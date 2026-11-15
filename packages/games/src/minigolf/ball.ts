/** A bola do Mini Golf (spec 082): cor, acabamento e rastro. Validação aqui, para o aparelho e a API usarem a mesma. */
export const GOLF_BALL_COLORS = [
  0xf4f4f0, 0xff7d26, 0xffc83d, 0xb8f03a, 0x2bb36a, 0x26c6c0, 0x2f5bff, 0x5cc8ff, 0x8b5cf6, 0xff5fa8, 0xff4a3a, 0x1b1f1c,
] as const;
export const GOLF_BALL_COLOR_NAMES = ['Branca', 'Laranja', 'Amarela', 'Lima', 'Verde', 'Turquesa', 'Azul', 'Céu', 'Roxa', 'Rosa', 'Vermelha', 'Preta'] as const;
export const GOLF_FINISHES = ['liso', 'listras', 'pontos', 'metade', 'estrela'] as const;
export const GOLF_TRAILS = ['nenhum', 'faiscas', 'fogo', 'neve'] as const;
export type GolfFinish = (typeof GOLF_FINISHES)[number];
export type GolfTrail = (typeof GOLF_TRAILS)[number];
export const GOLF_FINISH_LABEL: Record<GolfFinish, string> = { liso: 'Liso', listras: 'Listras', pontos: 'Pontos', metade: 'Metade', estrela: 'Estrela' };
export const GOLF_TRAIL_LABEL: Record<GolfTrail, string> = { nenhum: 'Nenhum', faiscas: 'Faíscas', fogo: 'Fogo', neve: 'Neve' };

export interface GolfBallLook {
  color: number;
  /** Cor das listras, pontos, metade e estrela; sem ela o acabamento usa branco (ou cinza em bola clara). */
  color2?: number;
  finish: GolfFinish;
  trail: GolfTrail;
}
export const GOLF_BALL_DEFAULT: GolfBallLook = { color: 0xffc83d, finish: 'liso', trail: 'nenhum' };

/** Lê o que veio do armazenamento ou da conta; o que não vale vira o padrão, campo a campo. */
export function parseGolfBall(v: unknown): GolfBallLook {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const c = o.color;
  const c2 = o.color2;
  return {
    ...(typeof c2 === 'number' && Number.isInteger(c2) && c2 >= 0 && c2 <= 0xffffff ? { color2: c2 } : {}),
    color: typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= 0xffffff ? c : GOLF_BALL_DEFAULT.color,
    finish: (GOLF_FINISHES as readonly unknown[]).includes(o.finish) ? (o.finish as GolfFinish) : GOLF_BALL_DEFAULT.finish,
    trail: (GOLF_TRAILS as readonly unknown[]).includes(o.trail) ? (o.trail as GolfTrail) : GOLF_BALL_DEFAULT.trail,
  };
}
