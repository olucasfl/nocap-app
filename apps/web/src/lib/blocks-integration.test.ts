import { describe, expect, it } from 'vitest';
import { classifyMatch, gameLabel, scoreParts } from './history';
import { boardChoices, boardMax, parseRankingsSearch, rankingLink } from './ranking';
import { countUnit, formatBest, formatCount, gameModes, knownModes, modeMax, type Stats } from './stats';

describe("Block's no ranking, histórico e recordes", () => {
  it('tem o quadro classic, sem Daily, e o link do ranking leva a ele', () => {
    expect(boardChoices('blocks').map((b) => b.id)).toEqual(['classic', 'towers']);
    expect(rankingLink('blocks', 'classic')).toEqual({ jogo: 'blocks', modo: 'classic' });
    expect(rankingLink('blocks', 'daily')).toEqual({ jogo: 'blocks' });
    expect(parseRankingsSearch({ jogo: 'blocks', modo: 'classic', quem: 'friends' })).toEqual({
      jogo: 'blocks',
      modo: 'classic',
      quem: 'friends',
    });
    expect(boardMax('blocks', 'classic')).toBe(0);
  });

  it('a nota é em pontos (guardada em décimos)', () => {
    expect(countUnit('blocks', 'classic')).toBe('pontos');
    expect(countUnit('blocks', 'towers')).toBe('peças');
    expect(formatCount(70, 'peças')).toBe('7 peças');
    expect(formatCount(25_000, 'pontos')).toBe('2.500 pontos');
    expect(formatBest('blocks', 'classic', 12_340)).toBe('1.234 pontos');
    expect(modeMax('blocks', 'classic')).toBe(0);
    expect(knownModes('blocks').sort()).toEqual(['classic', 'towers']);
  });

  it('o histórico mostra pontos e classifica pela pontuação', () => {
    const item = (p: number) => ({ game: 'blocks', mode: 'classic', answers: null, placement: null, totalScore: p * 10 });
    expect(scoreParts(item(1234))).toEqual({ main: '1234', unit: ' pts' });
    expect(classifyMatch(item(400000)).tone).toBe('top');
    expect(classifyMatch(item(80000)).tone).toBe('good');
    expect(classifyMatch(item(20000)).tone).toBe('mid');
    expect(classifyMatch(item(3000)).tone).toBe('low');
    expect(gameLabel('blocks')).toBe("Block's");
  });

  it('os recordes do servidor entram na lista de modos do jogo', () => {
    const none = { current: 0, best: 0, playedToday: false, totalScore: null };
    const stats: Stats = {
      modes: [{ game: 'blocks', mode: 'classic', matches: 3, best: 31_000, average: 20_000 }],
      daily: { color: none, time: none, eco: none, blocks: none, atravessa: none, wclassic: none, wbee: none },
      visit: { current: 0, best: 0, visitedToday: false },
    };
    expect(gameModes(stats, 'blocks').map((m) => m.mode)).toEqual(['classic']);
  });
});
