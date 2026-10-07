import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  claimSchema,
  createMatchSchema,
  historyQuerySchema,
  type ClaimInput,
  type CreateMatchInput,
  type HistoryQuery,
} from './match.schema';
import { MatchesService } from './matches.service';

@Controller()
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  /** Só com conta: o convidado pode ver o app, mas não joga. */
  @Post('matches')
  @HttpCode(201)
  @UseGuards(AuthGuard, RateLimitGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createMatchSchema)) body: CreateMatchInput,
  ) {
    return this.matches.create(body, req.user.id);
  }

  /** O app foi aberto hoje (sequência de dias seguidos no NoCap). */
  @Post('me/visit')
  @HttpCode(200)
  @UseGuards(AuthGuard, RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  visit(@Req() req: AuthedRequest) {
    return this.matches.visit(req.user.id);
  }

  @Get('me/stats')
  @UseGuards(AuthGuard)
  myStats(@Req() req: AuthedRequest) {
    return this.matches.statsOfUser(req.user.id);
  }

  @Get('me/matches')
  @UseGuards(AuthGuard)
  myHistory(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(historyQuerySchema)) query: HistoryQuery,
  ) {
    return this.matches.historyOf(req.user.id, query);
  }

  @Post('players/claim')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  claim(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(claimSchema)) body: ClaimInput) {
    return this.matches.claim(req.user.id, body.guestId);
  }
}
