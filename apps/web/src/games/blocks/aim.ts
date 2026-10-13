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

/** Quantas casas a borda de baixo da peça fica acima do dedo (no celular). */
export const LIFT_GAP = 1.3;

/** Até onde (em casas) a peça "gruda" numa posição válida vizinha. */
export const SNAP = 0.95;

/**
 * Para onde a peça aponta. No celular a peça fica acima do dedo (senão o dedo a esconde); com o
 * mouse ela fica quase embaixo da seta. Se a casa exata não serve mas uma vizinha serve e está
 * perto, gruda nela: assim encaixar não exige pontaria de cirurgião.
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
  // No celular a peça sobe o bastante para a borda de baixo dela ficar bem acima do dedo, de qualquer
  // altura (barra de 5 em pé, 3x3...): dá para ver onde ela vai cair. Com o mouse, fica quase embaixo da seta.
  const lift = touch ? (shape.h / 2 + LIFT_GAP) * cell : cell * 0.35;
  const left = px - (shape.w * cell) / 2;
  const top = py - lift - (shape.h * cell) / 2;
  const fc = (left - rect.left) / cell;
  const fr = (top - rect.top) / cell;
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
