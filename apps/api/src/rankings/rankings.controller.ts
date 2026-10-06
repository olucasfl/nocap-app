import { Controller, Get, Headers, Query } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import type { Auth } from '../auth/auth';
import { AUTH } from '../auth/auth.constants';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { rankingQuerySchema, type RankingQuery } from './ranking.schema';
import { RankingsService } from './rankings.service';

@Controller('rankings')
export class RankingsController {
  constructor(
    private readonly rankings: RankingsService,
    @Inject(AUTH) private readonly auth: Auth | null,
  ) {}

  /** Público; se vier um token válido, devolve também a posição de quem pediu. */
  @Get('color')
  async color(
    @Query(new ZodValidationPipe(rankingQuerySchema)) query: RankingQuery,
    @Headers() headers: IncomingHttpHeaders,
  ) {
    const session = await this.auth?.api
      .getSession({ headers: fromNodeHeaders(headers) })
      .catch(() => null);
    return this.rankings.color(query, session?.user.id ?? null);
  }
}
