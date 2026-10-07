import { Module } from '@nestjs/common';
import { RoomsRepository } from './rooms.repository';

/** O Colyseus é ligado em `main.ts`; este módulo só entrega o repositório ao servidor de salas. */
@Module({ providers: [RoomsRepository], exports: [RoomsRepository] })
export class RoomsModule {}
