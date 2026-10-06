import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';

export interface RankingRow {
  userId: string;
  username: string;
  /** Décimos (500 = 50.0). */
  score: number;
  playedAt: string;
  rank: number;
}

@Injectable()
export class RankingsRepository {
  constructor(@Inject(DB) private readonly maybeDb: Db | null) {}

  /**
   * Melhor partida de cada conta (convidado não entra: não tem nome), só presets (`ranked`).
   * Empate na nota vale quem chegou lá primeiro.
   */
  async leaderboard(opts: {
    game: string;
    mode: string;
    dailyOnly: boolean;
    since: Date | null;
  }): Promise<RankingRow[]> {
    if (!this.maybeDb) throw new ServiceUnavailableException('Banco de dados não configurado');
    const dailyOnly = opts.dailyOnly ? sql`and m.kind = 'daily'` : sql``;
    const since = opts.since
      ? sql`and mp.played_at >= ${opts.since.toISOString()}::timestamptz`
      : sql``;

    const rows = await this.maybeDb.execute<{
      user_id: string;
      username: string;
      score: number;
      played_at: Date;
      rank: string;
    }>(sql`
      with best as (
        select distinct on (u.id) u.id as user_id, u.username, mp.total_score as score, mp.played_at
        from match_players mp
        join matches m on m.id = mp.match_id
        join players p on p.id = mp.player_id
        join auth_user u on u.id = p.user_id
        where m.game = ${opts.game} and m.mode = ${opts.mode} and m.ranked
          and u.username is not null
          ${dailyOnly}
          ${since}
        order by u.id, mp.total_score desc, mp.played_at asc
      )
      select user_id, username, score, played_at,
             row_number() over (order by score desc, played_at asc) as rank
      from best
      order by rank
    `);

    return rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      score: r.score,
      playedAt: new Date(r.played_at).toISOString(),
      rank: Number(r.rank),
    }));
  }
}
