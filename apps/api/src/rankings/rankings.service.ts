import { Injectable } from '@nestjs/common';
import { periodStart } from '@nocap/games';
import type { RankingQuery } from './ranking.schema';
import { RankingsRepository } from './rankings.repository';

@Injectable()
export class RankingsService {
  constructor(private readonly repo: RankingsRepository) {}

  /** Top N + a posição de quem pediu (se logado e fora do top). Só `@usuario`, nunca o nome real. */
  async color(query: RankingQuery, myUserId: string | null) {
    const rows = await this.repo.leaderboard({
      game: 'color',
      mode: query.board === 'daily' ? 'classic' : query.board,
      dailyOnly: query.board === 'daily',
      since: periodStart(query.period),
    });
    const pick = (r: (typeof rows)[number]) => ({
      rank: r.rank,
      username: r.username,
      score: r.score,
      playedAt: r.playedAt,
    });
    const me = myUserId ? rows.find((r) => r.userId === myUserId) : undefined;
    return {
      board: query.board,
      period: query.period,
      total: rows.length,
      entries: rows.slice(0, query.limit).map((r) => ({ ...pick(r), isMe: r.userId === myUserId })),
      me: me ? pick(me) : null,
    };
  }
}
