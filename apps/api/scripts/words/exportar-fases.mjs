#!/usr/bin/env node
/**
 * Exporta os favos do Bee e os puzzles do Connect para o app (jogo offline, só com fases), em quatro
 * faixas de dificuldade (Fácil, Médio, Difícil, Mestre) que de fato crescem.
 *
 *   node apps/api/scripts/words/exportar-fases.mjs
 *
 * Lê `apps/api/data/words/bee/favos.json`, `palavras4mais.txt` (a raridade de cada palavra, ICF) e
 * `.../connect/puzzles.json`; grava em `apps/web/src/games/words/levels/`. Rode de novo sempre que mexer
 * nos dados. O resultado é determinístico.
 *
 * BEE: um favo guarda todas as palavras possíveis, mas isso é demais para quem está começando. Nas faixas
 * fáceis o jogo usa só as palavras comuns e curtas do favo (a lista da fase é "aparada"); as que ficaram de
 * fora vão em `x` (valem como palavra existente, mas não contam pontos nessa fase). O pangrama sempre fica.
 *   Fácil   palavras de até 7 letras, bem comuns, 10 a 22 palavras, pangrama de até 8 letras
 *   Médio   até 8 letras, comuns, 18 a 34 palavras, pangrama de até 9 letras
 *   Difícil até 9 letras, 28 a 52 palavras
 *   Mestre  o favo inteiro (palavras longas e raras)
 *
 * CONNECT: cada grupo ganha uma nota de dureza pelo título (categoria comum, de conhecimento, expressão
 * "vêm depois de...", ou jogo de palavras) e o puzzle é ordenado pela soma. Os puzzles do lote 6 (só
 * categorias comuns, sem jogo de palavras) são a faixa Fácil.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const data = join(here, '..', '..', 'data', 'words');
const out = join(here, '..', '..', '..', 'web', 'src', 'games', 'words', 'levels');
mkdirSync(out, { recursive: true });

const key = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------------------------------------------------------------- Bee
const icf = new Map();
for (const l of readFileSync(join(data, 'palavras4mais.txt'), 'utf8').split(/\r?\n/)) {
  if (!l || l.startsWith('#')) continue;
  const [w, v] = l.split('\t');
  icf.set(key(w), Number(v));
}
const rarity = (w) => icf.get(key(w)) ?? 99;
const points = (w, pangram) => (key(w).length === 4 ? 1 : key(w).length) + (pangram ? 7 : 0);

/** As regras de cada faixa do Bee: tamanho e raridade das palavras, do pangrama e quantas palavras a fase tem. */
const BEE_TIERS = [
  { name: 'Fácil', len: 7, icf: 11.8, pangLen: 8, pangIcf: 12.5, min: 10, max: 22, aim: 16 },
  { name: 'Médio', len: 8, icf: 12.5, pangLen: 9, pangIcf: 13.0, min: 18, max: 34, aim: 26 },
  { name: 'Difícil', len: 9, icf: 13.2, pangLen: 10, pangIcf: 13.5, min: 28, max: 52, aim: 38 },
  { name: 'Mestre', len: 99, icf: 99, pangLen: 99, pangIcf: 99, min: 0, max: 999, aim: 56 },
];
const PER_TIER = 50;

const favos = JSON.parse(readFileSync(join(data, 'bee', 'favos.json'), 'utf8'));
const trimFor = (f, t) => {
  const keep = [];
  const drop = [];
  for (const x of f.words) {
    const k = key(x.w);
    const fits = x.pangram ? k.length <= t.pangLen && rarity(x.w) <= t.pangIcf : k.length <= t.len && rarity(x.w) <= t.icf;
    (fits ? keep : drop).push(x);
  }
  return { keep, drop };
};
const eligible = (f, t) => {
  const { keep } = trimFor(f, t);
  return keep.some((x) => x.pangram) && keep.length >= t.min && keep.length <= t.max;
};
const avgRarity = (words) => words.reduce((s, x) => s + rarity(x.w), 0) / Math.max(1, words.length);

const beeTiers = [];
let pool = [...favos];
BEE_TIERS.forEach((t, ti) => {
  let chosen;
  if (ti === BEE_TIERS.length - 1) {
    chosen = pool; // o que sobra é o Mestre
  } else {
    const fit = pool
      .filter((f) => eligible(f, t))
      // mais perto do tamanho-alvo e com palavras mais comuns primeiro
      .map((f) => {
        const { keep } = trimFor(f, t);
        return { f, score: Math.abs(keep.length - t.aim) + avgRarity(keep) * 0.8 };
      })
      .sort((a, b) => a.score - b.score || a.f.id.localeCompare(b.f.id));
    chosen = fit.slice(0, PER_TIER).map((x) => x.f);
    if (chosen.length < PER_TIER) throw new Error(`Bee ${t.name}: só ${chosen.length} favos servem`);
  }
  const ids = new Set(chosen.map((f) => f.id));
  pool = pool.filter((f) => !ids.has(f.id));
  const levels = chosen
    .map((f) => {
      const { keep, drop } = ti === BEE_TIERS.length - 1 ? { keep: f.words, drop: [] } : trimFor(f, t);
      const max = keep.reduce((s, x) => s + points(x.w, !!x.pangram), 0);
      return { f, keep, drop, max };
    })
    // dentro da faixa: menos pontos e palavras mais comuns primeiro
    .sort((a, b) => a.max - b.max || a.keep.length - b.keep.length || a.f.id.localeCompare(b.f.id));
  for (const { f, keep, drop } of levels) {
    beeTiers.push({
      id: f.id,
      t: ti,
      c: f.center,
      l: f.letters,
      w: keep.map((x) => x.w),
      p: keep.filter((x) => x.pangram).map((x) => x.w),
      x: drop.map((x) => x.w),
    });
  }
});
writeFileSync(join(out, 'bee-levels.json'), JSON.stringify(beeTiers));

// ---------------------------------------------------------------- Connect
const puzzles = JSON.parse(readFileSync(join(data, 'connect', 'puzzles.json'), 'utf8'));
/** Jogo de palavras fácil de entender (3,5) ou difícil (4,5), expressão (3), conhecimento (2) ou categoria comum (1). */
const EASY_PLAY = /(Escondem|Começam com|Começam e terminam|Só têm a vogal|Palíndromos|Letras em ordem|Repetem a mesma|Verbo \+|Terminam em A|Viram outra palavra quando lidas|coladas|Ganham um .* na frente|Com um S antes|Tirando o|Perdem a primeira|Usam as cinco|Mesma forma no masculino)/i;
const HARD_PLAY = /(origem|aportuguesadas|tupi|Proparox|Plural em|X soa|U que não|mesmo som|outra palavra|Viram|Ganham outro|parecida|O O muda|O feminino|mais de um plural|Só existem no plural|Singular igual|Mudam de sentido|siglas|Particípios|H, letra|Verbos que)/i;
const EXPR = /(Vêm depois|Vêm antes|Combinam com|Completam|Têm (coroa|asa|boca|pé|dentes|olhos|cauda)|Usados na|Servem para|Sinônimos|Sem )/i;
const KNOW = /(Filósofos|Pintores|Compositores|Deuses|Heróis|Elementos|Não-metais|Músculos|Ossos|Vidrarias|Linguagens|Desertos|Mares|Rios do mundo|Cadeias|Capitais europeias|Letras gregas|Figuras de linguagem|Tipos de nuvem|Pedras|Madeiras|Tecidos|Estampas|Gases|Metais|Termos de|Classes de|Gêneros|Estilos|Aves de rapina|Cortes|Massas|Queijos|Oleaginosas|Cereais|Especialidades|Papéis|Instalação|Conexões|Peças internas|Programas|Partes de uma planilha|Fontes de energia|Combustíveis|Tipos de poluição|Seres do folclore|Palavras de origem|Documentos|Cidades|Países|Estados|Capitais|Biomas|Rios do Brasil|Oceanos|Partes de um castelo)/i;
const hardness = (title) =>
  HARD_PLAY.test(title) ? 4.5 : EASY_PLAY.test(title) ? 3.5 : EXPR.test(title) ? 3 : KNOW.test(title) ? 2 : 1;
const score = (p) =>
  p.groups.reduce((s, g) => s + hardness(g.title), 0) +
  (p.traps ?? []).length * 0.5 +
  p.groups.flatMap((g) => g.words).filter((w) => w.length > 9 || w.includes(' ')).length * 0.1;

const EASY_IDS = (id) => Number(id.slice(2)) >= 131; // o lote 6: só categorias comuns
const easy = puzzles.filter((p) => EASY_IDS(p.id));
const rest = puzzles
  .filter((p) => !EASY_IDS(p.id))
  .map((p) => ({ p, s: score(p) }))
  .sort((a, b) => a.s - b.s || a.p.id.localeCompare(b.p.id))
  .map((x) => x.p);
const SPLIT = [40, 45]; // Médio, Difícil; o resto é Mestre
const tiers = [
  easy.sort((a, b) => a.id.localeCompare(b.id)),
  rest.slice(0, SPLIT[0]),
  rest.slice(SPLIT[0], SPLIT[0] + SPLIT[1]),
  rest.slice(SPLIT[0] + SPLIT[1]),
];
const connect = tiers.flatMap((list, ti) =>
  list.map((p) => ({ id: p.id, t: ti, g: p.groups.map((g) => ({ l: g.level, t: g.title, w: g.words })) })),
);
writeFileSync(join(out, 'connect-levels.json'), JSON.stringify(connect));

writeFileSync(join(out, 'meta.json'), JSON.stringify({ bee: beeTiers.length, connect: connect.length, version: 2 }));
const count = (levels) => [0, 1, 2, 3].map((t) => levels.filter((l) => l.t === t).length).join('/');
console.log(`bee: ${beeTiers.length} fases (${count(beeTiers)}) | connect: ${connect.length} fases (${count(connect)})`);
