import { dailyDate } from '@nocap/games';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';

const USER = '99999999-9999-4999-8999-999999999999';
const NOW = new Date('2026-10-07T15:00:00Z'); // quarta, 12h em São Paulo
const day = (offset: number) => dailyDate(new Date(NOW.getTime() - offset * 86_400_000));
const at = (offset: number) => new Date(NOW.getTime() - offset * 86_400_000);

function setup(over: Partial<Record<keyof MatchesRepository, unknown>> = {}) {
  const repo = {
    playerIdsOf: vi.fn().mockResolvedValue(['p1']),
    modeStats: vi.fn().mockResolvedValue([]),
    dailyPlays: vi.fn().mockResolvedValue([]),
    dailyToday: vi.fn().mockResolvedValue([]),
    visitDays: vi.fn().mockResolvedValue([]),
    recordVisit: vi.fn().mockResolvedValue(undefined),
    ...over,
  } as unknown as MatchesRepository;
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  return { service: new MatchesService(repo), repo };
}

describe('estatísticas por conta', () => {
  afterEach(() => vi.useRealTimers());

  it('cada jogo tem a sua sequência de Daily, separada', async () => {
    const { service } = setup({
      dailyPlays: vi.fn().mockResolvedValue([
        { game: 'color', playedAt: at(0) },
        { game: 'color', playedAt: at(1) },
        { game: 'color', playedAt: at(2) },
        { game: 'time', playedAt: at(1) },
      ]),
      dailyToday: vi.fn().mockResolvedValue([{ game: 'color', totalScore: 412 }]),
    });
    const { daily } = await service.statsOfUser(USER);
    expect(daily.color).toEqual({ current: 3, best: 3, playedToday: true, totalScore: 412 });
    // O Tempo jogou só ontem: a sequência ainda vale, mas hoje não jogou.
    expect(daily.time).toEqual({ current: 1, best: 1, playedToday: false, totalScore: null });
  });

  it('a sequência de visitas conta os dias seguidos abrindo o app, sem depender de jogar', async () => {
    const { service } = setup({
      visitDays: vi.fn().mockResolvedValue([day(0), day(1), day(2), day(5)]),
    });
    const { visit } = await service.statsOfUser(USER);
    expect(visit).toEqual({ current: 3, best: 3, visitedToday: true });
  });

  it('sem visita hoje a sequência de ontem ainda vale, mas não conta hoje', async () => {
    const { service } = setup({ visitDays: vi.fn().mockResolvedValue([day(1), day(2)]) });
    const { visit } = await service.statsOfUser(USER);
    expect(visit).toEqual({ current: 2, best: 2, visitedToday: false });
  });

  it('abrir o app grava o dia e devolve a sequência atualizada', async () => {
    const days = [day(1), day(2)];
    const { service, repo } = setup({
      visitDays: vi.fn().mockImplementation(async () => [...days, day(0)]),
    });
    const res = await service.visit(USER);
    expect(repo.recordVisit).toHaveBeenCalledWith(USER, day(0));
    expect(res).toEqual({ current: 3, best: 3, visitedToday: true });
  });
});
