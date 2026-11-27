/**
 * Castle Circuit: gera `wallsL`/`wallsR` só com o que o jogador VÊ (spec 086, seção 11).
 * O arquivo original trazia paredes achadas por raios no `.fbx` inteiro, incluindo peças que não vão para o jogo, e a
 * pista valia uma barreira genérica de 18 m: o kart batia em paredes invisíveis. Agora, para cada ponto de controle e
 * cada lado, a barreira é a primeira entre:
 *  1. uma parede de verdade em `core.bin` (superfície vertical ou íngreme demais, na altura do kart): `visible-walls.mjs`;
 *  2. um vazio de verdade: 3 m seguidos sem superfície para pisar (`visible-surface.mjs`), onde o carro flutuaria.
 * Só entram trechos contínuos de parede (objetos soltos como árvores e postes não viram barreira). Não lê as listas antigas, então rodar de
 * novo dá o mesmo resultado. `99` = nada até 40 m.
 * Uso (na raiz, depois de `pnpm --filter @nocap/games build`): node tools/art/track/refine-castle-walls.mjs
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadVisibleSurface } from './visible-surface.mjs';
import { loadWalls } from './visible-walls.mjs';

const require = createRequire(import.meta.url);
const g = require('../../../packages/games/dist/index.cjs');
const FILE = 'packages/games/src/foxgp/track-castle.ts';
const DIR = 'apps/web/public/foxgp/castle';
const STEP = 0.5;
const MAX = 40;
/** Metros seguidos sem superfície para valer como vazio. */
const CHASM = 3;
const TOL = 2.5;

const t = g.gpTrack(g.GP_TRACK_CASTLE);
const def = g.GP_TRACK_CASTLE;
const surface = loadVisibleSurface(DIR);
const walls = loadWalls(DIR, ['core'], surface);

/** O começo do primeiro vazio para o lado `side` a partir da amostra `i` (ou 99). null se o centro não tem superfície. */
function voidAt(i, side) {
  const nx = -t.tz[i] * side;
  const nz = t.tx[i] * side;
  let h = surface.near(t.x[i], t.z[i], t.yAt(i * t.ds), TOL);
  if (h === null) return null;
  let bad = null;
  let run = 0;
  for (let d = STEP; d <= MAX; d += STEP) {
    const y = surface.near(t.x[i] + nx * d, t.z[i] + nz * d, h, TOL);
    if (y === null) {
      if (bad === null) bad = d;
      if (++run * STEP >= CHASM) return bad;
    } else {
      h = y;
      run = 0;
      bad = null;
    }
  }
  return 99;
}

/** Parede visível para o lado `side` a partir da amostra `i` (99 = nenhuma em 40 m). */
function wallAt(i, side) {
  const nx = -t.tz[i] * side;
  const nz = t.tx[i] * side;
  return Math.round(walls.hit(t.x[i], t.z[i], t.yAt(i * t.ds), nx, nz, MAX) * 10) / 10;
}

/** Um objeto solto (árvore, poste, caixa) não é parede: só valem os trechos contínuos de pelo menos RUN m. */
const RUN = 8;
/** Salto máximo (m) da distância da parede entre amostras vizinhas para continuar o mesmo trecho. */
const JUMP = 2;
/** Falhas de até GAPS amostras seguidas não cortam o trecho (colunas e janelas). */
const GAPS = 2;
function onlyRuns(raw) {
  const n = raw.length;
  const keep = new Array(n).fill(false);
  // anda pelo anel; começa onde não há parede para o trecho não ser cortado pela emenda da volta
  let start = raw.findIndex((v) => v >= 99);
  if (start < 0) start = 0;
  let run = [];
  let last = null;
  let miss = 0;
  const flush = () => {
    if (run.length >= RUN) for (const k of run) keep[k] = true;
    run = [];
    last = null;
    miss = 0;
  };
  for (let o = 0; o < n; o++) {
    const k = (start + o) % n;
    const v = raw[k];
    if (v >= 99) {
      if (last !== null && ++miss > GAPS) flush();
      continue;
    }
    if (last !== null && Math.abs(v - last) > JUMP) flush();
    run.push(k);
    last = v;
    miss = 0;
  }
  flush();
  return raw.map((v, k) => (keep[k] ? v : 99));
}

/**
 * Uma barreira por metro de pista: a pior entre a amostra e as duas vizinhas (±1 m, para não deixar frestas).
 * Sob a ponte (centro sem superfície) não se mede vazio, vale só a parede visível.
 */
function dense(side) {
  const len = Math.ceil(t.length);
  const at = (m) => ((Math.round(m / t.ds) % t.n) + t.n) % t.n;
  const wall = onlyRuns(Array.from({ length: len }, (_, m) => wallAt(at(m), side)));
  const out = [];
  for (let m = 0; m < len; m++) {
    let worst = 99;
    for (let o = -1; o <= 1; o++) {
      const k = (m + o + len) % len;
      worst = Math.min(worst, wall[k], voidAt(at(k), side) ?? 99);
    }
    // nunca menos que 3 m: a pista subtrai a folga da parede e trata zero ou negativo como "sem parede"; o piso real vem de lá
    out.push(Math.round(Math.max(3, worst) * 10) / 10);
  }
  return out;
}

/** A versão por ponto de controle (compatibilidade): a pior barreira do trecho até os pontos vizinhos. */
function coarse(d) {
  const K = def.wallsL.length;
  return def.wallsL.map((_, k) => {
    const from = Math.floor(t.cpS[(k - 1 + K) % K]);
    let to = Math.ceil(t.cpS[(k + 1) % K]);
    if (to < from) to += d.length;
    let worst = 99;
    for (let m = from; m <= to; m++) worst = Math.min(worst, d[m % d.length]);
    return worst;
  });
}

const LD = dense(-1);
const RD = dense(1);
const L = coarse(LD);
const R = coarse(RD);
const near = (a) => a.filter((v) => v < 40).length;
console.log(`barreiras por metro: esquerda ${near(LD)} de ${LD.length} fecham antes de 40 m, direita ${near(RD)} de ${RD.length}`);

let src = fs.readFileSync(FILE, 'utf8');
src = src.replace(/  wallsL: \[[^\]]*\],/, `  wallsL: [${L.join(', ')}],`).replace(/  wallsR: \[[^\]]*\],/, `  wallsR: [${R.join(', ')}],`);
const denseLines = `  wallsLD: [${LD.join(', ')}],\n  wallsRD: [${RD.join(', ')}],\n`;
src = /\n  wallsLD: \[/.test(src)
  ? src.replace(/  wallsLD: \[[^\]]*\],\n  wallsRD: \[[^\]]*\],\n/, denseLines)
  : src.replace(/(  wallsR: \[[^\]]*\],\n)/, `$1${denseLines}`);
fs.writeFileSync(FILE, src);
