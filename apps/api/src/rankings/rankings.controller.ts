import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import type { Auth } from '../auth/auth';
import { AUTH } from '../auth/auth.constants';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';
import {
  RANKING_GAMES,
  rankingQuerySchema,
  type RankingGame,
  type RankingQuery,
} from './ranking.schema';
import { RankingsService } from './rankings.service';

@Controller('rankings')
export class RankingsController {
  constructor(
    private readonly rankings: RankingsService,
    @Inject(AUTH) private readonly auth: Auth | null,
  ) {}

  /** Público; se vier um token válido, devolve também a posição de quem pediu. */
  @Get(':game')
  async board(
    @Param('game', new ZodValidationPipe(z.enum(RANKING_GAMES))) game: RankingGame,
    @Query(new ZodValidationPipe(rankingQuerySchema)) query: RankingQuery,
    @Headers() headers: IncomingHttpHeaders,
  ) {
    const session = await this.auth?.api
      .getSession({ headers: fromNodeHeaders(headers) })
      .catch(() => null);
    return this.rankings.board(game, query, session?.user.id ?? null);
  }
}
