import { describe, expect, it } from 'vitest';
import {
  connectClass,
  connectHint,
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

describe('classificação', () => {
  it('quem conclui é classificado pelos erros; desistir é Desistência', () => {
    expect([0, 1, 2, 3, 5, 6, 12].map((e) => connectClass(true, e, false).id)).toEqual([
      'perfeito',
      'muito-bom',
      'muito-bom',
      'bom',
      'bom',
      'concluida',
      'concluida',
    ]);
    expect(connectClass(false, 3, true)).toEqual({ id: 'desistencia', name: 'Desistência' });
    expect(connectClass(false, 0, false).id).toBe('desistencia');
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
    expect(s.found.map((x) => x.level)).toEqual([1, 2, 3, 4]);
  });

  it('palpite errado soma 1 ao contador de erros, repetido não soma', () => {
    const wrong = ['CAJU', 'GOIABA', 'MAMÃO', 'GOLA'];
    const s = playConnect(puzzle, [wrong, wrong]);
    expect(s.results).toEqual(['one_away', 'repeat']);
    expect(s.errors).toBe(1);
    expect(s.over).toBe(false);
  });

  it('não há vidas: muitos erros não acabam a fase, e dá para concluir mesmo assim', () => {
    const wrongs = [
      ['GOLA', 'CHUVA', 'ARARA', 'OVO'],
      ['PUNHO', 'ROUPA', 'RADAR', 'OSSO'],
      ['BOTÃO', 'SOL', 'OVO', 'ARARA'],
      ['MANGA', 'COSTAS', 'OSSO', 'RADAR'],
      ['GOLA', 'PUNHO', 'SOL', 'OSSO'],
      ['GOLA', 'ROUPA', 'OVO', 'RADAR'],
      ['PUNHO', 'CHUVA', 'ARARA', 'OSSO'],
    ];
    const open = playConnect(puzzle, [f!, ...wrongs]);
    expect(open.errors).toBe(7);
    expect(open.over).toBe(false);
    expect(open.won).toBe(false);
    const done = playConnect(puzzle, [f!, ...wrongs, c!, g!, p!]);
    expect(done.won).toBe(true);
    expect(done.errors).toBe(7);
    expect(connectClass(done.won, done.errors, done.gaveUp).id).toBe('concluida');
  });

  it('desistir acaba a fase sem vitória e revela o que faltava', () => {
    const s = playConnect(puzzle, [f!], { gaveUp: true });
    expect(s.gaveUp).toBe(true);
    expect(s.over).toBe(true);
    expect(s.won).toBe(false);
    expect(s.found).toHaveLength(1);
    expect(s.left).toHaveLength(12);
    // quem já venceu não "desiste"
    expect(playConnect(puzzle, [f!, c!, g!, p!], { gaveUp: true }).gaveUp).toBe(false);
  });

  it('a dica dá o nome do grupo mais fácil que ainda falta, sem palavras', () => {
    expect(connectHint(puzzle, [])?.title).toBe('Frutas');
    expect(connectHint(puzzle, [f!])?.title).toBe('Partes da camisa');
    expect(connectHint(puzzle, [f!, c!, g!, p!])).toBeNull();
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
