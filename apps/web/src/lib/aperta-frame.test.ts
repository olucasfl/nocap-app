import { describe, expect, it } from 'vitest';
import { frameFor, frameStyle } from './aperta-frame';

describe('moldura do Aperta! no celular', () => {
  it('celular deitado: ocupa a janela, sem giro', () => {
    expect(frameFor(874, 402, true)).toEqual({ mode: 'landscape', iw: 874, ih: 402 });
    expect(frameStyle(frameFor(874, 402, true))).toBeUndefined();
  });

  it('celular em pé: troca largura e altura e gira 90 graus para o canto certo', () => {
    const f = frameFor(402, 874, true);
    expect(f.mode).toBe('rotated');
    expect(frameStyle(f)).toMatchObject({ width: 874, height: 402, transform: 'translateX(402px) rotate(90deg)', transformOrigin: '0 0' });
  });

  it('virar o aparelho várias vezes sempre dá a mesma moldura para o mesmo tamanho (sem estado escondido)', () => {
    const a = frameFor(402, 874, true);
    frameFor(874, 402, true);
    frameFor(402, 874, true);
    expect(frameFor(402, 874, true)).toEqual(a);
  });

  it('PC, mouse e tablet ficam livres (nunca giram)', () => {
    expect(frameFor(1280, 720, false).mode).toBe('free');
    expect(frameFor(390, 844, false).mode).toBe('free');
    expect(frameFor(820, 1180, true).mode).toBe('free');
    expect(frameStyle(frameFor(820, 1180, true))).toBeUndefined();
  });

  it('o limite é o lado curto de 599 px', () => {
    expect(frameFor(599, 900, true).mode).toBe('rotated');
    expect(frameFor(600, 900, true).mode).toBe('free');
  });
});
