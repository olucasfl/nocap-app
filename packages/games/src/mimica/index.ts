import { createRng } from '../core/rng';

/**
 * Regras puras da Mímica da mesa (spec 089): modos, calendário de turnos, sorteio de palavras, pontos e ranking.
 * Serve ao modo Mesa (um celular, offline). Nada aqui depende de tela.
 */

export type MimFormat = 'teams' | 'solo';
export type MimStyle = 'classic' | 'speed';

export const MIM_MIN_TEAMS = 2;
export const MIM_MAX_TEAMS = 5;
export const MIM_MIN_PLAYERS = 2;
export const MIM_MAX_PLAYERS = 12;
export const MIM_MIN_ROUNDS = 1;
export const MIM_MAX_ROUNDS = 5;
export const MIM_SECONDS_CHOICES = [30, 60, 90, 120] as const;
export const MIM_DEFAULT_SECONDS: Readonly<Record<MimStyle, number>> = { classic: 90, speed: 60 };
/** Clássico: opções de palavra mostradas a quem faz a mímica. */
export const MIM_OPTIONS = 3;
/** Speed: pulos por turno (voltam a 3 no turno seguinte). */
export const MIM_SPEED_SKIPS = 3;

export const MIM_POINTS = {
  /** Clássico em Times: o time da mímica acertou no tempo. */
  teamsGuess: 3,
  /** Clássico em Times: cada outro time que acertou no roubo (o time da mímica fica com 0). */
  teamsSteal: 1,
  /** Clássico Individual: quem acertou primeiro, e quem fez a mímica. */
  soloGuesser: 3,
  soloMimer: 2,
  /** Speed em Times: por palavra acertada. */
  speedTeamsWord: 1,
  /** Speed Individual: por palavra, quem faz a mímica ganha mais, quem acerta ganha menos. */
  speedSoloMimer: 2,
  speedSoloGuesser: 1,
} as const;

export interface MimSettings {
  format: MimFormat;
  style: MimStyle;
  seconds: number;
  rounds: number;
  categories: readonly string[];
}

export interface MimWord {
  id: string;
  category: string;
  text: string;
  /** `classic` = palavras maiores e variadas; `speed` = curtas e rápidas (inclui o tema Ações). */
  pool: MimStyle;
}

/** Número de lados (times ou pessoas) permitido para o formato. */
export function mimSidesValid(format: MimFormat, count: number): boolean {
  return format === 'teams'
    ? count >= MIM_MIN_TEAMS && count <= MIM_MAX_TEAMS
    : count >= MIM_MIN_PLAYERS && count <= MIM_MAX_PLAYERS;
}

/** Total de turnos: 2 times e 5 rodadas são 10 mímicas, 3 times e 5 rodadas são 15. */
export function mimTotalTurns(sides: number, rounds: number): number {
  return sides * rounds;
}

export interface MimTurn {
  index: number;
  /** 1, 2, ... */
  round: number;
  side: string;
}

/** Calendário fixo: em cada rodada todo lado joga uma vez, sempre na mesma ordem. */
export function mimSchedule(sides: readonly string[], rounds: number): MimTurn[] {
  const out: MimTurn[] = [];
  for (let r = 1; r <= rounds; r++) for (const side of sides) out.push({ index: out.length, round: r, side });
  return out;
}

/** Duração aproximada em minutos: o relógio de cada turno mais o tempo de passar o celular, escolher e marcar os pontos. */
export function mimEstimateMinutes(style: MimStyle, seconds: number, sides: number, rounds: number): number {
  const overhead = style === 'classic' ? 40 : 30;
  return Math.max(1, Math.ceil((mimTotalTurns(sides, rounds) * (seconds + overhead)) / 60));
}

function pool(words: readonly MimWord[], s: Pick<MimSettings, 'style' | 'categories'>): MimWord[] {
  return words.filter((w) => w.pool === s.style && s.categories.includes(w.category));
}

function shuffle<T>(list: readonly T[], rng: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Palavras novas primeiro; só repete quando o conjunto acaba. */
function freshFirst(words: MimWord[], used: readonly string[], rng: () => number): MimWord[] {
  const set = new Set(used);
  return [...shuffle(words.filter((w) => !set.has(w.id)), rng), ...shuffle(words.filter((w) => set.has(w.id)), rng)];
}

/** Clássico: 3 opções diferentes para quem faz a mímica escolher uma. */
export function mimDrawOptions(input: {
  words: readonly MimWord[];
  settings: MimSettings;
  used: readonly string[];
  seed: string;
  turnIndex: number;
}): MimWord[] {
  const list = pool(input.words, { style: 'classic', categories: input.settings.categories });
  if (list.length < MIM_OPTIONS) throw new Error('poucas palavras nos temas escolhidos');
  return freshFirst(list, input.used, createRng(`${input.seed}|opt|${input.turnIndex}`)).slice(0, MIM_OPTIONS);
}

/** Speed: um baralho embaralhado para o turno (as palavras novas vêm antes das já usadas). */
export function mimDrawDeck(input: {
  words: readonly MimWord[];
  settings: MimSettings;
  used: readonly string[];
  seed: string;
  turnIndex: number;
  size?: number;
}): MimWord[] {
  const list = pool(input.words, { style: 'speed', categories: input.settings.categories });
  if (list.length === 0) throw new Error('poucas palavras nos temas escolhidos');
  return freshFirst(list, input.used, createRng(`${input.seed}|deck|${input.turnIndex}`)).slice(0, input.size ?? 40);
}

/* Turno do Speed: palavra atual, acertos e pulos (máximo 3 por turno). */

export interface MimSpeedTurn {
  deck: readonly MimWord[];
  /** Posição da palavra atual no baralho. */
  at: number;
  correct: readonly string[];
  skipped: readonly string[];
}

export function mimSpeedStart(deck: readonly MimWord[]): MimSpeedTurn {
  return { deck, at: 0, correct: [], skipped: [] };
}

export function mimSpeedCurrent(t: MimSpeedTurn): MimWord | null {
  return t.deck[t.at] ?? null;
}

export function mimSpeedSkipsLeft(t: MimSpeedTurn): number {
  return MIM_SPEED_SKIPS - t.skipped.length;
}

export function mimSpeedCorrect(t: MimSpeedTurn): MimSpeedTurn {
  const w = mimSpeedCurrent(t);
  return w ? { ...t, at: t.at + 1, correct: [...t.correct, w.id] } : t;
}

/** Sem pulos sobrando, nada muda. Pular não tira ponto. */
export function mimSpeedSkip(t: MimSpeedTurn): MimSpeedTurn {
  const w = mimSpeedCurrent(t);
  return w && mimSpeedSkipsLeft(t) > 0 ? { ...t, at: t.at + 1, skipped: [...t.skipped, w.id] } : t;
}

/* Pontos: sempre devolvem o que somar a cada lado (time ou pessoa). */

export type MimPoints = Record<string, number>;

export function mimScoreClassicTeams(input: { mimer: string; guessed: boolean; stealers: readonly string[] }): MimPoints {
  if (input.guessed) return { [input.mimer]: MIM_POINTS.teamsGuess };
  const out: MimPoints = {};
  for (const id of new Set(input.stealers)) if (id !== input.mimer) out[id] = MIM_POINTS.teamsSteal;
  return out;
}

export function mimScoreClassicSolo(input: { mimer: string; guesser: string | null }): MimPoints {
  if (input.guesser === null || input.guesser === input.mimer) return {};
  return { [input.guesser]: MIM_POINTS.soloGuesser, [input.mimer]: MIM_POINTS.soloMimer };
}

export function mimScoreSpeedTeams(input: { mimer: string; correct: number }): MimPoints {
  return { [input.mimer]: input.correct * MIM_POINTS.speedTeamsWord };
}

/** Quantos acertos ainda faltam distribuir na tela "Quem acertou?". */
export function mimRemainingToAssign(correct: number, guessedBy: Readonly<Record<string, number>>): number {
  return correct - Object.values(guessedBy).reduce((a, b) => a + b, 0);
}

/**
 * Speed Individual: quem faz a mímica ganha por todas as palavras; quem adivinhou ganha só pelas que foram marcadas.
 * Acertos sem dono ("ninguém específico") só pontuam para quem fez a mímica.
 */
export function mimScoreSpeedSolo(input: { mimer: string; correct: number; guessedBy: Readonly<Record<string, number>> }): MimPoints {
  if (mimRemainingToAssign(input.correct, input.guessedBy) < 0) throw new Error('mais acertos marcados do que palavras acertadas');
  const out: MimPoints = { [input.mimer]: input.correct * MIM_POINTS.speedSoloMimer };
  for (const [id, n] of Object.entries(input.guessedBy)) {
    if (id === input.mimer || n <= 0) continue;
    out[id] = (out[id] ?? 0) + n * MIM_POINTS.speedSoloGuesser;
  }
  return out;
}

/* Ranking da partida (times ou pessoas), com empate dividindo a posição. */

export interface MimSession {
  scores: Record<string, number>;
  /** Turnos já jogados. */
  turns: number;
}

export function mimNewSession(ids: readonly string[]): MimSession {
  return { scores: Object.fromEntries(ids.map((id) => [id, 0])), turns: 0 };
}

export function mimApply(s: MimSession, points: MimPoints): MimSession {
  const scores = { ...s.scores };
  for (const [id, n] of Object.entries(points)) scores[id] = (scores[id] ?? 0) + n;
  return { scores, turns: s.turns + 1 };
}

export interface MimRankRow {
  id: string;
  score: number;
  /** 1, 2, ...; empatados dividem a mesma posição. */
  position: number;
}

export function mimRanking(s: MimSession): MimRankRow[] {
  const rows = Object.entries(s.scores).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  let position = 0;
  let last: number | null = null;
  return rows.map(([id, score], i) => {
    if (score !== last) {
      position = i + 1;
      last = score;
    }
    return { id, score, position };
  });
}

/** `brusque` quando alguém sobe 2 lugares ou mais, ou 3 lados ou mais trocam de posição (mesma ideia do Impostor). */
export function mimShift(before: MimSession, after: MimSession): 'calm' | 'brusque' {
  const was = new Map(mimRanking(before).map((r) => [r.id, r.position]));
  let changed = 0;
  let maxUp = 0;
  for (const r of mimRanking(after)) {
    const w = was.get(r.id);
    if (w === undefined) continue;
    if (w !== r.position) changed++;
    maxUp = Math.max(maxUp, w - r.position);
  }
  return maxUp >= 2 || changed >= 3 ? 'brusque' : 'calm';
}

/** Vencedores (vários em caso de empate no primeiro lugar). */
export function mimWinners(s: MimSession): string[] {
  return mimRanking(s)
    .filter((r) => r.position === 1)
    .map((r) => r.id);
}
