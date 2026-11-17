import {
  IM_DEFAULTS, IM_EMPTY_HISTORY, IM_MIN_POOL, IM_MAX_PLAYERS, IM_MIN_PLAYERS, IM_QUESTIONS, IM_WORDS, IM_CATEGORY_LABELS,
  addResult, advanceHistory, clampRounds, drawRound, filterWords, imEffectiveMode, newSession, rankingShift, scoreResult,
  type ImHistory, type ImResult, type ImRound, type ImSession, type ImSettings,
} from '@nocap/games';
import { AVATARS } from './assets';

export type Phase =
  | 'players' | 'cats' | 'cfg' | 'reveal' | 'clues' | 'talk' | 'vote'
  | 'result' | 'guess' | 'score' | 'final';

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
  voter: number;
  votes: Record<string, string>;
  result: ImResult | null;
  guesses: Record<string, string>;
  guessIdx: number;
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
      if (s.settings) settings = { ...settings, ...s.settings, categories: [], rounds: clampRounds(s.settings.rounds ?? 3) };
    }
  } catch {
    /* sem memória salva: começa do padrão */
  }
  return {
    phase: 'players', back: false, players, settings, seed: randomSeed(), game: 0, history: IM_EMPTY_HISTORY, round: null,
    seen: 0, clueRound: 1, turn: 0, voter: 0, votes: {}, result: null, guesses: {}, guessIdx: 0,
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
  | { type: 'filter'; category: string; tag: string; value: string }
  | { type: 'toggleCategory'; id: string }
  | { type: 'start' }
  | { type: 'seen' }
  | { type: 'nextTurn' }
  | { type: 'castVote'; target: string }
  | { type: 'guess'; text: string }
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

export const poolOk = (s: Pick<State, 'settings' | 'players'>) => poolSize(s) >= IM_MIN_POOL;

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'go':
      return { ...s, phase: a.phase, back: !!a.back, error: null };
    case 'addPlayer': {
      const name = a.name.trim().slice(0, 14);
      if (!name || s.players.length >= IM_MAX_PLAYERS) return s;
      const taken = new Set(s.players.map((p) => p.avatar));
      // sem foto escolhida, vem uma aleatória que ninguém da mesa está usando
      const free = AVATARS.filter((x) => !taken.has(x));
      const avatar = a.avatar && !taken.has(a.avatar) ? a.avatar : (free[Math.floor(Math.random() * free.length)] ?? AVATARS[0]!);
      const id = `p${Math.max(0, ...s.players.map((p) => Number(p.id.slice(1)))) + 1}`;
      return { ...s, players: [...s.players, { id, name, avatar }] };
    }
    case 'removePlayer':
      return { ...s, players: s.players.filter((p) => p.id !== a.id) };
    case 'setAvatar':
      return { ...s, players: s.players.map((p) => (p.id === a.id ? { ...p, avatar: a.avatar } : p)) };
    case 'settings':
      return { ...s, settings: { ...s.settings, ...a.patch, rounds: clampRounds(a.patch.rounds ?? s.settings.rounds) } };
    case 'toggleCategory': {
      const has = s.settings.categories.includes(a.id);
      const categories = has ? s.settings.categories.filter((c) => c !== a.id) : [...s.settings.categories, a.id];
      return { ...s, settings: { ...s.settings, categories } };
    }
    case 'filter': {
      const cur = s.settings.filters?.[a.category]?.[a.tag] ?? [];
      const next = cur.includes(a.value) ? cur.filter((v) => v !== a.value) : [...cur, a.value];
      const filters = { ...s.settings.filters, [a.category]: { ...s.settings.filters?.[a.category], [a.tag]: next } };
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
      return { ...s, round, session, phase: 'reveal', back: false, seen: 0, clueRound: 1, turn: 0, voter: 0, votes: {}, result: null, guesses: {}, guessIdx: 0 };
    }
    case 'seen': {
      const last = s.seen >= s.players.length - 1;
      return last ? { ...s, phase: 'clues', back: false, clueRound: 1, turn: 0 } : { ...s, phase: 'reveal', back: false, seen: s.seen + 1 };
    }
    case 'nextTurn': {
      if (s.turn < s.players.length - 1) return { ...s, turn: s.turn + 1 };
      if (s.clueRound < s.settings.rounds) return { ...s, clueRound: s.clueRound + 1, turn: 0 };
      return { ...s, phase: 'talk', back: false };
    }
    case 'castVote': {
      const voterId = s.players[s.voter]!.id;
      const votes = { ...s.votes, [voterId]: a.target };
      if (s.voter < s.players.length - 1) return { ...s, votes, voter: s.voter + 1, phase: 'vote', back: false };
      const ids = s.players.map((p) => p.id);
      const result = scoreResult({ ids, round: s.round!, votes, lastChance: s.settings.lastChance });
      return { ...s, votes, result, phase: 'result', back: false, guessIdx: 0 };
    }
    case 'guess': {
      const caught = s.result!.canGuess;
      const id = caught[s.guessIdx]!;
      const guesses = { ...s.guesses, [id]: a.text };
      if (s.guessIdx < caught.length - 1) return { ...s, guesses, guessIdx: s.guessIdx + 1 };
      return finish({ ...s, guesses });
    }
    case 'finish':
      return finish(s);
    case 'leave':
      return { ...s, phase: 'players', back: true, round: null, votes: {}, result: null, guesses: {}, error: null };
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
  const result = scoreResult({ ids, round: s.round!, votes: s.votes, lastChance: s.settings.lastChance, guesses: s.guesses });
  const session = addResult(s.session, result);
  return {
    ...s, result, session, phase: 'score', back: false, game: s.game + 1, history: advanceHistory(s.history, ids, s.round!),
    shift: rankingShift(s.session, session), gains: result.points,
  };
}

export const canStart = (s: State) => s.players.length >= IM_MIN_PLAYERS && s.players.length <= IM_MAX_PLAYERS;
