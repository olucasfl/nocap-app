import { describe, expect, it } from 'vitest';
import { classifyMatch, gameLabel, modeLabel, scoreParts } from './history';
import { boardChoices, boardMax, parseRankingsSearch, rankingLink } from './ranking';
import { countUnit, formatBest, formatCount, gameModes, knownModes, modeMax, type Stats } from './stats';

describe('Sinal Vermelho no ranking, histórico e recordes', () => {
  it('tem os dois modos, sem Daily, e o link do ranking leva a eles', () => {
    expect(boardChoices('sinal').map((b) => b.id)).toEqual(['infinito', 'classico']);
    expect(rankingLink('sinal', 'infinito')).toEqual({ jogo: 'sinal', modo: 'infinito' });
    expect(rankingLink('sinal', 'daily')).toEqual({ jogo: 'sinal' });
    expect(parseRankingsSearch({ jogo: 'sinal', modo: 'classico', quem: 'friends' })).toEqual({
      jogo: 'sinal',
      modo: 'classico',
      quem: 'friends',
    });
    expect(parseRankingsSearch({ jogo: 'sinal', modo: 'daily' })).toEqual({ jogo: 'sinal' });
    expect(boardMax('sinal', 'infinito')).toBe(0);
  });

  it('a nota é em metros (guardada em décimos de metro)', () => {
    expect(countUnit('sinal', 'infinito')).toBe('metros');
    expect(formatCount(1234, 'metros')).toBe('123 m');
    expect(formatBest('sinal', 'classico', 4500)).toBe('450 m');
    expect(modeMax('sinal', 'infinito')).toBe(0);
    expect(knownModes('sinal').sort()).toEqual(['classico', 'infinito']);
  });

  it('o histórico mostra metros e classifica pela distância', () => {
    const item = (m: number) => ({ game: 'sinal', mode: 'infinito', answers: null, placement: null, totalScore: m * 10 });
    expect(scoreParts(item(250))).toEqual({ main: '250', unit: ' m' });
    expect(classifyMatch(item(700)).tone).toBe('top');
    expect(classifyMatch(item(350)).tone).toBe('good');
    expect(classifyMatch(item(150)).tone).toBe('mid');
    expect(classifyMatch(item(40)).tone).toBe('low');
    expect(gameLabel('sinal')).toBe('Sinal Vermelho');
    expect(modeLabel('infinito')).toBe('Infinito');
    expect(modeLabel('classico')).toBe('Clássico');
  });

  it('os recordes do servidor entram na lista de modos do jogo', () => {
    const stats: Stats = {
      modes: [
        { game: 'sinal', mode: 'classico', matches: 2, best: 3100, average: 2000 },
        { game: 'sinal', mode: 'infinito', matches: 1, best: 900, average: 900 },
      ],
      daily: {
        color: { current: 0, best: 0, playedToday: false, totalScore: null },
        time: { current: 0, best: 0, playedToday: false, totalScore: null },
        eco: { current: 0, best: 0, playedToday: false, totalScore: null },
        sinal: { current: 0, best: 0, playedToday: false, totalScore: null },
        blocks: { current: 0, best: 0, playedToday: false, totalScore: null },
      },
      visit: { current: 0, best: 0, visitedToday: false },
    };
    expect(gameModes(stats, 'sinal').map((m) => m.mode)).toEqual(['infinito', 'classico']);
  });
});
