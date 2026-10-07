import { describe, expect, it, vi } from 'vitest';
import { rankingQuerySchema } from './ranking.schema';
import type { RankingRow, RankingsRepository } from './rankings.repository';
import type { FriendsService } from '../friends/friends.service';
import { RankingsService } from './rankings.service';

const row = (rank: number, userId = `u${rank}`): RankingRow => ({
  userId,
  username: `jogador${rank}`,
  score: 500 - rank,
  playedAt: '2026-10-06T12:00:00.000Z',
  rank,
});

function setup(rows: RankingRow[], circle: string[] = []) {
  const leaderboard = vi.fn().mockResolvedValue(rows);
  const friends = { circleOf: vi.fn().mockResolvedValue(circle) } as unknown as FriendsService;
  const service = new RankingsService({ leaderboard } as unknown as RankingsRepository, friends);
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

describe('ranking entre amigos', () => {
  const rows = Array.from({ length: 5 }, (_, i) => row(i + 1));

  it('mostra só você e seus amigos, com a posição refeita', async () => {
    const { service } = setup(rows, ['u2', 'u5']);
    const res = await service.color(rankingQuerySchema.parse({ scope: 'friends' }), 'u5');
    expect(res.entries.map((e) => [e.username, e.rank])).toEqual([
      ['jogador2', 1],
      ['jogador5', 2],
    ]);
    expect(res.me).toMatchObject({ rank: 2 });
  });

  it('exige login', async () => {
    const { service } = setup(rows);
    await expect(
      service.color(rankingQuerySchema.parse({ scope: 'friends' }), null),
    ).rejects.toThrow('Entre na sua conta');
  });
});

describe('ranking por jogo', () => {
  it('o Tempo usa o jogo e o modo certos, e "sem estourar" é um quadro próprio', async () => {
    const { service, leaderboard } = setup([]);
    await service.board('time', rankingQuerySchema.parse({ board: 'strict', period: 'all' }), null);
    expect(leaderboard).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'time', mode: 'strict', dailyOnly: false }),
    );
  });

  it('o Daily do Tempo usa o clássico só com partidas de Daily', async () => {
    const { service, leaderboard } = setup([]);
    await service.board('time', rankingQuerySchema.parse({ board: 'daily', period: 'day' }), null);
    expect(leaderboard).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'time', mode: 'classic', dailyOnly: true }),
    );
  });

  it('recusa quadro que o jogo não tem (Flash no Tempo, "sem estourar" na Cor)', async () => {
    const { service } = setup([]);
    await expect(
      service.board('time', rankingQuerySchema.parse({ board: 'flash' }), null),
    ).rejects.toThrow('não existe');
    await expect(
      service.board('color', rankingQuerySchema.parse({ board: 'strict' }), null),
    ).rejects.toThrow('não existe');
  });
});
