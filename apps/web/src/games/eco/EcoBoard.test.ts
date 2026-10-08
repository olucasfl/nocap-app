import { describe, expect, it } from 'vitest';
import { SLOT_OF_PAD } from './EcoBoard';

describe('posição fixa dos botões do Ecooo', () => {
  it('cada botão tem um lugar próprio na grade 3x3', () => {
    expect([...SLOT_OF_PAD].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('os quatro primeiros ficam nos cantos e o quinto no centro', () => {
    expect(SLOT_OF_PAD.slice(0, 4).sort((a, b) => a - b)).toEqual([0, 2, 6, 8]);
    expect(SLOT_OF_PAD[4]).toBe(4);
  });

  it('botão novo nunca troca o lugar de um que já existia', () => {
    // O lugar de um botão depende só do índice dele, não de quantos botões há.
    for (let pads = 4; pads < 9; pads++) {
      for (let i = 0; i < pads; i++) expect(SLOT_OF_PAD[i]).toBe(SLOT_OF_PAD[i]);
    }
    expect(new Set(SLOT_OF_PAD.slice(0, 5)).size).toBe(5);
  });
});
