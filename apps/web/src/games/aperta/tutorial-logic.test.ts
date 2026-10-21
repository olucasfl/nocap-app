import { describe, expect, it } from 'vitest';
import { arrowSide, arrowX, cardSide, displayStep, padRect, tutorialPageAllowed, tutorialView, veilPieces } from './tutorial-logic';

describe('passos do tutorial', () => {
  it('cada passo tem seu alvo e seu "N de 5"', () => {
    expect(tutorialView(1, null)).toMatchObject({ step: 1, total: 5, target: 'press', arrow: true });
    expect(tutorialView(2, null).target).toBe('ok');
    expect(tutorialView(3, null).target).toBe('dock-upgrades');
    expect(tutorialView(4, 'upgrades').target).toBe('buy-pulse');
    expect(tutorialView(5, null).target).toBe('dock-grimoires');
    expect(tutorialView(5, 'grimoires')).toMatchObject({ target: 'grimoires-page', finish: true, arrow: false });
  });

  it('retomar no passo 4 ou 5 sem a página aberta aponta de volta para a dock', () => {
    expect(tutorialView(4, null).target).toBe('dock-upgrades');
    expect(tutorialView(5, 'upgrades').target).toBe('dock-grimoires');
    expect(tutorialView(5, 'upgrades').finish).toBe(false);
  });

  it('o passo 3 já aparece como 4 com Melhorias aberta', () => {
    expect(displayStep(3, 'upgrades')).toBe(4);
    expect(tutorialView(3, 'upgrades').step).toBe(4);
    expect(displayStep(3, null)).toBe(3);
  });

  it('só deixa abrir a página do passo', () => {
    expect(tutorialPageAllowed(3, 'upgrades')).toBe(true);
    expect(tutorialPageAllowed(4, 'grimoires')).toBe(false);
    expect(tutorialPageAllowed(5, 'grimoires')).toBe(true);
    expect(tutorialPageAllowed(5, 'upgrades')).toBe(false);
    expect(tutorialPageAllowed(1, 'upgrades')).toBe(false);
    expect(tutorialPageAllowed(2, 'tree')).toBe(false);
  });
});

describe('véu e posições', () => {
  const bounds = { w: 400, h: 800 };
  const area = (rs: { w: number; h: number }[]) => rs.reduce((a, r) => a + r.w * r.h, 0);

  it('as faixas cobrem tudo menos o buraco', () => {
    const hole = { x: 100, y: 300, w: 120, h: 80 };
    const pieces = veilPieces(hole, bounds);
    expect(area(pieces)).toBe(400 * 800 - 120 * 80);
    for (const p of pieces) {
      const overlaps = p.x < hole.x + hole.w && p.x + p.w > hole.x && p.y < hole.y + hole.h && p.y + p.h > hole.y;
      expect(overlaps).toBe(false);
    }
  });

  it('buraco colado na borda não gera faixa vazia, e sem alvo o véu é inteiro', () => {
    const edge = { x: 0, y: 700, w: 400, h: 100 };
    expect(veilPieces(edge, bounds)).toEqual([{ x: 0, y: 0, w: 400, h: 700 }]);
    expect(veilPieces(null, bounds)).toEqual([{ x: 0, y: 0, w: 400, h: 800 }]);
  });

  it('o respiro não sai da tela', () => {
    expect(padRect({ x: 2, y: 790, w: 396, h: 10 }, 6, bounds)).toEqual({ x: 0, y: 784, w: 400, h: 16 });
  });

  it('cartão e seta ficam do lado oposto ao alvo', () => {
    const low = { x: 10, y: 700, w: 100, h: 60 };
    const high = { x: 10, y: 150, w: 100, h: 60 };
    expect(cardSide(low, 800)).toBe('top');
    expect(cardSide(high, 800)).toBe('bottom');
    expect(cardSide(null, 800)).toBe('top');
    expect(arrowSide(low, 800)).toBe('above');
    expect(arrowSide(high, 800)).toBe('below');
  });

  it('a seta foge do cartão: sem espaço acima do alvo, vai para baixo', () => {
    const mid = { x: 10, y: 230, w: 100, h: 200 };
    expect(arrowSide(mid, 600)).toBe('above');
    expect(arrowSide(mid, 600, 190)).toBe('below');
    expect(arrowSide({ x: 10, y: 300, w: 100, h: 280 }, 600, 0, 0)).toBe('above');
    expect(arrowSide({ x: 10, y: 20, w: 100, h: 200 }, 600, 0, 0)).toBe('below');
  });

  it('a seta não passa das bordas', () => {
    expect(arrowX({ x: 0, y: 0, w: 20, h: 20 }, 320, 60)).toBe(68);
    expect(arrowX({ x: 300, y: 0, w: 20, h: 20 }, 320, 60)).toBe(252);
    expect(arrowX({ x: 100, y: 0, w: 100, h: 20 }, 320, 60)).toBe(150);
  });
});
