declare function atob(s: string): string;
/**
 * Mapas gerados de uma grade (spec 061): o mapa novo vem do modelo 3D (tools/art/map2_build.py), que gera uma grade de 0,5 m com o
 * nível do chão de cada célula (255 = parede) e as posições dos nascimentos e das bombas lidas do BSP. Daqui saem as caixas de
 * colisão, a navegação dos bots (A* com fila de prioridade), os pontos de nascimento e as marcas das bases e das bombas.
 */
import { fsBoxesInRect, type FsBox } from './map';
import { fsClearLine } from './grenades';
import type { FsDustMark, FsSpawn } from './spawn';

export interface FsGridMapData {
  cols: number;
  rows: number;
  x0: number;
  z0: number;
  cell: number;
  step: number;
  /** Pares [valor, quantidade] da grade, linha a linha (255 = parede). */
  rle: readonly number[];
  /**
   * Caixas de colisão exatas (base64 de Uint16 em grupos de 6: i0, j0, k0, i1, j1, k1 em voxels, extremos inclusivos; i = linha (z),
   * j = coluna (x), k = altura). Sem isso as caixas saem da grade (paredes e degraus por célula).
   */
  boxes?: string;
  /** lado dos voxels das caixas (m); padrão = cell */
  bcell?: number;
  tspawns: readonly (readonly [number, number, number])[];
  ctspawns: readonly (readonly [number, number, number])[];
  /** Caixas das bombas (x0, z0, x1, z1): a primeira é a A. */
  sites: readonly (readonly [number, number, number, number])[];
  /** Zonas de compra (as bases). */
  buys: readonly (readonly [number, number, number, number])[];
}

/** Tudo o que o jogo precisa saber de um mapa, igual para a Duna e para o mapa novo. */
export interface FsMapApi {
  id: string;
  name: string;
  solids: readonly FsBox[];
  marks: readonly FsDustMark[];
  spawns: readonly FsSpawn[];
  hotspots: readonly [number, number][];
  half: readonly [number, number];
  labels: readonly { x: number; z: number; text: string }[];
  floorY(x: number, z: number): number;
  siteAt(x: number, z: number): 'A' | 'B' | null;
  pickSpawn(foes: readonly { x: number; z: number }[], rng?: () => number, boxes?: readonly FsBox[], spawns?: readonly FsSpawn[]): FsSpawn;
  path(ax: number, az: number, bx: number, bz: number): [number, number][];
  nearestFree(x: number, z: number): [number, number];
  cellX(c: number): number;
  cellZ(r: number): number;
  col(x: number): number;
  row(z: number): number;
  walkable(c: number, r: number): boolean;
  lineWalkable(ax: number, az: number, bx: number, bz: number, margin?: number): boolean;
  /** Para desenhar o mapa pequeno: colunas, linhas, canto e se a célula é parede (`wall`) ou chão com altura (m). */
  grid: { cols: number; rows: number; x0: number; z0: number; cell: number; wall(c: number, r: number): boolean; height(c: number, r: number): number };
  /** Como a cena desenha: com o cenário próprio da Duna (caixas, decoração) ou com um modelo 3D. */
  visual: { kind: 'glb'; url: string };
}

const WALL = 255;
const NEI: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Fila de prioridade mínima (o A* com lista simples era lento numa grade de 37 mil células). */
class Heap {
  private a: { k: number; f: number }[] = [];
  get size() {
    return this.a.length;
  }
  push(k: number, f: number) {
    const a = this.a;
    a.push({ k, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.f <= a[i]!.f) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): { k: number; f: number } {
    const a = this.a;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.f < a[m]!.f) m = l;
        if (r < a.length && a[r]!.f < a[m]!.f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

export function createGridMap(opts: { id: string; name: string; data: FsGridMapData; glb: string; names?: { A: string; B: string } }): FsMapApi {
  const d = opts.data;
  const { cols, rows, x0, z0, cell, step } = d;
  const N = cols * rows;
  const level = new Uint8Array(N);
  {
    let i = 0;
    for (let k = 0; k < d.rle.length; k += 2) for (let n = 0; n < d.rle[k + 1]!; n++) level[i++] = d.rle[k]!;
  }
  const idx = (c: number, r: number) => r * cols + c;
  const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows;
  const col = (x: number) => Math.floor((x - x0) / cell);
  const row = (z: number) => Math.floor((z - z0) / cell);
  const cellX = (c: number) => x0 + (c + 0.5) * cell;
  const cellZ = (r: number) => z0 + (r + 0.5) * cell;
  const walkable = (c: number, r: number) => inside(c, r) && level[idx(c, r)] !== WALL;
  const height = (c: number, r: number) => (inside(c, r) && level[idx(c, r)] !== WALL ? level[idx(c, r)]! * step : 0);
  const floorY = (x: number, z: number) => height(col(x), row(z));

  // ---- caixas: chão elevado e paredes (juntando células iguais)
  const solids: FsBox[] = [];
  if (d.boxes) {
    const bin = atob(d.boxes);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const u16 = new Uint16Array(u8.buffer, 0, Math.floor(u8.length / 2));
    const bc = d.bcell ?? cell;
    for (let i = 0; i + 5 < u16.length; i += 6) {
      solids.push({
        min: [x0 + u16[i + 1]! * bc, u16[i + 2]! * bc, z0 + u16[i]! * bc],
        max: [x0 + (u16[i + 4]! + 1) * bc, (u16[i + 5]! + 1) * bc, z0 + (u16[i + 3]! + 1) * bc],
        pen: 0,
        mat: 'wall',
      });
    }
  }
  const merge = (pred: (c: number, r: number) => number | null, make: (key: number, c0: number, r0: number, c1: number, r1: number) => FsBox) => {
    const runs: { key: number; c0: number; c1: number; r0: number; r1: number }[] = [];
    const open = new Map<string, number>();
    for (let r = 0; r < rows; r++) {
      const nextOpen = new Map<string, number>();
      let c = 0;
      while (c < cols) {
        const key = pred(c, r);
        if (key === null) {
          c++;
          continue;
        }
        const c0 = c;
        while (c < cols && pred(c, r) === key) c++;
        const sig = `${key}:${c0}:${c - 1}`;
        const at = open.get(sig);
        if (at !== undefined) {
          runs[at]!.r1 = r;
          nextOpen.set(sig, at);
        } else {
          runs.push({ key, c0, c1: c - 1, r0: r, r1: r });
          nextOpen.set(sig, runs.length - 1);
        }
      }
      open.clear();
      for (const [k, v] of nextOpen) open.set(k, v);
    }
    for (const q of runs) solids.push(make(q.key, q.c0, q.r0, q.c1, q.r1));
  };
  const rect = (c0: number, r0: number, c1: number, r1: number) => ({ x0: x0 + c0 * cell, z0: z0 + r0 * cell, x1: x0 + (c1 + 1) * cell, z1: z0 + (r1 + 1) * cell });
  // chão elevado (só sem caixas exatas)
  if (!d.boxes) merge(
    (c, r) => (level[idx(c, r)] !== WALL && level[idx(c, r)]! > 0 ? level[idx(c, r)]! : null),
    (lv, c0, r0, c1, r1) => {
      const w = rect(c0, r0, c1, r1);
      return { min: [w.x0, 0, w.z0], max: [w.x1, lv * step, w.z1], pen: 0, mat: 'concrete' };
    },
  );
  // paredes: células de parede que encostam em chão; o topo é 3,4 m acima do chão mais alto ao lado
  const wallTop = new Int16Array(N);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (level[idx(c, r)] !== WALL) continue;
      let best = -1;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (walkable(c + dc, r + dr)) best = Math.max(best, level[idx(c + dc, r + dr)]!);
      wallTop[idx(c, r)] = best < 0 ? 0 : best + Math.ceil(3.4 / step);
    }
  }
  if (!d.boxes) merge(
    (c, r) => (wallTop[idx(c, r)]! > 0 ? wallTop[idx(c, r)]! : null),
    (top, c0, r0, c1, r1) => {
      const w = rect(c0, r0, c1, r1);
      return { min: [w.x0, 0, w.z0], max: [w.x1, top * step, w.z1], pen: 0, mat: 'wall' };
    },
  );

  // ---- marcas: bombas A e B (caixa da bomba com folga) e as bases (zona de compra onde nasce cada time)
  const nearestFree = (x: number, z: number): [number, number] => {
    const c0 = col(x);
    const r0 = row(z);
    let best: [number, number] = [c0, r0];
    let bd = 1e9;
    const R = 10;
    for (let r = r0 - R; r <= r0 + R; r++) {
      for (let c = c0 - R; c <= c0 + R; c++) {
        if (!walkable(c, r)) continue;
        const dd = Math.hypot(cellX(c) - x, cellZ(r) - z);
        if (dd < bd) {
          bd = dd;
          best = [c, r];
        }
      }
    }
    return best;
  };
  const mkMark = (id: 'A' | 'B' | 'T' | 'CT', short: string, name: string, kind: 'site' | 'base', b: readonly [number, number, number, number], pad: number): FsDustMark => {
    const cx = (b[0] + b[2]) / 2;
    const cz = (b[1] + b[3]) / 2;
    const [fc, fr] = nearestFree(cx, cz);
    return { id, short, name, kind, x: cellX(fc), z: cellZ(fr), x0: b[0] - pad, z0: b[1] - pad, x1: b[2] + pad, z1: b[3] + pad };
  };
  const inRect = (b: readonly [number, number, number, number], x: number, z: number) => x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3];
  const avg = (l: readonly (readonly [number, number, number])[]) => [l.reduce((s, p) => s + p[0], 0) / l.length, l.reduce((s, p) => s + p[1], 0) / l.length] as const;
  const [tx, tz] = avg(d.tspawns);
  const [ctx, ctz] = avg(d.ctspawns);
  const tBuy = d.buys.find((b) => inRect([b[0] - 3, b[1] - 3, b[2] + 3, b[3] + 3], tx, tz)) ?? d.buys[0]!;
  const ctBuy = d.buys.find((b) => inRect([b[0] - 3, b[1] - 3, b[2] + 3, b[3] + 3], ctx, ctz) && b !== tBuy) ?? d.buys[1] ?? d.buys[0]!;
  const nm = opts.names ?? { A: 'Bomba A', B: 'Bomba B' };
  const marks: FsDustMark[] = [
    ...(d.sites[0]
      ? [mkMark('A', 'A', nm.A, 'site', d.sites[0], 0), mkMark('B', 'B', nm.B, 'site', d.sites[1] ?? d.sites[0], 0)]
      : []),
    mkMark('CT', 'CT', 'Base Contra-Terrorista', 'base', ctBuy, 0),
    mkMark('T', 'TR', 'Base Terrorista', 'base', tBuy, 0),
  ];
  const siteAt = (x: number, z: number): 'A' | 'B' | null => {
    for (const m of marks) {
      if (m.kind !== 'site') continue;
      const inR = x >= m.x0 - 2 && x <= m.x1 + 2 && z >= m.z0 - 2 && z <= m.z1 + 2;
      if (inR || Math.hypot(x - m.x, z - m.z) <= 7) return m.id as 'A' | 'B';
    }
    return null;
  };

  // ---- nascimentos (BSP: o ângulo do CS vira o yaw da câmera) e pontos de interesse dos bots
  /** Chão de verdade sob o ponto: o topo de bloco mais perto da altura da grade onde o corpo cabe (a grade pode errar por um degrau ou andar). */
  const fitY = (px: number, pz: number, y0: number): number => {
    const near = fsBoxesInRect(solids, px - 0.5, pz - 0.5, px + 0.5, pz + 0.5);
    let best = y0;
    let bd = 1e9;
    for (const b of near) {
      if (!(px > b.min[0] && px < b.max[0] && pz > b.min[2] && pz < b.max[2])) continue;
      const t = b.max[1];
      if (Math.abs(t - y0) >= bd || Math.abs(t - y0) > 3) continue;
      const clear = !near.some((c) => px + 0.32 > c.min[0] && px - 0.32 < c.max[0] && pz + 0.32 > c.min[2] && pz - 0.32 < c.max[2] && t + 1.4 > c.min[1] && t + 0.02 < c.max[1]);
      if (clear) {
        best = t;
        bd = Math.abs(t - y0);
      }
    }
    return best;
  };
  const mkSpawn = (p: readonly [number, number, number], zone: 'TR' | 'CT'): FsSpawn => ({ x: p[0], z: p[1], y: fitY(p[0], p[1], floorY(p[0], p[1])), yaw: p[2] + 180, zone: zone as FsSpawn['zone'] });
  const spawns: FsSpawn[] = [...d.tspawns.map((p) => mkSpawn(p, 'TR')), ...d.ctspawns.map((p) => mkSpawn(p, 'CT'))];
  // mata-mata: nascimentos espalhados pelo mapa todo (reticulado de 5 m em chão andável onde o corpo cabe)
  for (let z = z0 + 2.5; z < z0 + rows * cell; z += 5) {
    for (let x = x0 + 2.5; x < x0 + cols * cell; x += 5) {
      const c = col(x), r = row(z);
      if (!walkable(c, r)) continue;
      const px = cellX(c), pz = cellZ(r);
      const py = fitY(px, pz, floorY(px, pz));
      const near = fsBoxesInRect(solids, px - 1, pz - 1, px + 1, pz + 1);
      const blocked = near.some((b) => px + 0.35 > b.min[0] && px - 0.35 < b.max[0] && pz + 0.35 > b.min[2] && pz - 0.35 < b.max[2] && py + 1.4 > b.min[1] && py + 0.05 < b.max[1]);
      const floored = near.some((b) => Math.abs(b.max[1] - py) < 0.35 && px > b.min[0] && px < b.max[0] && pz > b.min[2] && pz < b.max[2]);
      if (blocked || !floored) continue;
      spawns.push({ x: px, z: pz, y: py, yaw: Math.floor(((px * 7 + pz * 13) % 8) * 45), zone: 'open' });
    }
  }
  const hotspots: [number, number][] = [];
  for (let z = z0 + 6; z < z0 + rows * cell; z += 9) {
    for (let x = x0 + 6; x < x0 + cols * cell; x += 9) {
      const [fc, fr] = nearestFree(x, z);
      const px = cellX(fc);
      const pz = cellZ(fr);
      if (Math.hypot(px - x, pz - z) < 3 && !hotspots.some((h) => Math.hypot(h[0] - px, h[1] - pz) < 6)) hotspots.push([px, pz]);
    }
  }
  for (const m of marks) hotspots.push([m.x, m.z]);

  const pickSpawn = (foes: readonly { x: number; z: number }[], rng: () => number = Math.random, boxes: readonly FsBox[] = solids, list: readonly FsSpawn[] = spawns): FsSpawn => {
    const scored = list.map((s) => {
      let near = 1e9;
      let seen = 0;
      for (const f of foes) {
        const dd = Math.hypot(f.x - s.x, f.z - s.z);
        near = Math.min(near, dd);
        if (dd < 45 && fsClearLine(boxes, [s.x, s.y + 1, s.z], [f.x, s.y + 1, f.z])) seen++;
      }
      return { s, v: Math.min(near, 60) - seen * 25 - (near < 15 ? 100 : 0) };
    });
    scored.sort((a, b) => b.v - a.v);
    const top = scored.slice(0, Math.min(3, scored.length));
    return top[Math.min(top.length - 1, Math.floor(rng() * top.length))]!.s;
  };

  // ---- navegação
  const stepOk = (c: number, r: number, nc: number, nr: number) => walkable(nc, nr) && Math.abs(level[idx(nc, nr)]! - level[idx(c, r)]!) <= 2;
  const lineWalkable = (ax: number, az: number, bx: number, bz: number, margin = 0.42): boolean => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-6) return true;
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    const n = Math.ceil(len / 0.25);
    let pc = col(ax);
    let pr = row(az);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      for (const k of [-margin, 0, margin]) {
        const c = col(x + nx * k);
        const r = row(z + nz * k);
        if (!walkable(c, r)) return false;
        if (k === 0) {
          if (Math.abs(level[idx(c, r)]! - level[idx(pc, pr)]!) > 2) return false;
          pc = c;
          pr = r;
        }
      }
    }
    return true;
  };
  const path = (ax: number, az: number, bx: number, bz: number): [number, number][] => {
    const [sc, sr] = nearestFree(ax, az);
    const [gc, gr] = nearestFree(bx, bz);
    if (!walkable(sc, sr) || !walkable(gc, gr)) return [];
    const g = new Map<number, number>([[idx(sc, sr), 0]]);
    const from = new Map<number, number>();
    const open = new Heap();
    // distância octil: é o custo exato em campo aberto, então o A* quase não sai da reta (a euclidiana abria um leque enorme)
    const hd = (c: number, r: number) => {
      const dx = Math.abs(c - gc);
      const dy = Math.abs(r - gr);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    open.push(idx(sc, sr), hd(sc, sr) * 1.002);
    const closed = new Set<number>();
    let found = false;
    while (open.size) {
      const cur = open.pop();
      if (closed.has(cur.k)) continue;
      closed.add(cur.k);
      const c = cur.k % cols;
      const r = Math.floor(cur.k / cols);
      if (c === gc && r === gr) {
        found = true;
        break;
      }
      for (const [dc, dr] of NEI) {
        const nc = c + dc;
        const nr = r + dr;
        if (!stepOk(c, r, nc, nr)) continue;
        if (dc && dr && (!stepOk(c, r, c + dc, r) || !stepOk(c, r, c, r + dr))) continue;
        const nk = idx(nc, nr);
        if (closed.has(nk)) continue;
        const ng = g.get(cur.k)! + (dc && dr ? Math.SQRT2 : 1);
        if (ng < (g.get(nk) ?? 1e9)) {
          g.set(nk, ng);
          from.set(nk, cur.k);
          open.push(nk, ng + hd(nc, nr) * 1.002);
        }
      }
    }
    if (!found) return [];
    const cells: [number, number][] = [];
    for (let k: number | undefined = idx(gc, gr); k !== undefined; k = from.get(k)) cells.push([cellX(k % cols), cellZ(Math.floor(k / cols))]);
    cells.reverse();
    if (walkable(col(bx), row(bz))) cells.push([bx, bz]);
    const out: [number, number][] = [];
    let cx = ax;
    let cz = az;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !lineWalkable(cx, cz, cells[j]![0], cells[j]![1])) j--;
      out.push(cells[j]!);
      cx = cells[j]![0];
      cz = cells[j]![1];
      i = j + 1;
    }
    return out;
  };

  // os nomes das bombas e das bases já saem das marcas; não repete aqui
  const labels: { x: number; z: number; text: string }[] = [];
  return {
    id: opts.id,
    name: opts.name,
    solids,
    marks,
    spawns,
    hotspots,
    half: [(cols * cell) / 2, (rows * cell) / 2],
    labels,
    floorY,
    siteAt,
    pickSpawn,
    path,
    nearestFree,
    cellX,
    cellZ,
    col,
    row,
    walkable,
    lineWalkable,
    grid: { cols, rows, x0, z0, cell, wall: (c, r) => !walkable(c, r), height },
    visual: { kind: 'glb', url: opts.glb },
  };
}
