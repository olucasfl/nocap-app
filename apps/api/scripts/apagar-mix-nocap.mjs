// Apaga do banco tudo o que sobrou do Mix Nocap (o jogo foi removido do app em 20/10/2026): as partidas de
// sala com `mode = 'party'` (match_players sai junto, por cascade) e os recordes `mode = 'party'`.
//
//   cd apps/api
//   node scripts/apagar-mix-nocap.mjs          # só mostra quantas linhas seriam apagadas
//   node scripts/apagar-mix-nocap.mjs --apply  # apaga de verdade, numa transação
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });
const url = process.env.DATABASE_URL_MIGRATIONS || process.env.DATABASE_URL;
if (!url) {
  console.error('Sem DATABASE_URL_MIGRATIONS nem DATABASE_URL (defina no ambiente ou no .env da raiz).');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const sql = postgres(url, { prepare: false, max: 1 });

try {
  const count = async (q) => Number((await q)[0].n);
  const matches = await count(sql`select count(*)::int as n from matches where mode = 'party'`);
  const stats = await count(sql`select count(*)::int as n from user_game_stats where mode = 'party'`);
  console.log(`Partidas do Mix Nocap: ${matches}`);
  console.log(`Recordes do Mix Nocap: ${stats}`);
  if (!apply) {
    console.log('Nada foi apagado. Rode de novo com --apply para apagar.');
  } else {
    await sql.begin(async (tx) => {
      await tx`delete from matches where mode = 'party'`;
      await tx`delete from user_game_stats where mode = 'party'`;
    });
    console.log('Apagado.');
  }
} finally {
  await sql.end();
}
