/**
 * Paredes VISÍVEIS do cenário de uma pista de modelo (spec 086, seção 11): lança raios na horizontal, na altura do kart,
 * contra todos os triângulos de `core.bin` que não são chão (virados para o lado ou para baixo, ou subida íngreme demais
 * para o kart). Devolve a distância até a primeira parede de cada lado, ou 99. Tudo que existe aqui o jogador vê.
 */
import fs from 'node:fs';
import path from 'node:path';

const MAX_UP = 0.6; // normal.y acima disso é chão ou rampa que o kart sobe
const BAND = [0.25, 1.1]; // altura (m) acima da estrada em que o kart bate

/** @param {string} dir @param {string[]} packs pacotes lidos (`core` vai para todos; `detail` só para o computador) @param {{near: Function}|null} surface mapa de `visible-surface.mjs`: a faixa do kart acompanha o chão */
export function loadWalls(dir, packs = ['core'], surface = null) {
  const tris = [];
  for (const name of packs) addPack(dir, name, tris);
  return solid(tris, surface);
}

function addPack(dir, name, tris) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
  const raw = fs.readFileSync(path.join(dir, `${name}.bin`));
  const bin = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  for (const g of meta.groups) {
    if (g.alpha) continue;
    const p = new Float32Array(bin, g.pos, g.n * 3);
    for (let t = 0; t + 2 < g.n; t += 3) {
      const a = t * 3;
      const ax = p[a], ay = p[a + 1], az = p[a + 2];
      const bx = p[a + 3], by = p[a + 4], bz = p[a + 5];
      const cx = p[a + 6], cy = p[a + 7], cz = p[a + 8];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-9 || Math.abs(ny / len) > MAX_UP) continue;
      tris.push([ax, ay, az, bx, by, bz, cx, cy, cz, Math.min(ay, by, cy), Math.max(ay, by, cy), Math.min(ax, bx, cx), Math.max(ax, bx, cx), Math.min(az, bz, cz), Math.max(az, bz, cz), g.mat]);
    }
  }
}

function solid(tris, surface) {
  return {
    count: tris.length,
    /**
     * Distância até a parede na direção horizontal (dx, dz) unitária a partir de (x, z), com a estrada a `h` m; 99 se não há.
     * A faixa de altura do kart acompanha o CHÃO que há no caminho (`surface`, se dado), não a altura da estrada: num vale,
     * num barranco ou numa rampa a parede vale a partir do pé dela, e um muro suspenso acima do kart não conta.
     */
    hit(x, z, h, dx, dz, max = 40) {
      return this.hitTri(x, z, h, dx, dz, max).d;
    },
    /** Igual a `hit`, mas devolve também o triângulo atingido (`tri`, 16 números) para diagnóstico. */
    hitTri(x, z, h, dx, dz, max = 40) {
      // altura do chão a cada 0,25 m do raio (acompanha o chão mais perto da anterior; sem chão, mantém a última)
      const STEP = 0.25;
      const ground = [h];
      if (surface) {
        let cur = h;
        for (let d = STEP; d <= max + STEP; d += STEP) {
          const y = surface.near(x + dx * d, z + dz * d, cur, 2.5);
          if (y !== null) cur = y;
          ground.push(cur);
        }
      }
      const gAt = (d) => (surface ? ground[Math.min(ground.length - 1, Math.round(d / STEP))] : h);
      let best = 99;
      let tri = null;
      const ex = x + dx * max, ez = z + dz * max;
      const bx0 = Math.min(x, ex) - 0.5, bx1 = Math.max(x, ex) + 0.5, bz0 = Math.min(z, ez) - 0.5, bz1 = Math.max(z, ez) + 0.5;
      let lo = h, hi = h;
      for (const g of ground) {
        lo = Math.min(lo, g);
        hi = Math.max(hi, g);
      }
      for (const t of tris) {
        if (t[10] < lo + BAND[0] || t[9] > hi + BAND[1]) continue; // não cruza nenhuma faixa de altura do kart
        if (t[12] < bx0 || t[11] > bx1 || t[14] < bz0 || t[13] > bz1) continue;
        // raios horizontais a cada 0,3 m de altura dentro do triângulo; o acerto só vale se estiver na faixa do chão dali
        const ya = Math.max(t[9], lo + BAND[0]);
        const yb = Math.min(t[10], hi + BAND[1]);
        for (let y = ya; y <= yb + 1e-6; y += 0.3) {
          const d = rayTri(x, y, z, dx, 0, dz, t);
          if (d === null || d >= best || d > max) continue;
          const g = gAt(d);
          if (y < g + BAND[0] - 0.05 || y > g + BAND[1] + 0.05) continue;
          best = d;
          tri = t;
        }
      }
      return { d: best, tri };
    },
  };
}

/** Möller–Trumbore, dos dois lados do triângulo. */
function rayTri(ox, oy, oz, dx, dy, dz, t) {
  const e1x = t[3] - t[0], e1y = t[4] - t[1], e1z = t[5] - t[2];
  const e2x = t[6] - t[0], e2y = t[7] - t[1], e2z = t[8] - t[2];
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-9) return null;
  const inv = 1 / det;
  const tx = ox - t[0], ty = oy - t[1], tz = oz - t[2];
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return null;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return null;
  const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return d > 0.05 ? d : null;
}
