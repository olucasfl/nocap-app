import { describe, expect, it } from 'vitest';
import { colorModes, streakLabel, type Stats } from './stats';

const stats: Stats = {
  modes: [
    { game: 'color', mode: 'quick', matches: 2, best: 85, average: 70 },
    { game: 'color', mode: 'classic', matches: 4, best: 400, average: 300 },
    { game: 'time', mode: 'classic', matches: 1, best: 100, average: 100 },
    { game: 'color', mode: 'zzz', matches: 1, best: 10, average: 10 },
  ],
  daily: { current: 0, best: 0, playedToday: false },
};

describe('stats', () => {
  it('filtra só os modos da Cor conhecidos e ordena como na tela de início', () => {
    expect(colorModes(stats).map((m) => m.mode)).toEqual(['classic', 'quick']);
  });

  it('escreve a sequência no singular e no plural', () => {
    expect(streakLabel(1)).toBe('1 dia');
    expect(streakLabel(5)).toBe('5 dias');
  });
});
