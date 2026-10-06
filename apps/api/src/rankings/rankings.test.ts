import { describe, expect, it, vi } from 'vitest';
import { rankingQuerySchema } from './ranking.schema';
import type { RankingRow, RankingsRepository } from './rankings.repository';
import { RankingsService } from './rankings.service';

const row = (rank: number, userId = `u${rank}`): RankingRow => ({
  userId,
  username: `jogador${rank}`,
  score: 500 - rank,
  playedAt: '2026-10-06T12:00:00.000Z',
  rank,
});

function setup(rows: RankingRow[]) {
  const leaderboard = vi.fn().mockResolvedValue(rows);
  const service = new RankingsService({ leaderboard } as unknown as RankingsRepository);
  return { service, leaderboard };
}

describe('rankingQuerySchema', () => {
  it('usa Clássico e semana por padrão e limita o tamanho', () => {
    const q = rankingQuerySchema.parse({});
    expect(q).toMatchObject({ board: 'classic', period: 'week', limit: 50 });
    expect(rankingQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
    expect(rankingQuerySchema.safeParse({ board: 'zzz' }).success).toBe(false);
  });
});

describe('RankingsService.color', () => {
  it('devolve só o top pedido e o total', async () => {
    const { service } = setup(Array.from({ length: 5 }, (_, i) => row(i + 1)));
    const res = await service.color(rankingQuerySchema.parse({ limit: 3 }), null);
    expect(res.entries.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(res.total).toBe(5);
    expect(res.me).toBeNull();
  });

  it('marca quem pediu e devolve a posição dele mesmo fora do top', async () => {
    const { service } = setup(Array.from({ length: 5 }, (_, i) => row(i + 1)));
    const res = await service.color(rankingQuerySchema.parse({ limit: 2 }), 'u4');
    expect(res.entries.some((e) => e.isMe)).toBe(false);
    expect(res.me).toMatchObject({ rank: 4, username: 'jogador4' });
  });

  it('nunca expõe id de usuário', async () => {
    const { service } = setup([row(1)]);
    const res = await service.color(rankingQuerySchema.parse({}), 'u1');
    expect(JSON.stringify(res)).not.toContain('userId');
    expect(res.entries[0]).toMatchObject({ isMe: true });
  });

  it('o ranking do Daily usa o modo clássico só com partidas de Daily', async () => {
    const { service, leaderboard } = setup([]);
    await service.color(rankingQuerySchema.parse({ board: 'daily', period: 'day' }), null);
    expect(leaderboard).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'color', mode: 'classic', dailyOnly: true }),
    );
  });

  it('o rápido tem ranking próprio (modo quick)', async () => {
    const { service, leaderboard } = setup([]);
    await service.color(rankingQuerySchema.parse({ board: 'quick', period: 'all' }), null);
    expect(leaderboard).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'quick', dailyOnly: false, since: null }),
    );
  });
});
