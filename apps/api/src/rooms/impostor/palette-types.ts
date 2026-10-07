import type { Hsb } from '@nocap/games';

/**
 * Uma cor nomeada do Intruso com as dicas que a descrevem. A dica é o que o intruso recebe no
 * lugar da cor, então precisa ajudar de verdade (objeto, comparação, temperatura) e pode ter
 * piada. O HSB é a cor exata da rodada: a nota de todo mundo é medida contra ele.
 */
export interface PaletteColor {
  name: string;
  hsb: Hsb;
  hints: readonly string[];
}

/** Atalho para escrever a paleta em uma linha por cor. */
export const color = (
  name: string,
  h: number,
  s: number,
  b: number,
  hints: readonly string[],
): PaletteColor => ({ name, hsb: { h, s, b }, hints });
