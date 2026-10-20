// Converte as partidas antigas do Classic Word's (que guardavam uma NOTA de 0 a 10) para o formato novo
// (TENTATIVAS: acertar na 3ª = 30; não acertar = tentativas do modo + 1, ex.: 70 no Daily).
// Só mexe em `match_players.total_score` das partidas de `game = 'wclassic'`; nada é apagado.
//
//   cd apps/api
//   node scripts/converter-notas-classic.mjs          # só mostra o que mudaria
//   node scripts/converter-notas-classic.mjs --apply  # grava, numa transação
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

const TRIES = { classic: 6, dueto: 7, quarteto: 9 };

try {
  const rows = await sql`
    select mp.match_id, mp.player_id, mp.total_score, m.mode, m.kind,
           (m.settings->>'won')::boolean as won, (m.settings->>'tries')::int as tries
    from match_players mp join matches m on m.id = mp.match_id
    where m.game = 'wclassic'`;
  const changes = rows
    .map((r) => {
      const max = TRIES[r.mode] ?? 6;
      const next = (r.won ? Math.min(r.tries ?? max, max) : max + 1) * 10;
      return { ...r, next };
    })
    .filter((r) => r.next !== r.total_score);
  console.log(`Partidas do Classic Word's: ${rows.length} | a converter: ${changes.length}`);
  for (const c of changes.slice(0, 15)) {
    console.log(`  ${c.kind}/${c.mode}: ${c.total_score} -> ${c.next}`);
  }
  if (!apply) {
    console.log('Nada foi gravado. Rode de novo com --apply para converter.');
  } else {
    await sql.begin(async (tx) => {
      for (const c of changes) {
        await tx`update match_players set total_score = ${c.next} where match_id = ${c.match_id} and player_id = ${c.player_id}`;
      }
    });
    console.log('Convertido.');
  }
} finally {
  await sql.end();
}
