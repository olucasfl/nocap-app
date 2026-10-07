import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GlobalRateLimitGuard } from './common/rate-limit';
import { AccountModule } from './account/account.module';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { GamesController } from './games/games.controller';
import { HealthController } from './health/health.controller';
import { FriendsModule } from './friends/friends.module';
import { MatchesModule } from './matches/matches.module';
import { RankingsModule } from './rankings/rankings.module';
import { RoomsModule } from './rooms/rooms.module';

// Um módulo por domínio entra aqui.
@Module({
  imports: [
    DbModule,
    AuthModule,
    AccountModule,
    MatchesModule,
    FriendsModule,
    RankingsModule,
    RoomsModule,
  ],
  controllers: [HealthController, GamesController],
  providers: [{ provide: APP_GUARD, useClass: GlobalRateLimitGuard }],
})
export class AppModule {}
