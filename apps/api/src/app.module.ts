import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

// Um módulo por domínio entra aqui: matches, games, players...
@Module({
  controllers: [HealthController],
})
export class AppModule {}
