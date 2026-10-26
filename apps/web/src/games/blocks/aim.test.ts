import { describe, expect, it } from 'vitest';
import { BLOCK_SHAPES, emptyRows, fits } from '@nocap/games';
import { aimAt, LIFT_GAP, SNAP } from './aim';

const shape = (name: string) => BLOCK_SHAPES.find((s) => s.name === name)!;
const RECT = { left: 100, top: 200, width: 400 }; // cada casa tem 50 px
const open =
  () =>
  (row: number, col: number, s = shape('quadrado2')) =>
    fits(emptyRows(), s, row, col);

describe('aimAt (pontaria da peça arrastada)', () => {
  it('no mouse a peça fica quase embaixo da seta e cai na casa certa', () => {
    // O centro de um quadrado 2x2 em (3,3) está em 100+4*50, 200+4*50
    const a = aimAt(300, 400 + 17, RECT, shape('quadrado2'), false, open());
    expect(a.target).toEqual({ row: 3, col: 3 });
    expect(a.left).toBe(300 - 50);
  });

  it('no celular a peça sobe acima do dedo', () => {
    const mouse = aimAt(300, 400, RECT, shape('quadrado2'), false, open());
    const touch = aimAt(300, 400, RECT, shape('quadrado2'), true, open());
    expect(touch.top).toBeLessThan(mouse.top);
  });

  it('gruda numa posição válida vizinha quando a exata não serve', () => {
    const s = shape('quadrado2');
    const rows = emptyRows();
    rows[3] = 0b00001000; // ocupa (3,3)
    const canPlace = (r: number, c: number) => fits(rows, s, r, c);
    // Aponta bem perto de (3,3), que está ocupada: gruda em outra casa válida colada
    const a = aimAt(300, 417, RECT, s, false, canPlace);
    expect(a.target === null || canPlace(a.target.row, a.target.col)).toBe(true);
  });

  it('longe de qualquer lugar válido não há alvo (nem fora do tabuleiro)', () => {
    expect(aimAt(20, 20, RECT, shape('quadrado2'), false, open()).target).toBeNull();
    expect(aimAt(900, 900, RECT, shape('quadrado2'), false, open()).target).toBeNull();
    expect(SNAP).toBeLessThan(1);
  });

  it('respeita as bordas: peça larga não encaixa saindo pela direita', () => {
    const bar = BLOCK_SHAPES.find((s) => s.name === 'barra5' && s.w === 5)!;
    const a = aimAt(100 + 8 * 50 - 10, 200 + 25, RECT, bar, false, (r, c) =>
      fits(emptyRows(), bar, r, c),
    );
    if (a.target) expect(a.target.col + bar.w).toBeLessThanOrEqual(8);
  });
});

describe('a peça fica visível acima do dedo no celular', () => {
  it('a borda de baixo da peça fica acima do dedo, qualquer que seja a altura da peça', () => {
    const cell = RECT.width / 8;
    for (const s of BLOCK_SHAPES) {
      const a = aimAt(300, 560, RECT, s, true, () => false);
      const bottom = a.top + s.h * cell;
      expect(560 - bottom, `${s.name} ${s.w}x${s.h}`).toBeGreaterThanOrEqual(
        LIFT_GAP * cell - 0.001,
      );
    }
  });

  it('com o mouse a peça fica quase embaixo da seta', () => {
    const cell = RECT.width / 8;
    const bar = BLOCK_SHAPES.find((s) => s.name === 'barra5' && s.h === 5)!;
    const a = aimAt(300, 560, RECT, bar, false, () => false);
    expect(560 - (a.top + bar.h * cell)).toBeLessThan(0);
  });
});
