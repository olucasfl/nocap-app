import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FriendsService } from '../friends/friends.service';
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
  constructor(
    private readonly matches: MatchesService,
    private readonly friends: FriendsService,
  ) {}

  /** Perfil de um amigo: só @usuário e recordes (nunca nome real nem e-mail). Só amigos veem. */
  @Get('friends/:username/profile')
  @UseGuards(AuthGuard, RateLimitGuard)
  @RateLimit({ limit: 60, windowMs: 60_000 })
  async friendProfile(@Req() req: AuthedRequest, @Param('username') username: string) {
    const friend = await this.friends.friendByUsername(req.user.id, username.trim().toLowerCase());
    const [stats, activity, recent] = await Promise.all([
      this.matches.statsOfUser(friend.id),
      this.friends.activityOf(friend.id),
      this.matches.recentOf(friend.id, 20),
    ]);
    return { username: friend.username, stats, ...activity, recent };
  }

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

  @Get('me/matches/:matchId/room')
  @UseGuards(AuthGuard)
  roomMatch(@Req() req: AuthedRequest, @Param('matchId', ParseUUIDPipe) matchId: string) {
    return this.matches.roomOf(req.user.id, matchId);
  }

  @Post('players/claim')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  claim(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(claimSchema)) body: ClaimInput) {
    return this.matches.claim(req.user.id, body.guestId);
  }
}
