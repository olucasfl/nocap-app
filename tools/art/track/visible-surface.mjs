/**
 * Mapa da superfície VISÍVEL do cenário de uma pista de modelo (spec 086, seção 11): todo triângulo virado para cima de
 * `core.bin` (estrada, ponte, grama, areia, morro) vira células de 1 m com a altura da superfície naquele ponto. É o que
 * o jogador vê, ao contrário de `ground.bin` (só o que o modelo marca como "dirigível", que tem emendas e falhas pequenas
 * onde o visual mostra chão). Serve à ferramenta que fecha as barreiras e aos testes.
 */
import fs from 'node:fs';
import path from 'node:path';

const MIN_UP = 0.35;
const CELL = 1;

/** @param {string} dir pasta com `core.json` e `core.bin` */
export function loadVisibleSurface(dir) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'core.json'), 'utf8'));
  const raw = fs.readFileSync(path.join(dir, 'core.bin'));
  const bin = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  /** @type {Map<number, number[]>} */
  const cells = new Map();
  const key = (cx, cz) => (cz + 4096) * 8192 + (cx + 4096);
  for (const g of meta.groups) {
    if (g.alpha) continue; // folhagem recortada não é chão
    const p = new Float32Array(bin, g.pos, g.n * 3);
    for (let t = 0; t + 2 < g.n; t += 3) {
      const a = t * 3;
      const ax = p[a], ay = p[a + 1], az = p[a + 2];
      const bx = p[a + 3], by = p[a + 4], bz = p[a + 5];
      const cx = p[a + 6], cy = p[a + 7], cz = p[a + 8];
      // normal pela regra da mão direita; só superfícies viradas para cima servem de chão
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-9 || ny / len < MIN_UP) continue;
      // área do triângulo no plano (x, z): o denominador da interpolação
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-9) continue;
      const x0 = Math.floor(Math.min(ax, bx, cx) / CELL);
      const x1 = Math.floor(Math.max(ax, bx, cx) / CELL);
      const z0 = Math.floor(Math.min(az, bz, cz) / CELL);
      const z1 = Math.floor(Math.max(az, bz, cz) / CELL);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4000) continue; // triângulo enorme (céu, fundo): não é pista
      for (let zi = z0; zi <= z1; zi++) {
        for (let xi = x0; xi <= x1; xi++) {
          const px = (xi + 0.5) * CELL;
          const pz = (zi + 0.5) * CELL;
          const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / det;
          const l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / det;
          const l3 = 1 - l1 - l2;
          // o centro da célula tem de estar dentro do triângulo (com uma folga pequena para não abrir fendas)
          const e = -0.02;
          if (l1 < e || l2 < e || l3 < e) continue;
          const y = l1 * ay + l2 * by + l3 * cy;
          const k = key(xi, zi);
          const arr = cells.get(k);
          if (arr) arr.push(y);
          else cells.set(k, [y]);
        }
      }
    }
  }
  return {
    cells: cells.size,
    /** A altura da superfície visível em (x, z) mais perto de `h` (m), se estiver a no máximo `tol` m dela; senão null. */
    near(x, z, h, tol = 2.5) {
      const arr = cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
      if (!arr) return null;
      let best = null;
      let bd = tol;
      for (const y of arr) {
        const d = Math.abs(y - h);
        if (d <= bd) {
          bd = d;
          best = y;
        }
      }
      return best;
    },
  };
}
