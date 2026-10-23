import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ApertaAccessGuard } from './aperta-access';
import { ApertaService, SLOTS } from './aperta.service';

const putSchema = z.object({
  data: z.unknown(),
  baseRevision: z.number().int().min(0),
  overwrite: z.boolean().optional(),
});
type PutBody = z.infer<typeof putSchema>;

const slotPipe = new ParseIntPipe({
  exceptionFactory: () => new BadRequestException('Espaço inválido'),
});

function slotOf(raw: number): number {
  if (!(SLOTS as readonly number[]).includes(raw)) throw new BadRequestException('Espaço inválido');
  return raw;
}

/**
 * Os saves do Aperta! (spec 038, seção 10): exigem conta (sem sessão o `AuthGuard` responde 401) e o servidor
 * é a fonte da verdade. Convidado não joga, e enquanto o jogo está em teste só as contas liberadas passam (403).
 */
@Controller('me/aperta/saves')
@UseGuards(AuthGuard, ApertaAccessGuard, RateLimitGuard)
export class ApertaController {
  constructor(private readonly aperta: ApertaService) {}

  @Get()
  @RateLimit({ limit: 30, windowMs: 60_000 })
  async list(@Req() req: AuthedRequest) {
    return { slots: await this.aperta.list(req.user.id) };
  }

  @Get(':slot')
  @RateLimit({ limit: 30, windowMs: 60_000 })
  get(@Req() req: AuthedRequest, @Param('slot', slotPipe) slot: number) {
    return this.aperta.get(req.user.id, slotOf(slot));
  }

  /** No máximo 1 gravação a cada 5 s por save (2 saves por conta). */
  @Put(':slot')
  @HttpCode(200)
  @RateLimit({ limit: 2, windowMs: 5_000 })
  put(
    @Req() req: AuthedRequest,
    @Param('slot', slotPipe) slot: number,
    @Body(new ZodValidationPipe(putSchema)) body: PutBody,
  ) {
    return this.aperta.put(req.user.id, slotOf(slot), body);
  }

  @Delete(':slot')
  @HttpCode(204)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  async remove(@Req() req: AuthedRequest, @Param('slot', slotPipe) slot: number) {
    await this.aperta.remove(req.user.id, slotOf(slot));
  }

  @Post(':slot/restore')
  @HttpCode(200)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  restore(@Req() req: AuthedRequest, @Param('slot', slotPipe) slot: number) {
    return this.aperta.restore(req.user.id, slotOf(slot));
  }
}
