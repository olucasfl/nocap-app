import { describe, expect, it } from 'vitest';
import {
  beeHints,
  beeMaxPoints,
  beeNota,
  beePoints,
  beeRank,
  beeScore,
  checkBeeWord,
  isBeePangram,
  validateBeePuzzle,
  type BeePuzzle,
} from './rules';

// letras A D E N R T U, centro D (o exemplo da spec)
const puzzle: BeePuzzle = {
  id: 'teste',
  center: 'd',
  letters: ['a', 'e', 'n', 'r', 't', 'u'],
  words: [
    { w: 'durante', pangram: true },
    { w: 'nada' },
    { w: 'data' },
    { w: 'tarde' },
    { w: 'entrada' },
    { w: 'tendê' },
  ],
};

describe('pontos', () => {
  it('4 letras valem 1; maiores valem o tamanho; pangrama soma 7', () => {
    expect(beePoints('rota', false)).toBe(1);
    expect(beePoints('carta', false)).toBe(5);
    expect(beePoints('acorde', false)).toBe(6);
    expect(beePoints('durante', true)).toBe(14);
  });

  it('acento não conta como letra a mais', () => {
    expect(beePoints('ação', false)).toBe(1);
    expect(beePoints('coração', false)).toBe(7);
  });

  it('reconhece o pangrama', () => {
    expect(isBeePangram('durante', puzzle)).toBe(true);
    expect(isBeePangram('tarde', puzzle)).toBe(false);
  });
});

describe('palavra enviada', () => {
  it('aceita, mostra a forma correta e dá os pontos', () => {
    const r = checkBeeWord(puzzle, [], 'TENDE');
    expect(r).toEqual({ ok: true, shown: 'tendê', points: 5, pangram: false });
    expect(checkBeeWord(puzzle, [], 'durante')).toMatchObject({ ok: true, points: 14, pangram: true });
  });

  it('recusa curta, sem o centro, com letra de fora, repetida e fora da lista', () => {
    expect(checkBeeWord(puzzle, [], 'tad')).toEqual({ ok: false, reason: 'short' });
    expect(checkBeeWord(puzzle, [], 'rate')).toEqual({ ok: false, reason: 'center' });
    expect(checkBeeWord(puzzle, [], 'dado')).toEqual({ ok: false, reason: 'letters' });
    expect(checkBeeWord(puzzle, ['nada'], 'nada')).toEqual({ ok: false, reason: 'dup' });
    expect(checkBeeWord(puzzle, [], 'dente')).toEqual({ ok: false, reason: 'notlisted' });
  });
});

describe('patentes e nota', () => {
  it('o máximo e a soma das achadas', () => {
    expect(beeMaxPoints(puzzle)).toBe(14 + 1 + 1 + 5 + 7 + 5);
    expect(beeScore(puzzle, ['nada', 'durante', 'fora'])).toBe(15);
  });

  it('sobe de patente pela porcentagem e Rainha só com tudo', () => {
    expect(beeRank(0, 200).id).toBe('iniciante');
    expect(beeRank(4, 200).id).toBe('bom-comeco');
    expect(beeRank(80, 200).id).toBe('incrivel');
    expect(beeRank(140, 200).id).toBe('genio');
    expect(beeRank(199, 200).id).toBe('genio');
    expect(beeRank(200, 200).id).toBe('rainha');
  });

  it('chegar a 70% dá nota 10', () => {
    expect(beeNota(140, 200)).toBe(10);
    expect(beeNota(300, 200)).toBe(10);
    expect(beeNota(70, 200)).toBe(5);
    expect(beeNota(0, 200)).toBe(0);
  });
});

describe('dicas', () => {
  it('contam o que falta sem mostrar palavras', () => {
    const h = beeHints(puzzle, ['durante', 'nada']);
    expect(h.left).toBe(4);
    expect(h.pangramsLeft).toBe(0);
    expect(h.bySize).toEqual({ 4: 1, 5: 2, 7: 1 });
    expect(h.byInitial).toEqual({ d: 1, t: 2, e: 1 });
  });
});

describe('favo novo', () => {
  it('rejeita S, poucas palavras e palavra sem o centro', () => {
    const bad: BeePuzzle = { ...puzzle, letters: ['a', 'e', 'n', 'r', 't', 's'] };
    expect(validateBeePuzzle(bad).length).toBeGreaterThan(0);
    expect(validateBeePuzzle(puzzle)).toContain('lista fora de 25 a 80 palavras');
  });
});
