import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsRepository } from './friends.repository';
import { FriendsService } from './friends.service';
import { PresenceService } from './presence.service';

@Module({
  controllers: [FriendsController],
  providers: [FriendsService, FriendsRepository, PresenceService],
  exports: [FriendsService],
})
export class FriendsModule {}
