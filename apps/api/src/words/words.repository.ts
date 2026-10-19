import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { wordRuns } from '../db/schema';

export type WordRun = typeof wordRuns.$inferSelect;

@Injectable()
export class WordsRepository {
  constructor(@Inject(DB) private readonly maybeDb: Db | null) {}

  private get db(): Db {
    if (!this.maybeDb) throw new ServiceUnavailableException('Banco de dados não configurado');
    return this.maybeDb;
  }

  async byId(id: string, userId: string): Promise<WordRun | null> {
    const [row] = await this.db
      .select()
      .from(wordRuns)
      .where(and(eq(wordRuns.id, id), eq(wordRuns.userId, userId)));
    return row ?? null;
  }

  async daily(userId: string, game: string, day: string): Promise<WordRun | null> {
    const [row] = await this.db
      .select()
      .from(wordRuns)
      .where(and(eq(wordRuns.userId, userId), eq(wordRuns.game, game), eq(wordRuns.day, day)));
    return row ?? null;
  }

  /** Partida da conta ligada a um favo ou desafio (pela seed), para não criar duas. */
  async bySeed(userId: string, game: string, seed: string): Promise<WordRun | null> {
    const [row] = await this.db
      .select()
      .from(wordRuns)
      .where(and(eq(wordRuns.userId, userId), eq(wordRuns.game, game), eq(wordRuns.seed, seed)));
    return row ?? null;
  }

  /** Partidas abertas de dias que já passaram (o Bee fecha à meia-noite). */
  async openBefore(userId: string, game: string, day: string): Promise<WordRun[]> {
    const rows = await this.db
      .select()
      .from(wordRuns)
      .where(and(eq(wordRuns.userId, userId), eq(wordRuns.game, game), eq(wordRuns.state, 'open')));
    return rows.filter((r) => r.day !== null && r.day < day);
  }

  /** Respostas das últimas partidas da conta, para o sorteio não repetir palavra. */
  async recentAnswers(userId: string, game: string, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ answers: wordRuns.answers })
      .from(wordRuns)
      .where(and(eq(wordRuns.userId, userId), eq(wordRuns.game, game)))
      .orderBy(desc(wordRuns.startedAt))
      .limit(limit);
    return rows.flatMap((r) => r.answers);
  }

  /** `null` quando o Daily do dia já existe (corrida entre dois pedidos). */
  async create(row: typeof wordRuns.$inferInsert): Promise<WordRun | null> {
    const [created] = await this.db.insert(wordRuns).values(row).onConflictDoNothing().returning();
    return created ?? null;
  }

  async update(id: string, patch: Partial<typeof wordRuns.$inferInsert>): Promise<void> {
    await this.db.update(wordRuns).set(patch).where(eq(wordRuns.id, id));
  }
}
