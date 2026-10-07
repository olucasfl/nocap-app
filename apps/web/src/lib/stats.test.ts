import { describe, expect, it } from 'vitest';
import { dailyMax, gameModes, modeMax, streakLabel, type Stats } from './stats';

const stats: Stats = {
  modes: [
    { game: 'color', mode: 'quick', matches: 2, best: 85, average: 70 },
    { game: 'color', mode: 'classic', matches: 4, best: 400, average: 300 },
    { game: 'time', mode: 'classic', matches: 1, best: 100, average: 100 },
    { game: 'time', mode: 'strict', matches: 2, best: 250, average: 200 },
    { game: 'color', mode: 'zzz', matches: 1, best: 10, average: 10 },
  ],
  daily: {
    color: { current: 0, best: 0, playedToday: false, totalScore: null },
    time: { current: 0, best: 0, playedToday: false, totalScore: null },
  },
  visit: { current: 0, best: 0, visitedToday: false },
};

describe('stats', () => {
  it('separa os jogos, ordena como na tela de início e ignora modo desconhecido', () => {
    expect(gameModes(stats, 'color').map((m) => m.mode)).toEqual(['classic', 'quick']);
    expect(gameModes(stats, 'time').map((m) => m.mode)).toEqual(['classic', 'strict']);
  });

  it('o máximo de pontos depende do jogo: Cor 5 rodadas (50), Tempo 3 rodadas (30)', () => {
    expect(modeMax('color', 'classic')).toBe(50);
    expect(modeMax('time', 'classic')).toBe(30);
    expect(modeMax('time', 'strict')).toBe(30);
    expect(modeMax('color', 'quick')).toBe(10);
    expect(modeMax('time', 'quick')).toBe(10);
    expect(modeMax('color', 'strict')).toBeUndefined();
    expect(dailyMax('color')).toBe(50);
    expect(dailyMax('time')).toBe(30);
  });

  it('escreve a sequência no singular e no plural', () => {
    expect(streakLabel(1)).toBe('1 dia');
    expect(streakLabel(5)).toBe('5 dias');
  });
});
