import { colorGame, type ColorSettings, type Hsb, type TimeSettings } from '@nocap/games';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const REVEAL_MS = 12_000;
/** Folga depois do tempo de exibição, para o app terminar a animação antes do recriar. */
export const SHOW_GRACE_MS = 800;

export interface RoomSettings extends ColorSettings {
  /** Tempo máximo para recriar a cor. */
  pickMs: number;
}

export const DEFAULT_SETTINGS: RoomSettings = { rounds: 5, showMs: 3000, pickMs: 30_000 };

/** Regras do Tempo na sala: a mesma faixa do clássico, o host escolhe rodadas e "sem estourar". */
export type TimeRoomSettings = TimeSettings;

export const DEFAULT_TIME_SETTINGS: TimeRoomSettings = {
  rounds: 3,
  minMs: 3000,
  maxMs: 18_000,
  noOvershoot: false,
  mix: 'alternate',
};

export type AnySettings = RoomSettings | TimeRoomSettings;

/** `play` é a fase de resposta do Tempo (cada um começa e para o seu relógio). */
export type Phase = 'lobby' | 'show' | 'pick' | 'play' | 'reveal' | 'final';

export class RoomError extends Error {}

interface Member {
  id: string;
  username: string;
  connected: boolean;
  ready: boolean;
  joinedAt: number;
}

interface RoundAnswer {
  /** Cor: o HSB travado. Tempo: a duração em ms medida pelo servidor. */
  answer: Hsb | number;
  /** 0 a 10, 1 casa. */
  score: number;
}

export interface EngineOptions {
  code: string;
  now: () => number;
  newSeed: () => string;
  maxPlayers?: number;
}

export interface FinalRow {
  userId: string;
  username: string;
  /** Soma das notas em décimos. */
  totalTenths: number;
  placement: number;
  /** Respostas por rodada (null = não respondeu). */
  answers: (Hsb | number | null)[];
}

/**
 * Regras da sala da Cor, sem rede nem relógio próprio: o Colyseus só entrega eventos e chama
 * `tick`. Tudo que importa (quem manda, quando avança, nota) é decidido aqui e é testável.
 */
export class ColorRoomEngine {
  readonly code: string;
  protected readonly now: () => number;
  protected readonly newSeed: () => string;
  protected readonly maxPlayers: number;
  /** Qual jogo esta sala joga; o `TimeRoomEngine` troca. */
  readonly game: 'color' | 'time' = 'color';
  /** Fase em que as pessoas respondem (a Cor trava um HSB; o Tempo, um relógio). */
  protected readonly answerPhase: Phase = 'pick';

  protected members = new Map<string, Member>();
  protected hostId: string | null = null;
  protected settings: AnySettings = { ...DEFAULT_SETTINGS };

  protected phase: Phase = 'lobby';
  protected seed = '';
  protected roundIndex = 0;
  protected phaseEndsAt: number | null = null;
  /** `rounds[i][memberId]` */
  protected rounds: Record<string, RoundAnswer>[] = [];
  protected locked = new Set<string>();

  constructor(opts: EngineOptions) {
    this.code = opts.code;
    this.now = opts.now;
    this.newSeed = opts.newSeed;
    this.maxPlayers = opts.maxPlayers ?? MAX_PLAYERS;
  }

  // ---- pessoas ----

  /** Entrar (ou voltar, se o id já existe). Só se entra novo no lobby. */
  join(id: string, username: string) {
    const existing = this.members.get(id);
    if (existing) {
      existing.connected = true;
      existing.username = username;
      this.ensureHost();
      return;
    }
    if (this.phase !== 'lobby') throw new RoomError('A partida já começou');
    if (this.members.size >= this.maxPlayers) throw new RoomError('A sala está cheia');
    this.members.set(id, { id, username, connected: true, ready: false, joinedAt: this.now() });
    this.ensureHost();
  }

  /** Caiu a conexão (pode voltar). Se era o host, outra pessoa assume. */
  disconnect(id: string) {
    const m = this.members.get(id);
    if (!m) return;
    m.connected = false;
    m.ready = false;
    this.ensureHost();
    this.maybeAdvanceFromPick();
  }

  /** Saiu de vez (ou foi expulso, ou a reconexão expirou). */
  leave(id: string) {
    this.members.delete(id);
    this.locked.delete(id);
    this.ensureHost();
    this.maybeAdvanceFromPick();
    // Sozinho no meio de uma partida não há o que disputar: volta ao lobby.
    if (this.phase !== 'lobby' && this.phase !== 'final' && this.members.size < 2) this.reset();
  }

  /** O host é sempre alguém conectado; sem ninguém conectado, ninguém. */
  private ensureHost() {
    const current = this.hostId ? this.members.get(this.hostId) : undefined;
    if (current?.connected) return;
    const next = [...this.members.values()]
      .filter((m) => m.connected)
      .sort((a, b) => a.joinedAt - b.joinedAt)[0];
    this.hostId = next?.id ?? null;
  }

  get isEmpty() {
    return this.members.size === 0;
  }

  get hasConnected() {
    return [...this.members.values()].some((m) => m.connected);
  }

  has(id: string) {
    return this.members.has(id);
  }

  // ---- lobby ----

  protected requireHost(id: string) {
    if (id !== this.hostId) throw new RoomError('Só quem criou a sala pode fazer isso');
  }

  protected requirePhase(...phases: Phase[]) {
    if (!phases.includes(this.phase)) throw new RoomError('Agora não dá para fazer isso');
  }

  setReady(id: string, ready: boolean) {
    this.requirePhase('lobby');
    const m = this.members.get(id);
    if (!m) throw new RoomError('Você não está na sala');
    m.ready = ready;
  }

  /** Regras aceitas para esta sala; o Tempo tem outras. */
  protected validSettings(merged: Record<string, unknown>): boolean {
    const m = merged as unknown as RoomSettings;
    return (
      Number.isInteger(m.rounds) &&
      m.rounds >= 1 &&
      m.rounds <= 10 &&
      Number.isInteger(m.showMs) &&
      m.showMs >= 100 &&
      m.showMs <= 10_000 &&
      Number.isInteger(m.pickMs) &&
      m.pickMs >= 10_000 &&
      m.pickMs <= 60_000
    );
  }

  configure(id: string, next: Partial<RoomSettings> | Partial<TimeRoomSettings>) {
    this.requireHost(id);
    this.requirePhase('lobby');
    const merged = { ...this.settings, ...next } as AnySettings;
    const ok = this.validSettings(merged as unknown as Record<string, unknown>);
    if (!ok) throw new RoomError('Regras inválidas');
    this.settings = merged;
    // Regra nova: todo mundo confirma de novo.
    for (const m of this.members.values()) m.ready = false;
  }

  kick(id: string, targetId: string): string {
    this.requireHost(id);
    this.requirePhase('lobby');
    if (targetId === id) throw new RoomError('Você não pode se expulsar');
    if (!this.members.has(targetId)) throw new RoomError('Essa pessoa não está na sala');
    this.leave(targetId);
    return targetId;
  }

  /** O host inicia quando há pelo menos 2 pessoas e todas as outras estão prontas. */
  start(id: string) {
    this.requireHost(id);
    this.requirePhase('lobby');
    const connected = [...this.members.values()].filter((m) => m.connected);
    if (connected.length < MIN_PLAYERS) {
      throw new RoomError(`São precisas ${MIN_PLAYERS} pessoas para começar`);
    }
    if (connected.some((m) => m.id !== this.hostId && !m.ready)) {
      throw new RoomError('Falta gente marcar "pronto"');
    }
    this.seed = this.newSeed();
    this.rounds = [];
    this.roundIndex = -1;
    this.beginRound();
  }

  // ---- partida ----

  protected beginRound() {
    this.roundIndex += 1;
    this.rounds[this.roundIndex] = {};
    this.locked = new Set();
    this.phase = 'show';
    this.phaseEndsAt = this.now() + (this.settings as RoomSettings).showMs + SHOW_GRACE_MS;
  }

  lock(id: string, answer: Hsb) {
    this.requirePhase('pick');
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    if (this.locked.has(id)) return;
    const valid =
      Number.isInteger(answer.h) &&
      answer.h >= 0 &&
      answer.h <= 360 &&
      Number.isInteger(answer.s) &&
      answer.s >= 0 &&
      answer.s <= 100 &&
      Number.isInteger(answer.b) &&
      answer.b >= 0 &&
      answer.b <= 100;
    if (!valid) throw new RoomError('Resposta inválida');
    const colorSettings = this.settings as RoomSettings;
    const target = colorGame.generateRound(this.seed, colorSettings, this.roundIndex);
    this.rounds[this.roundIndex]![id] = {
      answer,
      score: colorGame.score(target, answer, colorSettings),
    };
    this.locked.add(id);
    this.maybeAdvanceFromPick();
  }

  /** Revelação encerrada pelo host antes do tempo. */
  next(id: string) {
    this.requireHost(id);
    this.requirePhase('reveal');
    this.finishReveal();
  }

  rematch(id: string) {
    this.requireHost(id);
    this.requirePhase('final');
    this.reset();
  }

  protected reset() {
    this.phase = 'lobby';
    this.phaseEndsAt = null;
    this.rounds = [];
    this.locked = new Set();
    this.roundIndex = 0;
    for (const m of this.members.values()) m.ready = false;
  }

  protected maybeAdvanceFromPick() {
    if (this.phase !== this.answerPhase) return;
    const waiting = [...this.members.values()].filter((m) => m.connected && !this.locked.has(m.id));
    if (waiting.length === 0) this.toReveal();
  }

  protected toReveal() {
    // Quem não respondeu fica com 0 na rodada.
    this.phase = 'reveal';
    this.phaseEndsAt = this.now() + REVEAL_MS;
  }

  protected finishReveal() {
    if (this.roundIndex + 1 >= this.settings.rounds) {
      this.phase = 'final';
      this.phaseEndsAt = null;
    } else {
      this.beginRound();
    }
  }

  /** Chamar com frequência: avança as fases por tempo. Devolve `true` se algo mudou. */
  tick(): boolean {
    if (this.phaseEndsAt === null || this.now() < this.phaseEndsAt) return false;
    if (this.phase === 'show') {
      this.phase = 'pick';
      this.phaseEndsAt = this.now() + (this.settings as RoomSettings).pickMs;
      this.maybeAdvanceFromPick();
    } else if (this.phase === this.answerPhase) {
      this.toReveal();
    } else if (this.phase === 'reveal') {
      this.finishReveal();
    } else {
      return false;
    }
    return true;
  }

  // ---- resultado ----

  private totals() {
    return [...this.members.values()].map((m) => {
      const totalTenths = this.rounds.reduce(
        (sum, r) => sum + Math.round((r[m.id]?.score ?? 0) * 10),
        0,
      );
      return { member: m, totalTenths };
    });
  }

  /** Classificação final (empate divide a colocação). Só vale em `final`. */
  finalRows(): FinalRow[] {
    const rows = this.totals().sort(
      (a, b) => b.totalTenths - a.totalTenths || a.member.joinedAt - b.member.joinedAt,
    );
    let placement = 0;
    let prev: number | null = null;
    return rows.map((r, i) => {
      if (prev === null || r.totalTenths !== prev) placement = i + 1;
      prev = r.totalTenths;
      return {
        userId: r.member.id,
        username: r.member.username,
        totalTenths: r.totalTenths,
        placement,
        answers: this.rounds.map((round) => round[r.member.id]?.answer ?? null),
      };
    });
  }

  get currentPhase(): Phase {
    return this.phase;
  }

  get currentSettings(): AnySettings {
    return { ...this.settings };
  }

  get currentSeed(): string {
    return this.seed;
  }

  // ---- o que cada cliente enxerga ----

  /** Estado enviado aos clientes. Respostas dos outros só aparecem na revelação e no pódio. */
  snapshot() {
    const revealed = this.phase === 'reveal' || this.phase === 'final';
    const round = this.rounds[this.roundIndex] ?? {};
    const members = [...this.members.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((m) => ({
        id: m.id,
        username: m.username,
        connected: m.connected,
        ready: m.ready,
        isHost: m.id === this.hostId,
        locked: this.locked.has(m.id),
      }));
    return {
      code: this.code,
      game: this.game,
      phase: this.phase,
      hostId: this.hostId,
      settings: this.settings,
      maxPlayers: this.maxPlayers,
      members,
      round:
        this.phase === 'lobby'
          ? null
          : {
              index: this.roundIndex,
              total: this.settings.rounds,
              seed: this.seed,
              endsAt: this.phaseEndsAt,
              results: revealed
                ? members.map((m) => ({
                    id: m.id,
                    answer: round[m.id]?.answer ?? null,
                    score: round[m.id]?.score ?? 0,
                  }))
                : null,
            },
      final:
        this.phase === 'final' ? this.finalRows().map(({ answers: _answers, ...r }) => r) : null,
    };
  }
}
