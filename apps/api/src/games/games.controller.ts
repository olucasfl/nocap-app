import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { dailySeed } from '@nocap/games';
import { randomUUID } from 'node:crypto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  ecoSessionSchema,
  timeSessionSchema,
  type TimeSessionInput,
} from '../matches/match.schema';
import { issueTimeSession } from '../matches/time-session';

@Controller('games')
export class GamesController {
  /** Daily da Cor: mesma seed para o mundo todo, no fuso America/Sao_Paulo. */
  @Get('color/daily')
  colorDaily() {
    return { seed: dailySeed('color'), preset: 'classic' };
  }

  /**
   * Começa uma partida do Tempo: o servidor sorteia a seed (Daily: a do dia) e assina o instante
   * de início. Essa sessão volta junto com os resultados, e o servidor confere o tempo decorrido.
   */
  @Post('time/session')
  @HttpCode(200)
  @UseGuards(AuthGuard, RateLimitGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  timeSession(@Body(new ZodValidationPipe(timeSessionSchema)) body: TimeSessionInput) {
    const seed = body.kind === 'daily' ? dailySeed('time') : randomUUID().slice(0, 12);
    return { seed, session: issueTimeSession(seed) };
  }

  /** Começa uma partida do Eco: seed (Daily: a do dia) e sessão assinada, como no Tempo. */
  @Post('eco/session')
  @HttpCode(200)
  @UseGuards(AuthGuard, RateLimitGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  ecoSession(@Body(new ZodValidationPipe(ecoSessionSchema)) body: TimeSessionInput) {
    const seed = body.kind === 'daily' ? dailySeed('eco') : randomUUID().slice(0, 12);
    return { seed, session: issueTimeSession(seed) };
  }
}
