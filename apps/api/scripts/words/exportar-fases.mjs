#!/usr/bin/env node
/**
 * Exporta os favos do Bee e os puzzles do Connect para o app (jogo offline, só com fases), ordenados do
 * mais fácil ao mais difícil.
 *
 *   node apps/api/scripts/words/exportar-fases.mjs
 *
 * Lê `apps/api/data/words/bee/favos.json` e `.../connect/puzzles.json`; grava em
 * `apps/web/src/games/words/levels/`. Rode de novo sempre que mexer nos dados.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const data = join(here, '..', '..', 'data', 'words');
const out = join(here, '..', '..', '..', 'web', 'src', 'games', 'words', 'levels');
mkdirSync(out, { recursive: true });

const key = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- Bee: mais fácil = menos pontos para fazer e menos palavras ----------
const favos = JSON.parse(readFileSync(join(data, 'bee', 'favos.json'), 'utf8'));
const points = (w, pangram) => (key(w).length === 4 ? 1 : key(w).length) + (pangram ? 7 : 0);
const bee = favos
  .map((f) => ({
    f,
    max: f.words.reduce((s, x) => s + points(x.w, !!x.pangram), 0),
  }))
  .sort((a, b) => a.max - b.max || a.f.words.length - b.f.words.length || a.f.id.localeCompare(b.f.id))
  .map(({ f }) => ({
    id: f.id,
    c: f.center,
    l: f.letters,
    w: f.words.map((x) => x.w),
    p: f.words.filter((x) => x.pangram).map((x) => x.w),
  }));
writeFileSync(join(out, 'bee-levels.json'), JSON.stringify(bee));

// ---------- Connect: mais difícil = mais pegadinhas e mais jogo de palavras ----------
const puzzles = JSON.parse(readFileSync(join(data, 'connect', 'puzzles.json'), 'utf8'));
const WORDPLAY = /(viram|perdem|ganham|escondem|começam|plural|o x soa|tirando|palíndromos|singular|têm outra|só têm|só existem|mudam|mesma forma|feminino|particípios|duas palavras|letras em ordem|repetem|ficam)/i;
const difficulty = (p) => {
  const traps = (p.traps ?? []).length * 3;
  const play = p.groups.filter((g) => WORDPLAY.test(g.title)).length * 1.5;
  const expr = p.groups.filter((g) => /vêm depois|combinam com|completam/i.test(g.title)).length * 0.8;
  const words = p.groups.flatMap((g) => g.words);
  const long = words.filter((w) => w.length > 9 || w.includes(' ')).length * 0.15;
  return traps + play + expr + long;
};
const connect = puzzles
  .map((p) => ({ p, d: difficulty(p) }))
  .sort((a, b) => a.d - b.d || a.p.id.localeCompare(b.p.id))
  .map(({ p }) => ({
    id: p.id,
    g: p.groups.map((g) => ({ l: g.level, t: g.title, w: g.words })),
  }));
writeFileSync(join(out, 'connect-levels.json'), JSON.stringify(connect));

writeFileSync(join(out, 'meta.json'), JSON.stringify({ bee: bee.length, connect: connect.length }));
console.log(`bee: ${bee.length} fases | connect: ${connect.length} fases`);
