import { createRng, randInt } from '../core/rng';
import { tallyVotes } from '../impostor';

/**
 * Regras puras do Impostor da mesa (spec 088): sorteio justo de papéis, palavras, voto secreto, pontos e ranking da sessão.
 * Serve ao modo Mesa (celular passado de mão em mão, offline) e ao modo Sala (servidor). Nada aqui depende de tela.
 */

export const IM_MIN_PLAYERS = 3;
export const IM_MAX_PLAYERS = 15;
export const IM_MAX_ROUNDS = 5;
export const IM_MAX_IMPOSTORS = 3;
/** Menos palavras que isso depois dos filtros e a partida não começa. */
export const IM_MIN_POOL = 30;
/** O modo "sem palavra" só vale a partir daqui. */
export const IM_WHITE_MIN_PLAYERS = 6;
/**
 * Rodízio: com `k` impostores numa mesa de `n`, quem chega a `ceil(n / k) - 1` partidas seguidas sem ser entra primeiro no
 * próximo sorteio. É o melhor que a conta permite (com 1 impostor para 6, cada pessoa espera no máximo 5 partidas).
 */
export function imDryLimit(players: number, impostors: number): number {
  return Math.max(1, Math.ceil(players / Math.max(1, impostors)) - 1);
}

export type ImMode = 'classic' | 'similar' | 'white' | 'wrong';

export interface ImWord {
  id: string;
  category: string;
  text: string;
  /** Palavra parecida e do mesmo tipo (modos "parecida" e "sem palavra"). */
  pair: string;
  /** Etiquetas para filtrar (ex.: `group: 'jogador-brasil'`). */
  tags: Readonly<Record<string, string>>;
  /** 1 = todo mundo conhece, 2 = a maioria conhece. */
  fame: 1 | 2;
}

export interface ImQuestion {
  id: string;
  category: string;
  /** Pergunta dos inocentes. */
  q: string;
  /** Pergunta parecida, mas diferente, dos impostores. */
  qPair: string;
}

export interface ImSettings {
  mode: ImMode;
  /** 1 a 3, ou "random" (de 1 até o máximo da mesa, sem revelar quantos). */
  impostors: number | 'random';
  /** Rodadas de dicas antes do debate (1 a 5). */
  rounds: number;
  /** Debate em segundos; 0 = sem limite. */
  talkSeconds: number;
  /** Clássico: o impostor vê a categoria. */
  hint: boolean;
  /** Pego, o impostor ainda pode adivinhar a palavra. */
  lastChance: boolean;
  categories: readonly string[];
  /** Por categoria e etiqueta, os valores aceitos (vazio ou ausente = tudo). */
  filters?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
}

export const IM_DEFAULTS: ImSettings = {
  mode: 'classic',
  impostors: 1,
  rounds: 3,
  talkSeconds: 60,
  hint: false,
  lastChance: true,
  categories: [],
};

export function clampRounds(n: number): number {
  return Math.max(1, Math.min(IM_MAX_ROUNDS, Math.round(n)));
}

/** Quantos "de fora" (impostores) a mesa aguenta: até 3, sempre sobra gente que sabe. */
export function imImpostorLimit(players: number): number {
  return Math.max(1, Math.min(IM_MAX_IMPOSTORS, players - 1));
}

/** O modo pedido, ajustado ao tamanho da mesa ("sem palavra" precisa de 6). */
export function imEffectiveMode(mode: ImMode, players: number): ImMode {
  return mode === 'white' && players < IM_WHITE_MIN_PLAYERS ? 'similar' : mode;
}

/** Palavras que passam nas categorias e nos filtros marcados. */
export function filterWords(words: readonly ImWord[], s: Pick<ImSettings, 'categories' | 'filters'>): ImWord[] {
  const cats = new Set(s.categories);
  return words.filter((w) => {
    if (!cats.has(w.category)) return false;
    const f = s.filters?.[w.category];
    if (!f) return true;
    return Object.entries(f).every(([tag, allowed]) => allowed.length === 0 || allowed.includes(w.tags[tag] ?? ''));
  });
}

export function poolIsEnough(count: number): boolean {
  return count >= IM_MIN_POOL;
}

export type ImRoleKind = 'civil' | 'impostor' | 'white';

export interface ImRole {
  kind: ImRoleKind;
  /** Palavra (ou pergunta) que a pessoa vê; `null` = nada. */
  text: string | null;
  /** Rótulo de tema para o impostor do clássico com dica. */
  hint: string | null;
  /** Tema da palavra sorteada, mostrado a quem recebe palavra (inocente e impostor que acha que é inocente). */
  theme: string | null;
  /** `false` nos modos em que o impostor recebe uma palavra parecida e acha que é inocente. */
  knowsRole: boolean;
}

export interface ImHistory {
  /** Rodadas seguidas sem ser impostor, por pessoa. */
  dry: Readonly<Record<string, number>>;
  /** Palavras já usadas na sessão. */
  used: readonly string[];
}

export const IM_EMPTY_HISTORY: ImHistory = { dry: {}, used: [] };

export interface ImRound {
  mode: ImMode;
  roles: Record<string, ImRole>;
  /** Palavra (ou pergunta) dos inocentes. */
  civilText: string;
  /** Palavra parecida (ou pergunta parecida) dos impostores, quando existe. */
  outsiderText: string | null;
  /** Quem fala primeiro; a ordem é a mesma em todas as rodadas de dicas. */
  order: string[];
  wordId: string;
}

/**
 * Escolhe os impostores com justiça: quem está há mais partidas sem ser tem mais chance, e quem chegou ao limite do
 * rodízio (`imDryLimit`) entra primeiro. Mesas de 3 não têm essa garantia (1 impostor para 3 pessoas).
 */
export function drawOutsiders(ids: readonly string[], count: number, dry: Readonly<Record<string, number>>, rng: () => number): string[] {
  const limit = imDryLimit(ids.length, count);
  const pool = [...ids].sort();
  const picked: string[] = [];
  if (ids.length >= 4) {
    const forced = pool
      .filter((id) => (dry[id] ?? 0) >= limit)
      .sort((a, b) => (dry[b] ?? 0) - (dry[a] ?? 0) || (a < b ? -1 : 1));
    for (const id of forced) if (picked.length < count) picked.push(id);
  }
  while (picked.length < count) {
    const left = pool.filter((id) => !picked.includes(id));
    const w = left.map((id) => (1 + (dry[id] ?? 0)) ** 2);
    const total = w.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let k = 0;
    for (; k < left.length - 1; k++) {
      r -= w[k]!;
      if (r < 0) break;
    }
    picked.push(left[k]!);
  }
  return picked;
}

export interface ImDrawInput {
  ids: readonly string[];
  settings: ImSettings;
  words: readonly ImWord[];
  questions?: readonly ImQuestion[];
  categoryLabels?: Readonly<Record<string, string>>;
  seed: string;
  roundIndex: number;
  history: ImHistory;
}

/** Sorteia uma partida (papéis, palavra, ordem de fala). Determinístico pela seed, pela rodada e pelo histórico. */
export function drawRound(input: ImDrawInput): ImRound {
  const { ids, settings, seed, roundIndex, history } = input;
  const n = ids.length;
  if (n < IM_MIN_PLAYERS || n > IM_MAX_PLAYERS) throw new Error(`mesa de ${IM_MIN_PLAYERS} a ${IM_MAX_PLAYERS} pessoas`);
  const rng = createRng(`${seed}:im:${roundIndex}`);
  const mode = imEffectiveMode(settings.mode, n);
  const max = imImpostorLimit(n);
  const asked = settings.impostors === 'random' ? randInt(rng, 1, max) : settings.impostors;
  const roles: Record<string, ImRole> = {};

  let civilText: string;
  let outsiderText: string | null = null;
  let wordId: string;
  let themeId: string | null = null;
  if (mode === 'wrong') {
    const qs = (input.questions ?? []).filter((q) => settings.categories.includes(q.category));
    if (qs.length === 0) throw new Error('sem perguntas nas categorias escolhidas');
    const fresh = qs.filter((q) => !history.used.includes(q.id));
    const list = fresh.length ? fresh : qs;
    const q = list[Math.floor(rng() * list.length)]!;
    civilText = q.q;
    outsiderText = q.qPair;
    wordId = q.id;
  } else {
    const pool = filterWords(input.words, settings);
    if (pool.length === 0) throw new Error('sem palavras nas categorias escolhidas');
    const fresh = pool.filter((w) => !history.used.includes(w.id));
    const list = fresh.length ? fresh : pool;
    const w = list[Math.floor(rng() * list.length)]!;
    civilText = w.text;
    outsiderText = mode === 'classic' ? null : w.pair;
    wordId = w.id;
    themeId = w.category;
  }

  let outsiders: string[];
  let whiteId: string | null = null;
  if (mode === 'white') {
    outsiders = drawOutsiders(ids, 2, history.dry, rng);
    // o primeiro sorteado leva a palavra parecida e o segundo fica sem nada
    whiteId = outsiders[1]!;
  } else {
    outsiders = drawOutsiders(ids, Math.max(1, Math.min(asked, max)), history.dry, rng);
  }

  const label = themeId ? (input.categoryLabels?.[themeId] ?? null) : null;
  // a dica de categoria só existe com mais de dois temas (com 1 ou 2 ela entregaria quase tudo)
  const giveHint = settings.hint && settings.categories.length > 2;
  for (const id of ids) {
    if (id === whiteId) roles[id] = { kind: 'white', text: null, hint: null, theme: null, knowsRole: true };
    else if (outsiders.includes(id)) {
      if (mode === 'classic') roles[id] = { kind: 'impostor', text: null, hint: giveHint ? label : null, theme: null, knowsRole: true };
      else roles[id] = { kind: 'impostor', text: outsiderText, hint: null, theme: label, knowsRole: false };
    } else roles[id] = { kind: 'civil', text: civilText, hint: null, theme: label, knowsRole: false };
  }

  // Ordem de fala: sorteada, sem relação com o papel; quem não tem palavra nunca abre.
  const shuffled = [...ids].sort();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  if (whiteId && shuffled[0] === whiteId) shuffled.push(shuffled.shift()!);

  return { mode, roles, civilText, outsiderText, order: shuffled, wordId };
}

/** Atualiza o histórico depois de uma partida: zera a fila de quem foi impostor e guarda a palavra. */
export function advanceHistory(h: ImHistory, ids: readonly string[], round: ImRound): ImHistory {
  const dry: Record<string, number> = {};
  for (const id of ids) dry[id] = round.roles[id]!.kind === 'civil' ? (h.dry[id] ?? 0) + 1 : 0;
  return { dry, used: [...h.used, round.wordId] };
}

/** Compara o chute com a palavra: sem maiúsculas, acentos, pontuação nem espaços sobrando. */
export function normalizeGuess(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "Hog Rider (Corredor)" vale como "Hog Rider", "Corredor" ou o texto inteiro. */
export function wordAnswers(word: string): string[] {
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(word);
  return m ? [word, m[1]!, m[2]!] : [word];
}

export function guessIsRight(guess: string, word: string): boolean {
  const g = normalizeGuess(guess);
  return g.length > 0 && wordAnswers(word).some((a) => normalizeGuess(a) === g);
}

/** Proporção (pedido do Lucas, 17/11/2026): escapar vale bem mais que a vitória dos inocentes; o chute certo vale pouco, menos que acertar o voto. */
export const IM_POINTS = {
  rightVote: 2,
  innocentsWin: 2,
  outsiderSurvived: 6,
  outsiderGuessed: 1,
  whiteGuessed: 2,
} as const;

export interface ImResultInput {
  ids: readonly string[];
  round: ImRound;
  /** `votes[quem votou] = em quem votou`. Quem não votou não pontua pelo voto. */
  votes: Readonly<Record<string, string>>;
  lastChance: boolean;
  /** Chute de cada impostor pego (só vale com `lastChance`). */
  guesses?: Readonly<Record<string, string>>;
}

export interface ImResult {
  counts: Record<string, number>;
  caught: string[];
  outsiders: string[];
  /** Impostores que foram pegos e ainda podem chutar. */
  canGuess: string[];
  guessedRight: string[];
  innocentsWin: boolean;
  points: Record<string, number>;
}

/** Resultado e pontos de uma partida (a votação já terminou). */
export function scoreResult(input: ImResultInput): ImResult {
  const { ids, round, votes } = input;
  const outsiders = ids.filter((id) => round.roles[id]!.kind !== 'civil');
  const tally = tallyVotes(ids, votes, outsiders.length);
  const caught = outsiders.filter((o) => tally.caught.includes(o));
  // no modo de perguntas não há palavra para chutar
  const canGuess = input.lastChance && round.mode !== 'wrong' ? caught : [];
  const guessedRight = canGuess.filter((id) => input.guesses?.[id] !== undefined && guessIsRight(input.guesses[id]!, round.civilText));
  const innocentsWin = caught.length === outsiders.length && guessedRight.length === 0;

  const points: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const [voter, target] of Object.entries(votes)) {
    if (voter === target || !ids.includes(voter) || !ids.includes(target)) continue;
    if (round.roles[voter]!.kind === 'civil' && outsiders.includes(target)) points[voter]! += IM_POINTS.rightVote;
  }
  for (const id of ids) {
    const kind = round.roles[id]!.kind;
    if (kind === 'civil') {
      if (innocentsWin) points[id]! += IM_POINTS.innocentsWin;
    } else if (!caught.includes(id)) points[id]! += IM_POINTS.outsiderSurvived;
    else if (guessedRight.includes(id)) points[id]! += kind === 'white' ? IM_POINTS.whiteGuessed : IM_POINTS.outsiderGuessed;
  }
  return { counts: tally.counts, caught, outsiders, canGuess, guessedRight, innocentsWin, points };
}

// ---- Sessão: várias partidas na mesma mesa, ranking que soma ----

export interface ImSession {
  scores: Record<string, number>;
  /** Partidas em que a pessoa foi impostor e escapou (desempate). */
  escapes: Record<string, number>;
  games: number;
}

export function newSession(ids: readonly string[]): ImSession {
  return { scores: Object.fromEntries(ids.map((id) => [id, 0])), escapes: Object.fromEntries(ids.map((id) => [id, 0])), games: 0 };
}

/** Soma uma partida ao ranking (quem entrou no meio começa do zero). */
export function addResult(s: ImSession, r: ImResult): ImSession {
  const scores = { ...s.scores };
  const escapes = { ...s.escapes };
  for (const [id, p] of Object.entries(r.points)) {
    scores[id] = (scores[id] ?? 0) + p;
    escapes[id] = escapes[id] ?? 0;
  }
  for (const id of r.outsiders) if (!r.caught.includes(id) || r.guessedRight.includes(id)) escapes[id] = (escapes[id] ?? 0) + 1;
  return { scores, escapes, games: s.games + 1 };
}

export interface ImRankRow {
  id: string;
  points: number;
  position: number;
}

/** Ranking da sessão: mais pontos, depois mais fugas de impostor, depois ordem estável por id. Empates dividem a posição. */
export function sessionRanking(s: ImSession): ImRankRow[] {
  const rows = Object.keys(s.scores)
    .map((id) => ({ id, points: s.scores[id]!, esc: s.escapes[id] ?? 0 }))
    .sort((a, b) => b.points - a.points || b.esc - a.esc || (a.id < b.id ? -1 : 1));
  let pos = 0;
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    if (!prev || prev.points !== r.points || prev.esc !== r.esc) pos = i + 1;
    return { id: r.id, points: r.points, position: pos };
  });
}

/** Líder (ou líderes, em empate perfeito) para a coroa. */
export function leaders(s: ImSession): string[] {
  return sessionRanking(s).filter((r) => r.position === 1).map((r) => r.id);
}

/**
 * Quanto o placar mexeu: "calm" se quase todo mundo ficou onde estava (som 15.3), "brusque" se alguém subiu 2 ou mais
 * lugares ou 3 pessoas ou mais trocaram de posição (som 15.1).
 */
export function rankingShift(before: ImSession, after: ImSession): 'calm' | 'brusque' {
  const a = new Map(sessionRanking(before).map((r) => [r.id, r.position]));
  let changed = 0;
  let maxUp = 0;
  for (const r of sessionRanking(after)) {
    const was = a.get(r.id);
    if (was === undefined) continue;
    if (was !== r.position) changed++;
    maxUp = Math.max(maxUp, was - r.position);
  }
  return maxUp >= 2 || changed >= 3 ? 'brusque' : 'calm';
}

export * from './content';
