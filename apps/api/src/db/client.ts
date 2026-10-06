import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/** Transaction pooler do Supabase (6543) não suporta prepared statements. */
export function createDb(url: string) {
  const sql = postgres(url, { prepare: false });
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;
