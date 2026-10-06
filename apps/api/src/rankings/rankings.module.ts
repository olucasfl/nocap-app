import { Module } from '@nestjs/common';
import { RankingsController } from './rankings.controller';
import { RankingsRepository } from './rankings.repository';
import { RankingsService } from './rankings.service';

@Module({
  controllers: [RankingsController],
  providers: [RankingsService, RankingsRepository],
})
export class RankingsModule {}
