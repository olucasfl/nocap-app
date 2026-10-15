import {
  ATR_MAX_TICKS,
  ATR_ROOM_COLORS,
  ATR_ROOM_COUNTDOWN_MS,
  ATR_ROOM_MAX_PLAYERS,
  ATR_ROOM_SIZES,
  ATR_ROOM_SIZE_IDS,
  ATR_ROOM_TICK_SLACK,
  ATR_TPS,
  AtravessaMirror,
  AtravessaWorld,
  atravessaCheckpoints,
  atravessaRoomRules,
  atravessaTickAt,
  type AtravessaRoomMode,
  type AtravessaRoomSize,
} from '@nocap/games';
import {
  ColorRoomEngine,
  RoomError,
  type AnySettings,
  type AtravessaRoomSettings,
  type EngineOptions,
  type FinalRow,
} from './color-room.engine';

/** Quanto tempo a tela do placar da rodada (Infinito) fica antes da próxima. */
export const ATRAVESSA_REVEAL_MS = 8000;
/** Sem relato do aparelho por tanto tempo: o herói conta como parado (a rodada não espera por ele). */
export const ATRAVESSA_STALL_MS = 8000;
/** No Checkpoint, depois do primeiro a chegar os outros têm este tempo para terminar. */
export const ATRAVESSA_FINISH_GRACE_MS = 60_000;

const DEFAULT_ROUNDS = 3;

interface Run {
  mirror: AtravessaMirror;
  /** Quando chegou o último relato válido (relógio da sala, ms). */
  lastReportAt: number;
}

/** Posição de um herói no fluxo `pos`: [slot, tick, x, y, pulo, direção, flags, linha, mortes, checkpoint, tick do fim]. */
export type AtravessaPos = number[];
export const POS_ALIVE = 1;
export const POS_FINISHED = 2;
export const POS_STALLED = 4;

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * O Atravessa! em sala (spec 031). Todo mundo joga o MESMO mapa e começa junto, na hora marcada pelo
 * servidor; cada aparelho simula o seu herói e o servidor o espelha pelas entradas com tick
 * (`AtravessaMirror`), então a morte, a distância e a nota nunca saem de uma posição enviada. Os
 * heróis não colidem entre si. Dois modos:
 * - `infinito`: rodadas (o líder escolhe), sem checkpoint e sem escuridão; quem morre assiste. Vale a
 *   soma dos metros de cada rodada. Quem fica parado 12 s é engolido, senão a rodada nunca acabaria.
 * - `checkpoint`: corrida até o fim de um mapa de 100 a 1000 m; quem morre volta ao último checkpoint.
 */
export class AtravessaRoomEngine extends ColorRoomEngine {
  override readonly game = 'atravessa' as const;
  override readonly persistable = false;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['infinito', 'checkpoint'];

  /** A cor de cada pessoa (fica entre uma partida e a revanche). */
  private colors = new Map<string, string>();
  private runs = new Map<string, Run>();
  /** A posição de cada pessoa nesta rodada (índice estável nos relatos `pos`). */
  private slots = new Map<string, number>();
  private world: AtravessaWorld | null = null;
  /** Hora da largada (relógio da sala, ms). */
  private startAt = 0;
  private finishDeadline: number | null = null;
  private forceEnd = false;
  /** Infinito: metros de cada pessoa em cada rodada já jogada. */
  private roundMeters: Record<string, number>[] = [];

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: ATR_ROOM_MAX_PLAYERS });
    this.mode = 'infinito';
    this.settings = { rounds: DEFAULT_ROUNDS, size: 'medio' } satisfies AtravessaRoomSettings;
  }

  private get cfg(): AtravessaRoomSettings {
    return this.settings as AtravessaRoomSettings;
  }

  private get roomMode(): AtravessaRoomMode {
    return this.mode as AtravessaRoomMode;
  }

  /** Metros do mapa do Checkpoint (null no Infinito). */
  private get length(): number | null {
    return this.roomMode === 'checkpoint' ? ATR_ROOM_SIZES[this.cfg.size] : null;
  }

  // ---- regras ----

  protected override settingsForMode(mode: string, current: AnySettings): AnySettings {
    const size = (current as AtravessaRoomSettings).size ?? 'medio';
    if (mode === 'checkpoint') return { rounds: 1, size };
    const rounds = (current as AtravessaRoomSettings).rounds;
    return { rounds: this.roomMode === 'infinito' && rounds > 1 ? rounds : DEFAULT_ROUNDS, size };
  }

  protected override validSettings(merged: Record<string, unknown>, mode: string): boolean {
    const m = merged as unknown as AtravessaRoomSettings;
    if (!ATR_ROOM_SIZE_IDS.includes(m.size)) return false;
    if (mode === 'checkpoint') return m.rounds === 1;
    return mode === 'infinito' && Number.isInteger(m.rounds) && m.rounds >= 1 && m.rounds <= 10;
  }

  /** Durante a largada e a corrida ninguém digita: o celular é todo da partida. */
  protected override chatOpen(): boolean {
    return this.phase !== 'show' && this.phase !== 'play';
  }

  // ---- pessoas e cores ----

  override join(id: string, username: string) {
    super.join(id, username);
    if (!this.colors.has(id)) {
      const taken = new Set(this.colors.values());
      this.colors.set(id, (ATR_ROOM_COLORS.find((c) => !taken.has(c.hex)) ?? ATR_ROOM_COLORS[0]!).hex);
    }
  }

  override leave(id: string) {
    this.colors.delete(id);
    this.runs.delete(id);
    this.slots.delete(id);
    super.leave(id);
  }

  /** Escolhe a cor da raposa no lobby: nenhuma cor é de duas pessoas. */
  setColor(id: string, hex: string) {
    this.requirePhase('lobby');
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    if (!ATR_ROOM_COLORS.some((c) => c.hex === hex)) throw new RoomError('Cor inválida');
    for (const [other, taken] of this.colors) {
      if (other !== id && taken === hex) throw new RoomError('Essa cor já é de outra pessoa');
    }
    this.colors.set(id, hex);
    this.members.get(id)!.ready = false;
  }

  // ---- a partida ----

  /** A seed de cada rodada do Infinito é outra; o mapa é o mesmo para todos dentro da rodada. */
  private roundSeed(): string {
    return `${this.seed}:r${this.roundIndex}`;
  }

  protected override publicSeed(): string {
    return this.roundSeed();
  }

  override start(id: string) {
    this.roundMeters = [];
    super.start(id);
  }

  protected override beginRound() {
    this.roundIndex += 1;
    this.rounds[this.roundIndex] = {};
    this.locked = new Set();
    this.forceEnd = false;
    this.finishDeadline = null;
    const seed = this.roundSeed();
    this.world = new AtravessaWorld(seed);
    this.startAt = this.now() + ATR_ROOM_COUNTDOWN_MS;
    this.runs.clear();
    this.slots.clear();
    const ordered = [...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    ordered.forEach((m, i) => {
      this.slots.set(m.id, i);
      this.runs.set(m.id, {
        mirror: new AtravessaMirror(seed, atravessaRoomRules(this.roomMode, this.cfg.size, i), this.world!),
        lastReportAt: this.startAt,
      });
    });
    this.phase = 'show';
    this.phaseEndsAt = this.startAt;
  }

  /**
   * O relato de um aparelho: "estou no tick T e estes são os passos a partir do número N". Relato
   * inválido é ignorado. Devolve quantos passos o servidor já aceitou (o aparelho reenvia o resto),
   * ou `null` se o relato não valeu.
   */
  report(id: string, tick: unknown, inputs: unknown, from: unknown): number | null {
    const t = this.now();
    // a largada tem hora marcada: o primeiro relato pode chegar antes de a sala virar de fase
    const racing = this.phase === 'play' || (this.phase === 'show' && t >= this.startAt);
    if (!racing) return null;
    const run = this.runs.get(id);
    if (!run) return null;
    const limit = atravessaTickAt(t, this.startAt) + ATR_ROOM_TICK_SLACK;
    if (!run.mirror.report(tick, inputs, limit, from)) return null;
    run.lastReportAt = t;
    return run.mirror.acceptedCount;
  }

  /** O líder encerra a rodada (ou a corrida) antes de todos terminarem. */
  endRound(id: string) {
    this.requireHost(id);
    this.requirePhase('play');
    this.forceEnd = true;
  }

  private stalled(run: Run, t: number) {
    return t - run.lastReportAt > ATRAVESSA_STALL_MS;
  }

  /** O herói não vai mais mudar nesta rodada (morreu de vez, chegou ao fim, ou sumiu). */
  private done(run: Run, t: number) {
    const sim = run.mirror.sim;
    return sim.finished || (this.roomMode === 'infinito' && !sim.alive) || this.stalled(run, t);
  }

  private roundOver(t: number): boolean {
    if (this.forceEnd || atravessaTickAt(t, this.startAt) >= ATR_MAX_TICKS) return true;
    if (this.runs.size === 0) return true;
    if (this.finishDeadline !== null && t >= this.finishDeadline) return true;
    for (const run of this.runs.values()) if (!this.done(run, t)) return false;
    return true;
  }

  override tick(): boolean {
    const t = this.now();
    if (this.phase === 'show') {
      if (t < this.startAt) return false;
      this.phase = 'play';
      this.phaseEndsAt = null;
      return true;
    }
    if (this.phase === 'play') {
      let changed = false;
      // o primeiro a chegar abre o prazo dos outros
      if (this.finishDeadline === null && [...this.runs.values()].some((r) => r.mirror.sim.finished)) {
        this.finishDeadline = t + ATRAVESSA_FINISH_GRACE_MS;
        changed = true;
      }
      if (this.roundOver(t)) {
        this.closeRound();
        return true;
      }
      return changed;
    }
    if (this.phase === 'reveal') {
      if (this.phaseEndsAt === null || t < this.phaseEndsAt) return false;
      this.finishReveal();
      return true;
    }
    return false;
  }

  private closeRound() {
    if (this.roomMode === 'infinito') {
      const meters: Record<string, number> = {};
      for (const [id, run] of this.runs) meters[id] = run.mirror.sim.best;
      this.roundMeters[this.roundIndex] = meters;
    }
    if (this.roundIndex + 1 >= this.cfg.rounds) {
      this.phase = 'final';
      this.phaseEndsAt = null;
    } else {
      this.phase = 'reveal';
      this.phaseEndsAt = this.now() + ATRAVESSA_REVEAL_MS;
    }
  }

  /** Alguém saiu ou caiu no meio da corrida: quem decide se acabou é o `tick`. */
  protected override maybeAdvanceFromPick() {}

  protected override toReveal() {
    this.closeRound();
  }

  protected override reset() {
    super.reset();
    this.runs.clear();
    this.slots.clear();
    this.world = null;
    this.forceEnd = false;
    this.finishDeadline = null;
    this.roundMeters = [];
  }

  // ---- o que cada aparelho enxerga ----

  /** Estado dos heróis no fluxo `pos` (10 por segundo durante a corrida). */
  positions(): AtravessaPos[] {
    const t = this.now();
    const out: AtravessaPos[] = [];
    for (const [id, run] of this.runs) {
      const sim = run.mirror.sim;
      const v = sim.view();
      let flags = 0;
      if (v.alive) flags |= POS_ALIVE;
      if (v.finished) flags |= POS_FINISHED;
      if (!v.finished && this.stalled(run, t)) flags |= POS_STALLED;
      out.push([
        this.slots.get(id) ?? 0,
        v.tick,
        r2(v.x),
        r2(v.y),
        r2(v.hop),
        v.facing,
        flags,
        v.score,
        v.deaths,
        v.checkpoint,
        v.finished ? sim.finishTick : 0,
      ]);
    }
    return out;
  }

  /** Metros de cada pessoa somados nas rodadas já jogadas (Infinito). */
  private totalMeters(id: string): number {
    return this.roundMeters.reduce((sum, r) => sum + (r[id] ?? 0), 0);
  }

  private allTotals(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const m of this.members.values()) out[m.id] = this.totalMeters(m.id);
    return out;
  }

  /** Classificação final. Infinito: mais metros somados. Checkpoint: quem chegou, por tempo; depois por distância. */
  override finalRows(): FinalRow[] {
    const people = [...this.members.values()];
    const key = (id: string): number[] => {
      if (this.roomMode === 'infinito') return [-this.totalMeters(id)];
      const sim = this.runs.get(id)?.mirror.sim;
      if (!sim) return [2, 0, 0];
      if (sim.finished) return [0, sim.finishTick, 0];
      return [1, -sim.best, sim.deaths];
    };
    const cmp = (a: number[], b: number[]) => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const d = (a[i] ?? 0) - (b[i] ?? 0);
        if (d !== 0) return d;
      }
      return 0;
    };
    const rows = people
      .map((m) => ({ m, k: key(m.id) }))
      .sort((a, b) => cmp(a.k, b.k) || a.m.joinedAt - b.m.joinedAt);
    let placement = 0;
    return rows.map((r, i) => {
      if (i === 0 || cmp(r.k, rows[i - 1]!.k) !== 0) placement = i + 1;
      const meters =
        this.roomMode === 'infinito' ? this.totalMeters(r.m.id) : (this.runs.get(r.m.id)?.mirror.sim.best ?? 0);
      return {
        userId: r.m.id,
        username: r.m.username,
        totalTenths: meters * 10,
        placement,
        answers: [],
      };
    });
  }

  /** O resultado de cada um para o pódio: metros, tempo de chegada (Checkpoint) e mortes. */
  private results() {
    const out: Record<string, { meters: number; ms: number | null; deaths: number; finished: boolean }> = {};
    for (const m of this.members.values()) {
      const sim = this.runs.get(m.id)?.mirror.sim;
      out[m.id] = {
        meters: this.roomMode === 'infinito' ? this.totalMeters(m.id) : (sim?.best ?? 0),
        ms: sim?.finished ? Math.round((sim.finishTick * 1000) / ATR_TPS) : null,
        deaths: sim?.deaths ?? 0,
        finished: !!sim?.finished,
      };
    }
    return out;
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    const length = this.length;
    const started = this.phase !== 'lobby';
    const showTotals = this.phase === 'reveal' || this.phase === 'final';
    const colors: Record<string, string> = {};
    for (const [id, hex] of this.colors) colors[id] = hex;
    const slots: Record<string, number> = {};
    for (const [id, i] of this.slots) slots[id] = i;
    return {
      atravessa: {
        /** Quem está vendo (convidado não tem id de conta no aparelho). */
        me: viewerId ?? null,
        mode: this.roomMode,
        size: this.cfg.size,
        length,
        checkpoints: length ? atravessaCheckpoints(length) : [],
        colors,
        startAt: started ? this.startAt : null,
        slots: started ? slots : {},
        /** Checkpoint: quando a corrida acaba para quem ainda não chegou (depois do primeiro a chegar). */
        endsAt: this.finishDeadline,
        /** Placar da rodada e soma até agora (no placar da rodada e no pódio). */
        roundMeters: showTotals ? (this.roundMeters[this.roundIndex] ?? {}) : null,
        totals: showTotals && this.roomMode === 'infinito' ? this.allTotals() : null,
        results: this.phase === 'final' ? this.results() : null,
      },
    };
  }
}
