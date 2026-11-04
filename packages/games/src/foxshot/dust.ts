/**
 * Duna: o primeiro mapa do Counter Fox (spec 057). A estrutura segue a das Dust 2 (três rotas saindo da base TR, portas e gargalos
 * estreitos, salas fechadas e dois pátios de bomba), mas o desenho é nosso: 57 x 68 células de 1 m, alturas em degraus de 0,3 m.
 *
 * Tudo sai de listas de retângulos (`FS_DUST_CARVES`): o resto do mapa é parede. Daí saem o chão com alturas, as caixas de colisão,
 * as zonas com nome, os pontos de nascimento e a malha de navegação dos bots.
 *
 *   Rotas: da base TR (sul) há três saídas.
 *   1. OESTE, "Túneis": corredor estreito e coberto até o cruzamento; dali sobe ao B (norte) ou segue pelo "Túnel baixo" ao Meio (leste).
 *   2. CENTRO, "Meio": corredor de 4 m, com portas (2 m) no meio, até a Base CT; ramal "Passarela" sobe ao A.
 *   3. LESTE, "Pátio e Long A": pátio, portas do Long e um corredor largo que sobe até o A.
 *   Base CT (norte, centro) liga ao B pelas portas do B e ao A pela rampa CT.
 */
import type { FsBox } from './map';
import { fsClearLine } from './grenades';

export const FS_CELL = 1;
/** Altura de cada degrau de chão (m): menor que o `stepUp` do movimento, então se sobe andando. */
export const FS_DUST_STEP = 0.3;
export const FS_DUST_COLS = 57;
export const FS_DUST_ROWS = 68;
/** Canto noroeste do mapa no mundo: o centro do mapa fica em (0, 0). */
export const FS_DUST_X0 = -(FS_DUST_COLS * FS_CELL) / 2;
export const FS_DUST_Z0 = -(FS_DUST_ROWS * FS_CELL) / 2;
export const FS_DUST_WALL_H = 4.4;

export type FsDustZoneId = 'A' | 'B' | 'CT' | 'TR' | 'mid' | 'tunnels' | 'lower' | 'long' | 'yard' | 'catwalk' | 'ctramp' | 'bdoors';
export type FsFloorMat = 'dirt' | 'sandstone' | 'tile' | 'cobble' | 'concrete' | 'brick';

/** Retângulo de células (inclusive). */
export interface FsCellRect {
  c0: number;
  r0: number;
  c1: number;
  r1: number;
}

/**
 * Um retângulo de chão. `lv` é a altura em degraus (0 = nível do chão); `ramp` faz o nível variar de `from` a `to` ao longo de colunas ou
 * linhas (uma rampa em degraus). `wall` põe parede (pilares, divisórias). `roof` cobre com teto.
 */
export interface FsCarve extends FsCellRect {
  lv?: number;
  ramp?: { axis: 'c' | 'r'; from: number; to: number };
  wall?: boolean;
  roof?: boolean;
  zone?: FsDustZoneId;
  floor?: FsFloorMat;
}

const K = (c0: number, r0: number, c1: number, r1: number, o: Partial<FsCarve> = {}): FsCarve => ({ c0, r0, c1, r1, ...o });

export const FS_DUST_CARVES: readonly FsCarve[] = [
  // ---- Base TR (sul): sala larga, três saídas
  K(4, 53, 29, 60, { lv: 1, zone: 'TR', floor: 'dirt' }),
  // ---- Rota oeste: pátio de saída, túnel estreito coberto, cruzamento
  K(6, 44, 13, 52, { lv: 1, zone: 'tunnels', floor: 'cobble' }),
  K(10, 34, 12, 43, { lv: 1, zone: 'tunnels', floor: 'brick', roof: true }),
  K(6, 29, 16, 33, { lv: 1, zone: 'tunnels', floor: 'brick' }),
  K(8, 25, 15, 28, { lv: 1, zone: 'tunnels', floor: 'cobble' }),
  // túnel baixo: do cruzamento ao Meio (um degrau abaixo)
  K(17, 29, 25, 32, { lv: 0, zone: 'lower', floor: 'brick', roof: true }),
  K(26, 29, 28, 32, { lv: 0, zone: 'lower', floor: 'cobble' }),
  // ---- Bomba B (noroeste): sala alta com dois acessos (túneis ao sul, portas do B a leste)
  K(6, 9, 17, 24, { lv: 2, zone: 'B', floor: 'sandstone' }),
  K(18, 14, 19, 15, { lv: 1, zone: 'bdoors', floor: 'cobble' }),
  // ---- Meio: corredor de 4 m do sul até a Base CT
  K(25, 44, 30, 52, { lv: 0, zone: 'mid', floor: 'cobble' }),
  K(26, 23, 29, 43, { lv: 0, zone: 'mid', floor: 'cobble' }),
  // ---- Base CT (norte, centro)
  K(20, 12, 35, 22, { lv: 0, zone: 'CT', floor: 'tile' }),
  // ---- Passarela: ramal do Meio que sobe ao A
  K(30, 28, 41, 30, { lv: 0, zone: 'catwalk', floor: 'cobble' }),
  K(38, 18, 41, 27, { zone: 'catwalk', floor: 'concrete', ramp: { axis: 'r', from: 3, to: 0 } }),
  // ---- Rampa CT: da Base CT ao A
  K(36, 11, 41, 14, { zone: 'ctramp', floor: 'concrete', ramp: { axis: 'c', from: 0, to: 3 } }),
  // ---- Bomba A (nordeste): plataforma alta (nível 3)
  K(42, 9, 53, 17, { lv: 3, zone: 'A', floor: 'sandstone' }),
  K(38, 16, 41, 17, { lv: 3, zone: 'A', floor: 'sandstone' }),
  // ---- Rota leste: do fundo da base TR ao pátio, às portas do Long e ao Long A
  K(30, 54, 40, 58, { lv: 1, zone: 'yard', floor: 'dirt' }),
  K(35, 36, 40, 53, { lv: 1, zone: 'yard', floor: 'dirt' }),
  K(35, 31, 48, 35, { lv: 1, zone: 'long', floor: 'concrete' }),
  K(49, 18, 54, 35, { zone: 'long', floor: 'concrete', ramp: { axis: 'r', from: 3, to: 1 } }),

  // ---- estrutura interna (paredes e pilares): quebra as salas em corredores e esconderijos
  // Base TR: dois blocos e uma mureta criam três "baias"
  K(12, 55, 14, 58, { wall: true }),
  K(20, 53, 22, 55, { wall: true }),
  K(22, 58, 25, 60, { wall: true }),
  // portas do Meio (2 m) e pilares
  K(26, 35, 26, 36, { wall: true }),
  K(29, 35, 29, 36, { wall: true }),
  // portas do Long (3 m)
  K(35, 36, 36, 36, { wall: true }),
  K(40, 36, 40, 36, { wall: true }),
  K(43, 31, 43, 32, { wall: true }),
  K(46, 34, 46, 35, { wall: true }),
  // Bomba B: bloco central e muro baixo
  K(10, 14, 12, 17, { wall: true }),
  K(14, 20, 14, 22, { wall: true }),
  K(7, 18, 8, 19, { wall: true }),
  // Base CT: dois blocos formam pistas
  K(23, 15, 24, 18, { wall: true }),
  K(31, 16, 32, 19, { wall: true }),
  // Bomba A: parede entre a rampa CT e a Passarela, e blocos de cobertura
  K(36, 15, 41, 15, { wall: true }),
  K(45, 13, 46, 14, { wall: true }),
  // Meio: quina que esconde a descida do Túnel baixo
  K(26, 25, 26, 26, { wall: true }),
  // Pátio do Long: pilar e quina
  K(38, 44, 39, 45, { wall: true }),
  // plataformas dentro dos pátios (um degrau acima)
  K(7, 10, 9, 12, { lv: 3, zone: 'B', floor: 'sandstone' }),
  K(45, 10, 49, 12, { lv: 4, zone: 'A', floor: 'sandstone' }),
  K(50, 22, 53, 24, { lv: 3, zone: 'long', floor: 'concrete' }),
];

/** Uma caixa (caixote) ou outro objeto sólido, em células. `h` em metros. */
export interface FsDustProp {
  c: number;
  r: number;
  /** Largura e profundidade em células. */
  w: number;
  d: number;
  h: number;
  mat: FsBox['mat'];
  /** Se vive sobre uma plataforma, o nível dela vem do chão da célula. */
}

const P = (c: number, r: number, w: number, d: number, h: number, mat: FsBox['mat'] = 'crate'): FsDustProp => ({ c, r, w, d, h, mat });

/** Cobertura: caixotes de 1,2 m (madeira, a bala atravessa um pouco), de 2,4 m e tonéis de metal. */
export const FS_DUST_PROPS: readonly FsDustProp[] = [
  // Base TR
  P(6, 55, 2, 2, 1.2), P(8, 57, 1, 1, 1.2), P(17, 54, 2, 2, 2.4), P(18, 58, 2, 1, 1.2), P(26, 55, 1, 1, 1.2),
  // saída oeste
  P(7, 47, 2, 2, 1.2), P(12, 49, 1, 1, 1.2),
  // túneis
  P(11, 38, 1, 1, 1.2),
  // cruzamento
  P(8, 30, 2, 1, 1.2), P(14, 31, 1, 1, 1.2),
  // Bomba B
  P(14, 11, 2, 2, 1.2), P(14, 12, 1, 1, 2.4), P(8, 21, 2, 2, 1.2), P(15, 18, 1, 1, 1.2), P(12, 22, 2, 1, 1.2), P(16, 21, 1, 1, 2.4),
  // Meio
  P(27, 41, 2, 2, 1.2), P(28, 31, 1, 1, 1.2), P(27, 48, 2, 1, 1.2), P(28, 19, 1, 1, 1.2),
  // Base CT
  P(21, 14, 2, 2, 1.2), P(27, 13, 2, 1, 1.2), P(33, 20, 2, 2, 1.2), P(29, 16, 1, 1, 2.4),
  // Passarela
  P(33, 29, 1, 1, 1.2),
  // Bomba A
  P(43, 12, 2, 2, 1.2), P(51, 10, 2, 2, 2.4), P(50, 15, 2, 1, 1.2), P(42, 15, 1, 1, 1.2), P(47, 16, 1, 1, 1.2),
  // Long A
  P(50, 28, 2, 2, 1.2), P(53, 21, 1, 2, 2.4), P(52, 32, 1, 1, 1.2), P(51, 26, 1, 1, 1.2),
  // pátio e portas do Long
  P(37, 40, 2, 2, 1.2), P(36, 48, 1, 1, 1.2), P(33, 56, 2, 1, 1.2), P(38, 51, 2, 2, 2.4),
];

/** Zonas com nome (bases, bombas, meio...): para o mapa pequeno, o chão e as frases do jogo. */
export interface FsDustZone extends FsCellRect {
  id: FsDustZoneId;
  name: string;
}
export const FS_DUST_ZONES: readonly FsDustZone[] = [
  { id: 'A', name: 'Bomba A', c0: 38, r0: 9, c1: 53, r1: 17 },
  { id: 'B', name: 'Bomba B', c0: 6, r0: 9, c1: 17, r1: 24 },
  { id: 'CT', name: 'Base CT', c0: 20, r0: 12, c1: 35, r1: 22 },
  { id: 'TR', name: 'Base TR', c0: 4, r0: 53, c1: 29, r1: 60 },
  { id: 'mid', name: 'Meio', c0: 26, r0: 23, c1: 29, r1: 52 },
  { id: 'tunnels', name: 'Túneis', c0: 6, r0: 25, c1: 16, r1: 52 },
  { id: 'lower', name: 'Túnel baixo', c0: 17, r0: 29, c1: 28, r1: 32 },
  { id: 'long', name: 'Long A', c0: 35, r0: 18, c1: 54, r1: 35 },
  { id: 'yard', name: 'Pátio', c0: 30, r0: 36, c1: 40, r1: 58 },
  { id: 'catwalk', name: 'Passarela', c0: 30, r0: 18, c1: 41, r1: 30 },
  { id: 'ctramp', name: 'Rampa CT', c0: 36, r0: 11, c1: 41, r1: 14 },
  { id: 'bdoors', name: 'Portas do B', c0: 18, r0: 14, c1: 19, r1: 15 },
];

// ---------------------------------------------------------------- montagem da grade

const N = FS_DUST_COLS * FS_DUST_ROWS;
const idx = (c: number, r: number) => r * FS_DUST_COLS + c;
const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < FS_DUST_COLS && r < FS_DUST_ROWS;

interface Built {
  /** Nível do chão de cada célula; -1 = parede. */
  level: Int8Array;
  floor: (FsFloorMat | null)[];
  zone: (FsDustZoneId | null)[];
  roof: Uint8Array;
}

function build(): Built {
  const level = new Int8Array(N).fill(-1);
  const floor: (FsFloorMat | null)[] = new Array<FsFloorMat | null>(N).fill(null);
  const zone: (FsDustZoneId | null)[] = new Array<FsDustZoneId | null>(N).fill(null);
  const roof = new Uint8Array(N);
  for (const k of FS_DUST_CARVES) {
    for (let r = k.r0; r <= k.r1; r++) {
      for (let c = k.c0; c <= k.c1; c++) {
        const i = idx(c, r);
        if (k.wall) {
          level[i] = -1;
          continue;
        }
        let lv = k.lv ?? 0;
        if (k.ramp) {
          const a = k.ramp.axis === 'c' ? c - k.c0 : r - k.r0;
          const len = (k.ramp.axis === 'c' ? k.c1 - k.c0 : k.r1 - k.r0) || 1;
          lv = Math.round(k.ramp.from + ((k.ramp.to - k.ramp.from) * a) / len);
        }
        level[i] = lv;
        if (k.floor) floor[i] = k.floor;
        if (k.zone) zone[i] = k.zone;
        if (k.roof) roof[i] = 1;
      }
    }
  }
  return { level, floor, zone, roof };
}
const B = build();

/** Chão por onde se anda (qualquer nível). */
const isFloor = (c: number, r: number) => inside(c, r) && B.level[idx(c, r)]! >= 0;
export const fsDustLevel = (c: number, r: number) => (inside(c, r) ? B.level[idx(c, r)]! : -1);
export const fsDustHeight = (c: number, r: number) => Math.max(0, fsDustLevel(c, r)) * FS_DUST_STEP;

export const fsDustCellX = (c: number) => FS_DUST_X0 + (c + 0.5) * FS_CELL;
export const fsDustCellZ = (r: number) => FS_DUST_Z0 + (r + 0.5) * FS_CELL;
export const fsDustCol = (x: number) => Math.floor((x - FS_DUST_X0) / FS_CELL);
export const fsDustRow = (z: number) => Math.floor((z - FS_DUST_Z0) / FS_CELL);

/** Altura do chão no ponto do mundo (m). */
export const fsDustFloorY = (x: number, z: number) => fsDustHeight(fsDustCol(x), fsDustRow(z));

/** Desenho em texto, para testes e para olhar: `#` parede, dígito = nível do chão, `c`/`C` caixote. */
export const FS_DUST_GRID: readonly string[] = (() => {
  const rows: string[] = [];
  for (let r = 0; r < FS_DUST_ROWS; r++) {
    let s = '';
    for (let c = 0; c < FS_DUST_COLS; c++) {
      const lv = B.level[idx(c, r)]!;
      s += lv < 0 ? '#' : String(lv);
    }
    rows.push(s);
  }
  for (const p of FS_DUST_PROPS) {
    for (let r = p.r; r < p.r + p.d; r++) {
      const arr = rows[r]!.split('');
      for (let c = p.c; c < p.c + p.w; c++) arr[c] = p.h > 2 ? 'C' : 'c';
      rows[r] = arr.join('');
    }
  }
  return rows;
})();

const blocked = new Uint8Array(N);
for (const p of FS_DUST_PROPS) for (let r = p.r; r < p.r + p.d; r++) for (let c = p.c; c < p.c + p.w; c++) if (inside(c, r)) blocked[idx(c, r)] = 1;

/** Célula por onde o bot anda: chão livre (sem caixote em cima). */
export const fsDustWalkable = (c: number, r: number) => isFloor(c, r) && !blocked[idx(c, r)];

export const fsDustRectWorld = (q: FsCellRect) => ({
  x0: FS_DUST_X0 + q.c0 * FS_CELL,
  z0: FS_DUST_Z0 + q.r0 * FS_CELL,
  x1: FS_DUST_X0 + (q.c1 + 1) * FS_CELL,
  z1: FS_DUST_Z0 + (q.r1 + 1) * FS_CELL,
});

/** Zona que contém o ponto (a primeira que bater) ou null. */
export function fsDustZoneAt(x: number, z: number): FsDustZone | null {
  const c = fsDustCol(x);
  const r = fsDustRow(z);
  const id = inside(c, r) ? B.zone[idx(c, r)] : null;
  if (id) return FS_DUST_ZONES.find((q) => q.id === id) ?? null;
  return FS_DUST_ZONES.find((q) => c >= q.c0 && c <= q.c1 && r >= q.r0 && r <= q.r1) ?? null;
}

// ---------------------------------------------------------------- caixas de colisão

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pen: number, mat: FsBox['mat']): FsBox => ({
  min: [x0, y0, z0], max: [x1, y1, z1], pen, mat,
});

/** Material da parede pela zona vizinha: tijolo nos túneis, arenito nos pátios, reboco nas ruas. */
function wallMat(c: number, r: number): FsBox['mat'] {
  const near = new Set<FsDustZoneId>();
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const z = inside(c + dc, r + dr) ? B.zone[idx(c + dc, r + dr)] : null;
    if (z) near.add(z);
  }
  if (near.has('tunnels') || near.has('lower')) return 'brick';
  if (near.has('B') || near.has('CT') || near.has('bdoors')) return 'sandstone';
  if (near.has('A') || near.has('long') || near.has('ctramp') || near.has('catwalk')) return 'plaster';
  return 'wall';
}

/** Gera as caixas: paredes (juntando células iguais), pisos elevados, caixotes e tetos. */
export function fsDustBuildBoxes(): FsBox[] {
  const out: FsBox[] = [];
  const merge = (pred: (c: number, r: number) => string | null, make: (key: string, q: FsCellRect) => FsBox) => {
    const runs: (FsCellRect & { key: string })[] = [];
    for (let r = 0; r < FS_DUST_ROWS; r++) {
      let c = 0;
      while (c < FS_DUST_COLS) {
        const key = pred(c, r);
        if (key === null) {
          c++;
          continue;
        }
        const c0 = c;
        while (c < FS_DUST_COLS && pred(c, r) === key) c++;
        const open = runs.find((q) => q.key === key && q.c0 === c0 && q.c1 === c - 1 && q.r1 === r - 1);
        if (open) open.r1 = r;
        else runs.push({ key, c0, c1: c - 1, r0: r, r1: r });
      }
    }
    for (const q of runs) out.push(make(q.key, q));
  };
  // paredes (só as que encostam em chão; o miolo maciço fora do mapa não precisa de caixa por célula)
  const wallNeeded = (c: number, r: number) => {
    if (B.level[idx(c, r)]! >= 0) return false;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (isFloor(c + dc, r + dr)) return true;
    return false;
  };
  merge(
    (c, r) => (wallNeeded(c, r) ? wallMat(c, r) : null),
    (key, q) => {
      const w = fsDustRectWorld(q);
      return box(w.x0, 0, w.z0, w.x1, FS_DUST_WALL_H, w.z1, 0, key as FsBox['mat']);
    },
  );
  // pisos elevados (um bloco por trecho de mesmo nível e material)
  merge(
    (c, r) => {
      const lv = B.level[idx(c, r)]!;
      return lv > 0 ? `${lv}:${B.floor[idx(c, r)] ?? 'concrete'}` : null;
    },
    (key, q) => {
      const [lv, mat] = key.split(':') as [string, FsFloorMat];
      const w = fsDustRectWorld(q);
      return box(w.x0, 0, w.z0, w.x1, Number(lv) * FS_DUST_STEP, w.z1, 0, mat === 'dirt' || mat === 'cobble' || mat === 'concrete' || mat === 'sandstone' || mat === 'tile' || mat === 'brick' ? (mat as FsBox['mat']) : 'wall');
    },
  );
  // caixotes: sobem do chão em que estão
  for (const p of FS_DUST_PROPS) {
    const y0 = fsDustHeight(p.c, p.r);
    const x0 = FS_DUST_X0 + p.c * FS_CELL + 0.06;
    const z0 = FS_DUST_Z0 + p.r * FS_CELL + 0.06;
    out.push(box(x0, y0, z0, x0 + p.w * FS_CELL - 0.12, y0 + p.h, z0 + p.d * FS_CELL - 0.12, p.mat === 'crate' ? 0.5 : 0, p.mat));
  }
  // tetos dos trechos cobertos
  merge(
    (c, r) => (B.roof[idx(c, r)] ? 'brick' : null),
    (key, q) => {
      const w = fsDustRectWorld(q);
      return box(w.x0, 3.0, w.z0, w.x1, 3.5, w.z1, 0, key as FsBox['mat']);
    },
  );
  return out;
}

export const FS_DUST_BOXES: readonly FsBox[] = fsDustBuildBoxes();

/** Chão no nível 0 (o plano do mundo) separado por material, só para a cena colorir cada zona. */
export interface FsDustDecal {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  mat: FsFloorMat;
}
export const FS_DUST_DECALS: readonly FsDustDecal[] = (() => {
  const out: FsDustDecal[] = [];
  const runs: (FsCellRect & { key: FsFloorMat })[] = [];
  for (let r = 0; r < FS_DUST_ROWS; r++) {
    let c = 0;
    while (c < FS_DUST_COLS) {
      const f = B.level[idx(c, r)] === 0 ? B.floor[idx(c, r)] : null;
      if (!f) {
        c++;
        continue;
      }
      const c0 = c;
      while (c < FS_DUST_COLS && B.level[idx(c, r)] === 0 && B.floor[idx(c, r)] === f) c++;
      const open = runs.find((q) => q.key === f && q.c0 === c0 && q.c1 === c - 1 && q.r1 === r - 1);
      if (open) open.r1 = r;
      else runs.push({ key: f, c0, c1: c - 1, r0: r, r1: r });
    }
  }
  for (const q of runs) out.push({ ...fsDustRectWorld(q), mat: q.key });
  return out;
})();

/** Meio-tamanho do mapa em x e z (para o mapa pequeno e a luz). */
export const FS_DUST_HALF: readonly [number, number] = [(FS_DUST_COLS * FS_CELL) / 2, (FS_DUST_ROWS * FS_CELL) / 2];

// ---------------------------------------------------------------- nascimento

export interface FsSpawn {
  x: number;
  /** Altura do chão no ponto (m). */
  y: number;
  z: number;
  /** Para onde olha ao nascer (graus, como a câmera: 0 = norte). */
  yaw: number;
  zone: FsDustZoneId | 'open';
}

const SPAWN_CELLS: readonly [number, number][] = [
  // base TR
  [6, 54], [9, 56], [11, 59], [16, 56], [19, 59], [23, 56], [27, 58], [15, 54],
  // base CT
  [21, 13], [25, 14], [28, 14], [33, 13], [35, 21], [28, 20], [22, 21], [30, 18],
  // bomba A
  [43, 10], [51, 13], [48, 16], [44, 16], [53, 12],
  // bomba B
  [7, 14], [12, 11], [15, 15], [10, 23], [16, 23],
  // meio, túneis, passarela e Long A
  [27, 26], [28, 40], [11, 40], [9, 50], [12, 30], [22, 30], [39, 29], [50, 30], [52, 20], [37, 44], [38, 54],
];

export const FS_DUST_SPAWNS: readonly FsSpawn[] = SPAWN_CELLS.map(([c, r]) => {
  const x = fsDustCellX(c);
  const z = fsDustCellZ(r);
  return {
    x,
    z,
    y: fsDustHeight(c, r),
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
      if (d < 45 && fsClearLine(boxes, [s.x, s.y + 1, s.z], [f.x, s.y + 1, f.z])) seen++;
    }
    // quem é visto por inimigos perde muito (cada um vale 25 m); o resto é a distância ao mais perto
    return { s, v: Math.min(near, 60) - seen * 25 };
  });
  scored.sort((a, b) => b.v - a.v);
  const top = scored.slice(0, Math.min(3, scored.length));
  return top[Math.min(top.length - 1, Math.floor(rng() * top.length))]!.s;
}

// ---------------------------------------------------------------- navegação (A* na grade)

const NEI: readonly [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Dá para passar de uma célula a outra? (os dois chãos livres e no máximo um degrau de diferença). */
const stepOk = (c: number, r: number, nc: number, nr: number) =>
  fsDustWalkable(nc, nr) && Math.abs(B.level[idx(nc, nr)]! - B.level[idx(c, r)]!) <= 1;

/** O segmento (a, b) cabe andando com uma folga lateral? Amostra pontos ao longo dele, cada um com folga dos dois lados. */
export function fsDustLineWalkable(ax: number, az: number, bx: number, bz: number, margin = 0.42): boolean {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 1e-6) return true;
  const nx = -(bz - az) / len;
  const nz = (bx - ax) / len;
  const n = Math.ceil(len / 0.3);
  let pc = fsDustCol(ax);
  let pr = fsDustRow(az);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    for (const k of [-margin, 0, margin]) {
      const c = fsDustCol(x + nx * k);
      const r = fsDustRow(z + nz * k);
      if (!fsDustWalkable(c, r)) return false;
      // não pula mais de um degrau entre uma amostra e a seguinte
      if (k === 0) {
        if (Math.abs(B.level[idx(c, r)]! - B.level[idx(pc, pr)]!) > 1) return false;
        pc = c;
        pr = r;
      }
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
      if (!stepOk(c, r, nc, nr)) continue;
      if (dc && dr && (!stepOk(c, r, c + dc, r) || !stepOk(c, r, c, r + dr))) continue;
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

/** Pontos onde os bots gostam de ir: as bombas, o meio, as bases, os túneis e o Long. */
export const FS_DUST_HOTSPOTS: readonly [number, number][] = (
  [
    [47, 11], [43, 15], [9, 12], [13, 20], [27, 14], [22, 20], [34, 14], [27, 30], [26, 40], [11, 40], [9, 46], [12, 30],
    [21, 30], [39, 29], [52, 30], [52, 21], [37, 44], [37, 33], [20, 57], [8, 56], [27, 18], [39, 22],
  ] as [number, number][]
).map(([c, r]) => [fsDustCellX(c), fsDustCellZ(r)] as [number, number]);

// ---------------------------------------------------------------- decoração (sem colisão)

/** Uma face de parede voltada para o chão: `nx, nz` é a direção para onde ela olha; `len` o comprimento em metros. */
export interface FsDustFace {
  x: number;
  z: number;
  nx: number;
  nz: number;
  len: number;
  y: number;
  zone: FsDustZoneId | null;
}

/** Todas as faces de parede que dão para o chão, juntando as células vizinhas em trechos retos. */
export function fsDustFaces(): FsDustFace[] {
  const out: FsDustFace[] = [];
  const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [dc, dr] of dirs) {
    // trechos ao longo do eixo perpendicular à direção
    const along = dc === 0 ? 'c' : 'r';
    const outer = along === 'c' ? FS_DUST_ROWS : FS_DUST_COLS;
    const inner = along === 'c' ? FS_DUST_COLS : FS_DUST_ROWS;
    for (let o = 0; o < outer; o++) {
      let i = 0;
      while (i < inner) {
        const cc = (k: number) => (along === 'c' ? k : o);
        const rr = (k: number) => (along === 'c' ? o : k);
        const faces = (k: number) => B.level[idx(cc(k), rr(k))]! < 0 && isFloor(cc(k) + dc, rr(k) + dr);
        if (!faces(i)) {
          i++;
          continue;
        }
        const i0 = i;
        while (i < inner && faces(i)) i++;
        const len = i - i0;
        const mid = (i0 + i) / 2 - 0.5;
        // centro do trecho no plano da parede (a borda entre a parede e o chão)
        const c = along === 'c' ? mid : o;
        const r = along === 'c' ? o : mid;
        const x = FS_DUST_X0 + (c + 0.5) * FS_CELL + (dc > 0 ? 0.5 : dc < 0 ? -0.5 : 0) * FS_CELL;
        const z = FS_DUST_Z0 + (r + 0.5) * FS_CELL + (dr > 0 ? 0.5 : dr < 0 ? -0.5 : 0) * FS_CELL;
        const fc = Math.round(c) + dc;
        const fr = Math.round(r) + dr;
        out.push({ x, z, nx: dc, nz: dr, len: len * FS_CELL, y: fsDustHeight(fc, fr), zone: B.zone[idx(Math.min(FS_DUST_COLS - 1, Math.max(0, fc)), Math.min(FS_DUST_ROWS - 1, Math.max(0, fr)))] ?? null });
      }
    }
  }
  return out;
}

export interface FsDustPlacement {
  model: string;
  x: number;
  y: number;
  z: number;
  /** Rotação em y (rad). */
  rot: number;
  /** Altura final desejada (m) ou 0 para manter o tamanho do modelo. */
  h: number;
}

/** Zonas de salas abertas, onde as fachadas com arcos e os postes fazem sentido. */
const HALLS: ReadonlySet<FsDustZoneId> = new Set<FsDustZoneId>(['A', 'B', 'CT', 'TR', 'yard', 'long', 'mid', 'catwalk']);

function lcg(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

/**
 * Enfeites do mapa, sempre os mesmos (semente fixa): fachadas com arcos coladas nas paredes das salas, postes, barreiras e, atrás das
 * paredes, prédios de vários tamanhos formando o horizonte em volta (no lugar de uma parede reta e vazia).
 */
export function fsDustDecor(): FsDustPlacement[] {
  const rnd = lcg(20261104);
  const out: FsDustPlacement[] = [];
  const faces = fsDustFaces();
  // fachadas com arcos: nas paredes retas das salas, uma a cada ~3,4 m
  for (const f of faces) {
    if (!f.zone || !HALLS.has(f.zone) || f.len < 3.5) continue;
    const alongX = f.nz !== 0;
    const n = Math.floor((f.len - 0.4) / 3.4);
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * 3.4;
      const rot = Math.atan2(f.nx, f.nz);
      out.push({ model: rnd() < 0.5 ? 'arch_a' : 'arch_b', x: f.x + (alongX ? off : 0) + f.nx * 0.02, y: f.y, z: f.z + (alongX ? 0 : off) + f.nz * 0.02, rot, h: 3.4 });
    }
  }
  // postes de luz junto às paredes das salas grandes
  for (const f of faces) {
    if (!f.zone || !['A', 'B', 'CT', 'TR', 'yard'].includes(f.zone) || f.len < 8) continue;
    const alongX = f.nz !== 0;
    const off = (rnd() - 0.5) * (f.len - 4);
    out.push({ model: 'lamp', x: f.x + (alongX ? off : 0) + f.nx * 0.45, y: f.y, z: f.z + (alongX ? 0 : off) + f.nz * 0.45, rot: Math.atan2(f.nx, f.nz), h: 0 });
  }
  // barreiras e grades baixas encostadas nas paredes do pátio e da base TR
  for (const f of faces) {
    if (!f.zone || !['yard', 'TR', 'long'].includes(f.zone) || f.len < 6) continue;
    const alongX = f.nz !== 0;
    const off = (rnd() - 0.5) * (f.len - 3);
    out.push({ model: rnd() < 0.5 ? 'barrier' : 'railing', x: f.x + (alongX ? off : 0) + f.nx * 0.5, y: f.y, z: f.z + (alongX ? 0 : off) + f.nz * 0.5, rot: Math.atan2(f.nx, f.nz) + Math.PI / 2, h: 0 });
  }
  // horizonte: prédios sobre o miolo maciço (a 5+ células de qualquer chão) e numa faixa em volta do mapa
  const models = ['bld_a', 'bld_b', 'bld_c', 'bld_d', 'bld_e', 'bld_tower'];
  const farFromFloor = (c: number, r: number) => {
    for (let dr = -5; dr <= 5; dr++) for (let dc = -5; dc <= 5; dc++) if (isFloor(c + dc, r + dr)) return false;
    return true;
  };
  for (let r = -14; r < FS_DUST_ROWS + 14; r += 9) {
    for (let c = -14; c < FS_DUST_COLS + 14; c += 9) {
      const jc = c + Math.round((rnd() - 0.5) * 3);
      const jr = r + Math.round((rnd() - 0.5) * 3);
      if (!farFromFloor(jc, jr)) continue;
      const tower = rnd() < 0.18;
      out.push({
        model: tower ? 'bld_tower' : models[Math.floor(rnd() * 5)]!,
        x: FS_DUST_X0 + (jc + 0.5) * FS_CELL,
        y: 0,
        z: FS_DUST_Z0 + (jr + 0.5) * FS_CELL,
        rot: Math.floor(rnd() * 4) * (Math.PI / 2),
        h: tower ? 13 + rnd() * 6 : 7 + rnd() * 6,
      });
    }
  }
  return out;
}

export const FS_DUST_DECOR: readonly FsDustPlacement[] = fsDustDecor();
