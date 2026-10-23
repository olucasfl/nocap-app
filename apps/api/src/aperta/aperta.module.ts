import { Module } from '@nestjs/common';
import { ApertaAccessController } from './aperta-access';
import { ApertaController } from './aperta.controller';
import { ApertaRepository } from './aperta.repository';
import { ApertaService } from './aperta.service';

@Module({
  controllers: [ApertaController, ApertaAccessController],
  providers: [ApertaService, ApertaRepository],
})
export class ApertaModule {}
