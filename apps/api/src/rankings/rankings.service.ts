import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { periodStart } from '@nocap/games';
import { FriendsService } from '../friends/friends.service';
import { BOARDS_OF, type RankingGame, type RankingQuery } from './ranking.schema';
import { RankingsRepository } from './rankings.repository';

@Injectable()
export class RankingsService {
  constructor(
    private readonly repo: RankingsRepository,
    private readonly friends: FriendsService,
  ) {}

  /** Atalho antigo: o ranking da Cor. */
  color(query: RankingQuery, myUserId: string | null) {
    return this.board('color', query, myUserId);
  }

  /** Top N + a posição de quem pediu (se logado e fora do top). Só `@usuario`, nunca o nome real. */
  async board(game: RankingGame, query: RankingQuery, myUserId: string | null) {
    if (!BOARDS_OF[game].includes(query.board)) {
      throw new BadRequestException(`O quadro ${query.board} não existe no jogo ${game}`);
    }
    if (query.scope === 'friends' && !myUserId) {
      throw new UnauthorizedException('Entre na sua conta para ver o ranking dos amigos');
    }
    const all = await this.repo.leaderboard({
      game,
      mode: query.board === 'daily' ? 'classic' : query.board,
      dailyOnly: query.board === 'daily',
      since: periodStart(query.period),
    });
    // Entre amigos, a posição é refeita só com o círculo (você + amigos aceitos).
    const circle =
      query.scope === 'friends' && myUserId ? new Set(await this.friends.circleOf(myUserId)) : null;
    const rows = circle
      ? all.filter((r) => circle.has(r.userId)).map((r, i) => ({ ...r, rank: i + 1 }))
      : all;
    const daily = query.board === 'daily';
    const pick = (r: (typeof rows)[number]) => ({
      rank: r.rank,
      username: r.username,
      score: r.score,
      // Só o Daily soma dias; nos outros quadros a nota é de uma partida.
      ...(daily ? { days: r.days } : {}),
      playedAt: r.playedAt,
    });
    const me = myUserId ? rows.find((r) => r.userId === myUserId) : undefined;
    return {
      game,
      board: query.board,
      scope: query.scope,
      period: query.period,
      total: rows.length,
      entries: rows.slice(0, query.limit).map((r) => ({ ...pick(r), isMe: r.userId === myUserId })),
      me: me ? pick(me) : null,
    };
  }
}
