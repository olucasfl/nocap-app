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
  elimApply,
  elimOutcome,
  elimResolve,
  elimStart,
  imRoundView,
  imImpostorLimit,
  scoreElimination,
  leaders,
  newSession,
  normalizeWord,
  scoreResult,
  sessionRanking,
  IM_ELIM_MAX_ROUNDS,
  type ImElimState,
  type ImHistory,
  type ImVoteMode,
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
/** Cerimônia de revelação (suspense, quem é, quem votou) depois do voto. */
export const SALA_REVEAL_MS = 11_000;
/** Eliminação: quem saiu, os votos e o papel (se for para mostrar). */
export const SALA_ELIM_MS = 11_000;

export interface ImpostorSalaSettings {
  /** Rodadas de dicas (1 a 5; até 7 na eliminação); o motor base lê este campo. */
  rounds: number;
  /** 0 = surpresa (de 1 até o máximo da mesa). */
  impostors: number;
  /** Debate em ms; 0 = sem limite (todos precisam tocar em "votar"). */
  talkMs: number;
  hint: boolean;
  /** "final": um voto só no fim. "elim": vota a cada rodada e uma pessoa sai. */
  voteMode: ImVoteMode;
  /** Eliminação: mostra se quem saiu era inocente ou impostor (só com 2 ou mais impostores). */
  revealRoles: boolean;
  categories: string[];
  filters: Record<string, Record<string, string[]>>;
}

export const DEFAULT_IMPOSTOR_SALA: ImpostorSalaSettings = {
  rounds: 3,
  impostors: 1,
  talkMs: 60_000,
  hint: false,
  voteMode: 'final',
  revealRoles: true,
  categories: [],
  filters: {},
};

const MODES: readonly ImMode[] = ['classic', 'similar', 'wrong'];
const TALK_OPTIONS = [0, 30_000, 60_000, 90_000, 120_000, 180_000, 240_000, 300_000];

export interface Clue {
  id: string;
  word: string;
  round: number;
}

/** `reveal`: cerimônia do voto final. `elim`: quem saiu nesta rodada. `score`: placar. */
type Stage = 'reveal' | 'elim' | 'score' | null;

/**
 * O Impostor em sala (spec 088): cada pessoa no seu celular. Reaproveita o ciclo da sala (entrar, líder, pronto, chat,
 * revanche) e troca a partida pelas regras de `impostor-mesa` (packages/games): papéis secretos por pessoa, dicas
 * digitadas na ordem de fala, debate, voto secreto simultâneo (um só no fim ou a eliminação de uma pessoa por rodada) e ranking que soma várias partidas.
 *
 * Fases da sala: `show` (cada um vê o papel), `play` (rodadas de dicas), `pick` (debate), `vote` (voto secreto),
 * `reveal` (cerimônia do resultado, quem saiu na eliminação e o placar) e `final` (ranking da sessão).
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
  /** Eliminação: quem está vivo e o histórico de quem saiu (null no voto final). */
  private elim: ImElimState | null = null;
  private elimCands: string[] | null = null;
  private elimRevote = false;
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
      Number.isInteger(m.rounds) && m.rounds >= 1 && m.rounds <= IM_ELIM_MAX_ROUNDS &&
      Number.isInteger(m.impostors) && m.impostors >= 0 && m.impostors <= 3 &&
      TALK_OPTIONS.includes(m.talkMs) &&
      typeof m.hint === 'boolean' && (m.voteMode === 'final' || m.voteMode === 'elim') && typeof m.revealRoles === 'boolean' &&
      okCat && typeof m.filters === 'object' && m.filters !== null
    );
  }

  protected override settingsForMode(_mode: string, current: AnySettings): AnySettings {
    return current;
  }

  override configure(id: string, next: Parameters<ColorRoomEngine['configure']>[1]) {
    const patch = { ...(next as Record<string, unknown>) };
    const nextMode = (patch.voteMode as ImVoteMode | undefined) ?? this.cfg.voteMode;
    if (typeof patch.rounds === 'number') patch.rounds = clampRounds(patch.rounds, nextMode === 'elim' ? IM_ELIM_MAX_ROUNDS : 5);
    else if (nextMode === 'final' && this.cfg.rounds > 5) patch.rounds = 5;
    super.configure(id, patch as Parameters<ColorRoomEngine['configure']>[1]);
  }

  // ---- partida ----

  override start(id: string) {
    this.requireHost(id);
    this.requirePhase('lobby');
    if (this.cfg.categories.length === 0) throw new RoomError('Escolha pelo menos 1 tema antes de começar');
    if (this.mode !== 'wrong' && filterWords(IM_WORDS, this.imSettings()).length < IM_MIN_POOL) {
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
      voteMode: c.voteMode,
      revealRoles: c.revealRoles,
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
    this.elim = this.cfg.voteMode === 'elim' ? elimStart(ids, this.round, this.cfg.rounds) : null;
    this.elimCands = null;
    this.elimRevote = false;
    this.stage = null;
    this.gains = {};
    this.phase = 'show';
    this.phaseEndsAt = this.now() + SALA_SHOW_MS;
  }

  private present(): string[] {
    return this.participants.filter((id) => this.members.get(id)?.connected && this.alive(id));
  }

  /** "Já vi o meu papel". Quando todos viram, começam as dicas. */
  markSeen(id: string) {
    this.requirePhase('show');
    if (!this.participants.includes(id)) throw new RoomError('Você não está nesta partida');
    if (!this.alive(id)) throw new RoomError('Você foi eliminado(a): agora só assiste');
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
    const secret = normalizeWord(this.round!.civilText);
    const sec2 = this.round!.outsiderText ? normalizeWord(this.round!.outsiderText) : null;
    const w = normalizeWord(word);
    if (w === secret || (sec2 !== null && w === sec2) || secret.split(' ').includes(w)) {
      throw new RoomError('Essa é a palavra secreta (ou parte dela). Dê outra dica');
    }
    if (this.clues.some((c) => c.id === id && normalizeWord(c.word) === w)) {
      throw new RoomError('Você já deu essa dica. Dê outra palavra');
    }
    this.pushClue(id, word);
  }

  private pushClue(id: string, word: string) {
    this.clues.push({ id, word, round: this.clueRound });
    this.advanceTurn();
  }

  /** Rodadas de dicas de verdade: eliminação tem o total ajustado; voto final no modo de perguntas tem uma só. */
  private clueRounds(): number {
    if (this.elim) return this.elim.total;
    return this.mode === 'wrong' ? 1 : this.cfg.rounds;
  }

  /** Na eliminação, quem já saiu não fala nem vota. */
  private alive(id: string): boolean {
    return !this.elim || this.elim.alive.includes(id);
  }

  /** Fim da rodada de dicas: vem o debate (na eliminação, antes de cada votação). */
  private afterClues() {
    this.toDebate();
  }

  private advanceTurn() {
    const order = this.round!.order;
    if (this.turn < order.length - 1) this.turn += 1;
    else if (!this.elim && this.clueRound < this.clueRounds()) {
      this.clueRound += 1;
      this.turn = 0;
    } else {
      this.afterClues();
      return;
    }
    this.skipAbsent();
    if (this.phase === 'play') this.phaseEndsAt = this.now() + SALA_CLUE_MS;
  }

  /** Quem caiu da conexão perde a vez em silêncio (e quem foi eliminado nem entra na fila). */
  private skipAbsent() {
    let guard = 0;
    while (this.phase === 'play' && guard++ < 200) {
      const s = this.speaker();
      if (s && this.alive(s) && this.members.get(s)?.connected) return;
      if (s && this.alive(s)) this.clues.push({ id: s, word: '', round: this.clueRound });
      const order = this.round!.order;
      if (this.turn < order.length - 1) this.turn += 1;
      else if (!this.elim && this.clueRound < this.clueRounds()) {
        this.clueRound += 1;
        this.turn = 0;
      } else {
        this.afterClues();
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
    if (!this.alive(id)) throw new RoomError('Você foi eliminado(a): agora só assiste');
    this.wantVote.add(id);
    this.reevaluate();
  }

  private toVote() {
    this.phase = 'vote';
    this.votes = {};
    this.phaseEndsAt = this.now() + SALA_VOTE_MS;
  }

  /** Quem vota agora: na eliminação só os vivos. */
  private voters(): string[] {
    return this.participants.filter((id) => this.alive(id));
  }

  /** Voto secreto: pode trocar até todos votarem. Na eliminação, só vivos votam e só em vivos (ou nos empatados). */
  castVote(id: string, target: string) {
    this.requirePhase('vote');
    if (!this.participants.includes(id)) throw new RoomError('Você não está nesta partida');
    if (!this.alive(id)) throw new RoomError('Você foi eliminado(a): agora só assiste');
    if (target === id) throw new RoomError('Você não pode votar em si mesmo');
    if (!this.participants.includes(target)) throw new RoomError('Essa pessoa não está na partida');
    if (!this.alive(target)) throw new RoomError('Essa pessoa já foi eliminada');
    if (this.elimCands && !this.elimCands.includes(target)) throw new RoomError('No desempate só vale votar nos empatados');
    this.votes[id] = target;
    this.reevaluate();
  }

  private resolveVotes() {
    const votes = Object.fromEntries(Object.entries(this.votes).filter(([v, t]) => this.members.has(v) && this.members.has(t)));
    if (this.elim) {
      this.resolveElimVote(votes);
      return;
    }
    this.result = scoreResult({ ids: this.participants, round: this.round!, votes });
    this.phase = 'reveal';
    this.stage = 'reveal';
    this.phaseEndsAt = this.now() + SALA_REVEAL_MS;
  }

  /** Eliminação: empate volta só com os empatados; empate de novo sorteia; senão, sai o mais votado. */
  private resolveElimVote(votes: Record<string, string>) {
    const el = this.elim!;
    const res = elimResolve(this.elimCands ?? el.alive, votes, this.elimRevote, `${this.seed}:${this.gameNo}:${el.steps.length}`);
    if (res.kind === 'tie') {
      this.elimCands = res.tied;
      this.elimRevote = true;
      this.toVote();
      return;
    }
    this.elim = elimApply(el, this.round!, res.out, votes, this.elimRevote, res.drawn);
    this.elimCands = null;
    this.elimRevote = false;
    this.votes = {};
    this.phase = 'reveal';
    this.stage = 'elim';
    this.phaseEndsAt = this.now() + SALA_ELIM_MS;
  }

  /** Fim da cerimônia de quem saiu: acabou a partida ou segue para a próxima rodada de dicas. */
  private afterElim() {
    const el = this.elim!;
    if (elimOutcome(el, this.round!)) {
      this.finishGame();
      return;
    }
    this.clueRound = el.steps.length + 1;
    this.turn = 0;
    this.clues = this.clues.filter((c) => c.round < this.clueRound);
    this.stage = null;
    if (this.round!.qa) {
      // modo de perguntas: cada rodada tem uma pergunta nova, que todo mundo vivo vê de novo em segredo
      this.seen = new Set();
      this.phase = 'show';
      this.phaseEndsAt = this.now() + SALA_SHOW_MS;
      return;
    }
    this.phase = 'play';
    this.skipAbsent();
    if (this.phase === 'play') this.phaseEndsAt = this.now() + SALA_CLUE_MS;
  }

  private finishGame() {
    const ids = this.participants;
    const winner = this.elim ? elimOutcome(this.elim, this.round!) : null;
    if (this.elim) {
      // as rodadas acabaram sem resolver: os impostores vencem
      this.result = scoreElimination(ids, this.round!, this.elim, winner ?? 'impostors');
    } else {
      const votes = Object.fromEntries(Object.entries(this.votes).filter(([v, t]) => this.members.has(v) && this.members.has(t)));
      this.result = scoreResult({ ids, round: this.round!, votes });
    }
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
    else if (this.phase === 'vote' && here.filter((id) => this.alive(id)).every((id) => this.votes[id] !== undefined)) this.resolveVotes();
  }

  override tick(): boolean {
    if (this.phaseEndsAt === null || this.now() < this.phaseEndsAt) return false;
    if (this.phase === 'show') this.toClues();
    else if (this.phase === 'play') {
      const s = this.speaker();
      this.pushClue(s ?? '', '');
    } else if (this.phase === 'pick') this.toVote();
    else if (this.phase === 'vote') this.resolveVotes();
    else if (this.phase === 'reveal' && this.stage === 'reveal') this.finishGame();
    else if (this.phase === 'reveal' && this.stage === 'elim') this.afterElim();
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

  private outsidersCount(): number {
    return Object.values(this.round?.roles ?? {}).filter((x) => x.kind !== 'civil').length;
  }

  /** Eliminação: o papel de quem saiu só aparece com 1 impostor, se a mesa escolheu mostrar, ou quando a partida acaba. */
  private roleVisible(): boolean {
    if (!this.elim || !this.round) return false;
    return this.outsidersCount() === 1 || this.cfg.revealRoles || elimOutcome(this.elim, this.round) !== null || this.stage === 'score';
  }

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
    // modo de perguntas com eliminação: a pergunta de cada rodada
    const roundView = me && r.qa ? imRoundView(r, me, (this.elim?.steps.length ?? 0) + 1) : null;
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
        // eliminação: quem está vivo, as rodadas e quem saiu (o papel só aparece se a mesa escolheu mostrar)
        alive: this.elim ? this.elim.alive : this.participants,
        voteMode: this.elim ? 'elim' : 'final',
        cands: this.elimCands,
        revote: this.elimRevote,
        elim: this.elim
          ? {
              total: this.elim.total,
              steps: this.elim.steps.map((st) => ({
                round: st.round,
                out: st.out,
                role: this.roleVisible() ? st.role : null,
                votes: st.votes,
                revote: st.revote,
                drawn: st.drawn,
              })),
              winner: this.stage === 'elim' || finished ? elimOutcome(this.elim, r) : null,
              outsiders: this.stage === 'elim' || finished ? this.outsidersCount() : null,
            }
          : null,
        // o papel é segredo: cada pessoa recebe só o seu (todos aparecem quando o placar fecha)
        me: my
          ? { kind: my.kind, text: roundView ? roundView.text : my.text, hint: my.hint, theme: roundView ? roundView.theme : my.theme, knowsRole: my.knowsRole, wasSeen: this.seen.has(me!) }
          : null,
        myVote: me ? (this.votes[me] ?? null) : null,
        result: this.result && (this.stage === 'reveal' || finished)
          ? {
              caught: this.result.caught,
              counts: this.result.counts,
              // a cerimônia de revelação mostra quem são os impostores e quem votou neles
              outsiders: this.result.outsiders,
              votes: this.votes,
              innocentsWin: this.stage === 'score' ? this.result.innocentsWin : null,
              word: this.stage === 'score' ? r.civilText : null,
              similar: this.stage === 'score' ? r.outsiderText : null,
              gains: this.stage === 'score' ? this.gains : null,
            }
          : null,
      },
    };
  }
}
