import { Module } from '@nestjs/common';
import { WordsProgressController } from './words-progress.controller';
import { WordsProgressRepository } from './words-progress.repository';
import { WordsProgressService } from './words-progress.service';

@Module({
  controllers: [WordsProgressController],
  providers: [WordsProgressService, WordsProgressRepository],
})
export class WordsProgressModule {}
