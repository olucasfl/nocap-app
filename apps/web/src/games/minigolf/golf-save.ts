import { GOLF_BALL_DEFAULT, parseGolfBall, type GolfBallLook } from '@nocap/games';

/**
 * Salvo no aparelho: a bola (cor, acabamento e rastro) e a melhor marca de cada fase. `golf-account.ts` leva as duas
 * coisas para a conta (spec 082); cada mudança avisa por `GOLF_CHANGED`.
 */
const BEST = 'nocap-golf-best';
const BALL = 'nocap-golf-ball2';
export const GOLF_CHANGED = 'nocap-golf-changed';
export const golfNotify = () => {
  try {
    window.dispatchEvent(new Event(GOLF_CHANGED));
  } catch {
    /* sem janela */
  }
};

export function loadBest(): Record<number, number> {
  try {
    const v = JSON.parse(localStorage.getItem(BEST) ?? '{}') as Record<string, unknown>;
    const out: Record<number, number> = {};
    for (const [k, n] of Object.entries(v)) if (typeof n === 'number' && n > 0) out[Number(k)] = n;
    return out;
  } catch {
    return {};
  }
}
function writeBest(b: Record<number, number>) {
  try {
    localStorage.setItem(BEST, JSON.stringify(b));
  } catch {
    /* sem armazenamento */
  }
}
export function saveBest(level: number, strokes: number): Record<number, number> {
  const b = loadBest();
  if (!b[level] || strokes < b[level]!) b[level] = strokes;
  writeBest(b);
  golfNotify();
  return b;
}
/** Junta as marcas da conta às do aparelho (vale a menor de cada fase). */
export function mergeBest(remote: Record<string, number>) {
  const b = loadBest();
  for (const [k, v] of Object.entries(remote)) if (!b[Number(k)] || v < b[Number(k)]!) b[Number(k)] = v;
  writeBest(b);
}

export function loadLook(): GolfBallLook {
  try {
    const raw = localStorage.getItem(BALL);
    return raw ? parseGolfBall(JSON.parse(raw)) : GOLF_BALL_DEFAULT;
  } catch {
    return GOLF_BALL_DEFAULT;
  }
}
export function saveLook(look: GolfBallLook) {
  try {
    localStorage.setItem(BALL, JSON.stringify(look));
  } catch {
    /* sem armazenamento */
  }
  golfNotify();
}

const PROGRESS = 'nocap-golf-progress';
/** A fase que a pessoa começou e ainda não terminou (buraco feito ou limite de tacadas), para mostrar "em andamento". */
export function loadProgress(): number | null {
  try {
    const n = Number(localStorage.getItem(PROGRESS));
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
export function setProgress(level: number | null) {
  try {
    if (level === null) localStorage.removeItem(PROGRESS);
    else localStorage.setItem(PROGRESS, String(level));
  } catch {
    /* sem armazenamento */
  }
}
