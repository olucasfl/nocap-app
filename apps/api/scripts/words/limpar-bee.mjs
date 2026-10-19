#!/usr/bin/env node
/**
 * Tira palavras reprovadas na revisão dos favos já gerados, sem mexer na ordem dos outros.
 *
 *   node apps/api/scripts/words/limpar-bee.mjs <primeiro-favo-a-limpar> palavra1 palavra2 ...
 *
 * Também grava as palavras em `fora-bee.txt` (para o gerador nunca mais usar). Favo que fica sem
 * pangrama, com poucas palavras ou fora das regras é removido, e os números dos favos seguintes
 * continuam sequenciais (só use em favos que ainda não foram ao ar).
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', '..', 'data', 'words');
const file = join(dir, 'bee', 'favos.json');

const [from, ...bad] = process.argv.slice(2);
const start = Number(from);
const ban = new Set(bad);
appendFileSync(join(dir, 'fora-bee.txt'), bad.join('\n') + '\n');

const all = JSON.parse(readFileSync(file, 'utf8'));
const kept = [];
let removedWords = 0;
let droppedPuzzles = 0;
all.forEach((p, i) => {
  if (i < start) return kept.push(p);
  const before = p.words.length;
  p.words = p.words.filter((w) => !ban.has(w.w));
  removedWords += before - p.words.length;
  const pangrams = p.words.filter((w) => w.pangram).length;
  const max = p.words.reduce((s, w) => s + (w.w.normalize('NFD').replace(/[̀-ͯ]/g, '').length === 4 ? 1 : w.w.normalize('NFD').replace(/[̀-ͯ]/g, '').length) + (w.pangram ? 7 : 0), 0);
  if (pangrams < 1 || pangrams > 2 || p.words.length < 25 || max < 60) {
    droppedPuzzles += 1;
    return;
  }
  kept.push(p);
});
kept.forEach((p, i) => (p.id = `b-${String(i + 1).padStart(4, '0')}`));
writeFileSync(file, JSON.stringify(kept, null, 1));
console.log(`palavras tiradas: ${removedWords} | favos removidos: ${droppedPuzzles} | favos agora: ${kept.length}`);
