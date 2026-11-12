import {
  GP_DNF_SEC,
  GP_LAPS,
  GP_MAX_PLAYERS,
  GP_MIN_LAP_SEC,
  GP_PHYSICS_DEFAULT,
  GP_QUALI_MAX_SEC,
  GP_ROOM_GRID_MS,
  GP_ROOM_LIGHTS_MS,
  GP_ROOM_MAX_RACE_SEC,
  GP_ROOM_QUALI_COUNT_MS,
  GP_ROOM_STALL_MS,
  gpGridOrder,
  gpIsPhysicsMode,
  gpLightsHold,
  gpTrack,
  gpValidRoomCar,
  gpBotCar,
  GP_BOT_NAMES,
  GP_BOT_LEVELS,
  GP_FILL_OPTIONS,
  type GpBotLevel,
  type GpPhysicsMode,
  type GpRoomCar,
} from '@nocap/games';
import { ColorRoomEngine, RoomError, type EngineOptions, type FinalRow } from './color-room.engine';

/** Dois relatos de posição mais juntos que isto são ignorados. */
const MIN_POS_GAP_MS = 25;
/** Folga entre a soma das voltas relatadas e o tempo de chegada (ms). */
const FINISH_SLACK_MS = 1500;

export type FoxGpStage = 'quali' | 'grid' | 'race';

interface Racer {
  id: string;
  username: string;
  /** Bot da sala (12.4): simulado pelo líder, não segura o fim da corrida. */
  bot?: boolean;
  slot: number;
  qualiMs: number | null;
  /** Hora (ms de jogo da classificação) em que marcou o tempo: desempata o grid. */
  qualiAt: number | null;
  laps: number[];
  best: number | null;
  finishMs: number | null;
  prog: number;
  gone: boolean;
  lastPosAt: number;
  /** [x, z, h, velocidade, progresso, flags, vácuo, pneu, volante]. */
  pos: number[] | null;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * O Fox GP em sala (specs 078, 079 e 080). A regra "Física" (Arcade ou Realista) é da sala inteira e só o líder muda:
 * todos correm no mesmo modo, porque o aparelho do líder simula todos os carros. O aparelho do LÍDER simula todos os carros (autoridade: batidas iguais para todos),
 * conectado aos outros por WebRTC; quando a conexão direta não sai, a sala só repassa as entradas (`grin`) e os estados
 * (`grsnap`, `grev`) entre eles. A sala é o relógio e o juiz: hora da classificação e da largada, tempos de classificação
 * e grid, voltas e chegada (que o líder relata por todos), regra dos 30 s, quem saiu (DNF) e o fim. Sem ranking nem
 * histórico. Quem entra com a corrida andando espera a próxima, assistindo pelo fluxo `pos`.
 */
const hex6 = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export class FoxGpRoomEngine extends ColorRoomEngine {
  /** Tempos da partida (ms). Os testes com servidor de verdade encurtam para não esperar uma corrida inteira. */
  static timing = {
    countMs: GP_ROOM_QUALI_COUNT_MS,
    qualiMaxMs: GP_QUALI_MAX_SEC * 1000,
    gridMs: GP_ROOM_GRID_MS + GP_ROOM_LIGHTS_MS,
    minLapMs: GP_MIN_LAP_SEC * 1000,
    dnfMs: GP_DNF_SEC * 1000,
  };
  /** Sorteio da espera das luzes (os testes trocam por um fixo). */
  static rand: () => number = Math.random;
  override readonly game = 'foxgp' as const;
  override readonly persistable = false;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['classico'];

  /** O carro de cada um (pelo e as pinturas do F1 e do kart), da garagem do aparelho. Cores repetidas são normais. */
  private paints = new Map<string, GpRoomCar>();
  private racers = new Map<string, Racer>();
  private stage: FoxGpStage = 'quali';
  /** Hora (relógio do jogo da sala, ms) em que a classificação começa e em que as luzes apagam. */
  private qualiAt = 0;
  private raceAt = 0;
  private grid: string[] = [];
  /** Espera sorteada com as 5 luzes acesas antes de apagar (ms): todos largam juntos. */
  private holdMs = 0;
  /** Hora (relógio do jogo, ms) em que o primeiro cruzou a linha. */
  private firstFinishAt: number | null = null;
  /** Quem simula a partida (o líder quando ela começou). */
  private simHost: string | null = null;
  private dirty = false;
  private readonly lapLength = gpTrack().length;

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: GP_MAX_PLAYERS });
    this.mode = 'classico';
    this.settings = { rounds: 1, physics: GP_PHYSICS_DEFAULT, fill: 0, botLevel: 'medio' } as unknown as typeof this.settings;
  }

  protected override validSettings(merged: Record<string, unknown>, mode: string): boolean {
    const fill = merged.fill ?? 0;
    const level = merged.botLevel ?? 'medio';
    return (
      mode === 'classico' &&
      gpIsPhysicsMode(merged.physics) &&
      GP_FILL_OPTIONS.includes(fill as number) &&
      GP_BOT_LEVELS.includes(level as GpBotLevel)
    );
  }

  /** O modo de física da sala. */
  get physics(): GpPhysicsMode {
    const v = (this.settings as unknown as { physics?: unknown }).physics;
    return gpIsPhysicsMode(v) ? v : GP_PHYSICS_DEFAULT;
  }

  /** Total de carros com bots (0 = só gente) e a dificuldade (spec 081, 12.4). */
  get fill(): number {
    const v = (this.settings as unknown as { fill?: unknown }).fill;
    return GP_FILL_OPTIONS.includes(v as number) ? (v as number) : 0;
  }
  get botLevel(): GpBotLevel {
    const v = (this.settings as unknown as { botLevel?: unknown }).botLevel;
    return GP_BOT_LEVELS.includes(v as GpBotLevel) ? (v as GpBotLevel) : 'medio';
  }
  /** Quantos bots entram agora: o total escolhido menos as pessoas, nunca passando de 12. */
  private botCount(people: number): number {
    return this.fill === 0 ? 0 : Math.max(0, Math.min(GP_MAX_PLAYERS, this.fill) - people);
  }

  // ---- pessoas, cores e pintura (a garagem) ----

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
    this.dirty = true;
  }

  /**
   * Não há mais escolha de cor (spec 081, Fase 8): cada um entra com o carro da própria garagem. A mensagem `color`
   * de aparelhos antigos é ignorada.
   */
  setColor(_id: string, _hex: string) {
    /* sem cor no Fox GP */
  }

  clearColor(_id: string) {
    /* sem cor no Fox GP */
  }

  /** O carro de quem está na sala: pelo e as duas pinturas, só das listas fechadas (o resto é recusado). */
  setPaint(id: string, v: unknown) {
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    const car = gpValidRoomCar(v);
    if (!car) throw new RoomError('Pintura inválida');
    this.paints.set(id, car);
    this.dirty = true;
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
    this.simHost = this.hostId;
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
        prog: 0,
        gone: false,
        lastPosAt: this.qualiAt,
        pos: null,
      }),
    );
    // os bots completam a sala até o total escolhido (o líder simula; aqui só têm vaga, nome e pintura)
    for (let k = 0; k < this.botCount(ordered.length); k++) {
      const id = `bot:${k}`;
      this.racers.set(id, {
        id,
        username: GP_BOT_NAMES[k % GP_BOT_NAMES.length]!,
        bot: true,
        slot: ordered.length + k,
        qualiMs: null,
        qualiAt: null,
        laps: [],
        best: null,
        finishMs: null,
        prog: 0,
        gone: false,
        lastPosAt: this.qualiAt,
        pos: null,
      });
    }
    this.phase = 'show';
    this.phaseEndsAt = this.qualiAt;
  }

  /** Quem simula a partida agora (o líder quando ela começou). */
  get simHostId(): string | null {
    return this.simHost;
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

  /** De quem é o relato: quem simula pode relatar por qualquer piloto (`id` na mensagem); os outros só por si. */
  private target(sender: string, v: unknown): Racer | undefined {
    const m = v as { id?: unknown } | null;
    const id = sender === this.simHost && m && typeof m.id === 'string' ? m.id : sender;
    const r = this.racers.get(id);
    return r && !r.gone ? r : undefined;
  }

  /** Posição de um carro (~10 por segundo): `[x, z, h, velocidade, progresso, flags, vácuo, pneu, volante]`. */
  report(sender: string, v: unknown, forId?: string): void {
    if (!this.driving) return;
    const id = forId !== undefined && sender === this.simHost ? forId : sender;
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

  /** Posições de todos de uma vez, mandadas por quem simula: linhas `[vaga, ...posição]`. */
  reportAll(sender: string, rows: unknown): void {
    if (sender !== this.simHost || !Array.isArray(rows)) return;
    const bySlot = new Map([...this.racers.values()].map((r) => [r.slot, r.id]));
    for (const row of rows.slice(0, GP_MAX_PLAYERS)) {
      if (!Array.isArray(row) || row.length !== 10 || !Number.isInteger(row[0])) continue;
      const id = bySlot.get(row[0] as number);
      if (id) this.report(sender, row.slice(1), id);
    }
  }

  /** Tempo da volta de classificação (ms). Vale uma vez, dentro do tempo da sessão. */
  qualiTime(sender: string, v: unknown): void {
    if (this.phase !== 'play' || this.stage !== 'quali') return;
    const r = this.target(sender, v);
    const ms = (v as { ms?: unknown } | null)?.ms;
    if (!r || r.qualiMs !== null || !finite(ms)) return;
    const now = this.stageMs();
    if (ms < FoxGpRoomEngine.timing.minLapMs || ms > now + 500) return;
    r.qualiMs = Math.round(ms);
    r.qualiAt = now;
    this.dirty = true;
  }

  /** Uma volta da corrida (para a volta mais rápida de quem não chegar a terminar). */
  lap(sender: string, v: unknown): void {
    if (!this.driving || this.stage !== 'race') return;
    const r = this.target(sender, v);
    const m = v as { lap?: unknown; ms?: unknown } | null;
    if (!r || r.finishMs !== null || !m || !Number.isInteger(m.lap) || !finite(m.ms)) return;
    const lap = m.lap as number;
    if (lap !== r.laps.length + 1 || lap > GP_LAPS || m.ms < FoxGpRoomEngine.timing.minLapMs) return;
    r.laps.push(Math.round(m.ms));
    if (r.best === null || m.ms < r.best) r.best = Math.round(m.ms);
    this.dirty = true;
  }

  /** Cruzou a linha de chegada: hora (ms desde as luzes) e as voltas. */
  finishLine(sender: string, v: unknown): void {
    if (!this.driving || this.stage !== 'race') return;
    const r = this.target(sender, v);
    const m = v as { ms?: unknown; laps?: unknown } | null;
    if (!r || r.finishMs !== null || !m || !finite(m.ms) || !Array.isArray(m.laps)) return;
    const laps = m.laps as unknown[];
    if (laps.length !== GP_LAPS || !laps.every((l) => finite(l) && l >= FoxGpRoomEngine.timing.minLapMs))
      return;
    const sum = (laps as number[]).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - m.ms) > FINISH_SLACK_MS || m.ms > this.stageMs() + 2000) return;
    r.laps = (laps as number[]).map((l) => Math.round(l));
    r.best = Math.min(...r.laps);
    r.finishMs = Math.round(m.ms);
    r.prog = GP_LAPS * this.lapLength;
    if (this.firstFinishAt === null) this.firstFinishAt = this.gnow();
    this.dirty = true;
  }

  private kill(id: string) {
    const r = this.racers.get(id);
    if (!r || r.gone || r.finishMs !== null) return;
    r.gone = true;
    this.dirty = true;
  }

  override leave(id: string) {

    this.paints.delete(id);
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
    this.simHost = null;
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
    // quem simula saiu: sem ele não há partida (como no Fut Fox ponto a ponto)
    const host = this.simHost ? this.members.get(this.simHost) : undefined;
    if (!host || !host.connected) {
      this.finish();
      return true;
    }
    const live = [...this.racers.values()].filter((r) => !r.gone);
    if (this.stage === 'quali') {
      const done =
        t - this.qualiAt >= FoxGpRoomEngine.timing.qualiMaxMs ||
        live.every((r) => r.qualiMs !== null || r.bot || !this.members.get(r.id)?.connected);
      if (done) {
        this.grid = gpGridOrder(
          [...this.racers.values()]
            .filter((r) => !r.gone)
            .map((r) => ({ id: r.id, slot: r.slot, ms: r.qualiMs, at: r.qualiAt })),
        );
        this.stage = 'grid';
        // a espera com as luzes acesas é sorteada aqui, uma vez, para todos largarem juntos
        this.holdMs = Math.round(gpLightsHold(FoxGpRoomEngine.rand()) * 1000);
        this.raceAt = t + FoxGpRoomEngine.timing.gridMs + this.holdMs;
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
    // corrida: quem sumiu está fora; sem relato de posição por muito tempo (o líder relata por todos) também
    for (const r of live) {
      const m = this.members.get(r.id);
      if ((m && !m.connected) || (r.finishMs === null && t - r.lastPosAt > GP_ROOM_STALL_MS))
        this.kill(r.id);
    }
    // bots não seguram o fim: termina quando todas as pessoas terminam (ou saem)
    const still = [...this.racers.values()].filter((r) => !r.gone && !r.bot);
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
      if (r.gone) gone.push(r.id);
    }
    const final = this.phase === 'final';
    return {
      foxgp: {
        me: viewerId ?? null,
        host: started ? this.simHost : null,
        stage: started ? this.stage : null,
        qualiAt: started ? this.qualiAt : null,
        raceAt: started && this.stage !== 'quali' ? this.raceAt : null,
        holdMs: started && this.stage !== 'quali' ? this.holdMs : null,
        physics: this.physics,
        slots: started ? slots : {},
        // a cor de cada um (o pelo), para a barra da classificação e a lista; sem carro ainda, laranja
        colors: Object.fromEntries(
          [...this.members.keys()].map((id) => [id, hex6(this.paints.get(id)?.fur ?? 0xff7d26)]),
        ),
        paints: {
          ...Object.fromEntries(this.paints),
          ...Object.fromEntries(
            [...this.racers.values()].filter((r) => r.bot).map((r) => [r.id, gpBotCar(Number(r.id.slice(4)))]),
          ),
        },
        bots: [...this.racers.values()].filter((r) => r.bot).map((r) => ({ id: r.id, name: r.username })),
        fill: this.fill,
        botLevel: this.botLevel,
        quali: started ? quali : {},
        grid: this.grid,
        finish,
        best,
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
