import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { apertaSaves } from '../db/schema';

export interface SaveRow {
  slot: number;
  name: string;
  data: unknown;
  version: number;
  revision: number;
  playSeconds: number;
  collapses: number;
  picks: number;
  dustLog10: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** O que muda a cada gravação (o resto da linha o repositório cuida). */
export type SaveFields = Pick<SaveRow, 'name' | 'data' | 'version' | 'playSeconds' | 'collapses' | 'picks' | 'dustLog10'>;

/** Acesso às linhas. Cada método que escreve é atômico: o servidor nunca lê e depois grava às cegas. */
export interface ApertaStore {
  /** As linhas da conta (vivas e apagadas). */
  all(userId: string): Promise<SaveRow[]>;
  get(userId: string, slot: number): Promise<SaveRow | null>;
  /** Cria no espaço (revisão 1). Troca uma linha apagada; `null` se o espaço tem um save vivo. */
  create(userId: string, slot: number, fields: SaveFields, now: Date): Promise<SaveRow | null>;
  /** Grava só se a revisão ainda é `baseRevision` e o save está vivo; `null` caso contrário. */
  update(userId: string, slot: number, baseRevision: number, fields: SaveFields, now: Date): Promise<SaveRow | null>;
  /** `false` se não havia save vivo. */
  softDelete(userId: string, slot: number, now: Date): Promise<boolean>;
  /** Desfaz o apagar; `null` se não há apagado. */
  restore(userId: string, slot: number): Promise<SaveRow | null>;
  /** Some de vez o que foi apagado antes de `before`. */
  purgeDeletedBefore(userId: string, before: Date): Promise<void>;
}

const columns = {
  slot: apertaSaves.slot,
  name: apertaSaves.name,
  data: apertaSaves.data,
  version: apertaSaves.version,
  revision: apertaSaves.revision,
  playSeconds: apertaSaves.playSeconds,
  collapses: apertaSaves.collapses,
  picks: apertaSaves.picks,
  dustLog10: apertaSaves.dustLog10,
  createdAt: apertaSaves.createdAt,
  updatedAt: apertaSaves.updatedAt,
  deletedAt: apertaSaves.deletedAt,
};

@Injectable()
export class ApertaRepository implements ApertaStore {
  constructor(@Inject(DB) private readonly maybeDb: Db | null) {}

  private get db(): Db {
    if (!this.maybeDb) throw new ServiceUnavailableException('Banco de dados não configurado');
    return this.maybeDb;
  }

  all(userId: string): Promise<SaveRow[]> {
    return this.db.select(columns).from(apertaSaves).where(eq(apertaSaves.userId, userId));
  }

  async get(userId: string, slot: number): Promise<SaveRow | null> {
    const [row] = await this.db
      .select(columns)
      .from(apertaSaves)
      .where(and(eq(apertaSaves.userId, userId), eq(apertaSaves.slot, slot)));
    return row ?? null;
  }

  async create(userId: string, slot: number, fields: SaveFields, now: Date): Promise<SaveRow | null> {
    const [row] = await this.db
      .insert(apertaSaves)
      .values({ userId, slot, ...fields, revision: 1, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [apertaSaves.userId, apertaSaves.slot],
        set: { ...fields, revision: 1, createdAt: now, updatedAt: now, deletedAt: null },
        // só troca quem foi apagado: um save vivo nunca é sobrescrito por criar
        setWhere: isNotNull(apertaSaves.deletedAt),
      })
      .returning(columns);
    return row ?? null;
  }

  async update(userId: string, slot: number, baseRevision: number, fields: SaveFields, now: Date): Promise<SaveRow | null> {
    const [row] = await this.db
      .update(apertaSaves)
      .set({ ...fields, revision: sql`${apertaSaves.revision} + 1`, updatedAt: now })
      .where(
        and(
          eq(apertaSaves.userId, userId),
          eq(apertaSaves.slot, slot),
          eq(apertaSaves.revision, baseRevision),
          sql`${apertaSaves.deletedAt} is null`,
        ),
      )
      .returning(columns);
    return row ?? null;
  }

  async softDelete(userId: string, slot: number, now: Date): Promise<boolean> {
    const rows = await this.db
      .update(apertaSaves)
      .set({ deletedAt: now })
      .where(and(eq(apertaSaves.userId, userId), eq(apertaSaves.slot, slot), sql`${apertaSaves.deletedAt} is null`))
      .returning({ slot: apertaSaves.slot });
    return rows.length > 0;
  }

  async restore(userId: string, slot: number): Promise<SaveRow | null> {
    const [row] = await this.db
      .update(apertaSaves)
      .set({ deletedAt: null })
      .where(and(eq(apertaSaves.userId, userId), eq(apertaSaves.slot, slot), isNotNull(apertaSaves.deletedAt)))
      .returning(columns);
    return row ?? null;
  }

  async purgeDeletedBefore(userId: string, before: Date): Promise<void> {
    await this.db
      .delete(apertaSaves)
      .where(and(eq(apertaSaves.userId, userId), isNotNull(apertaSaves.deletedAt), lt(apertaSaves.deletedAt, before)));
  }
}
