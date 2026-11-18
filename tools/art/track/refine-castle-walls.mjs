/**
 * Castle Circuit: fecha as barreiras do kart onde o chão do mapa acaba (spec 086, seção 11).
 * Para cada ponto de controle e cada lado, anda para fora da estrada de 0,5 em 0,5 m seguindo o chão de
 * `apps/web/public/foxgp/castle/ground.bin` (o andar mais perto da altura da estrada); onde não há chão por 1,5 m
 * seguidos, ou o chão sobe/desce mais de 1,2 m de uma vez (muro, borda de ponte, barranco), a barreira fica ali.
 * Só diminui `wallsL`/`wallsR` (nunca aumenta), então rodar de novo não muda nada.
 * Uso (na raiz, depois de `pnpm --filter @nocap/games build`): node tools/art/track/refine-castle-walls.mjs
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const g = require('../../../packages/games/dist/index.cjs');
const FILE = 'packages/games/src/foxgp/track-castle.ts';
const GROUND = 'apps/web/public/foxgp/castle';
const STEP = 0.5;
const MAX = 40;
const JUMP = 1.2;
const NONE = -32768;

const t = g.gpTrack(g.GP_TRACK_CASTLE);
const yAt = (s) => t.yAt(s);
const def = g.GP_TRACK_CASTLE;
const m = JSON.parse(fs.readFileSync(`${GROUND}/ground.json`, 'utf8'));
const buf = fs.readFileSync(`${GROUND}/ground.bin`);
const n = m.w * m.h;
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const low = new Int16Array(ab, 0, n);
const high = new Int16Array(ab, n * 2, n);

/** O andar do chão em (x, z) mais perto de `hint` (m), ou null se não há chão. */
function floorAt(x, z, hint) {
  const cx = Math.floor((x - m.x0) / m.cell);
  const cz = Math.floor((z - m.z0) / m.cell);
  if (cx < 0 || cz < 0 || cx >= m.w || cz >= m.h) return null;
  const i = cz * m.w + cx;
  if (low[i] === NONE) return null;
  const a = low[i] / 100;
  const b = high[i] === NONE ? a : high[i] / 100;
  return Math.abs(a - hint) <= Math.abs(b - hint) ? a : b;
}

/** Até onde dá para ir para o lado `side` a partir da amostra `i` da pista (altura `h0` da estrada ali); null se o centro não tem chão. */
function stopAt(i, h0, side) {
  const nx = -t.tz[i] * side;
  const nz = t.tx[i] * side;
  // o andar do centro da estrada manda (a altura cadastrada pode destoar um pouco entre dois pontos de controle)
  const f0 = floorAt(t.x[i], t.z[i], h0);
  if (f0 === null) return null;
  let h = f0;
  let bad = null;
  let run = 0;
  for (let d = STEP; d <= MAX; d += STEP) {
    const f = floorAt(t.x[i] + nx * d, t.z[i] + nz * d, h);
    if (f === null || Math.abs(f - h) > JUMP) {
      if (bad === null) bad = d;
      if (++run >= 3) return Math.round(bad * 10) / 10;
    } else {
      h = f;
      run = 0;
      bad = null;
    }
  }
  return 99;
}

/** A barreira de um ponto de controle vale para o trecho até os vizinhos: fica a pior entre todas as amostras de 1 m. */
function stop(k, side) {
  const K = def.wallsL.length;
  const from = Math.round(t.cpS[(k - 1 + K) % K] / t.ds);
  let to = Math.round(t.cpS[(k + 1) % K] / t.ds);
  if (to < from) to += t.n;
  let worst = 99;
  for (let j = from; j <= to; j++) {
    const i = j % t.n;
    const h0 = yAt(i * t.ds);
    const v = stopAt(i, h0, side);
    if (v !== null) worst = Math.min(worst, v);
  }
  return worst;
}

// nunca menos que 3 m: a pista subtrai a folga da parede e trata zero ou negativo como "sem parede"; o piso real da barreira é aplicado lá
const L = def.wallsL.map((w, k) => Math.min(w, Math.max(3, stop(k, -1))));
const R = def.wallsR.map((w, k) => Math.min(w, Math.max(3, stop(k, 1))));
const diff = (a, b) => a.filter((v, k) => v !== b[k]).length;
console.log(`barreiras fechadas: esquerda ${diff(def.wallsL, L)} de ${L.length}, direita ${diff(def.wallsR, R)} de ${R.length}`);

let src = fs.readFileSync(FILE, 'utf8');
src = src.replace(/  wallsL: \[[^\]]*\],/, `  wallsL: [${L.join(', ')}],`).replace(/  wallsR: \[[^\]]*\],/, `  wallsR: [${R.join(', ')}],`);
fs.writeFileSync(FILE, src);
