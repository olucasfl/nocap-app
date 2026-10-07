import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module';
import { MatchesController } from './matches.controller';
import { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';

@Module({
  imports: [FriendsModule],
  controllers: [MatchesController],
  providers: [MatchesService, MatchesRepository],
})
export class MatchesModule {}
