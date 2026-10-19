import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ConnectService } from './connect.service';

const startSchema = z.object({
  kind: z.enum(['daily', 'archive']),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
const moveSchema = z.object({ words: z.array(z.string().min(1).max(30)).length(4) });

/** Connect Word's (spec 034): os grupos ficam no servidor; o aparelho manda 4 palavras e recebe o veredito. */
@Controller('words/wconnect')
@UseGuards(AuthGuard, RateLimitGuard)
export class ConnectController {
  constructor(private readonly connect: ConnectService) {}

  @Get('daily')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  daily(@Req() req: AuthedRequest) {
    return this.connect.dailyStatus(req.user.id);
  }

  @Post('runs')
  @HttpCode(201)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  start(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(startSchema)) body: z.infer<typeof startSchema>) {
    return this.connect.start(req.user.id, body.kind, body.day);
  }

  @Get('runs/:id')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.connect.get(req.user.id, id);
  }

  @Post('runs/:id/moves')
  @HttpCode(200)
  @RateLimit({ limit: 120, windowMs: 60_000 })
  move(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(moveSchema)) body: z.infer<typeof moveSchema>,
  ) {
    return this.connect.move(req.user.id, id, body.words);
  }
}
