#!/usr/bin/env node
/**
 * Gera os favos do Bee Word's (spec 035) a partir de `apps/api/data/words/palavras4mais.txt`.
 *
 *   node apps/api/scripts/words/gerar-bee.mjs [quantidade]
 *
 * Saídas em `apps/api/data/words/bee/`:
 *   - `favos.json`: favos aprovados pelos critérios (o que o servidor lê);
 *   - `revisao.txt`: cada favo com a lista inteira, para a revisão humana (as palavras estranhas vão
 *     para `fora-bee.txt` e o script roda de novo; ele é determinístico).
 * O que já está em `favos.json` NÃO muda de lugar: favos novos só entram no fim.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', '..', 'data', 'words');
const outDir = join(dataDir, 'bee');
mkdirSync(outDir, { recursive: true });

const WANT = Number(process.argv[2] ?? 60);
const key = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lines = (f) =>
  existsSync(f)
    ? readFileSync(f, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [];

const banned = new Set(lines(join(dataDir, 'fora-bee.txt')).map(key));
for (const w of lines(join(dataDir, 'fora5.txt'))) banned.add(key(w));

// palavra -> frequência (ICF, quanto menor mais comum); uma forma por chave
const words = new Map();
for (const l of lines(join(dataDir, 'palavras4mais.txt'))) {
  const [w, icf] = l.split('\t');
  const k = key(w);
  if (!/^[a-z]{4,}$/.test(k) || k.includes('s') || banned.has(k)) continue;
  const f = Number(icf);
  if (f > 13.5) continue;
  if (!words.has(k) || words.get(k).icf > f) words.set(k, { w, icf: f });
}

const VOWELS = new Set('aeiou');
const mask = (k) => [...new Set(k)].reduce((m, ch) => m | (1 << (ch.charCodeAt(0) - 97)), 0);
const entries = [...words.entries()].map(([k, v]) => ({ k, ...v, m: mask(k), n: new Set(k).size }));

// Conjuntos de 7 letras que formam pangrama comum
const sets = new Map();
for (const e of entries) if (e.n === 7 && e.icf <= 12.5) sets.set(e.m, e.m);

const letters = (m) => [...'abcdefghijklmnopqrstuvwxyz'].filter((c) => m & (1 << (c.charCodeAt(0) - 97)));
const points = (k, pangram) => (k.length === 4 ? 1 : k.length) + (pangram ? 7 : 0);

const candidates = [];
for (const m of sets.values()) {
  const ls = letters(m);
  if (ls.filter((c) => VOWELS.has(c)).length < 2) continue;
  const inside = entries.filter((e) => (e.m & ~m) === 0);
  for (const center of ls) {
    const cm = 1 << (center.charCodeAt(0) - 97);
    const list = inside.filter((e) => e.m & cm);
    if (list.length < 25 || list.length > 80) continue;
    const pang = list.filter((e) => e.m === m);
    if (pang.length < 1 || pang.length > 2) continue;
    const total = list.reduce((s, e) => s + points(e.k, e.m === m), 0);
    if (total < 60 || total > 300) continue;
    // nenhuma raiz domina (4 primeiras letras)
    const roots = new Map();
    for (const e of list) roots.set(e.k.slice(0, 4), (roots.get(e.k.slice(0, 4)) ?? 0) + 1);
    if (Math.max(...roots.values()) > 8) continue;
    const meanIcf = list.reduce((s, e) => s + e.icf, 0) / list.length;
    candidates.push({ m, center, ls, list, pang, total, meanIcf });
  }
}

// mais comuns primeiro; no máximo um favo por conjunto de letras
candidates.sort((a, b) => a.meanIcf - b.meanIcf || a.center.localeCompare(b.center));
const seen = new Set();
const pick = [];
for (const c of candidates) {
  if (seen.has(c.m)) continue;
  seen.add(c.m);
  pick.push(c);
}

// embaralha de forma determinística entre os melhores (para a ordem não ser por frequência)
let seed = 2026;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pool = pick.slice(0, Math.max(WANT * 3, 90));
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [pool[i], pool[j]] = [pool[j], pool[i]];
}

const file = join(outDir, 'favos.json');
const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
const used = new Set(existing.map((p) => p.letters.join('') + p.center));
const fresh = [];
for (const c of pool) {
  if (existing.length + fresh.length >= WANT) break;
  const id = `${c.ls.join('')}${c.center}`;
  if ([...existing, ...fresh].some((p) => [p.center, ...p.letters].sort().join('') === c.ls.join(''))) continue;
  if (used.has(id)) continue;
  fresh.push({
    id: `b-${String(existing.length + fresh.length + 1).padStart(4, '0')}`,
    center: c.center,
    letters: c.ls.filter((x) => x !== c.center),
    words: c.list
      .sort((a, b) => a.k.localeCompare(b.k))
      .map((e) => (e.m === c.m ? { w: e.w, pangram: true } : { w: e.w })),
  });
}
const all = [...existing, ...fresh];
writeFileSync(file, JSON.stringify(all, null, 1));

const review = all
  .map(
    (p) =>
      `${p.id}  centro ${p.center.toUpperCase()}  letras ${[p.center, ...p.letters].join(' ').toUpperCase()}  ` +
      `(${p.words.length} palavras)\n  ` +
      p.words.map((x) => (x.pangram ? `*${x.w}*` : x.w)).join(', '),
  )
  .join('\n\n');
writeFileSync(join(outDir, 'revisao.txt'), review + '\n');
console.log(`favos: ${all.length} (novos ${fresh.length}) | candidatos ${candidates.length} | conjuntos ${seen.size}`);
