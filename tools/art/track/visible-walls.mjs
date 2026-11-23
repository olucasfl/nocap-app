/**
 * Paredes VISÍVEIS do cenário de uma pista de modelo (spec 086, seção 11): lança raios na horizontal, na altura do kart,
 * contra todos os triângulos de `core.bin` que não são chão (virados para o lado ou para baixo, ou subida íngreme demais
 * para o kart). Devolve a distância até a primeira parede de cada lado, ou 99. Tudo que existe aqui o jogador vê.
 */
import fs from 'node:fs';
import path from 'node:path';

const MAX_UP = 0.6; // normal.y acima disso é chão ou rampa que o kart sobe
const BAND = [0.25, 1.1]; // altura (m) acima da estrada em que o kart bate

/** @param {string} dir @param {string[]} packs pacotes lidos (`core` vai para todos; `detail` só para o computador) */
export function loadWalls(dir, packs = ['core']) {
  const tris = [];
  for (const name of packs) addPack(dir, name, tris);
  return solid(tris);
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
      tris.push([ax, ay, az, bx, by, bz, cx, cy, cz, Math.min(ay, by, cy), Math.max(ay, by, cy), Math.min(ax, bx, cx), Math.max(ax, bx, cx), Math.min(az, bz, cz), Math.max(az, bz, cz)]);
    }
  }
}

function solid(tris) {
  return {
    count: tris.length,
    /** Distância até a parede na direção horizontal (dx, dz) unitária a partir de (x, z), com a estrada a `h` m; 99 se não há. */
    hit(x, z, h, dx, dz, max = 40) {
      let best = 99;
      const y0 = h + BAND[0];
      const y1 = h + BAND[1];
      const ex = x + dx * max, ez = z + dz * max;
      const bx0 = Math.min(x, ex) - 0.5, bx1 = Math.max(x, ex) + 0.5, bz0 = Math.min(z, ez) - 0.5, bz1 = Math.max(z, ez) + 0.5;
      for (const t of tris) {
        if (t[10] < y0 || t[9] > y1) continue; // não cruza a faixa de altura do kart
        if (t[12] < bx0 || t[11] > bx1 || t[14] < bz0 || t[13] > bz1) continue;
        // interseção do raio horizontal com o triângulo recortado na faixa: testa o raio em 3 alturas
        for (const y of [y0, (y0 + y1) / 2, y1]) {
          const d = rayTri(x, y, z, dx, 0, dz, t);
          if (d !== null && d < best && d <= max) best = d;
        }
      }
      return best;
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
