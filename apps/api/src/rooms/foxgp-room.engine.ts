import {
  ATR_ROOM_COLORS,
  GP_DNF_SEC,
  GP_LAPS,
  GP_MAX_PLAYERS,
  GP_MIN_LAP_SEC,
  GP_QUALI_MAX_SEC,
  GP_ROOM_GRID_MS,
  GP_ROOM_LIGHTS_MS,
  GP_ROOM_MAX_RACE_SEC,
  GP_ROOM_QUALI_COUNT_MS,
  GP_ROOM_STALL_MS,
  gpGridOrder,
  gpTrack,
} from '@nocap/games';
import { ColorRoomEngine, RoomError, type EngineOptions, type FinalRow } from './color-room.engine';

/** Dois relatos de posição da mesma pessoa mais juntos que isto são ignorados. */
const MIN_POS_GAP_MS = 25;
/** Folga entre a soma das voltas relatadas e o tempo de chegada (ms). */
const FINISH_SLACK_MS = 1500;

export type FoxGpStage = 'quali' | 'grid' | 'race';

interface Racer {
  id: string;
  username: string;
  slot: number;
  qualiMs: number | null;
  /** Hora (ms de jogo da classificação) em que marcou o tempo: desempata o grid. */
  qualiAt: number | null;
  laps: number[];
  best: number | null;
  finishMs: number | null;
  passes: number;
  prog: number;
  gone: boolean;
  lastPosAt: number;
  /** [x, z, h, velocidade, progresso, flags, vácuo, pneu, volante]. */
  pos: number[] | null;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * O Fox GP em sala (spec 078). Cada aparelho simula só o PRÓPRIO carro (a pista sai da seed, que aqui nem precisa: só há
 * uma) e relata a posição; a sala decide o que precisa ser igual para todos: a hora da classificação e da largada, os tempos
 * de classificação e o grid, quem terminou e quando, a regra dos 30 s, quem saiu (DNF) e o fim. Não grava ranking nem
 * histórico. Quem entra com a corrida andando espera a próxima, assistindo.
 */
export class FoxGpRoomEngine extends ColorRoomEngine {
  /** Tempos da partida (ms). Os testes com servidor de verdade encurtam para não esperar uma corrida inteira. */
  static timing = {
    countMs: GP_ROOM_QUALI_COUNT_MS,
    qualiMaxMs: GP_QUALI_MAX_SEC * 1000,
    gridMs: GP_ROOM_GRID_MS + GP_ROOM_LIGHTS_MS,
    minLapMs: GP_MIN_LAP_SEC * 1000,
    dnfMs: GP_DNF_SEC * 1000,
  };
  override readonly game = 'foxgp' as const;
  override readonly persistable = false;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['classico'];

  private colors = new Map<string, string>();
  private racers = new Map<string, Racer>();
  private stage: FoxGpStage = 'quali';
  /** Hora (relógio do jogo da sala, ms) em que a classificação começa e em que as luzes apagam. */
  private qualiAt = 0;
  private raceAt = 0;
  private grid: string[] = [];
  /** Hora (relógio do jogo, ms) em que o primeiro cruzou a linha. */
  private firstFinishAt: number | null = null;
  private dirty = false;
  private readonly lapLength = gpTrack().length;

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: GP_MAX_PLAYERS });
    this.mode = 'classico';
    this.settings = { rounds: 1 };
  }

  protected override validSettings(_merged: Record<string, unknown>, mode: string): boolean {
    return mode === 'classico';
  }

  // ---- pessoas e cores (a "Garagem") ----

  private giveColor(id: string) {
    if (this.colors.has(id)) return;
    const taken = new Set(this.colors.values());
    this.colors.set(id, (ATR_ROOM_COLORS.find((c) => !taken.has(c.hex)) ?? ATR_ROOM_COLORS[0]!).hex);
  }

  /** Quem entra com a corrida andando entra como espectador e joga a próxima (decisão de 10/11/2026). */
  override get joinableInPlay(): boolean {
    return true;
  }

  override join(id: string, username: string) {
    const existing = this.members.get(id);
    if (existing || this.phase === 'lobby') {
      super.join(id, username);
    } else {
      if (this.members.size >= this.maxPlayers) throw new RoomError('A sala está cheia');
      this.members.set(id, { id, username, connected: true, ready: false, joinedAt: this.now() });
      this.ensureHost();
    }
    this.giveColor(id);
    this.dirty = true;
  }

  /** Trocou para o Fox GP numa sala do Fox Cap!: cada um já chega com uma cor livre (dá para trocar no lobby). */
  override adoptFrom(other: ColorRoomEngine) {
    super.adoptFrom(other);
    for (const id of [...this.members.keys()]) this.giveColor(id);
  }

  /** Escolhe a cor do pelo (e da pintura) no lobby: nenhuma cor é de duas pessoas. */
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

  clearColor(id: string) {
    this.requirePhase('lobby');
    const m = this.members.get(id);
    if (!m) throw new RoomError('Você não está na sala');
    this.colors.delete(id);
    m.ready = false;
  }

  override setReady(id: string, ready: boolean) {
    if (ready && this.members.has(id) && !this.colors.has(id))
      throw new RoomError('Escolha a sua cor');
    super.setReady(id, ready);
  }

  override start(id: string) {
    const without = [...this.members.values()].filter((m) => m.connected && !this.colors.has(m.id));
    if (this.phase === 'lobby' && without.length > 0) {
      throw new RoomError(
        without.length === 1
          ? `${without[0]!.username} ainda não escolheu a cor`
          : 'Todo mundo precisa escolher uma cor',
      );
    }
    super.start(id);
  }

  // ---- partida ----

  protected override publicSeed(): string {
    return this.seed;
  }

  protected override beginRound() {
    this.roundIndex = 0;
    this.rounds[0] = {};
    this.resetPause();
    this.racers.clear();
    this.grid = [];
    this.firstFinishAt = null;
    this.stage = 'quali';
    this.qualiAt = this.now() + FoxGpRoomEngine.timing.countMs;
    this.raceAt = 0;
    const ordered = [...this.members.values()]
      .filter((m) => m.connected)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    ordered.forEach((m, slot) =>
      this.racers.set(m.id, {
        id: m.id,
        username: m.username,
        slot,
        qualiMs: null,
        qualiAt: null,
        laps: [],
        best: null,
        finishMs: null,
        passes: 0,
        prog: 0,
        gone: false,
        lastPosAt: this.qualiAt,
        pos: null,
      }),
    );
    this.phase = 'show';
    this.phaseEndsAt = this.qualiAt;
  }

  /** Relógio da fase de agora (ms): na classificação, desde que ela começou; na corrida, desde que as luzes apagaram. */
  private stageMs(): number {
    return this.gnow() - (this.stage === 'race' ? this.raceAt : this.qualiAt);
  }

  private get driving(): boolean {
    return (
      this.phase === 'play' &&
      ((this.stage === 'quali' && this.gnow() >= this.qualiAt) ||
        (this.stage === 'race' && this.gnow() >= this.raceAt))
    );
  }

  /** O relato do próprio carro (~15 por segundo). Inválido é ignorado. */
  report(id: string, v: unknown): void {
    if (!this.driving) return;
    const r = this.racers.get(id);
    if (!r || r.gone || !Array.isArray(v) || v.length !== 9 || !v.every(finite)) return;
    const [x, z, h, speed, prog, flags, slip, wear, steer] = v as number[];
    if (Math.abs(x!) > 400 || Math.abs(z!) > 400 || Math.abs(speed!) > 60) return;
    const t = this.gnow();
    if (t - r.lastPosAt < MIN_POS_GAP_MS && r.pos) return;
    r.lastPosAt = t;
    // o progresso só vale na corrida e não pode correr mais que o carro aguenta
    if (this.stage === 'race') {
      const cap = ((t - this.raceAt) / 1000) * 45 + 10;
      r.prog = Math.min(prog!, cap, GP_LAPS * this.lapLength + 5);
    }
    r.pos = [
      r2(x!),
      r2(z!),
      r2(h!),
      r2(speed!),
      r2(r.prog),
      Math.trunc(flags!) & 7,
      r2(Math.max(0, Math.min(1, slip!))),
      r2(Math.max(0, Math.min(1, wear!))),
      r2(Math.max(-1, Math.min(1, steer!))),
    ];
  }

  /** Tempo da volta de classificação (ms). Vale uma vez, dentro do tempo da sessão. */
  qualiTime(id: string, v: unknown): void {
    if (this.phase !== 'play' || this.stage !== 'quali') return;
    const r = this.racers.get(id);
    const ms = (v as { ms?: unknown } | null)?.ms;
    if (!r || r.gone || r.qualiMs !== null || !finite(ms)) return;
    const now = this.stageMs();
    if (ms < FoxGpRoomEngine.timing.minLapMs || ms > now + 500) return;
    r.qualiMs = Math.round(ms);
    r.qualiAt = now;
    this.dirty = true;
  }

  /** Uma volta da corrida (para a volta mais rápida de quem não chegar a terminar). */
  lap(id: string, v: unknown): void {
    if (!this.driving || this.stage !== 'race') return;
    const r = this.racers.get(id);
    const m = v as { lap?: unknown; ms?: unknown } | null;
    if (!r || r.gone || r.finishMs !== null || !m || !Number.isInteger(m.lap) || !finite(m.ms)) return;
    const lap = m.lap as number;
    if (lap !== r.laps.length + 1 || lap > GP_LAPS || m.ms < FoxGpRoomEngine.timing.minLapMs) return;
    r.laps.push(Math.round(m.ms));
    if (r.best === null || m.ms < r.best) r.best = Math.round(m.ms);
    this.dirty = true;
  }

  /** "Cruzei a linha de chegada": hora (ms desde as luzes), as voltas e as ultrapassagens com o turbo. */
  finishLine(id: string, v: unknown): void {
    if (!this.driving || this.stage !== 'race') return;
    const r = this.racers.get(id);
    const m = v as { ms?: unknown; laps?: unknown; passes?: unknown } | null;
    if (!r || r.gone || r.finishMs !== null || !m || !finite(m.ms) || !Array.isArray(m.laps)) return;
    const laps = m.laps as unknown[];
    if (laps.length !== GP_LAPS || !laps.every((l) => finite(l) && l >= FoxGpRoomEngine.timing.minLapMs)) return;
    const sum = (laps as number[]).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - m.ms) > FINISH_SLACK_MS || m.ms > this.stageMs() + 2000) return;
    r.laps = (laps as number[]).map((l) => Math.round(l));
    r.best = Math.min(...r.laps);
    r.finishMs = Math.round(m.ms);
    r.prog = GP_LAPS * this.lapLength;
    r.passes = finite(m.passes) ? Math.max(0, Math.min(40, Math.trunc(m.passes))) : 0;
    if (this.firstFinishAt === null) this.firstFinishAt = this.gnow();
    this.dirty = true;
  }

  /** Ultrapassagens com o turbo de quem ainda corre (o pódio mostra mesmo para quem não terminou). */
  stats(id: string, v: unknown): void {
    const r = this.racers.get(id);
    const passes = (v as { passes?: unknown } | null)?.passes;
    if (!r || r.finishMs !== null || !finite(passes)) return;
    r.passes = Math.max(0, Math.min(40, Math.trunc(passes)));
  }

  private kill(id: string) {
    const r = this.racers.get(id);
    if (!r || r.gone || r.finishMs !== null) return;
    r.gone = true;
    this.dirty = true;
  }

  override leave(id: string) {
    this.colors.delete(id);
    if (this.phase === 'show' || this.phase === 'play') this.kill(id);
    super.leave(id);
  }

  override disconnect(id: string) {
    super.disconnect(id);
    // desconectou: o carro some e recebe DNF (na classificação fica sem tempo e larga no fim, se voltar)
    if (this.phase === 'play' && this.stage === 'race') this.kill(id);
  }

  protected override maybeAdvanceFromPick() {}

  protected override toReveal() {
    this.finish();
  }

  protected override reset() {
    super.reset();
    this.racers.clear();
    this.grid = [];
    this.firstFinishAt = null;
    this.stage = 'quali';
  }

  protected override pausable(): boolean {
    return true;
  }

  override tick(): boolean {
    const t = this.gnow();
    if (this.phase === 'show') {
      if (t < this.qualiAt) return this.flush();
      this.phase = 'play';
      this.phaseEndsAt = null;
      return true;
    }
    if (this.phase !== 'play') return this.flush();
    const live = [...this.racers.values()].filter((r) => !r.gone);
    if (this.stage === 'quali') {
      const done =
        t - this.qualiAt >= FoxGpRoomEngine.timing.qualiMaxMs ||
        live.every((r) => r.qualiMs !== null || !this.members.get(r.id)?.connected);
      if (done) {
        this.grid = gpGridOrder(
          [...this.racers.values()]
            .filter((r) => !r.gone)
            .map((r) => ({ id: r.id, slot: r.slot, ms: r.qualiMs, at: r.qualiAt })),
        );
        this.stage = 'grid';
        this.raceAt = t + FoxGpRoomEngine.timing.gridMs;
        for (const r of this.racers.values()) r.lastPosAt = this.raceAt;
        return true;
      }
      return this.flush();
    }
    if (this.stage === 'grid') {
      if (t < this.raceAt) return this.flush();
      this.stage = 'race';
      return true;
    }
    // corrida: quem sumiu ou parou de relatar (aba em segundo plano) está fora
    for (const r of live) {
      const m = this.members.get(r.id);
      if ((m && !m.connected) || (r.finishMs === null && t - r.lastPosAt > GP_ROOM_STALL_MS))
        this.kill(r.id);
    }
    const still = [...this.racers.values()].filter((r) => !r.gone);
    if (
      still.length === 0 ||
      still.every((r) => r.finishMs !== null) ||
      (this.firstFinishAt !== null && t - this.firstFinishAt >= FoxGpRoomEngine.timing.dnfMs) ||
      t - this.raceAt > GP_ROOM_MAX_RACE_SEC * 1000
    ) {
      this.finish();
      return true;
    }
    return this.flush();
  }

  private flush(): boolean {
    const d = this.dirty;
    this.dirty = false;
    return d;
  }

  /** O líder encerra a partida agora (quem não terminou fica DNF). */
  endNow(id: string) {
    this.requireHost(id);
    this.requirePhase('play');
    this.finish();
  }

  private finish() {
    this.phase = 'final';
    this.phaseEndsAt = null;
  }

  // ---- o que cada aparelho enxerga ----

  /** Posições para o fluxo `pos` (só de quem já relatou e ainda corre): [vaga, ...relato]. */
  positions(): number[][] {
    const out: number[][] = [];
    for (const r of this.racers.values()) if (!r.gone && r.pos) out.push([r.slot, ...r.pos]);
    return out;
  }

  /** Ordem final: quem terminou pela chegada; os outros (DNF) pela distância; quem saiu por último. */
  private ordered(): Racer[] {
    return [...this.racers.values()].sort((a, b) => {
      if (a.finishMs !== null && b.finishMs !== null) return a.finishMs - b.finishMs;
      if ((a.finishMs !== null) !== (b.finishMs !== null)) return a.finishMs !== null ? -1 : 1;
      if (a.gone !== b.gone) return a.gone ? 1 : -1;
      return b.prog - a.prog || a.slot - b.slot;
    });
  }

  override finalRows(): FinalRow[] {
    return this.ordered().map((r, i) => ({
      userId: r.id,
      username: r.username,
      totalTenths: 0,
      placement: i + 1,
      answers: [],
    }));
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    const started = this.phase !== 'lobby';
    const slots: Record<string, number> = {};
    const quali: Record<string, number | null> = {};
    const finish: Record<string, number> = {};
    const best: Record<string, number> = {};
    const passes: Record<string, number> = {};
    const gone: string[] = [];
    let fastest: { id: string; ms: number } | null = null;
    for (const r of this.racers.values()) {
      slots[r.id] = r.slot;
      quali[r.id] = r.qualiMs;
      if (r.finishMs !== null) finish[r.id] = r.finishMs;
      if (r.best !== null) {
        best[r.id] = r.best;
        if (!fastest || r.best < fastest.ms) fastest = { id: r.id, ms: r.best };
      }
      if (r.passes > 0) passes[r.id] = r.passes;
      if (r.gone) gone.push(r.id);
    }
    const final = this.phase === 'final';
    return {
      foxgp: {
        me: viewerId ?? null,
        stage: started ? this.stage : null,
        qualiAt: started ? this.qualiAt : null,
        raceAt: started && this.stage !== 'quali' ? this.raceAt : null,
        slots: started ? slots : {},
        colors: Object.fromEntries(this.colors),
        quali: started ? quali : {},
        grid: this.grid,
        finish,
        best,
        passes,
        gone,
        fastest,
        firstFinishAt: this.firstFinishAt,
        order: final ? this.ordered().map((r) => r.id) : null,
        dnf: final
          ? [...this.racers.values()].filter((r) => r.finishMs === null).map((r) => r.id)
          : [],
      },
    };
  }
}

export { RoomError };
