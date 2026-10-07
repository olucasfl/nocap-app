import type { Hsb } from '@nocap/games';

/**
 * Uma cor nomeada do Intruso com as dicas que a descrevem. A dica é o que o intruso recebe no
 * lugar da cor, então precisa dar noção real dela (família da cor, claro ou escuro, vivo ou
 * apagado, um objeto que todo mundo conhece) e pode ter piada. O HSB é a cor exata da rodada: a
 * nota de todo mundo é medida contra ele.
 */
export interface PaletteColor {
  name: string;
  hsb: Hsb;
  hints: readonly string[];
}

/** Quantas dicas cada cor tem: poucas, mas todas boas. */
export const HINTS_PER_COLOR = 5;

/** Atalho para escrever a paleta em uma linha por cor (HSB direto). */
export const color = (
  name: string,
  h: number,
  s: number,
  b: number,
  hints: readonly string[],
): PaletteColor => ({ name, hsb: { h, s, b }, hints });

/** Hex (#RRGGBB) para o HSB usado no jogo (H 0–359, S e B 0–100, inteiros). */
export function hexToHsb(hex: string): Hsb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Cor hexadecimal inválida: ${hex}`);
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return {
    h: Math.round(h) % 360,
    s: Math.round(max === 0 ? 0 : (d / max) * 100),
    b: Math.round(max * 100),
  };
}

/**
 * Atalho com a cor em hexadecimal: o nome e a cor ficam amarrados a um valor real, sem
 * conversões de cabeça. É o jeito preferido de escrever cores novas.
 */
export const colorHex = (name: string, hex: string, hints: readonly string[]): PaletteColor => ({
  name,
  hsb: hexToHsb(hex),
  hints,
});
