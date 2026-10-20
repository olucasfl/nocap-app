import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { wordsProgress } from '../db/schema';

export interface ProgressRow {
  game: string;
  level: number;
  data: unknown;
}

@Injectable()
export class WordsProgressRepository {
  constructor(@Inject(DB) private readonly maybeDb: Db | null) {}

  private get db(): Db {
    if (!this.maybeDb) throw new ServiceUnavailableException('Banco de dados não configurado');
    return this.maybeDb;
  }

  /** Todo o progresso da conta (poucas centenas de linhas pequenas). */
  async all(userId: string): Promise<ProgressRow[]> {
    return this.db
      .select({ game: wordsProgress.game, level: wordsProgress.level, data: wordsProgress.data })
      .from(wordsProgress)
      .where(eq(wordsProgress.userId, userId));
  }

  /**
   * Junta as fases que chegaram com as que já existem, numa transação que trava as linhas lidas (dois aparelhos
   * enviando ao mesmo tempo não se sobrescrevem). `merge(existente, novo)` devolve o que fica gravado.
   */
  async apply(userId: string, incoming: ProgressRow[], merge: (existing: unknown, row: ProgressRow) => unknown): Promise<void> {
    if (incoming.length === 0) return;
    const games = [...new Set(incoming.map((r) => r.game))];
    await this.db.transaction(async (tx) => {
      const current = await tx
        .select({ game: wordsProgress.game, level: wordsProgress.level, data: wordsProgress.data })
        .from(wordsProgress)
        .where(and(eq(wordsProgress.userId, userId), inArray(wordsProgress.game, games)))
        .for('update');
      const byKey = new Map(current.map((r) => [`${r.game}:${r.level}`, r.data]));
      for (const row of incoming) {
        const data = merge(byKey.get(`${row.game}:${row.level}`), row);
        await tx
          .insert(wordsProgress)
          .values({ userId, game: row.game, level: row.level, data })
          .onConflictDoUpdate({
            target: [wordsProgress.userId, wordsProgress.game, wordsProgress.level],
            set: { data, updatedAt: sql`now()` },
          });
      }
    });
  }
}
