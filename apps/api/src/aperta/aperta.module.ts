import { Module } from '@nestjs/common';
import { ApertaController } from './aperta.controller';
import { ApertaRepository } from './aperta.repository';
import { ApertaService } from './aperta.service';

@Module({
  controllers: [ApertaController],
  providers: [ApertaService, ApertaRepository],
})
export class ApertaModule {}
