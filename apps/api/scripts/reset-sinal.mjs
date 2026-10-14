// Zera tudo do Sinal Vermelho (pedido do Lucas em 14/10/2026). Mesma coisa que reset-sinal.sql,
// mas sem precisar do psql: usa o driver `postgres` que a API já tem e a DATABASE_URL do ambiente
// (ou do apps/api/.env). Nunca imprime a connection string.
//
//   cd apps/api
//   node scripts/reset-sinal.mjs          # só mostra quantas linhas seriam apagadas
//   node scripts/reset-sinal.mjs --apply  # apaga de verdade, numa transação
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

// O .env do projeto fica na raiz do repositório (o mesmo que a API e o drizzle usam).
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

// A conexão de sessão (migrations) aceita transação; cai na do runtime se não existir.
const url = process.env.DATABASE_URL_MIGRATIONS || process.env.DATABASE_URL;
if (!url) {
  console.error('Sem DATABASE_URL_MIGRATIONS nem DATABASE_URL (defina no ambiente ou no .env da raiz).');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const sql = postgres(url, { prepare: false, max: 1 });

try {
  const count = async (q) => Number((await q)[0].n);
  const matches = await count(sql`select count(*)::int as n from matches where game = 'sinal'`);
  const stats = await count(sql`select count(*)::int as n from user_game_stats where game = 'sinal'`);
  console.log(`Partidas do sinal: ${matches}`);
  console.log(`Recordes do sinal: ${stats}`);
  if (!apply) {
    console.log('Nada foi apagado. Rode de novo com --apply para apagar.');
  } else {
    await sql.begin(async (tx) => {
      await tx`delete from matches where game = 'sinal'`; // match_players sai junto (cascade)
      await tx`delete from user_game_stats where game = 'sinal'`;
    });
    const left =
      (await count(sql`select count(*)::int as n from matches where game = 'sinal'`)) +
      (await count(sql`select count(*)::int as n from user_game_stats where game = 'sinal'`));
    console.log(`Apagado. Sobraram ${left} (deve ser 0).`);
  }
} finally {
  await sql.end();
}
