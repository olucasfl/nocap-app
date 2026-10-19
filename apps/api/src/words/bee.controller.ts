import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BeeService } from './bee.service';

const startSchema = z.object({
  kind: z.enum(['daily', 'archive', 'free']),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
const moveSchema = z.object({ word: z.string().min(1).max(30) });

/** Bee Word's (spec 035): o favo e as palavras ficam no servidor; o aparelho manda palavras e recebe o resultado. */
@Controller('words/wbee')
@UseGuards(AuthGuard, RateLimitGuard)
export class BeeController {
  constructor(private readonly bee: BeeService) {}

  @Get('daily')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  daily(@Req() req: AuthedRequest) {
    return this.bee.dailyStatus(req.user.id);
  }

  @Post('runs')
  @HttpCode(201)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  start(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(startSchema)) body: z.infer<typeof startSchema>) {
    return this.bee.start(req.user.id, body.kind, body.day);
  }

  @Get('runs/:id')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.bee.get(req.user.id, id);
  }

  @Get('runs/:id/hints')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  hints(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.bee.hints(req.user.id, id);
  }

  @Post('runs/:id/moves')
  @HttpCode(200)
  @RateLimit({ limit: 240, windowMs: 60_000 })
  move(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(moveSchema)) body: z.infer<typeof moveSchema>,
  ) {
    return this.bee.move(req.user.id, id, body.word);
  }

  @Post('runs/:id/finish')
  @HttpCode(200)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  finish(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.bee.finish(req.user.id, id);
  }
}
