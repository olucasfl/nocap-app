import { describe, expect, it } from 'vitest';
import { BLOCK_SHAPES, emptyRows, fits } from '@nocap/games';
import { aimAt, SNAP } from './aim';

const shape = (name: string) => BLOCK_SHAPES.find((s) => s.name === name)!;
const RECT = { left: 100, top: 200, width: 400 }; // cada casa tem 50 px
const open = () => (row: number, col: number, s = shape('quadrado2')) => fits(emptyRows(), s, row, col);

describe('aimAt (pontaria da peça arrastada)', () => {
  it('a sombra fica acima da peça que está na mão', () => {
    const s = shape('quadrado2');
    // O dedo em (300, 560): a peça fica sob o dedo e a sombra cai bem acima dela, no tabuleiro
    const a = aimAt(300, 560, RECT, s, true, open());
    expect(a.target).not.toBeNull();
    const shadowTop = RECT.top + a.target!.row * 50;
    expect(shadowTop + 2 * 50).toBeLessThanOrEqual(a.top + 25); // a sombra termina onde a peça começa (com folga)
    expect(a.left).toBe(300 - 50);
  });

  it('a peça tem a posição certa na mão: no celular um pouco acima do dedo', () => {
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
    const a = aimAt(300, 520, RECT, s, false, canPlace);
    expect(a.target === null || canPlace(a.target.row, a.target.col)).toBe(true);
  });

  it('longe de qualquer lugar válido não há alvo (nem fora do tabuleiro)', () => {
    expect(aimAt(20, 20, RECT, shape('quadrado2'), false, open()).target).toBeNull();
    expect(aimAt(900, 900, RECT, shape('quadrado2'), false, open()).target).toBeNull();
    expect(SNAP).toBeLessThan(1);
  });

  it('respeita as bordas: peça larga não encaixa saindo pela direita', () => {
    const bar = BLOCK_SHAPES.find((s) => s.name === 'barra5' && s.w === 5)!;
    const a = aimAt(100 + 8 * 50 - 10, 200 + 25, RECT, bar, false, (r, c) => fits(emptyRows(), bar, r, c));
    if (a.target) expect(a.target.col + bar.w).toBeLessThanOrEqual(8);
  });
});
