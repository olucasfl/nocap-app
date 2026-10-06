import { Global, Module } from '@nestjs/common';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { createAuth, type Auth } from './auth';
import { AUTH } from './auth.constants';
import { AuthGuard } from './auth.guard';

/** `null` sem banco: as rotas de conta respondem 503, o resto da API sobe normalmente. */
@Global()
@Module({
  providers: [
    {
      provide: AUTH,
      inject: [DB],
      useFactory: (db: Db | null): Auth | null => (db ? createAuth(db) : null),
    },
    AuthGuard,
  ],
  exports: [AUTH, AuthGuard],
})
export class AuthModule {}
