import { describe, expect, it } from 'vitest';
import { classifyMatch, gameLabel, modeLabel, scoreParts } from './history';
import { boardChoices, boardMax, parseRankingsSearch, rankingLink } from './ranking';
import { countUnit, formatBest, formatCount, gameModes, knownModes, modeMax, type Stats } from './stats';

describe('Atravessa! no ranking, histórico e recordes', () => {
  it('tem só o Infinito, sem Daily, e o link do ranking leva a ele', () => {
    expect(boardChoices('atravessa').map((b) => b.id)).toEqual(['infinito']);
    expect(rankingLink('atravessa', 'infinito')).toEqual({ jogo: 'atravessa', modo: 'infinito' });
    expect(rankingLink('atravessa', 'daily')).toEqual({ jogo: 'atravessa' });
    expect(parseRankingsSearch({ jogo: 'atravessa', modo: 'infinito', quem: 'friends' })).toEqual({
      jogo: 'atravessa',
      modo: 'infinito',
      quem: 'friends',
    });
    expect(parseRankingsSearch({ jogo: 'atravessa', modo: 'daily' })).toEqual({ jogo: 'atravessa' });
    expect(boardMax('atravessa', 'infinito')).toBe(0);
  });

  it('o Sinal Vermelho não existe mais no ranking', () => {
    expect(parseRankingsSearch({ jogo: 'sinal', modo: 'infinito' })).toEqual({});
  });

  it('a nota é em linhas (guardada em décimos de linha)', () => {
    expect(countUnit('atravessa', 'infinito')).toBe('linhas');
    expect(formatCount(1230, 'linhas')).toBe('123 linhas');
    expect(formatCount(10, 'linhas')).toBe('1 linha');
    expect(formatBest('atravessa', 'infinito', 4500)).toBe('450 linhas');
    expect(modeMax('atravessa', 'infinito')).toBe(0);
    expect(knownModes('atravessa')).toEqual(['infinito']);
  });

  it('o histórico mostra linhas e classifica pela distância', () => {
    const item = (n: number) => ({ game: 'atravessa', mode: 'infinito', answers: null, placement: null, totalScore: n * 10 });
    expect(scoreParts(item(250))).toEqual({ main: '250', unit: ' linhas' });
    expect(classifyMatch(item(200)).tone).toBe('top');
    expect(classifyMatch(item(90)).tone).toBe('good');
    expect(classifyMatch(item(30)).tone).toBe('mid');
    expect(classifyMatch(item(10)).tone).toBe('low');
    expect(gameLabel('atravessa')).toBe('Atravessa!');
    expect(modeLabel('infinito')).toBe('Infinito');
  });

  it('os recordes do servidor entram na lista de modos do jogo', () => {
    const none = { current: 0, best: 0, playedToday: false, totalScore: null };
    const stats: Stats = {
      modes: [{ game: 'atravessa', mode: 'infinito', matches: 1, best: 900, average: 900 }],
      daily: { color: none, time: none, eco: none, blocks: none, atravessa: none, wclassic: none, wbee: none, wconnect: none },
      visit: { current: 0, best: 0, visitedToday: false },
    };
    expect(gameModes(stats, 'atravessa').map((m) => m.mode)).toEqual(['infinito']);
  });
});
