import { BATIDA_LANES } from '@nocap/games';

/**
 * Perspectiva da pista do Eco Hero: a pista vai de um horizonte (alto, estreito) até os moldes
 * (perto, largos). `K` é a força da perspectiva; `HORIZON` e `HIT` são a altura do horizonte e dos
 * moldes, em fração do campo. Tudo vira `transform` (posição e escala): nada de layout por quadro.
 */
export const K = 2.6;
export const HORIZON = 0.05;
/** Altura (fração do campo) do centro dos moldes: onde a nota tem que estar na hora de apertar. */
export const HIT = 0.84;
export const S_FAR = 1 / (1 + K);

/** Onde uma nota está na tela: `z` = 1 no fundo, 0 no molde, negativo depois dele. */
export function project(z: number, lane: number, w: number, h: number) {
  const s = 1 / (1 + K * Math.max(-0.2, z));
  const u = (s - S_FAR) / (1 - S_FAR);
  return {
    scale: s,
    x: w / 2 + (lane - (BATIDA_LANES - 1) / 2) * (w / BATIDA_LANES) * s,
    y: h * (HORIZON + (HIT - HORIZON) * u),
    /** Surge devagar no fundo e some depois de passar do molde. */
    opacity: z > 0 ? Math.min(1, u / 0.14) : Math.max(0, 1 + z / 0.2),
  };
}
