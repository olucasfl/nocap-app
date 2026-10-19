import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module';
import { WordsController } from './words.controller';
import { WordsRepository } from './words.repository';
import { WordsService } from './words.service';

@Module({
  imports: [MatchesModule],
  controllers: [WordsController],
  providers: [WordsService, WordsRepository],
})
export class WordsModule {}
