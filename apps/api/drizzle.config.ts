import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

config({ path: resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Migrations usam o session pooler (5432); o runtime usa o transaction pooler (6543).
  dbCredentials: { url: process.env.DATABASE_URL_MIGRATIONS ?? '' },
});
