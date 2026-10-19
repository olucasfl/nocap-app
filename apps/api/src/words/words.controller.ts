import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { isWordGame, WordsService, type WordGame } from './words.service';

const startSchema = z.object({ mode: z.string(), kind: z.enum(['daily', 'solo']) });
const moveSchema = z.object({ guess: z.string().min(1).max(20) });

const game = (g: string): WordGame => {
  if (!isWordGame(g)) throw new BadRequestException('Jogo inválido');
  return g;
};

/** Os jogos do grupo de palavras (spec 032): a resposta fica no servidor; o aparelho manda palpites e recebe cores. */
@Controller('words/:game')
@UseGuards(AuthGuard, RateLimitGuard)
export class WordsController {
  constructor(private readonly words: WordsService) {}

  @Get('daily')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  daily(@Req() req: AuthedRequest, @Param('game') g: string) {
    return this.words.dailyStatus(game(g), req.user.id);
  }

  @Get('modes')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  modes(@Req() req: AuthedRequest, @Param('game') g: string) {
    return this.words.modes(game(g), req.user.id);
  }

  @Post('runs')
  @HttpCode(201)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  start(
    @Req() req: AuthedRequest,
    @Param('game') g: string,
    @Body(new ZodValidationPipe(startSchema)) body: z.infer<typeof startSchema>,
  ) {
    return this.words.start(game(g), req.user.id, body.mode, body.kind);
  }

  @Get('runs/:id')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.words.get(req.user.id, id);
  }

  @Post('runs/:id/moves')
  @HttpCode(200)
  @RateLimit({ limit: 120, windowMs: 60_000 })
  move(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(moveSchema)) body: z.infer<typeof moveSchema>,
  ) {
    return this.words.move(req.user.id, id, body.guess);
  }

  @Post('runs/:id/finish')
  @HttpCode(200)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  finish(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.words.giveUp(req.user.id, id);
  }
}
