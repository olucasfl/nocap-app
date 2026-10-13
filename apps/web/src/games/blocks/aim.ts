import { SIZE, type BlockShape } from '@nocap/games';

export interface BoardRect {
  left: number;
  top: number;
  /** Largura do tabuleiro em px; a altura é a mesma (a grade é quadrada). */
  width: number;
}

export interface Aim {
  /** Onde fica o canto de cima à esquerda da peça que o dedo carrega, em px da tela. */
  left: number;
  top: number;
  /** A casa onde ela encaixaria, ou `null` se não há lugar válido perto. */
  target: { row: number; col: number } | null;
}

/** Até onde (em casas) a peça "gruda" numa posição válida vizinha. */
export const SNAP = 0.95;

/**
 * Para onde a peça aponta, como no Block Blast: a peça fica na mão (um tanto acima do dedo, para o
 * dedo não esconder) e a SOMBRA, que mostra onde ela vai cair de verdade, fica acima da peça, à
 * vista. Quanto mais alta a peça, mais a sombra sobe, para uma não cobrir a outra. Se a casa exata
 * não serve mas uma vizinha serve e está perto, gruda nela: encaixar não exige pontaria de cirurgião.
 */
export function aimAt(
  px: number,
  py: number,
  rect: BoardRect,
  shape: BlockShape,
  touch: boolean,
  canPlace: (row: number, col: number) => boolean,
): Aim {
  const cell = rect.width / SIZE;
  const hand = touch ? cell * 0.7 : cell * 0.2;
  const left = px - (shape.w * cell) / 2;
  const top = py - hand - (shape.h * cell) / 2;
  // A sombra fica uma peça e meia acima da que está na mão.
  const gap = (shape.h / 2 + 0.55) * cell;
  const fc = (left - rect.left) / cell;
  const fr = (top - gap - rect.top) / cell;
  const r0 = Math.round(fr);
  const c0 = Math.round(fc);
  let best: { row: number; col: number; d: number } | null = null;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const row = r0 + dr;
      const col = c0 + dc;
      if (row < 0 || col < 0 || row + shape.h > SIZE || col + shape.w > SIZE) continue;
      const d = Math.hypot(row - fr, col - fc);
      if (d > SNAP || (best && d >= best.d)) continue;
      if (canPlace(row, col)) best = { row, col, d };
    }
  }
  return { left, top, target: best ? { row: best.row, col: best.col } : null };
}
