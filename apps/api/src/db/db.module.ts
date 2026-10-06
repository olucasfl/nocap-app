import { Global, Module } from '@nestjs/common';
import { createDb, type Db } from './client';

export const DB = Symbol('DB');

/**
 * `null` quando DATABASE_URL não está configurada: a API sobe (health, daily) e só as
 * rotas que precisam de banco respondem 503. O postgres.js conecta sob demanda.
 */
@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (): Db | null => {
        const url = process.env.DATABASE_URL;
        return url ? createDb(url) : null;
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
