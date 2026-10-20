import { describe, expect, it } from 'vitest';
import {
  BEE_HINT_UNLOCK,
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
    expect(h.initials).toEqual([
      { letter: 'd', count: 1 },
      { letter: 'e', count: 1 },
      { letter: 't', count: 2 },
    ]);
    expect(h.sizes).toEqual([
      { size: 4, count: 1 },
      { size: 5, count: 2 },
      { size: 7, count: 1 },
    ]);
  });
});

describe('dicas: pangrama', () => {
  it('conta os pangramas que faltam e o tamanho de cada um', () => {
    const h = beeHints(puzzle, []);
    expect(h.pangrams).toBe(1);
    expect(h.pangramsLeft).toBe(1);
    expect(h.pangramSizes).toEqual([7]);
    const done = beeHints(puzzle, ['durante']);
    expect(done.pangramsLeft).toBe(0);
    expect(done.pangramSizes).toEqual([]);
  });
});

describe('dicas: mapa e pares de letras', () => {
  const left = ['durante', 'nada'];
  it('o mapa conta inicial x tamanho só do que falta', () => {
    const h = beeHints(puzzle, left);
    expect(h.map.letters).toEqual(['d', 'e', 't']);
    expect(h.map.sizes).toEqual([4, 5, 7]);
    expect(h.map.rowTotals.reduce((a, b) => a + b, 0)).toBe(h.left);
    expect(h.map.colTotals).toEqual([1, 2, 1]);
    // cada célula bate com a contagem por tamanho e por inicial
    h.map.letters.forEach((l, i) => expect(h.map.rowTotals[i]).toBe(h.byInitial[l]));
    h.map.sizes.forEach((n, j) => expect(h.map.colTotals[j]).toBe(h.bySize[n]));
  });

  it('os pares de letras somam o que falta', () => {
    const h = beeHints(puzzle, left);
    expect(h.pairs.reduce((a, b) => a + b.count, 0)).toBe(h.left);
    for (const p of h.pairs) expect(p.prefix).toHaveLength(2);
  });

  it('as dicas mais fortes só abrem depois de achar parte das palavras (não fica fácil demais)', () => {
    const total = puzzle.words.length;
    expect(BEE_HINT_UNLOCK.map).toBeLessThan(BEE_HINT_UNLOCK.pairs);
    const none = beeHints(puzzle, []);
    expect(none.needMap).toBe(Math.ceil(total * BEE_HINT_UNLOCK.map));
    expect(none.needPairs).toBe(Math.ceil(total * BEE_HINT_UNLOCK.pairs));
    const all = beeHints(puzzle, puzzle.words.map((x) => x.w));
    expect(all.needMap).toBe(0);
    expect(all.needPairs).toBe(0);
    // achar uma palavra aproxima o desbloqueio em uma
    expect(beeHints(puzzle, [puzzle.words[0]!.w]).needMap).toBe(none.needMap - 1);
  });
});

describe('favo novo', () => {
  it('rejeita S, poucas palavras e palavra sem o centro', () => {
    const bad: BeePuzzle = { ...puzzle, letters: ['a', 'e', 'n', 'r', 't', 's'] };
    expect(validateBeePuzzle(bad).length).toBeGreaterThan(0);
    expect(validateBeePuzzle(puzzle)).toContain('lista fora de 25 a 80 palavras');
  });
});
