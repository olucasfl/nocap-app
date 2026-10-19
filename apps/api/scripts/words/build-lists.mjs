#!/usr/bin/env node
/**
 * Monta as listas de palavras do Word's (spec 032) a partir da coleção `fserb/pt-br` (licença MIT).
 *
 *   node apps/api/scripts/words/build-lists.mjs <pasta-da-colecao>
 *
 * A pasta da coleção é um clone de https://github.com/fserb/pt-br (arquivos `lexico`, `conjugações`,
 * `icf` e `listas/*`). Nada daqui depende de rede: o clone fica fora do repositório.
 *
 * Saídas em `apps/api/data/words/` (determinísticas: rodar duas vezes dá arquivos idênticos):
 * - `aceitas5.txt`      palavras de 5 letras aceitas como palpite (forma correta, com acento)
 * - `candidatas5.txt`   candidatas a resposta com a frequência (ICF), para a revisão humana
 * - `palavras4mais.txt` palavras de 4+ letras sem a letra S, com ICF (base do Bee)
 *
 * As respostas finais saem de `candidatas5.txt` menos `fora5.txt` mais `extras5.txt` (ver `apply-review.mjs`).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2];
if (!root) {
  console.error('Uso: node build-lists.mjs <pasta-da-colecao-fserb-pt-br>');
  process.exit(1);
}
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/words');
mkdirSync(out, { recursive: true });

const read = (f) =>
  readFileSync(join(root, f), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean);

const lex = new Set(read('lexico'));
const conj = new Set(read('conjugações'));
const negativas = new Set(read('listas/negativas'));
const proprios = new Set(
  ['listas/paises', 'listas/estados-br', 'listas/municipios-br', 'listas/continentes']
    .flatMap(read)
    .map((s) => s.toLowerCase()),
);
const icf = new Map();
for (const line of read('icf')) {
  const i = line.lastIndexOf(',');
  icf.set(line.slice(0, i), Number.parseFloat(line.slice(i + 1)));
}

/** A chave de comparação: sem acento, só a-z. */
export const key = (w) =>
  w
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
const letters = /^[a-zàáâãäçéêëíîïóôõöúûü]+$/;
const len = (w) => [...w].length;

/** Plural simples de uma entrada do léxico (o léxico quase não tem plurais). */
const isPlural = (w) => w.endsWith('s') && (lex.has(w.slice(0, -1)) || (w.endsWith('es') && lex.has(w.slice(0, -2))));
const clean = (w) => letters.test(w) && !proprios.has(w) && !negativas.has(w) && icf.has(w);

/**
 * Entre duas formas com a mesma chave (farão / faraó) fica a preferida (as candidatas a resposta) e,
 * sem preferida, a de menor ICF (mais comum).
 */
function byKey(words, prefer = new Set()) {
  const best = new Map();
  for (const w of words) {
    const k = key(w);
    const cur = best.get(k);
    if (!cur) best.set(k, w);
    else if (prefer.has(w) !== prefer.has(cur)) best.set(k, prefer.has(w) ? w : cur);
    else if (icf.get(w) < icf.get(cur)) best.set(k, w);
  }
  return [...best.values()];
}
const sortWords = (list) => list.sort((a, b) => key(a).localeCompare(key(b)) || a.localeCompare(b));

// ---- 5 letras ----
const five = [...icf.keys()].filter((w) => len(w) === 5 && clean(w));
// candidatas a resposta: palavras "de dicionário" (léxico ou plural), nunca só forma verbal conjugada
const candidates = byKey(five.filter((w) => (lex.has(w) || isPlural(w)) && icf.get(w) <= 16));
// Palpites aceitos: qualquer palavra de verdade, mesmo as que também são nome de lugar (arcos, areia, feliz,
// farol) ou não têm nota de frequência. Só as RESPOSTAS passam pelo filtro de nomes e de palavras negativas.
// Entram: palavras do léxico e tudo o que tem nota de frequência (ICF) e é palavra (léxico, conjugação ou plural).
// Formas raríssimas, sem nota e só de conjugação ou de "plural fabricado", ficam de fora.
const acceptedPool = new Set();
for (const w of lex) if (len(w) === 5 && letters.test(w)) acceptedPool.add(w);
for (const w of icf.keys()) {
  if (len(w) === 5 && letters.test(w) && (lex.has(w) || conj.has(w) || isPlural(w))) acceptedPool.add(w);
}
// O léxico quase não traz plurais (bolos, gatos, mesas): eles saem do singular pelas regras simples.
// Só plurais de 5 letras, só de palavras que não são infinitivo: vogal + s (bolo, bolos), r ou z + es
// (luz, luzes) m vira ns (item, itens) e al/ul viram ais/uis (real, reais).
const VOWEL_END = /[aeiouáéíóúâêôãõ]$/;
for (const w of lex) {
  if (!letters.test(w)) continue;
  let plural = null;
  if (len(w) === 4 && VOWEL_END.test(w)) plural = w + 's';
  else if (len(w) === 3 && /[rz]$/.test(w)) plural = w + 'es';
  else if (len(w) === 4 && w.endsWith('m')) plural = w.slice(0, -1) + 'ns';
  else if (len(w) === 4 && /[au]l$/.test(w)) plural = w.slice(0, -1) + 'is';
  if (plural && len(plural) === 5) acceptedPool.add(plural);
}
// A forma (com acento) que já estava na lista continua sendo a preferida: o jogo e o Daily já a usam.
const before = existsSync(join(out, 'aceitas5.txt'))
  ? readFileSync(join(out, 'aceitas5.txt'), 'utf8').split(/\r?\n/).filter(Boolean)
  : [];
const accepted = byKey([...acceptedPool, ...before], new Set([...candidates, ...before]));

writeFileSync(join(out, 'aceitas5.txt'), sortWords(accepted).join('\n') + '\n');
writeFileSync(
  join(out, 'candidatas5.txt'),
  sortWords(candidates)
    .map((w) => `${w}\t${icf.get(w).toFixed(2)}`)
    .join('\n') + '\n',
);

// ---- 4+ letras, sem S (Bee) ----
const bee = byKey(
  [...icf.keys()].filter(
    (w) =>
      len(w) >= 4 &&
      clean(w) &&
      !key(w).includes('s') &&
      (lex.has(w) || conj.has(w) || isPlural(w)) &&
      icf.get(w) <= 14.5,
  ),
);
writeFileSync(
  join(out, 'palavras4mais.txt'),
  sortWords(bee)
    .map((w) => `${w}\t${icf.get(w).toFixed(2)}`)
    .join('\n') + '\n',
);

console.log(`aceitas5: ${accepted.length} | candidatas5: ${candidates.length} | palavras4mais (sem S): ${bee.length}`);
