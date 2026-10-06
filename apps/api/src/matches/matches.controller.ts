import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  claimSchema,
  createMatchSchema,
  guestIdSchema,
  historyQuerySchema,
  type ClaimInput,
  type CreateMatchInput,
  type HistoryQuery,
} from './match.schema';
import { MatchesService } from './matches.service';

@Controller()
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Post('matches')
  @HttpCode(201)
  create(@Body(new ZodValidationPipe(createMatchSchema)) body: CreateMatchInput) {
    return this.matches.create(body);
  }

  @Get('players/:guestId/matches')
  history(
    @Param('guestId', new ZodValidationPipe(guestIdSchema)) guestId: string,
    @Query(new ZodValidationPipe(historyQuerySchema)) query: HistoryQuery,
  ) {
    return this.matches.history(guestId, query);
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
