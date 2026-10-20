import { Body, Controller, Get, HttpCode, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MAX_BATCH, WordsProgressService } from './words-progress.service';

const saveSchema = z.object({
  entries: z.array(z.object({ game: z.string().max(20), level: z.number().int(), data: z.unknown() })).max(MAX_BATCH),
});
type SaveInput = z.infer<typeof saveSchema>;

/** O progresso das fases do Word's (Bee, Connect e Classic) na conta: o mesmo em todos os aparelhos. */
@Controller('me/words-progress')
@UseGuards(AuthGuard, RateLimitGuard)
export class WordsProgressController {
  constructor(private readonly progress: WordsProgressService) {}

  @Get()
  @RateLimit({ limit: 30, windowMs: 60_000 })
  load(@Req() req: AuthedRequest) {
    return this.progress.load(req.user.id);
  }

  @Put()
  @HttpCode(200)
  @RateLimit({ limit: 60, windowMs: 60_000 })
  save(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(saveSchema)) body: SaveInput) {
    return this.progress.save(req.user.id, body.entries);
  }
}
