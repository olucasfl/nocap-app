import {
  IM_DEFAULTS, IM_ELIM_MAX_ROUNDS, IM_EMPTY_HISTORY, IM_MAX_ROUNDS, IM_MIN_POOL, IM_MAX_PLAYERS, IM_MIN_PLAYERS, IM_QUESTIONS, IM_WORDS, IM_CATEGORY_LABELS,
  addResult, advanceHistory, clampRounds, drawRound, elimApply, elimOutcome, elimResolve, elimStart, filterWords, imEffectiveMode,
  imImpostorLimit, newSession, rankingShift, scoreElimination, scoreResult,
  type ImElimState, type ImHistory, type ImResult, type ImRound, type ImSession, type ImSettings, type ImWinner,
} from '@nocap/games';
import { AVATARS } from './assets';

export type Phase =
  | 'players' | 'cats' | 'cfg' | 'reveal' | 'clues' | 'talk' | 'vote'
  | 'result' | 'elimres' | 'score' | 'final';

export interface Player {
  id: string;
  name: string;
  avatar: string;
}

export interface State {
  phase: Phase;
  /** Ao voltar de uma tela, a animação entra pelo outro lado. */
  back: boolean;
  players: Player[];
  settings: ImSettings;
  seed: string;
  game: number;
  history: ImHistory;
  round: ImRound | null;
  /** Quem está vendo o papel (índice em `players`). */
  seen: number;
  clueRound: number;
  /** Quem fala agora na rodada de dicas (índice na ordem de fala). */
  turn: number;
  /** Dentro de cada rodada de dicas: primeiro as instruções, depois a hora de dizer as palavras. */
  clueStep: 'brief' | 'say';
  /** Cada voto começa com "passe o celular para..."; só depois aparece a escolha. */
  voteStep: 'pass' | 'pick';
  /** Depois do último voto: primeiro pergunta se já revela, depois vem a revelação. */
  resultStep: 'ask' | 'reveal';
  voter: number;
  votes: Record<string, string>;
  result: ImResult | null;
  /** Eliminação: quem está vivo, quantas rodadas e o histórico de quem saiu. */
  elim: ImElimState | null;
  /** Eliminação: votos da votação em andamento. */
  elimVotes: Record<string, string>;
  /** Eliminação: em empate, só estes recebem votos na segunda votação. */
  elimCands: string[] | null;
  elimRevote: boolean;
  session: ImSession;
  /** O que o último placar mexeu (escolhe o som). */
  shift: 'calm' | 'brusque';
  gains: Record<string, number>;
  /** Erro vindo do sorteio (ex.: poucas palavras); a tela mostra e a pessoa corrige. */
  error: string | null;
}

const KEY = 'nocap-impostor-setup';

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function initial(): State {
  // a mesa começa vazia: quem vai jogar é adicionado por quem está jogando
  const players: Player[] = [];
  let settings: ImSettings = { ...IM_DEFAULTS, categories: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as { settings?: ImSettings };
      // os temas começam sempre vazios: a pessoa escolhe a cada sessão
      if (s.settings) settings = { ...settings, ...s.settings, categories: [], rounds: clampRounds(s.settings.rounds ?? 3, IM_ELIM_MAX_ROUNDS) };
    }
  } catch {
    /* sem memória salva: começa do padrão */
  }
  return {
    phase: 'players', back: false, players, settings, seed: randomSeed(), game: 0, history: IM_EMPTY_HISTORY, round: null,
    seen: 0, clueRound: 1, turn: 0, clueStep: 'brief', voteStep: 'pass', resultStep: 'ask', voter: 0, votes: {}, result: null, elim: null, elimVotes: {}, elimCands: null, elimRevote: false,
    session: newSession(players.map((p) => p.id)), shift: 'calm', gains: {}, error: null,
  };
}

export function saveSetup(s: State): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ settings: s.settings }));
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

export type Action =
  | { type: 'go'; phase: Phase; back?: boolean }
  | { type: 'addPlayer'; name: string; avatar?: string }
  | { type: 'removePlayer'; id: string }
  | { type: 'setAvatar'; id: string; avatar: string }
  | { type: 'settings'; patch: Partial<ImSettings> }
  | { type: 'filter'; category: string; tag: string; value: string; /** todos os valores da opção (lista vazia no estado = tudo incluído) */ all: readonly string[] }
  | { type: 'toggleCategory'; id: string }
  | { type: 'start' }
  | { type: 'seen' }
  | { type: 'clueNext' }
  | { type: 'voteReady' }
  | { type: 'revealNow' }
  | { type: 'elimNext' }
  | { type: 'castVote'; target: string }
  | { type: 'finish' }
  | { type: 'leave' }
  | { type: 'again'; phase: 'cfg' | 'cats' }
  | { type: 'reset' };

/** Palavras (ou perguntas) que sobram depois dos filtros, para avisar quando for pouco. */
export function poolSize(s: Pick<State, 'settings' | 'players'>): number {
  const mode = imEffectiveMode(s.settings.mode, s.players.length);
  if (mode === 'wrong') return IM_QUESTIONS.filter((q) => s.settings.categories.includes(q.category)).length * 8;
  return filterWords(IM_WORDS, s.settings).length;
}

/** Rodadas de dicas de verdade: no modo de perguntas é uma só (cada um responde e pronto). */
export const clueRounds = (s: Pick<State, 'settings' | 'round' | 'elim'>) => (s.elim ? s.elim.total : s.round?.mode === 'wrong' ? 1 : s.settings.rounds);

/** Quem vota agora: na eliminação só os vivos; no voto final, todos. */
export const voterIds = (s: Pick<State, 'players' | 'elim'>): string[] => (s.elim ? s.elim.alive : s.players.map((p) => p.id));

/** Quem fala/vota ainda: na eliminação só os vivos. */
export const isAlive = (s: Pick<State, 'elim'>, id: string) => !s.elim || s.elim.alive.includes(id);

/** Como a eliminação termina agora (ou null se segue). */
export const elimWinner = (s: Pick<State, 'elim' | 'round'>): ImWinner | null => (s.elim && s.round ? elimOutcome(s.elim, s.round) : null);

export const poolOk = (s: Pick<State, 'settings' | 'players'>) => poolSize(s) >= IM_MIN_POOL;

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'go':
      return { ...s, phase: a.phase, back: !!a.back, error: null, ...(a.phase === 'vote' ? { voteStep: 'pass' as const, voter: 0, elimVotes: {}, elimCands: null, elimRevote: false } : {}) };
    case 'addPlayer': {
      const name = a.name.trim().slice(0, 14);
      if (!name || s.players.length >= IM_MAX_PLAYERS) return s;
      const taken = new Set(s.players.map((p) => p.avatar));
      // sem foto escolhida, vem uma aleatória que ninguém da mesa está usando
      const free = AVATARS.filter((x) => !taken.has(x));
      const avatar = a.avatar && !taken.has(a.avatar) ? a.avatar : (free[Math.floor(Math.random() * free.length)] ?? AVATARS[0]!);
      const id = `p${Math.max(0, ...s.players.map((p) => Number(p.id.slice(1)))) + 1}`;
      // quem entra no meio da sessão já aparece no ranking com 0 ponto
      const session = { ...s.session, scores: { ...s.session.scores, [id]: 0 }, escapes: { ...s.session.escapes, [id]: 0 } };
      return { ...s, players: [...s.players, { id, name, avatar }], session };
    }
    case 'removePlayer':
      return {
        ...s,
        players: s.players.filter((p) => p.id !== a.id),
        session: {
          ...s.session,
          scores: Object.fromEntries(Object.entries(s.session.scores).filter(([k]) => k !== a.id)),
          escapes: Object.fromEntries(Object.entries(s.session.escapes).filter(([k]) => k !== a.id)),
        },
      };
    case 'setAvatar':
      return { ...s, players: s.players.map((p) => (p.id === a.id ? { ...p, avatar: a.avatar } : p)) };
    case 'settings': {
      const settings = { ...s.settings, ...a.patch };
      const max = settings.voteMode === 'elim' ? IM_ELIM_MAX_ROUNDS : IM_MAX_ROUNDS;
      settings.rounds = clampRounds(a.patch.rounds ?? settings.rounds, max);
      if (typeof settings.impostors === 'number') settings.impostors = Math.min(settings.impostors, imImpostorLimit(Math.max(s.players.length, 3), settings.voteMode));
      return { ...s, settings };
    }
    case 'toggleCategory': {
      const has = s.settings.categories.includes(a.id);
      const categories = has ? s.settings.categories.filter((c) => c !== a.id) : [...s.settings.categories, a.id];
      return { ...s, settings: { ...s.settings, categories } };
    }
    case 'filter': {
      const stored = s.settings.filters?.[a.category]?.[a.tag] ?? [];
      // lista vazia guardada = tudo incluído: o primeiro toque tira só aquele item e deixa os outros
      const cur = stored.length === 0 ? [...a.all] : stored;
      const next = cur.includes(a.value) ? cur.filter((v) => v !== a.value) : [...cur, a.value];
      if (next.length === 0) return s; // pelo menos uma opção precisa ficar marcada
      const value = next.length >= a.all.length ? [] : next;
      const filters = { ...s.settings.filters, [a.category]: { ...s.settings.filters?.[a.category], [a.tag]: value } };
      return { ...s, settings: { ...s.settings, filters } };
    }
    case 'start': {
      const ids = s.players.map((p) => p.id);
      let round: ImRound;
      try {
        round = drawRound({
          ids, settings: s.settings, words: IM_WORDS, questions: IM_QUESTIONS, categoryLabels: IM_CATEGORY_LABELS,
          seed: s.seed, roundIndex: s.game, history: s.history,
        });
      } catch (e) {
        const m = e instanceof Error ? e.message : '';
        return { ...s, phase: 'cfg', error: m.includes('palavras') || m.includes('perguntas') ? 'Não há palavras nos temas escolhidos. Escolha outros temas ou libere os filtros.' : 'Não deu para sortear a partida. Confira os jogadores e os temas.' };
      }
      // quem entrou depois do começo da sessão começa do zero no ranking
      // o ranking continua igual; quem entrou agora começa do zero e quem saiu deixa o ranking
      const keep = (m: Record<string, number>) => Object.fromEntries(ids.map((id) => [id, m[id] ?? 0]));
      const session = { ...s.session, scores: keep(s.session.scores), escapes: keep(s.session.escapes) };
      return { ...s, round, session, phase: 'reveal', back: false, seen: 0, clueRound: 1, turn: 0, clueStep: 'brief', voteStep: 'pass', voter: 0, votes: {}, result: null, elim: s.settings.voteMode === 'elim' ? elimStart(ids, round, s.settings.rounds) : null, elimVotes: {}, elimCands: null, elimRevote: false };
    }
    case 'seen': {
      const n = voterIds(s).length;
      const last = s.seen >= n - 1;
      const round = (s.elim?.steps.length ?? 0) + 1;
      return last ? { ...s, phase: 'clues', back: false, clueRound: round, turn: 0, clueStep: 'brief' } : { ...s, phase: 'reveal', back: false, seen: s.seen + 1 };
    }
    case 'clueNext': {
      if (s.clueStep === 'brief') return { ...s, clueStep: 'say' };
      // eliminação: depois das palavras de cada rodada vem o debate e então a votação
      if (s.elim) return { ...s, phase: 'talk', back: false };
      if (s.clueRound < clueRounds(s)) return { ...s, clueRound: s.clueRound + 1, clueStep: 'brief' };
      return { ...s, phase: 'talk', back: false };
    }
    case 'revealNow':
      return { ...s, resultStep: 'reveal' };
    case 'voteReady':
      return { ...s, voteStep: 'pick' };
    case 'castVote': {
      if (s.elim) {
        const alive = s.elim.alive;
        const votes = { ...s.elimVotes, [alive[s.voter]!]: a.target };
        if (s.voter < alive.length - 1) return { ...s, elimVotes: votes, voter: s.voter + 1, voteStep: 'pass', phase: 'vote', back: false };
        const res = elimResolve(s.elimCands ?? alive, votes, s.elimRevote, `${s.seed}:${s.game}:${s.elim.steps.length}`);
        if (res.kind === 'tie') return { ...s, elimVotes: {}, elimCands: res.tied, elimRevote: true, voter: 0, voteStep: 'pass', phase: 'vote', back: false };
        const elim = elimApply(s.elim, s.round!, res.out, votes, s.elimRevote, res.drawn);
        return { ...s, elim, elimVotes: {}, elimCands: null, elimRevote: false, phase: 'elimres', back: false };
      }
      const voterId = s.players[s.voter]!.id;
      const votes = { ...s.votes, [voterId]: a.target };
      if (s.voter < s.players.length - 1) return { ...s, votes, voter: s.voter + 1, voteStep: 'pass', phase: 'vote', back: false };
      const ids = s.players.map((p) => p.id);
      const result = scoreResult({ ids, round: s.round!, votes });
      return { ...s, votes, result, phase: 'result', resultStep: 'ask', back: false };
    }
    case 'elimNext': {
      if (!s.elim) return s;
      if (elimWinner(s)) return finish(s);
      // modo de perguntas: cada rodada tem uma pergunta nova, que todo mundo vê de novo em segredo
      if (s.round?.qa) return { ...s, phase: 'reveal', back: false, seen: 0 };
      return { ...s, phase: 'clues', back: false, clueRound: s.elim.steps.length + 1, clueStep: 'brief' };
    }
    case 'finish':
      return finish(s);
    case 'leave':
      return { ...s, phase: 'players', back: true, round: null, votes: {}, result: null, elim: null, elimVotes: {}, elimCands: null, elimRevote: false, error: null };
    case 'again':
      return { ...s, phase: a.phase, back: false };
    case 'reset':
      return { ...initial(), settings: { ...s.settings, categories: [] }, players: s.players };
    default:
      return s;
  }
}

/** Fecha a partida: pontos, ranking da sessão, histórico do sorteio. */
export function finish(s: State): State {
  const ids = s.players.map((p) => p.id);
  const winner = elimWinner(s);
  const result = s.elim && winner
    ? scoreElimination(ids, s.round!, s.elim, winner)
    : scoreResult({ ids, round: s.round!, votes: s.votes });
  const session = addResult(s.session, result);
  return {
    ...s, result, session, phase: 'score', back: false, game: s.game + 1, history: advanceHistory(s.history, ids, s.round!),
    shift: rankingShift(s.session, session), gains: result.points,
  };
}

export const canStart = (s: State) => s.players.length >= IM_MIN_PLAYERS && s.players.length <= IM_MAX_PLAYERS;
