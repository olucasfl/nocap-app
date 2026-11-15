/** Regras do Mini Golf (spec 082): par de cada fase, limite de tacadas, tempo e os nomes do golfe. */

/** Par de cada fase (índice 0 = fase 1). As 20 primeiras são as do Open Golf; da 21 em diante são nossas (spec 082). */
export const GOLF_PARS = [2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5] as const;
export const GOLF_LEVELS = GOLF_PARS.length;
export type GolfTier = 'easy' | 'medium' | 'hard';
/** As fases de cada dificuldade, na ordem em que se joga (a "próxima fase" segue esta ordem). */
export const GOLF_TIERS: Record<GolfTier, readonly number[]> = {
  easy: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  medium: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
  hard: [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
};
export const GOLF_TIER_LABEL: Record<GolfTier, string> = { easy: 'Fácil', medium: 'Média', hard: 'Difícil' };
export const GOLF_ORDER: readonly number[] = [...GOLF_TIERS.easy, ...GOLF_TIERS.medium, ...GOLF_TIERS.hard];
export const golfTierOf = (level: number): GolfTier => (GOLF_TIERS.easy.includes(level) ? 'easy' : GOLF_TIERS.medium.includes(level) ? 'medium' : 'hard');
/** A fase que vem depois (na ordem fácil, média, difícil); `null` na última. */
export const golfNextLevel = (level: number): number | null => GOLF_ORDER[GOLF_ORDER.indexOf(level) + 1] ?? null;
/** Máximo de tacadas por buraco. */
export const GOLF_STROKE_LIMIT = 16;
/** Quem não encaçapa (tempo ou limite) conta o limite mais isto. */
export const GOLF_FAIL_EXTRA = 2;
export const GOLF_FAIL_STROKES = GOLF_STROKE_LIMIT + GOLF_FAIL_EXTRA;
/** Tempo por buraco no online, em segundos (a sala escolhe). */
export const GOLF_HOLE_SECONDS = [60, 180, 300] as const;
export const GOLF_HOLE_SECONDS_DEFAULT = 180;
/** Quantidade de buracos que a sala pode escolher. */
export const GOLF_HOLE_COUNTS = [3, 6, 9, 12, 18, 20] as const;

export const golfParOf = (level: number): number => GOLF_PARS[Math.max(1, Math.min(GOLF_LEVELS, level)) - 1]!;

export type GolfScoreName = 'ace' | 'albatross' | 'eagle' | 'birdie' | 'par' | 'bogey' | 'double' | 'triple' | 'fail';

/** O nome do resultado: ACE é 1 tacada; os demais vêm da diferença para o par. `fail` = não encaçapou. */
export function golfScoreName(strokes: number, par: number, holed = true): GolfScoreName {
  if (!holed) return 'fail';
  if (strokes <= 1) return 'ace';
  const d = strokes - par;
  if (d <= -3) return 'albatross';
  if (d === -2) return 'eagle';
  if (d === -1) return 'birdie';
  if (d === 0) return 'par';
  if (d === 1) return 'bogey';
  if (d === 2) return 'double';
  return 'triple';
}

export const GOLF_SCORE_LABEL: Record<GolfScoreName, string> = {
  ace: 'ACE',
  albatross: 'Albatross',
  eagle: 'Eagle',
  birdie: 'Birdie',
  par: 'Par',
  bogey: 'Bogey',
  double: 'Double Bogey',
  triple: 'Triple Bogey',
  fail: 'Fim das tacadas',
};

/** Tacadas que contam na pontuação: as feitas, ou o máximo mais 2 se não encaçapou. */
export const golfCountedStrokes = (strokes: number, holed: boolean): number => (holed ? Math.min(strokes, GOLF_STROKE_LIMIT) : GOLF_FAIL_STROKES);
