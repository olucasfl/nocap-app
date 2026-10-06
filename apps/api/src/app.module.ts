import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { GamesController } from './games/games.controller';
import { HealthController } from './health/health.controller';
import { MatchesModule } from './matches/matches.module';

// Um módulo por domínio entra aqui.
@Module({
  imports: [DbModule, MatchesModule],
  controllers: [HealthController, GamesController],
})
export class AppModule {}
