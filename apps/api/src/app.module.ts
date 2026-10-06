import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { GamesController } from './games/games.controller';
import { HealthController } from './health/health.controller';
import { FriendsModule } from './friends/friends.module';
import { MatchesModule } from './matches/matches.module';
import { RankingsModule } from './rankings/rankings.module';

// Um módulo por domínio entra aqui.
@Module({
  imports: [DbModule, AuthModule, MatchesModule, FriendsModule, RankingsModule],
  controllers: [HealthController, GamesController],
})
export class AppModule {}
