import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module';
import { InvitesController } from './invites.controller';
import { MeRoomController } from './me-room.controller';
import { InvitesService } from './invites.service';
import { RoomsRepository } from './rooms.repository';

/** O Colyseus é ligado em `main.ts`; este módulo só entrega o repositório ao servidor de salas. */
@Module({
  imports: [FriendsModule],
  controllers: [InvitesController, MeRoomController],
  providers: [RoomsRepository, InvitesService],
  exports: [RoomsRepository, InvitesService],
})
export class RoomsModule {}
