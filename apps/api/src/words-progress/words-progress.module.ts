import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module';
import { FriendWordsController } from './friend-words.controller';
import { WordsProgressController } from './words-progress.controller';
import { WordsProgressRepository } from './words-progress.repository';
import { WordsProgressService } from './words-progress.service';

@Module({
  imports: [FriendsModule],
  controllers: [WordsProgressController, FriendWordsController],
  providers: [WordsProgressService, WordsProgressRepository],
})
export class WordsProgressModule {}
