import {
  IMPOSTOR_MAX_PLAYERS,
  IMPOSTOR_MIN_PLAYERS,
  assignImpostors,
  colorGame,
  effectiveImpostors,
  generateColorStart,
  scoreImpostorRound,
  type Hsb,
  type VoteResult,
} from '@nocap/games';
import {
  ColorRoomEngine,
  REVEAL_MS,
  RoomError,
  SHOW_GRACE_MS,
  type AnySettings,
  type EngineOptions,
  type ImpostorRoomSettings,
} from '../color-room.engine';
import { paletteRound, type PaletteRound } from './palette';

export const DEFAULT_IMPOSTOR_SETTINGS: ImpostorRoomSettings = {
  rounds: 3,
  showMs: 3000,
  pickMs: 45_000,
  voteMs: 30_000,
  impostors: 1,
  anonymous: false,
};

/** Tudo que a rodada tem de secreto ou de resultado, além das respostas da base. */
interface ImpostorRound {
  palette: PaletteRound;
  /** Quem joga a rodada (conectados quando ela começou). */
  participants: string[];
  impostors: string[];
  /** `votes[votante] = suspeito`. */
  votes: Record<string, string>;
  /** Quem já decidiu (inclui abstenção). */
  voted: Set<string>;
  points: Record<string, number> | null;
  tally: VoteResult | null;
}

/**
 * O Intruso: a Cor com papéis secretos e votação. Reaproveita o ciclo da sala (entrar, host,
 * pronto, pódio, revanche) e troca a rodada: tripulantes veem a cor; intrusos só recebem uma
 * dica; todos recriam, depois votam em quem acham que é intruso. O estado é por pessoa
 * (`snapshot(viewerId)`): cor e dica só vão a quem pode vê-las e a seed nunca sai do servidor.
 */
export class ImpostorRoomEngine extends ColorRoomEngine {
  override readonly game = 'impostor' as const;
  override readonly persistable = false;
  protected override readonly minPlayers = IMPOSTOR_MIN_PLAYERS;
  protected override readonly modes: readonly string[] = ['impostor'];

  private info: ImpostorRound[] = [];

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: opts.maxPlayers ?? IMPOSTOR_MAX_PLAYERS });
    this.mode = 'impostor';
    this.settings = { ...DEFAULT_IMPOSTOR_SETTINGS };
  }

  private get cfg(): ImpostorRoomSettings {
    return this.settings as ImpostorRoomSettings;
  }

  protected override validSettings(merged: Record<string, unknown>): boolean {
    const m = merged as unknown as ImpostorRoomSettings;
    return (
      Number.isInteger(m.rounds) &&
      m.rounds >= 1 &&
      m.rounds <= 5 &&
      Number.isInteger(m.showMs) &&
      m.showMs >= 1000 &&
      m.showMs <= 10_000 &&
      Number.isInteger(m.pickMs) &&
      m.pickMs >= 15_000 &&
      m.pickMs <= 90_000 &&
      Number.isInteger(m.voteMs) &&
      m.voteMs >= 15_000 &&
      m.voteMs <= 90_000 &&
      Number.isInteger(m.impostors) &&
      m.impostors >= 1 &&
      m.impostors <= 3 &&
      typeof m.anonymous === 'boolean'
    );
  }

  protected override settingsForMode(_mode: string, current: AnySettings): AnySettings {
    return current;
  }

  /** O host pediu mais intrusos do que a sala aguenta: vale o máximo, mas só na hora de jogar. */
  private impostorCount(players: number) {
    return effectiveImpostors(this.cfg.impostors, players);
  }

  // ---- rodada ----

  protected override beginRound() {
    this.roundIndex += 1;
    this.rounds[this.roundIndex] = {};
    this.locked = new Set();
    const participants = [...this.members.values()].filter((m) => m.connected).map((m) => m.id);
    this.info[this.roundIndex] = {
      palette: paletteRound(this.seed, this.roundIndex),
      participants,
      impostors: assignImpostors(
        participants,
        this.impostorCount(participants.length),
        this.seed,
        this.roundIndex,
      ),
      votes: {},
      voted: new Set(),
      points: null,
      tally: null,
    };
    this.phase = 'show';
    this.phaseEndsAt = this.now() + this.cfg.showMs + SHOW_GRACE_MS;
  }

  private get round(): ImpostorRound | undefined {
    return this.info[this.roundIndex];
  }

  override start(id: string) {
    this.info = [];
    super.start(id);
  }

  override lock(id: string, answer: Hsb) {
    this.requirePhase('pick');
    const round = this.round;
    if (!round?.participants.includes(id)) throw new RoomError('Você não está nesta rodada');
    if (this.locked.has(id)) return;
    const valid = (v: number, max: number) => Number.isInteger(v) && v >= 0 && v <= max;
    if (!valid(answer?.h, 360) || !valid(answer?.s, 100) || !valid(answer?.b, 100)) {
      throw new RoomError('Resposta inválida');
    }
    this.rounds[this.roundIndex]![id] = {
      answer,
      score: colorGame.score(round.palette.color, answer, this.cfg),
    };
    this.locked.add(id);
    this.maybeAdvanceFromPick();
  }

  /** Terminou de recriar (ou acabou o tempo): em vez da revelação, vem a votação. */
  protected override toReveal() {
    this.phase = 'vote';
    this.phaseEndsAt = this.now() + this.cfg.voteMs;
    this.maybeResolveVotes();
  }

  /** Aponta uma suspeita (`null` abstém-se ou desfaz). Pode trocar até acabar o tempo. */
  vote(id: string, target: string | null) {
    this.requirePhase('vote');
    const round = this.round;
    if (!round?.participants.includes(id)) throw new RoomError('Você não está nesta rodada');
    if (target === null) {
      delete round.votes[id];
    } else {
      if (target === id) throw new RoomError('Você não pode votar em si mesmo');
      if (!round.participants.includes(target)) throw new RoomError('Essa pessoa não está na rodada');
      round.votes[id] = target;
    }
    round.voted.add(id);
    this.maybeResolveVotes();
  }

  /** Todo mundo que está conectado já votou? Então revela. */
  private maybeResolveVotes() {
    if (this.phase !== 'vote') return;
    const round = this.round;
    if (!round) return;
    const waiting = round.participants.filter(
      (id) => this.members.get(id)?.connected && !round.voted.has(id),
    );
    if (waiting.length === 0) this.resolveVotes();
  }

  private resolveVotes() {
    const round = this.round!;
    const present = round.participants.filter((id) => this.members.has(id));
    const accuracy: Record<string, number> = {};
    for (const id of present) accuracy[id] = this.rounds[this.roundIndex]![id]?.score ?? 0;
    // Só contam votos entre quem ainda está na sala.
    const votes = Object.fromEntries(
      Object.entries(round.votes).filter(([v, t]) => present.includes(v) && present.includes(t)),
    );
    const { points, tally } = scoreImpostorRound({
      memberIds: present,
      impostors: round.impostors,
      accuracy,
      votes,
    });
    round.points = points;
    round.tally = tally;
    this.phase = 'reveal';
    this.phaseEndsAt = this.now() + REVEAL_MS + 8000;
  }

  override tick(): boolean {
    if (this.phase === 'vote' && this.phaseEndsAt !== null && this.now() >= this.phaseEndsAt) {
      this.resolveVotes();
      return true;
    }
    return super.tick();
  }

  override disconnect(id: string) {
    super.disconnect(id);
    this.maybeResolveVotes();
  }

  override leave(id: string) {
    super.leave(id);
    this.maybeResolveVotes();
  }

  protected override reset() {
    super.reset();
    this.info = [];
  }

  // ---- pódio ----

  /** Pontos da partida em décimos (as notas já têm 1 casa). */
  protected override totals() {
    return [...this.members.values()].map((m) => ({
      member: m,
      totalTenths: this.info.reduce(
        (sum, r) => sum + Math.round((r.points?.[m.id] ?? 0) * 10),
        0,
      ),
    }));
  }

  // ---- o que cada pessoa enxerga ----

  protected override resultsVisible() {
    return this.phase === 'vote' || this.phase === 'reveal' || this.phase === 'final';
  }

  protected override publicSeed() {
    return '';
  }

  protected override extraSnapshot(viewerId?: string) {
    const round = this.round;
    if (!round || this.phase === 'lobby') {
      return { impostor: { count: this.impostorCount(Math.max(this.members.size, 3)) } };
    }
    const revealed = this.phase === 'reveal' || this.phase === 'final';
    const me = viewerId && round.participants.includes(viewerId) ? viewerId : null;
    const isImpostor = !!me && round.impostors.includes(me);
    const playing = this.phase === 'show' || this.phase === 'pick' || this.phase === 'vote';
    const target = round.palette.color;
    return {
      impostor: {
        count: round.impostors.length,
        anonymous: this.cfg.anonymous,
        participants: round.participants,
        /** Seu papel; os dos outros só aparecem na revelação. */
        role: me ? (isImpostor ? 'impostor' : 'crew') : null,
        /** A cor, só para a tripulação enquanto decora (e para todos na revelação). */
        color: revealed || (this.phase === 'show' && me && !isImpostor) ? target : null,
        /** A dica, só para os intrusos (e para todos na revelação). */
        hint: revealed || (playing && isImpostor) ? round.palette.hint : null,
        colorName: revealed ? round.palette.name : null,
        /** Onde os controles começam; igual para todos e sempre longe da cor. */
        start: generateColorStart(this.seed, target, this.roundIndex),
        voted: [...round.voted],
        myVote: me ? (round.votes[me] ?? null) : null,
        reveal: revealed
          ? {
              impostors: round.impostors,
              caught: round.tally?.caught ?? [],
              counts: round.tally?.counts ?? {},
              points: round.points ?? {},
              /** Quem votou em quem; some se o voto é anônimo. */
              votes: this.cfg.anonymous
                ? null
                : Object.entries(round.votes).map(([voter, target]) => ({ voter, target })),
            }
          : null,
      },
    };
  }
}
