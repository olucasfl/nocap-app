import { Controller, Get } from '@nestjs/common';
import { dailySeed } from '@nocap/games';

@Controller('games')
export class GamesController {
  /** Daily da Cor: mesma seed para o mundo todo, no fuso America/Sao_Paulo. */
  @Get('color/daily')
  colorDaily() {
    return { seed: dailySeed('color'), preset: 'classic' };
  }
}
