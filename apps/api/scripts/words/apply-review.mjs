#!/usr/bin/env node
/**
 * Aplica a revisão humana às listas do Classic Word's (spec 032 e 033).
 *
 *   node apps/api/scripts/words/apply-review.mjs
 *
 * Entradas (em `apps/api/data/words/`): `candidatas5.txt`, `fora5.txt`, `aprovadas5.txt`, `extras5.txt`
 * e `aceitas5.txt`. Saídas:
 * - `respostas5.txt`  as respostas, sem acento duplicado, ordenadas pela chave
 * - `ordem5.txt`      a ordem fixa do Daily (SÓ ACRESCENTA: o que já está lá nunca muda de lugar)
 *
 * Regras: resposta = candidata com ICF até 14, menos `fora5`, mais `aprovadas5` (as raras que a revisão
 * reconheceu) e `extras5`. Toda resposta também tem de estar entre as palavras aceitas. A ordem do Daily
 * começa pelas palavras mais comuns, em faixas de ICF, embaralhadas com uma seed fixa.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/words');
const lines = (f) =>
  existsSync(join(dir, f))
    ? readFileSync(join(dir, f), 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.trim().startsWith('#'))
    : [];
const tokens = (f) => lines(f).flatMap((l) => l.trim().split(/\s+/));
const key = (w) =>
  w
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');

const candidates = new Map(lines('candidatas5.txt').map((l) => l.split('\t')).map(([w, i]) => [w, Number.parseFloat(i)]));
const fora = new Set(tokens('fora5.txt'));
const aprovadas = new Set(tokens('aprovadas5.txt'));
const extras = new Set(tokens('extras5.txt'));
const aceitas = new Set(lines('aceitas5.txt'));

const answers = new Map(); // chave -> palavra
const add = (w, icf) => {
  const k = key(w);
  if (k.length !== 5) throw new Error(`"${w}" não tem 5 letras`);
  if (answers.has(k)) return;
  if (!aceitas.has(w)) throw new Error(`"${w}" não está nas palavras aceitas`);
  answers.set(k, { w, icf });
};
for (const [w, icf] of candidates) if (icf <= 14 && !fora.has(w)) add(w, icf);
for (const w of aprovadas) if (candidates.has(w)) add(w, candidates.get(w));
else throw new Error(`"${w}" aprovada, mas não está nas candidatas`);
for (const w of extras) add(w, 14);
for (const w of fora) if (!candidates.has(w) && !aceitas.has(w)) console.warn(`aviso: "${w}" em fora5.txt não existe nas listas`);

const list = [...answers.values()].sort((a, b) => key(a.w).localeCompare(key(b.w)));
writeFileSync(join(dir, 'respostas5.txt'), list.map((x) => x.w).join('\n') + '\n');

// Ordem do Daily: mantém o que já existe e acrescenta o que é novo no fim.
const existing = lines('ordem5.txt');
const known = new Set(existing.map(key));
for (const w of existing) if (!answers.has(key(w))) console.warn(`aviso: "${w}" está na ordem mas saiu das respostas (o dia continua com ela)`);
const fresh = list.filter((x) => !known.has(key(x.w)));
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const tiers = [11.5, 13, 14, Infinity];
const ordered = [];
tiers.forEach((max, t) => {
  const min = t === 0 ? -Infinity : tiers[t - 1];
  const group = fresh.filter((x) => x.icf > min && x.icf <= max).map((x) => x.w);
  const rand = rng(`words:classic:ordem:${existing.length ? 'mais' : 'v1'}:${t}`);
  for (let i = group.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [group[i], group[j]] = [group[j], group[i]];
  }
  ordered.push(...group);
});
writeFileSync(join(dir, 'ordem5.txt'), [...existing, ...ordered].join('\n') + '\n');
console.log(`respostas: ${list.length} | ordem do Daily: ${existing.length + ordered.length} (${ordered.length} novas)`);
