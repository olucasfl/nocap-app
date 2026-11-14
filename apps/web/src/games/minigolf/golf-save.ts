/** Salvo no aparelho (a conta vem na etapa do servidor): melhor marca por fase e a cor da bola. */
const BEST = 'nocap-golf-best';
const BALL = 'nocap-golf-ball';

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
export function saveBest(level: number, strokes: number): Record<number, number> {
  const b = loadBest();
  if (!b[level] || strokes < b[level]!) b[level] = strokes;
  try {
    localStorage.setItem(BEST, JSON.stringify(b));
  } catch {
    /* sem armazenamento */
  }
  return b;
}
export function loadBall(): number {
  try {
    const n = Number(localStorage.getItem(BALL));
    return Number.isFinite(n) && n > 0 ? n : 0xffc83d;
  } catch {
    return 0xffc83d;
  }
}
