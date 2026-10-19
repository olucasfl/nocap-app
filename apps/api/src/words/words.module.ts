import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module';
import { BeeController } from './bee.controller';
import { BeeService } from './bee.service';
import { WordsController } from './words.controller';
import { WordsRepository } from './words.repository';
import { WordsService } from './words.service';

@Module({
  imports: [MatchesModule],
  // O Bee vem antes: a rota dele (words/wbee) não pode cair em words/:game.
  controllers: [BeeController, WordsController],
  providers: [WordsService, BeeService, WordsRepository],
})
export class WordsModule {}
