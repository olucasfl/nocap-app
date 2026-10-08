import { describe, expect, it } from 'vitest';
import {
  boardChoices,
  defaultPeriod,
  neighborsOf,
  parseRankingsSearch,
  rankingLink,
  type RankingEntry,
} from './ranking';

const e = (rank: number, username: string, score: number, isMe = false): RankingEntry => ({
  rank,
  username,
  score,
  playedAt: 'x',
  isMe,
});

describe('página de ranking', () => {
  it('cada jogo lista os modos dele e o Daily por último', () => {
    expect(boardChoices('eco').map((b) => b.id)).toEqual([
      'classic',
      'escalada',
      'velocidade',
      'reverso',
      'daily',
    ]);
    expect(boardChoices('color').at(-1)?.id).toBe('daily');
    expect(boardChoices('time').some((b) => b.id === 'strict')).toBe(true);
  });

  it('o Daily abre em hoje; os outros na semana', () => {
    expect(defaultPeriod('daily')).toBe('day');
    expect(defaultPeriod('classic')).toBe('week');
  });

  it('a URL só aceita jogo, modo, período e recorte que existem', () => {
    expect(
      parseRankingsSearch({ jogo: 'eco', modo: 'escalada', periodo: 'all', quem: 'friends' }),
    ).toEqual({
      jogo: 'eco',
      modo: 'escalada',
      periodo: 'all',
      quem: 'friends',
    });
    // Modo de outro jogo, jogo inventado e período inválido somem.
    expect(parseRankingsSearch({ jogo: 'color', modo: 'escalada' })).toEqual({ jogo: 'color' });
    expect(parseRankingsSearch({ jogo: 'xadrez', periodo: 'ano', quem: 'todos' })).toEqual({});
    expect(parseRankingsSearch({ modo: 'classic' })).toEqual({});
  });

  it('o link "Ver ranking" leva ao jogo e ao modo jogados', () => {
    expect(rankingLink('time', 'strict')).toEqual({ jogo: 'time', modo: 'strict' });
    expect(rankingLink('color', 'daily')).toEqual({ jogo: 'color', modo: 'daily' });
    expect(rankingLink('eco')).toEqual({ jogo: 'eco' });
    // Quadro que não é do jogo: abre só o jogo.
    expect(rankingLink('eco', 'flash')).toEqual({ jogo: 'eco' });
  });

  it('vizinhos: quanto falta para passar quem está acima e a vantagem sobre quem está abaixo', () => {
    const list = [e(1, 'ana', 300), e(2, 'bia', 250, true), e(3, 'caio', 200)];
    expect(neighborsOf(list)).toEqual({
      above: { username: 'ana', gap: 50 },
      below: { username: 'caio', gap: 50 },
    });
    expect(neighborsOf([e(1, 'eu', 100, true), e(2, 'x', 90)]).above).toBeNull();
    expect(neighborsOf([e(1, 'x', 100)])).toEqual({ above: null, below: null });
  });
});
