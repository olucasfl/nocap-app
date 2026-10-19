#!/usr/bin/env node
/**
 * Monta `apps/api/data/words/connect/puzzles.json` a partir dos lotes escritos à mão em
 * `apps/api/data/words/connect/fonte/*.txt` (ordem alfabética dos arquivos = ordem dos dias).
 *
 *   node apps/api/scripts/words/montar-connect.mjs
 *
 * Formato de um puzzle (uma linha por grupo; a ordem das linhas é o nível, 1 = mais fácil):
 *
 *   ## c-0001
 *   1 Pães :: BAGUETE, CIABATTA, BRIOCHE, FRANCÊS
 *   2 Partes do corpo :: JOELHO, TORNOZELO, COTOVELO, PUNHO
 *   3 Partes do violão :: CORDA, CRAVELHA, TAMPO, BRAÇO
 *   4 Só existem no plural :: ÓCULOS, FÉRIAS, NÚPCIAS, PARABÉNS
 *   ~ BRAÇO > Partes do corpo
 *   * nota livre (opcional)
 *
 * `~ PALAVRA > Título do grupo` declara uma pegadinha: a palavra também cabe nesse outro grupo.
 * A validação (divisão única, repetição, títulos) roda nos testes da API.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', '..', 'data', 'words', 'connect');
const sourceDir = join(dir, 'fonte');

const puzzles = [];
for (const file of readdirSync(sourceDir).filter((f) => f.endsWith('.txt')).sort()) {
  let cur = null;
  for (const raw of readFileSync(join(sourceDir, file), 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') && !line.startsWith('##')) continue;
    if (line.startsWith('##')) {
      cur = { id: line.replace(/^##\s*/, ''), groups: [], traps: [], notes: [] };
      puzzles.push(cur);
    } else if (/^[1-4]\s/.test(line)) {
      const m = line.match(/^([1-4])\s+(.+?)\s*::\s*(.+)$/);
      if (!m) throw new Error(`${file}: grupo mal escrito: ${line}`);
      cur.groups.push({ level: Number(m[1]), title: m[2], words: m[3].split(',').map((w) => w.trim()) });
    } else if (line.startsWith('~')) {
      const m = line.match(/^~\s*(.+?)\s*>\s*(.+)$/);
      if (!m) throw new Error(`${file}: pegadinha mal escrita: ${line}`);
      cur.traps.push({ word: m[1], alsoFits: m[2] });
    } else if (line.startsWith('*')) {
      cur.notes.push(line.replace(/^\*\s*/, ''));
    } else {
      throw new Error(`${file}: linha não entendida: ${line}`);
    }
  }
}
const out = puzzles.map((p) => ({
  id: p.id,
  groups: p.groups,
  ...(p.traps.length ? { traps: p.traps } : {}),
  ...(p.notes.length ? { notes: p.notes.join(' ') } : {}),
}));
writeFileSync(join(dir, 'puzzles.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`puzzles: ${out.length}`);
