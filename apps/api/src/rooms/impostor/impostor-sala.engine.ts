import {
  IM_MAX_PLAYERS,
  IM_MIN_PLAYERS,
  IM_MIN_POOL,
  IM_QUESTIONS,
  IM_WORDS,
  IM_CATEGORY_LABELS,
  IM_EMPTY_HISTORY,
  addResult,
  advanceHistory,
  clampRounds,
  drawRound,
  filterWords,
  guessIsRight,
  guessNeedsJudgement,
  imEffectiveMode,
  leaders,
  newSession,
  normalizeGuess,
  scoreResult,
  sessionRanking,
  type ImHistory,
  type ImMode,
  type ImResult,
  type ImRound,
  type ImSession,
  type ImSettings,
} from '@nocap/games';
import {
  ColorRoomEngine,
  RoomError,
  type AnySettings,
  type EngineOptions,
  type FinalRow,
} from '../color-room.engine';

/** Quanto cada fase espera antes de seguir sozinha (quem some não trava a mesa). */
export const SALA_SHOW_MS = 90_000;
export const SALA_CLUE_MS = 45_000;
export const SALA_VOTE_MS = 60_000;
export const SALA_GUESS_MS = 45_000;
/** Cerimônia de revelação (suspense, quem é, quem votou) antes do chute. */
export const SALA_REVEAL_MS = 11_000;
/** O grupo decide se um chute parecido vale; sem chute para decidir, só mostra o resultado. */
export const SALA_JUDGE_MS = 30_000;
export const SALA_JUDGE_SHOW_MS = 5_000;

export interface ImpostorSalaSettings {
  /** Rodadas de dicas (1 a 5); o motor base lê este campo. */
  rounds: number;
  /** 0 = surpresa (de 1 até o máximo da mesa). */
  impostors: number;
  /** Debate em ms; 0 = sem limite (todos precisam tocar em "votar"). */
  talkMs: number;
  hint: boolean;
  lastChance: boolean;
  categories: string[];
  filters: Record<string, Record<string, string[]>>;
}

export const DEFAULT_IMPOSTOR_SALA: ImpostorSalaSettings = {
  rounds: 3,
  impostors: 1,
  talkMs: 60_000,
  hint: false,
  lastChance: true,
  categories: [],
  filters: {},
};

const MODES: readonly ImMode[] = ['classic', 'similar', 'white', 'wrong'];
const TALK_OPTIONS = [0, 30_000, 60_000, 90_000, 120_000, 180_000, 240_000, 300_000];

export interface Clue {
  id: string;
  word: string;
  round: number;
}

type Stage = 'reveal' | 'guess' | 'judge' | 'score' | null;

/**
 * O Impostor em sala (spec 088): cada pessoa no seu celular. Reaproveita o ciclo da sala (entrar, líder, pronto, chat,
 * revanche) e troca a partida pelas regras de `impostor-mesa` (packages/games): papéis secretos por pessoa, dicas
 * digitadas na ordem de fala, debate, voto secreto simultâneo, última chance de chute e ranking que soma várias partidas.
 *
 * Fases da sala: `show` (cada um vê o papel), `play` (rodadas de dicas), `pick` (debate), `vote` (voto secreto),
 * `reveal` (resultado, com a etapa do chute e depois o placar) e `final` (ranking da sessão).
 */
export class ImpostorSalaEngine extends ColorRoomEngine {
  override readonly game = 'impostor' as const;
  override get historyMode() {
    return 'impostor';
  }
  override readonly persistable = false;
  protected override readonly minPlayers = IM_MIN_PLAYERS;
  protected override readonly modes: readonly string[] = MODES;
  /** Nenhuma fase do Impostor usa a lógica de "responder" da Cor. */
  protected override readonly answerPhase = 'create' as const;

  private round: ImRound | null = null;
  private history: ImHistory = IM_EMPTY_HISTORY;
  private session: ImSession = newSession([]);
  private gameNo = 0;
  private participants: string[] = [];
  private seen = new Set<string>();
  private clueRound = 1;
  private turn = 0;
  private clues: Clue[] = [];
  private wantVote = new Set<string>();
  private votes: Record<string, string> = {};
  private result: ImResult | null = null;
  private guesses: Record<string, string> = {};
  /** Chute parecido: quem decidiu se vale (por chutador). */
  private judgeVotes: Record<string, Record<string, boolean>> = {};
  private stage: Stage = null;
  private gains: Record<string, number> = {};

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: opts.maxPlayers ?? IM_MAX_PLAYERS });
    this.mode = 'classic';
    this.settings = { ...DEFAULT_IMPOSTOR_SALA } as unknown as AnySettings;
  }

  private get cfg(): ImpostorSalaSettings {
    return this.settings as unknown as ImpostorSalaSettings;
  }

  /** O chat fica fechado enquanto há segredo na tela (papéis, dicas e votos): conversa só no debate e no resto. */
  protected override chatOpen() {
    return ['lobby', 'pick', 'reveal', 'final'].includes(this.phase);
  }

  protected override validSettings(merged: Record<string, unknown>): boolean {
    const m = merged as unknown as ImpostorSalaSettings;
    const okCat = Array.isArray(m.categories) && m.categories.every((c) => typeof c === 'string' && c in IM_CATEGORY_LABELS);
    return (
      Number.isInteger(m.rounds) && m.rounds >= 1 && m.rounds <= 5 &&
      Number.isInteger(m.impostors) && m.impostors >= 0 && m.impostors <= 3 &&
      TALK_OPTIONS.includes(m.talkMs) &&
      typeof m.hint === 'boolean' && typeof m.lastChance === 'boolean' &&
      okCat && typeof m.filters === 'object' && m.filters !== null
    );
  }

  protected override settingsForMode(_mode: string, current: AnySettings): AnySettings {
    return current;
  }

  override configure(id: string, next: Parameters<ColorRoomEngine['configure']>[1]) {
    const patch = { ...(next as Record<string, unknown>) };
    if (typeof patch.rounds === 'number') patch.rounds = clampRounds(patch.rounds);
    super.configure(id, patch as Parameters<ColorRoomEngine['configure']>[1]);
  }

  // ---- partida ----

  override start(id: string) {
    this.requireHost(id);
    this.requirePhase('lobby');
    const connected = [...this.members.values()].filter((m) => m.connected);
    if (this.cfg.categories.length === 0) throw new RoomError('Escolha pelo menos 1 tema antes de começar');
    const mode = imEffectiveMode(this.mode as ImMode, connected.length);
    if (mode !== 'wrong' && filterWords(IM_WORDS, this.imSettings()).length < IM_MIN_POOL) {
      throw new RoomError('Poucas palavras com esses temas e opções: escolha mais temas');
    }
    super.start(id);
  }

  private imSettings(): ImSettings {
    const c = this.cfg;
    return {
      mode: this.mode as ImMode,
      impostors: c.impostors === 0 ? 'random' : c.impostors,
      rounds: c.rounds,
      talkSeconds: Math.round(c.talkMs / 1000),
      hint: c.hint,
      lastChance: c.lastChance,
      categories: c.categories,
      filters: c.filters,
    };
  }

  protected override beginRound() {
    const ids = [...this.members.values()].filter((m) => m.connected).map((m) => m.id);
    this.participants = ids;
    // quem entrou agora começa do zero; quem saiu deixa o ranking
    const keep = (m: Record<string, number>) => Object.fromEntries(ids.map((i) => [i, m[i] ?? 0]));
    this.session = { ...this.session, scores: keep(this.session.scores), escapes: keep(this.session.escapes) };
    this.round = drawRound({
      ids,
      settings: this.imSettings(),
      words: IM_WORDS,
      questions: IM_QUESTIONS,
      categoryLabels: IM_CATEGORY_LABELS,
      seed: this.seed,
      roundIndex: this.gameNo,
      history: this.history,
    });
    this.seen = new Set();
    this.clueRound = 1;
    this.turn = 0;
    this.clues = [];
    this.wantVote = new Set();
    this.votes = {};
    this.result = null;
    this.guesses = {};
    this.judgeVotes = {};
    this.stage = null;
    this.gains = {};
    this.phase = 'show';
    this.phaseEndsAt = this.now() + SALA_SHOW_MS;
  }

  private present(): string[] {
    return this.participants.filter((id) => this.members.get(id)?.connected);
  }

  /** "Já vi o meu papel". Quando todos viram, começam as dicas. */
  markSeen(id: string) {
    this.requirePhase('show');
    if (!this.participants.includes(id)) throw new RoomError('Você não está nesta partida');
    this.seen.add(id);
    this.reevaluate();
  }

  private speaker(): string | undefined {
    return this.round?.order[this.turn];
  }

  /** Uma palavra de dica, na vez de quem fala. Não pode ser a palavra secreta. */
  submitClue(id: string, raw: unknown) {
    this.requirePhase('play');
    if (this.speaker() !== id) throw new RoomError('Não é a sua vez de dar a dica');
    const word = typeof raw === 'string' ? raw.trim() : '';
    if (!word) throw new RoomError('Digite a sua dica');
    if (/\s/.test(word)) throw new RoomError('A dica é uma palavra só');
    if (word.length > 24) throw new RoomError('A dica ficou grande demais (máximo 24 letras)');
    const secret = normalizeGuess(this.round!.civilText);
    const sec2 = this.round!.outsiderText ? normalizeGuess(this.round!.outsiderText) : null;
    const w = normalizeGuess(word);
    if (w === secret || (sec2 !== null && w === sec2) || secret.split(' ').includes(w)) {
      throw new RoomError('Essa é a palavra secreta (ou parte dela). Dê outra dica');
    }
    if (this.clues.some((c) => c.id === id && normalizeGuess(c.word) === w)) {
      throw new RoomError('Você já deu essa dica. Dê outra palavra');
    }
    this.pushClue(id, word);
  }

  private pushClue(id: string, word: string) {
    this.clues.push({ id, word, round: this.clueRound });
    this.advanceTurn();
  }

  /** No modo "resposta errada" cada um só responde a pergunta uma vez: nada de rodadas repetidas. */
  private clueRounds(): number {
    return this.mode === 'wrong' ? 1 : this.cfg.rounds;
  }

  private advanceTurn() {
    const order = this.round!.order;
    if (this.turn < order.length - 1) this.turn += 1;
    else if (this.clueRound < this.clueRounds()) {
      this.clueRound += 1;
      this.turn = 0;
    } else {
      this.toDebate();
      return;
    }
    this.skipAbsent();
    if (this.phase === 'play') this.phaseEndsAt = this.now() + SALA_CLUE_MS;
  }

  /** Quem caiu da conexão perde a vez em silêncio, sem segurar a mesa. */
  private skipAbsent() {
    let guard = 0;
    while (this.phase === 'play' && guard++ < 200) {
      const s = this.speaker();
      if (s && this.members.get(s)?.connected) return;
      this.clues.push({ id: s ?? '', word: '', round: this.clueRound });
      const order = this.round!.order;
      if (this.turn < order.length - 1) this.turn += 1;
      else if (this.clueRound < this.clueRounds()) {
        this.clueRound += 1;
        this.turn = 0;
      } else {
        this.toDebate();
        return;
      }
    }
  }

  private toClues() {
    this.phase = 'play';
    this.skipAbsent();
    if (this.phase === 'play') this.phaseEndsAt = this.now() + SALA_CLUE_MS;
  }

  private toDebate() {
    this.phase = 'pick';
    this.wantVote = new Set();
    this.phaseEndsAt = this.cfg.talkMs > 0 ? this.now() + this.cfg.talkMs : null;
  }

  /** "Quero votar": no debate sem limite, todos precisam tocar; com tempo, adianta quando todos tocam. */
  readyToVote(id: string) {
    this.requirePhase('pick');
    if (!this.participants.includes(id)) throw new RoomError('Você não está nesta partida');
    this.wantVote.add(id);
    this.reevaluate();
  }

  private toVote() {
    this.phase = 'vote';
    this.phaseEndsAt = this.now() + SALA_VOTE_MS;
  }

  /** Voto secreto: pode trocar até todos votarem. */
  castVote(id: string, target: string) {
    this.requirePhase('vote');
    if (!this.participants.includes(id)) throw new RoomError('Você não está nesta partida');
    if (target === id) throw new RoomError('Você não pode votar em si mesmo');
    if (!this.participants.includes(target)) throw new RoomError('Essa pessoa não está na partida');
    this.votes[id] = target;
    this.reevaluate();
  }

  private resolveVotes() {
    const ids = this.participants;
    const votes = Object.fromEntries(Object.entries(this.votes).filter(([v, t]) => this.members.has(v) && this.members.has(t)));
    this.result = scoreResult({ ids, round: this.round!, votes, lastChance: this.cfg.lastChance });
    this.phase = 'reveal';
    this.stage = 'reveal';
    this.phaseEndsAt = this.now() + SALA_REVEAL_MS;
  }

  /** Fim da cerimônia: quem foi pego pode chutar; sem chute, o placar fecha. */
  private afterReveal() {
    if (this.result && this.result.canGuess.length > 0) {
      this.stage = 'guess';
      this.phaseEndsAt = this.now() + SALA_GUESS_MS;
    } else {
      this.finishGame();
    }
  }

  /** Depois dos chutes: mostra acertou/errou; chute parecido vai para o grupo decidir. */
  private toJudge() {
    this.stage = 'judge';
    this.phaseEndsAt = this.now() + (this.pendingGuessers().length > 0 ? SALA_JUDGE_MS : SALA_JUDGE_SHOW_MS);
  }

  private pendingGuessers(): string[] {
    const word = this.round!.civilText;
    return (this.result?.canGuess ?? []).filter((id) => guessNeedsJudgement(this.guesses[id] ?? '', word));
  }

  private judges(): string[] {
    const bad = new Set(this.result?.canGuess ?? []);
    return this.participants.filter((id) => !bad.has(id) && this.members.get(id)?.connected);
  }

  /** Voto de quem não chutou: o chute do outro vale ou não? */
  judge(id: string, target: string, ok: unknown) {
    this.requirePhase('reveal');
    if (this.stage !== 'judge') throw new RoomError('Agora não dá para decidir');
    if (!this.judges().includes(id)) throw new RoomError('Quem chutou não decide o próprio chute');
    if (!this.pendingGuessers().includes(target)) throw new RoomError('Esse chute não precisa de decisão');
    (this.judgeVotes[target] ??= {})[id] = ok === true;
    this.reevaluate();
  }

  private acceptedGuessers(): string[] {
    return this.pendingGuessers().filter((g) => {
      const v = Object.values(this.judgeVotes[g] ?? {});
      return v.filter(Boolean).length > v.filter((x) => !x).length;
    });
  }

  /** Chute de quem foi pego (última chance). */
  guess(id: string, raw: unknown) {
    this.requirePhase('reveal');
    if (this.stage !== 'guess' || !this.result?.canGuess.includes(id)) throw new RoomError('Agora não dá para chutar');
    const text = typeof raw === 'string' ? raw.trim().slice(0, 40) : '';
    this.guesses[id] = text;
    this.reevaluate();
  }

  private finishGame() {
    const ids = this.participants;
    const votes = Object.fromEntries(Object.entries(this.votes).filter(([v, t]) => this.members.has(v) && this.members.has(t)));
    this.result = scoreResult({ ids, round: this.round!, votes, lastChance: this.cfg.lastChance, guesses: this.guesses, accepted: this.acceptedGuessers() });
    this.session = addResult(this.session, this.result);
    this.history = advanceHistory(this.history, ids, this.round!);
    this.gains = this.result.points;
    this.gameNo += 1;
    this.stage = 'score';
    this.phase = 'reveal';
    this.phaseEndsAt = null;
  }

  /** Líder: mais uma partida (volta ao lobby com o ranking, para mudar gente, temas e regras). */
  continueSession(id: string) {
    this.requireHost(id);
    this.requirePhase('reveal');
    if (this.stage !== 'score') throw new RoomError('Espere o resultado terminar');
    const keep = new Set([...this.members.values()].filter((m) => m.connected).map((m) => m.id));
    this.backToLobby();
    // quem estava na mesa já volta "pronto": o líder só começa
    this.committed = keep;
  }

  /** Líder: encerrar. Aparece o ranking final. */
  endSession(id: string) {
    this.requireHost(id);
    this.requirePhase('reveal');
    if (this.stage !== 'score') throw new RoomError('Espere o resultado terminar');
    this.phase = 'final';
    this.phaseEndsAt = null;
  }

  private backToLobby() {
    this.phase = 'lobby';
    this.phaseEndsAt = null;
    this.round = null;
    this.stage = null;
    this.rounds = [];
    this.rematchVotes.clear();
    this.committed.clear();
    for (const m of this.members.values()) m.ready = false;
  }

  /** Quem vê o ranking final pode recomeçar do zero (revanche votada por todos, igual aos outros jogos). */
  protected override reset() {
    const fromFinal = this.phase === 'final';
    this.backToLobby();
    if (fromFinal) {
      this.session = newSession([...this.members.keys()]);
      this.history = IM_EMPTY_HISTORY;
      this.gameNo = 0;
    }
  }

  // ---- tempo e saídas ----

  protected override maybeAdvanceFromPick() {
    this.reevaluate();
  }

  /** Olha a fase de hoje e avança se a condição já foi cumprida (todo mundo viu, votou...). */
  private reevaluate() {
    if (!this.round) return;
    const here = this.present();
    if (this.phase === 'show' && here.every((id) => this.seen.has(id))) this.toClues();
    else if (this.phase === 'play') this.skipAbsent();
    else if (this.phase === 'pick' && here.length > 0 && here.every((id) => this.wantVote.has(id))) this.toVote();
    else if (this.phase === 'vote' && here.every((id) => this.votes[id] !== undefined)) this.resolveVotes();
    else if (this.phase === 'reveal' && this.stage === 'guess') {
      const need = (this.result?.canGuess ?? []).filter((id) => this.members.get(id)?.connected);
      if (need.every((id) => this.guesses[id] !== undefined)) this.toJudge();
    } else if (this.phase === 'reveal' && this.stage === 'judge') {
      const judges = this.judges();
      if (this.pendingGuessers().every((g) => judges.every((j) => this.judgeVotes[g]?.[j] !== undefined))) this.finishGame();
    }
  }

  override tick(): boolean {
    if (this.phaseEndsAt === null || this.now() < this.phaseEndsAt) return false;
    if (this.phase === 'show') this.toClues();
    else if (this.phase === 'play') {
      const s = this.speaker();
      this.pushClue(s ?? '', '');
    } else if (this.phase === 'pick') this.toVote();
    else if (this.phase === 'vote') this.resolveVotes();
    else if (this.phase === 'reveal' && this.stage === 'reveal') this.afterReveal();
    else if (this.phase === 'reveal' && this.stage === 'guess') this.toJudge();
    else if (this.phase === 'reveal' && this.stage === 'judge') this.finishGame();
    else return false;
    return true;
  }

  // ---- resultado (ranking da sessão) ----

  override finalRows(): FinalRow[] {
    return sessionRanking(this.session).map((r) => ({
      userId: r.id,
      username: this.members.get(r.id)?.username ?? 'Jogador',
      totalTenths: r.points * 10,
      placement: r.position,
      answers: [],
    }));
  }

  protected override publicSeed(): string {
    return '';
  }

  // ---- o que cada pessoa enxerga ----

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    const me = viewerId && this.participants.includes(viewerId) ? viewerId : null;
    const r = this.round;
    const inGame = r !== null && this.phase !== 'lobby';
    const finished = this.stage === 'score' || this.phase === 'final';
    const name = (id: string) => this.members.get(id)?.username ?? 'Jogador';
    const ranking = sessionRanking(this.session).map((x) => ({ id: x.id, points: x.points, position: x.position }));
    const lead = new Set(leaders(this.session).length === ranking.length ? [] : leaders(this.session));
    const base = {
      session: { games: this.session.games, ranking, leaders: [...lead] },
    };
    if (!inGame || !r) return { mesa: base };
    const my = me ? r.roles[me] : undefined;
    return {
      mesa: {
        ...base,
        mode: r.mode,
        stage: this.stage,
        participants: this.participants.map((id) => ({ id, name: name(id) })),
        order: r.order,
        clueRound: this.clueRound,
        turn: this.turn,
        speaker: this.phase === 'play' ? (this.speaker() ?? null) : null,
        clues: this.clues,
        seen: [...this.seen],
        wantVote: [...this.wantVote],
        voted: Object.keys(this.votes),
        guessed: Object.keys(this.guesses),
        // o papel é segredo: cada pessoa recebe só o seu (todos aparecem quando o placar fecha)
        me: my
          ? { kind: my.kind, text: my.text, hint: my.hint, theme: my.theme, knowsRole: my.knowsRole, wasSeen: this.seen.has(me!) }
          : null,
        myVote: me ? (this.votes[me] ?? null) : null,
        result: this.result && (this.stage !== null || finished)
          ? {
              caught: this.result.caught,
              counts: this.result.counts,
              canGuess: this.result.canGuess,
              // a cerimônia de revelação mostra quem são os impostores e quem votou neles
              outsiders: this.result.outsiders,
              votes: this.votes,
              innocentsWin: this.stage === 'score' ? this.result.innocentsWin : null,
              guessedRight: this.stage === 'score' ? this.result.guessedRight : [],
              word: this.stage === 'judge' || this.stage === 'score' ? r.civilText : null,
              similar: this.stage === 'score' ? r.outsiderText : null,
              gains: this.stage === 'score' ? this.gains : null,
              guesses: this.stage === 'judge' || this.stage === 'score' ? this.guesses : null,
              judge: this.stage === 'judge' || this.stage === 'score'
                ? Object.fromEntries((this.result.canGuess).map((g) => {
                    const text = this.guesses[g] ?? '';
                    const exact = guessIsRight(text, r.civilText);
                    const needs = guessNeedsJudgement(text, r.civilText);
                    const v = Object.values(this.judgeVotes[g] ?? {});
                    return [g, { exact, needs, yes: v.filter(Boolean).length, no: v.filter((x) => !x).length, mine: me ? (this.judgeVotes[g]?.[me] ?? null) : null, eligible: this.judges().length }];
                  }))
                : null,
            }
          : null,
      },
    };
  }
}
