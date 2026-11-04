/**
 * Duna: o primeiro mapa do Counter Fox (spec 057), inspirado na estrutura da Dust 2: base TR, base CT, bomba A, bomba B, meio,
 * túneis, passarela e Long A. É um desenho em texto (uma célula = 2 m) de onde saem as caixas de colisão, os pontos de
 * nascimento, as zonas com nome e a malha de navegação dos bots.
 */
import type { FsBox } from './map';
import { fsClearLine } from './grenades';

export const FS_CELL = 2;

/**
 * Legenda: `#` parede (4,2 m) · `.` chão · `c` caixote (1,2 m) · `C` caixote alto (2,4 m) · `l` plataforma (0,9 m, sobe pulando).
 * Norte é para cima (linha 0 = z negativo), a base TR fica ao sul, a CT ao norte, A a nordeste e B a noroeste.
 */
export const FS_DUST_GRID: readonly string[] = [
  '############################',
  '############################',
  '##.........#.......#.......#',
  '##..CC...C.#.......#..ll...#',
  '##.........#..c.c..#..ll...#',
  '##....cc...#...............#',
  '##....c....#....C....cc....#',
  '##.................#.......#',
  '##.ll...c..........#.....C.#',
  '##...............###.......#',
  '###.....####...............#',
  '###.....####.c............##',
  '###...######.....#####....##',
  '###...#######..#######....##',
  '###...#######..#######..c.##',
  '###...#######..#######....##',
  '###.c.#######c.#######....##',
  '###............#######....##',
  '###............#######.C..##',
  '###...#######.c#######....##',
  '###..c#######..#######....##',
  '###...#######.C#######c...##',
  '###...######.....#####....##',
  '###...######.....#####....##',
  '##.......................c##',
  '##............#...........##',
  '##..c......c..............##',
  '##................C.......##',
  '##........c...............##',
  '##.....c......##############',
  '##............##############',
  '##............##############',
  '############################',
  '############################',
];

export const FS_DUST_COLS = FS_DUST_GRID[0]!.length;
export const FS_DUST_ROWS = FS_DUST_GRID.length;
/** Canto noroeste do mapa no mundo: o centro do mapa fica em (0, 0). */
export const FS_DUST_X0 = -(FS_DUST_COLS * FS_CELL) / 2;
export const FS_DUST_Z0 = -(FS_DUST_ROWS * FS_CELL) / 2;
export const FS_DUST_WALL_H = 4.2;

export const fsDustCellX = (c: number) => FS_DUST_X0 + (c + 0.5) * FS_CELL;
export const fsDustCellZ = (r: number) => FS_DUST_Z0 + (r + 0.5) * FS_CELL;
export const fsDustCol = (x: number) => Math.floor((x - FS_DUST_X0) / FS_CELL);
export const fsDustRow = (z: number) => Math.floor((z - FS_DUST_Z0) / FS_CELL);
const cellCh = (c: number, r: number) => (c < 0 || r < 0 || c >= FS_DUST_COLS || r >= FS_DUST_ROWS ? '#' : FS_DUST_GRID[r]![c]!);

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pen: number, mat: FsBox['mat']): FsBox => ({
  min: [x0, y0, z0], max: [x1, y1, z1], pen, mat,
});

/** Retângulo de células (inclusive). */
export interface FsCellRect {
  c0: number;
  r0: number;
  c1: number;
  r1: number;
}
/** Zonas com nome (bases, bombas, meio...): usadas no mapa pequeno, na decoração e nas frases do jogo. */
export interface FsDustZone extends FsCellRect {
  id: 'A' | 'B' | 'CT' | 'TR' | 'mid' | 'tunnels' | 'long' | 'catwalk';
  name: string;
}
export const FS_DUST_ZONES: readonly FsDustZone[] = [
  { id: 'A', name: 'Bomba A', c0: 20, r0: 2, c1: 26, r1: 10 },
  { id: 'B', name: 'Bomba B', c0: 2, r0: 2, c1: 10, r1: 9 },
  { id: 'CT', name: 'Base CT', c0: 12, r0: 2, c1: 18, r1: 8 },
  { id: 'TR', name: 'Base TR', c0: 2, r0: 24, c1: 13, r1: 31 },
  { id: 'mid', name: 'Meio', c0: 13, r0: 9, c1: 14, r1: 23 },
  { id: 'tunnels', name: 'Túneis', c0: 3, r0: 12, c1: 5, r1: 23 },
  { id: 'long', name: 'Long A', c0: 22, r0: 11, c1: 25, r1: 28 },
  { id: 'catwalk', name: 'Passarela', c0: 16, r0: 10, c1: 21, r1: 11 },
];
/** Trechos com teto (os túneis e o túnel baixo). */
export const FS_DUST_ROOFS: readonly FsCellRect[] = [
  { c0: 3, r0: 12, c1: 5, r1: 23 },
  { c0: 6, r0: 17, c1: 12, r1: 18 },
];
export const FS_DUST_ROOF_Y = [3.0, 3.4] as const;

/** Zona que contém o ponto (a primeira que bater) ou null. */
export function fsDustZoneAt(x: number, z: number): FsDustZone | null {
  const c = fsDustCol(x);
  const r = fsDustRow(z);
  return FS_DUST_ZONES.find((q) => c >= q.c0 && c <= q.c1 && r >= q.r0 && r <= q.r1) ?? null;
}

const rectToWorld = (q: FsCellRect) => ({
  x0: FS_DUST_X0 + q.c0 * FS_CELL,
  z0: FS_DUST_Z0 + q.r0 * FS_CELL,
  x1: FS_DUST_X0 + (q.c1 + 1) * FS_CELL,
  z1: FS_DUST_Z0 + (q.r1 + 1) * FS_CELL,
});
export const fsDustRectWorld = rectToWorld;

/** Está no tijolo? (as paredes ao redor dos túneis são de tijolo escuro). */
const brickCell = (c: number, r: number) => c >= 2 && c <= 12 && r >= 10 && r <= 24 && !(c >= 12 && r < 12);

/** Gera as caixas: paredes viram retângulos grandes (juntando células vizinhas); caixotes e plataformas são caixas próprias. */
export function fsDustBuildBoxes(): FsBox[] {
  const out: FsBox[] = [];
  // paredes: junta em faixas na horizontal e depois empilha faixas iguais na vertical (um material por vez)
  for (const brick of [false, true]) {
    const runs: { c0: number; c1: number; r0: number; r1: number }[] = [];
    for (let r = 0; r < FS_DUST_ROWS; r++) {
      let c = 0;
      while (c < FS_DUST_COLS) {
        if (cellCh(c, r) !== '#' || brickCell(c, r) !== brick) {
          c++;
          continue;
        }
        const c0 = c;
        while (c < FS_DUST_COLS && cellCh(c, r) === '#' && brickCell(c, r) === brick) c++;
        const open = runs.find((q) => q.c0 === c0 && q.c1 === c - 1 && q.r1 === r - 1);
        if (open) open.r1 = r;
        else runs.push({ c0, c1: c - 1, r0: r, r1: r });
      }
    }
    for (const q of runs) {
      const w = rectToWorld(q);
      out.push(box(w.x0, 0, w.z0, w.x1, FS_DUST_WALL_H, w.z1, 0, brick ? 'brick' : 'wall'));
    }
  }
  for (let r = 0; r < FS_DUST_ROWS; r++) {
    for (let c = 0; c < FS_DUST_COLS; c++) {
      const ch = cellCh(c, r);
      const x = fsDustCellX(c);
      const z = fsDustCellZ(r);
      if (ch === 'c') out.push(box(x - 0.8, 0, z - 0.8, x + 0.8, 1.2, z + 0.8, 0.5, 'crate'));
      else if (ch === 'C') out.push(box(x - 0.85, 0, z - 0.85, x + 0.85, 2.4, z + 0.85, 0.5, 'crate'));
      else if (ch === 'l') out.push(box(x - 1, 0, z - 1, x + 1, 0.9, z + 1, 0, 'metal'));
    }
  }
  // tetos dos túneis
  for (const q of FS_DUST_ROOFS) {
    const w = rectToWorld(q);
    out.push(box(w.x0, FS_DUST_ROOF_Y[0], w.z0, w.x1, FS_DUST_ROOF_Y[1], w.z1, 0, 'brick'));
  }
  return out;
}

export const FS_DUST_BOXES: readonly FsBox[] = fsDustBuildBoxes();

/** Meio-tamanho do mapa em x e z (para o mapa pequeno e a luz). */
export const FS_DUST_HALF: readonly [number, number] = [(FS_DUST_COLS * FS_CELL) / 2, (FS_DUST_ROWS * FS_CELL) / 2];

// ---------------------------------------------------------------- nascimento

export interface FsSpawn {
  x: number;
  z: number;
  /** Para onde olha ao nascer (graus, como a câmera: 0 = norte). */
  yaw: number;
  zone: FsDustZone['id'] | 'open';
}

const SPAWN_CELLS: readonly [number, number][] = [
  // base TR
  [3, 25], [5, 25], [7, 25], [9, 27], [11, 30], [4, 29], [8, 30], [12, 25],
  // base CT
  [13, 3], [15, 3], [17, 3], [13, 6], [17, 7], [15, 8], [14, 7], [18, 3],
  // bomba A
  [21, 4], [25, 3], [24, 9], [21, 9], [25, 6],
  // bomba B
  [3, 3], [9, 5], [4, 6], [9, 9], [3, 9],
  // meio, túneis e Long A
  [13, 10], [14, 15], [14, 20], [4, 14], [4, 21], [23, 15], [24, 22],
];

export const FS_DUST_SPAWNS: readonly FsSpawn[] = SPAWN_CELLS.map(([c, r]) => {
  const x = fsDustCellX(c);
  const z = fsDustCellZ(r);
  return {
    x,
    z,
    // olha para o centro do mapa (as bases ficam nas pontas e o centro é aberto)
    yaw: (Math.atan2(-(0 - x), -(0 - z)) * 180) / Math.PI,
    zone: fsDustZoneAt(x, z)?.id ?? 'open',
  };
});

/**
 * Escolhe onde nascer: o ponto mais longe dos inimigos que estão vivos, preferindo os que nenhum deles enxerga.
 * Sorteia entre os 3 melhores para não nascer sempre no mesmo lugar. `rng` devolve 0 a 1.
 */
export function fsPickSpawn(
  foes: readonly { x: number; z: number }[],
  rng: () => number = Math.random,
  boxes: readonly FsBox[] = FS_DUST_BOXES,
  spawns: readonly FsSpawn[] = FS_DUST_SPAWNS,
): FsSpawn {
  const scored = spawns.map((s) => {
    let near = 1e9;
    let seen = 0;
    for (const f of foes) {
      const d = Math.hypot(f.x - s.x, f.z - s.z);
      near = Math.min(near, d);
      if (d < 40 && fsClearLine(boxes, [s.x, 1, s.z], [f.x, 1, f.z])) seen++;
    }
    // quem é visto por inimigos perde muito (cada um vale 25 m); o resto é a distância ao mais perto
    return { s, v: Math.min(near, 60) - seen * 25 };
  });
  scored.sort((a, b) => b.v - a.v);
  const top = scored.slice(0, Math.min(3, scored.length));
  return top[Math.min(top.length - 1, Math.floor(rng() * top.length))]!.s;
}

// ---------------------------------------------------------------- navegação (A* na grade)

/** Célula por onde o bot anda: chão livre (caixotes e plataformas não). */
export const fsDustWalkable = (c: number, r: number) => cellCh(c, r) === '.';

const NEI: readonly [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** O segmento (a, b) cabe andando com uma folga lateral? Amostra pontos ao longo dele, cada um com folga dos dois lados. */
export function fsDustLineWalkable(ax: number, az: number, bx: number, bz: number, margin = 0.42): boolean {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 1e-6) return true;
  const nx = -(bz - az) / len;
  const nz = (bx - ax) / len;
  const n = Math.ceil(len / 0.3);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    for (const k of [-margin, 0, margin]) {
      if (!fsDustWalkable(fsDustCol(x + nx * k), fsDustRow(z + nz * k))) return false;
    }
  }
  return true;
}

/** Célula livre mais perto do ponto (ele mesmo, se já estiver em chão livre). */
export function fsDustNearestFree(x: number, z: number): [number, number] {
  const c0 = fsDustCol(x);
  const r0 = fsDustRow(z);
  let best: [number, number] = [c0, r0];
  let bd = 1e9;
  for (let r = r0 - 4; r <= r0 + 4; r++) {
    for (let c = c0 - 4; c <= c0 + 4; c++) {
      if (!fsDustWalkable(c, r)) continue;
      const d = Math.hypot(fsDustCellX(c) - x, fsDustCellZ(r) - z);
      if (d < bd) {
        bd = d;
        best = [c, r];
      }
    }
  }
  return best;
}

/**
 * Caminho de (ax, az) até (bx, bz) em pontos do mundo [x, z]: A* nas 8 direções (sem cortar quina) e depois puxa o fio, juntando
 * pontos que dá para ir em linha reta. Vazio se não há caminho. O primeiro ponto é o primeiro passo (não a origem).
 */
export function fsDustPath(ax: number, az: number, bx: number, bz: number): [number, number][] {
  const [sc, sr] = fsDustNearestFree(ax, az);
  const [gc, gr] = fsDustNearestFree(bx, bz);
  if (!fsDustWalkable(sc, sr) || !fsDustWalkable(gc, gr)) return [];
  const W = FS_DUST_COLS;
  const key = (c: number, r: number) => r * W + c;
  const g = new Map<number, number>([[key(sc, sr), 0]]);
  const from = new Map<number, number>();
  const open: { k: number; f: number }[] = [{ k: key(sc, sr), f: 0 }];
  const closed = new Set<number>();
  const hd = (c: number, r: number) => Math.hypot(c - gc, r - gr);
  let found = false;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bi]!.f) bi = i;
    const cur = open.splice(bi, 1)[0]!;
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);
    const c = cur.k % W;
    const r = Math.floor(cur.k / W);
    if (c === gc && r === gr) {
      found = true;
      break;
    }
    for (const [dc, dr] of NEI) {
      const nc = c + dc;
      const nr = r + dr;
      if (!fsDustWalkable(nc, nr)) continue;
      if (dc && dr && (!fsDustWalkable(c + dc, r) || !fsDustWalkable(c, r + dr))) continue;
      const nk = key(nc, nr);
      if (closed.has(nk)) continue;
      const ng = g.get(cur.k)! + (dc && dr ? Math.SQRT2 : 1);
      if (ng < (g.get(nk) ?? 1e9)) {
        g.set(nk, ng);
        from.set(nk, cur.k);
        open.push({ k: nk, f: ng + hd(nc, nr) });
      }
    }
  }
  if (!found) return [];
  const cells: [number, number][] = [];
  for (let k: number | undefined = key(gc, gr); k !== undefined; k = from.get(k)) cells.push([fsDustCellX(k % W), fsDustCellZ(Math.floor(k / W))]);
  cells.reverse();
  // o último ponto é o destino de verdade (se for chão livre)
  if (fsDustWalkable(fsDustCol(bx), fsDustRow(bz))) cells.push([bx, bz]);
  // puxa o fio: de cada ponto, vai para o mais distante que dá para alcançar em linha reta
  const out: [number, number][] = [];
  let cx = ax;
  let cz = az;
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !fsDustLineWalkable(cx, cz, cells[j]![0], cells[j]![1])) j--;
    out.push(cells[j]!);
    cx = cells[j]![0];
    cz = cells[j]![1];
    i = j + 1;
  }
  return out;
}

/** Pontos onde os bots gostam de ir (centros das zonas e cruzamentos). */
export const FS_DUST_HOTSPOTS: readonly [number, number][] = [
  [23, 5], [5, 5], [13, 4], [14, 10], [14, 16], [13, 21], [4, 13], [4, 21], [9, 18], [23, 14], [23, 24], [8, 27], [17, 11], [19, 6], [10, 8],
].map(([c, r]) => [fsDustCellX(c!), fsDustCellZ(r!)] as [number, number]);
