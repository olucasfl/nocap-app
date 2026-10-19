import { describe, expect, it } from 'vitest';
import {
  connectNota,
  countSolutions,
  guessKey,
  judgeGuess,
  playConnect,
  validateConnectPuzzle,
  type ConnectPuzzle,
} from './rules';

const puzzle: ConnectPuzzle = {
  id: 't',
  groups: [
    { level: 1, title: 'Frutas', words: ['CAJU', 'GOIABA', 'MAMÃO', 'UVA'] },
    { level: 2, title: 'Partes da camisa', words: ['GOLA', 'PUNHO', 'BOTÃO', 'MANGA'] },
    { level: 3, title: 'Depois de guarda-', words: ['CHUVA', 'ROUPA', 'SOL', 'COSTAS'] },
    { level: 4, title: 'Palíndromos', words: ['ARARA', 'RADAR', 'OVO', 'OSSO'] },
  ],
  traps: [{ word: 'MANGA', alsoFits: 'Frutas' }],
};
const [f, c, g, p] = puzzle.groups.map((x) => x.words);

describe('nota', () => {
  it('vitória por erros e derrota por grupos', () => {
    expect([0, 1, 2, 3, 4].map((e) => connectNota(true, e, 4))).toEqual([10, 8.5, 7, 5.5, 4]);
    expect([0, 1, 2, 3].map((n) => connectNota(false, 5, n))).toEqual([0, 1, 2, 3]);
  });
});

describe('palpite', () => {
  it('acerta, quase acerta e erra', () => {
    expect(judgeGuess(puzzle.groups, f!).result).toBe('correct');
    expect(judgeGuess(puzzle.groups, ['CAJU', 'GOIABA', 'MAMÃO', 'GOLA']).result).toBe('one_away');
    expect(judgeGuess(puzzle.groups, ['CAJU', 'GOIABA', 'GOLA', 'PUNHO']).result).toBe('wrong');
  });

  it('a chave ignora ordem e acento', () => {
    expect(guessKey(['uva', 'MAMAO', 'caju', 'goiaba'])).toBe(guessKey(f!));
  });
});

describe('partida', () => {
  it('vence sem erros em 4 palpites', () => {
    const s = playConnect(puzzle, [f!, c!, g!, p!]);
    expect(s.won).toBe(true);
    expect(s.errors).toBe(0);
    expect(s.nota).toBe(10);
    expect(s.found.map((x) => x.level)).toEqual([1, 2, 3, 4]);
  });

  it('palpite errado custa vida, repetido não custa', () => {
    const wrong = ['CAJU', 'GOIABA', 'MAMÃO', 'GOLA'];
    const s = playConnect(puzzle, [wrong, wrong]);
    expect(s.results).toEqual(['one_away', 'repeat']);
    expect(s.errors).toBe(1);
    expect(s.lives).toBe(4);
  });

  it('perde depois de 5 erros', () => {
    const wrongs = [
      ['GOLA', 'CHUVA', 'ARARA', 'OVO'],
      ['PUNHO', 'ROUPA', 'RADAR', 'OSSO'],
      ['BOTÃO', 'SOL', 'OVO', 'ARARA'],
      ['MANGA', 'COSTAS', 'OSSO', 'RADAR'],
      ['GOLA', 'PUNHO', 'SOL', 'OSSO'],
    ];
    const s = playConnect(puzzle, [f!, ...wrongs]);
    expect(s.over).toBe(true);
    expect(s.won).toBe(false);
    expect(s.found).toHaveLength(1);
    expect(s.nota).toBe(1);
  });

  it('palpite com palavra que já saiu é erro de uso', () => {
    expect(() => playConnect(puzzle, [f!, ['CAJU', 'GOIABA', 'MAMÃO', 'UVA']])).toThrow();
  });
});

describe('validação', () => {
  it('o exemplo da spec passa e a pegadinha resolve por eliminação', () => {
    expect(validateConnectPuzzle(puzzle)).toEqual([]);
    expect(countSolutions(puzzle)).toBe(1);
  });

  it('recusa título que revela palavra, repetição e divisão ambígua', () => {
    const reveals = { ...puzzle, groups: puzzle.groups.map((x, i) => (i === 0 ? { ...x, title: 'Frutas como CAJU' } : x)) };
    expect(validateConnectPuzzle(reveals).join()).toContain('revela');
    const dup = { ...puzzle, groups: puzzle.groups.map((x, i) => (i === 1 ? { ...x, words: ['GOLA', 'PUNHO', 'BOTÃO', 'UVA'] } : x)) };
    expect(validateConnectPuzzle(dup).join()).toContain('repetida');
    const ambiguous: ConnectPuzzle = {
      ...puzzle,
      traps: [
        { word: 'MANGA', alsoFits: 'Frutas' },
        { word: 'UVA', alsoFits: 'Partes da camisa' },
      ],
    };
    expect(validateConnectPuzzle(ambiguous).join()).toContain('divisão');
  });
});
