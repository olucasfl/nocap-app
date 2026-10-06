import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  createMatchSchema,
  guestIdSchema,
  historyQuerySchema,
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
}
