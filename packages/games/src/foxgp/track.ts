import {
  GP_GRAVEL_RADIUS,
  GP_HALF_WIDTH,
  GP_KERB_RADIUS,
  GP_KERB_W,
  GP_LIMIT,
  GP_PIT_BOX_LEN,
  GP_PIT_HALF,
  GP_SAMPLE,
  type GpSurface,
} from './constants';

/** A faixa do box: de que lado fica, a que distância do centro, onde abre, onde fica paralela, onde volta e a vaga. */
export interface GpPitDef {
  side: 1 | -1;
  offset: number;
  /** Distâncias do traçado relativas à linha de chegada (negativas antes dela). */
  inStart: number;
  inEnd: number;
  outStart: number;
  outEnd: number;
  box: number;
}

/** Uma pista: pontos de controle (x, z) da linha central, fechada, começando na linha de chegada e indo para a frente. */
export interface GpTrackDef {
  id: string;
  name: string;
  points: readonly (readonly [number, number])[];
  /** Os pontos estão em outra unidade (pixels do desenho): multiplica por isto e centra em `origin`. */
  scale?: number;
  origin?: readonly [number, number];
  /** Passadas de suavização da linha central (arredonda os cantos dos pontos de controle). */
  smooth?: number;
  /** Trechos onde sair da pista é cortar caminho (chicane): índices de pontos de controle, de/até. */
  noCut: readonly (readonly [number, number])[];
  /** Distância máxima do centro até a barreira (m). Onde outro trecho passa perto, a barreira fica no meio do caminho. */
  limit?: number;
  pit?: GpPitDef;
  /** Onde começam o setor 2 e o setor 3 (índices de pontos de controle). */
  sectors?: readonly [number, number];
  /** Arquibancadas: de um ponto de controle a outro, do lado indicado (só desenho). */
  stands?: readonly { from: number; to: number; side: 1 | -1; name: string }[];
  /** Área verde de público (só desenho): polígono nos mesmos pontos do traçado. */
  park?: readonly (readonly [number, number])[];
}

const PIT_DEFAULT: GpPitDef = { side: 1, offset: 13, inStart: -95, inEnd: -65, outStart: 20, outEnd: 50, box: -18 };

/**
 * Circuito da Toca, a primeira pista (spec 078). Continua aqui para os testes do motor que não dependem do desenho da pista
 * do jogo; a pista do jogo agora é a Marina (`GP_TRACK_MARINA`).
 */
export const GP_TRACK_TOCA: GpTrackDef = {
  id: 'toca',
  name: 'Circuito da Toca',
  points: [
    [0, 0],
    [60, 0],
    [110, 0],
    [148, 22],
    [160, 68],
    [142, 118],
    [100, 140],
    [72, 141],
    [53, 134],
    [34, 140],
    [-10, 146],
    [-75, 150],
    [-128, 142],
    [-155, 137],
    [-170, 118],
    [-160, 98],
    [-135, 92],
    [-62, 94],
    [-40, 94],
    [-20, 86],
    [-12, 70],
    [-24, 54],
    [-50, 49],
    [-110, 50],
    [-160, 46],
    [-186, 40],
    [-198, 26],
    [-194, 10],
    [-170, 1],
    [-90, 0],
  ],
  noCut: [[6, 10]],
  pit: PIT_DEFAULT,
  sectors: [8, 18],
};

/**
 * Circuito da Marina (spec 079): o traçado da imagem de referência (o desenho de um circuito de marina com a reta norte e o
 * grampo), redesenhado em pontos do próprio desenho (pixels) e escalado para ~1,5 km. Sentido: a reta principal desce para
 * sudeste passando pela linha, sobe para o grampo do norte, volta pela reta norte, desce pela esquerda até o sul, faz o
 * miolo de curvas e sobe de volta para a reta principal. Os boxes ficam do lado de dentro da reta principal.
 */
export const GP_TRACK_MARINA: GpTrackDef = {
  id: 'marina',
  name: 'Circuito da Marina',
  scale: 0.36,
  origin: [800, 500],
  smooth: 12,
  limit: 16,
  points: [
    [722, 375], // 0 linha de chegada, na reta principal
    [790, 500],
    [826, 568],
    [850, 585],
    [880, 572],
    [935, 540],
    [985, 500],
    [1003, 440],
    [1010, 375],
    [1040, 322],
    [1110, 302], // 10
    [1185, 296],
    [1260, 280],
    [1360, 232],
    [1420, 206],
    [1490, 196],
    [1528, 160], // 16 grampo do norte
    [1506, 122],
    [1450, 128],
    [1395, 146],
    [1300, 150], // 20 reta norte
    [1000, 150],
    [700, 150],
    [545, 152],
    [520, 175],
    [516, 204],
    [462, 248],
    [420, 292],
    [382, 350],
    [352, 440],
    [318, 540], // 30 arquibancada da marina
    [288, 640],
    [272, 760],
    [264, 868],
    [288, 902], // 34 curva do sul
    [335, 902],
    [392, 880],
    [412, 820],
    [398, 760],
    [372, 690],
    [372, 610], // 40
    [388, 545],
    [450, 500],
    [470, 505],
    [495, 552],
    [528, 566],
    [585, 540],
    [596, 500],
    [572, 448],
    [522, 322],
    [566, 276], // 50
    [606, 228],
    [640, 212],
    [670, 244],
  ],
  // a chicane do miolo (das curvas de baixo até a subida): cortar por dentro volta o carro
  noCut: [[42, 47]],
  pit: { side: 1, offset: 12, inStart: -46, inEnd: -32, outStart: 30, outEnd: 52, box: -12 },
  sectors: [13, 33],
  stands: [
    { from: 0, to: 2, side: -1, name: 'MAIN' },
    { from: 21, to: 22, side: -1, name: 'NORTH STRAIGHT' },
    { from: 16, to: 18, side: 1, name: 'NORTH' },
    { from: 23, to: 25, side: -1, name: 'WEST' },
    { from: 29, to: 31, side: -1, name: 'MARINA' },
    { from: 32, to: 33, side: -1, name: 'SOUTH' },
  ],
  park: [
    [1030, 190],
    [1075, 205],
    [1085, 260],
    [1040, 300],
    [995, 340],
    [985, 410],
    [955, 435],
    [915, 400],
    [905, 330],
    [950, 230],
  ],
};

/** A pista do jogo. */
export const GP_TRACK_DEFAULT = GP_TRACK_MARINA;

/** Onde o carro está em relação à pista. */
export interface GpProjection {
  /** Amostra mais perto (o segmento começa nela). */
  i: number;
  /** Distância ao longo do traçado, de 0 a L. */
  s: number;
  /** Afastamento do centro: positivo à direita de quem corre. */
  d: number;
  /** Distância (sem sinal) até a linha central. */
  dist: number;
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Catmull-Rom centrípeta fechada, amostrada densa (para medir o comprimento). Cada ponto: [x, z, segmento]. */
function denseSpline(pts: readonly (readonly [number, number])[], per = 48): number[][] {
  const n = pts.length;
  const out: number[][] = [];
  const at = (i: number) => pts[((i % n) + n) % n]!;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const tj = (ti: number, a: readonly number[], b: readonly number[]) =>
      ti + Math.max(1e-6, Math.sqrt(Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!)));
    const t0 = 0;
    const t1 = tj(t0, p0, p1);
    const t2 = tj(t1, p1, p2);
    const t3 = tj(t2, p2, p3);
    const lerp = (a: readonly number[], b: readonly number[], ta: number, tb: number, t: number) => {
      const w = (t - ta) / (tb - ta);
      return [a[0]! + (b[0]! - a[0]!) * w, a[1]! + (b[1]! - a[1]!) * w];
    };
    for (let k = 0; k < per; k++) {
      const t = t1 + ((t2 - t1) * k) / per;
      const a1 = lerp(p0, p1, t0, t1, t);
      const a2 = lerp(p1, p2, t1, t2, t);
      const a3 = lerp(p2, p3, t2, t3, t);
      const b1 = lerp(a1, a2, t0, t2, t);
      const b2 = lerp(a2, a3, t1, t3, t);
      const c = lerp(b1, b2, t1, t2, t);
      out.push([c[0]!, c[1]!, i]);
    }
  }
  return out;
}

/** Reamostra uma linha fechada a cada `step` (aprox.): devolve os pontos e o comprimento. */
function resample(xs: number[], zs: number[], step: number) {
  const m = xs.length;
  const cum = [0];
  for (let i = 1; i <= m; i++) {
    const a = i - 1;
    const b = i % m;
    cum.push(cum[a]! + Math.hypot(xs[b]! - xs[a]!, zs[b]! - zs[a]!));
  }
  const total = cum[m]!;
  const n = Math.max(16, Math.round(total / step));
  const ds = total / n;
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = i * ds;
    while (j < m - 1 && cum[j + 1]! < s) j++;
    const b = (j + 1) % m;
    const w = (s - cum[j]!) / Math.max(1e-9, cum[j + 1]! - cum[j]!);
    x[i] = xs[j]! + (xs[b]! - xs[j]!) * w;
    z[i] = zs[j]! + (zs[b]! - zs[j]!) * w;
  }
  return { x, z, n, ds, total, cum };
}

/**
 * A pista amostrada a cada ~1 m: posição, direção, curvatura e o que existe de cada lado (zebra, brita, barreira).
 * Direção: o carro olha para (sen h, −cos h); a direita dele é (cos h, sen h). Curvatura positiva = curva à direita.
 */
export class GpTrack {
  readonly def: GpTrackDef;
  readonly n: number;
  readonly length: number;
  readonly ds: number;
  readonly x: Float64Array;
  readonly z: Float64Array;
  readonly tx: Float64Array;
  readonly tz: Float64Array;
  readonly curv: Float64Array;
  /** Zebra dos dois lados nesta amostra. */
  readonly kerb: Uint8Array;
  /** Lado da brita (−1 esquerda, 1 direita, 0 nenhuma). */
  readonly gravel: Int8Array;
  /** Distância do centro até a barreira de cada lado (Infinity = sem barreira, do lado de dentro de curva fechada). */
  readonly wallL: Float64Array;
  readonly wallR: Float64Array;
  readonly noCut: Uint8Array;
  readonly limit: number;
  readonly pit: GpPitDef;
  /** Distância do traçado onde começam os setores 2 e 3. */
  readonly sectorS: readonly [number, number];
  /** Distância do traçado de cada ponto de controle. */
  readonly cpS: readonly number[];

  constructor(def: GpTrackDef) {
    this.def = def;
    this.limit = def.limit ?? GP_LIMIT;
    this.pit = def.pit ?? PIT_DEFAULT;
    const k = def.scale ?? 1;
    const [ox, oz] = def.origin ?? [0, 0];
    const pts = def.points.map(([px, pz]) => [(px - ox) * k, (pz - oz) * k] as const);
    const dense = denseSpline(pts);
    let r = resample(
      dense.map((p) => p[0]!),
      dense.map((p) => p[1]!),
      GP_SAMPLE,
    );
    // onde cada ponto de controle cai no traçado (antes da suavização, que quase não mexe nas distâncias)
    const cp: number[] = new Array<number>(def.points.length).fill(0);
    {
      const cum = [0];
      for (let i = 1; i < dense.length; i++)
        cum.push(cum[i - 1]! + Math.hypot(dense[i]![0]! - dense[i - 1]![0]!, dense[i]![1]! - dense[i - 1]![1]!));
      for (let q = 0; q < dense.length; q++) {
        const seg = dense[q]![2]!;
        if (q === 0 || dense[q - 1]![2] !== seg) cp[seg] = cum[q]!;
      }
    }
    // suavização: média móvel de ±4 m, algumas passadas; a linha de chegada (amostra 0) fica onde está
    const passes = def.smooth ?? 0;
    if (passes > 0) {
      const w = Math.max(1, Math.round(4 / r.ds));
      let xs = Array.from(r.x);
      let zs = Array.from(r.z);
      const n0 = xs.length;
      const x0 = xs[0]!;
      const z0 = zs[0]!;
      for (let p = 0; p < passes; p++) {
        const nx = new Array<number>(n0);
        const nz = new Array<number>(n0);
        for (let i = 0; i < n0; i++) {
          let sx = 0;
          let sz = 0;
          for (let o = -w; o <= w; o++) {
            const j = (((i + o) % n0) + n0) % n0;
            sx += xs[j]!;
            sz += zs[j]!;
          }
          nx[i] = sx / (2 * w + 1);
          nz[i] = sz / (2 * w + 1);
        }
        xs = nx;
        zs = nz;
      }
      // a suavização puxa a linha um pouco para dentro: volta o começo para o lugar da linha de chegada
      const dx = x0 - xs[0]!;
      const dz = z0 - zs[0]!;
      xs = xs.map((v) => v + dx);
      zs = zs.map((v) => v + dz);
      const scale = r.total;
      r = resample(xs, zs, GP_SAMPLE);
      for (let i = 0; i < cp.length; i++) cp[i] = (cp[i]! * r.total) / scale;
    }
    const n = r.n;
    this.n = n;
    this.length = r.total;
    this.ds = r.ds;
    this.x = r.x;
    this.z = r.z;
    this.cpS = cp;
    this.tx = new Float64Array(n);
    this.tz = new Float64Array(n);
    this.curv = new Float64Array(n);
    this.kerb = new Uint8Array(n);
    this.gravel = new Int8Array(n);
    this.wallL = new Float64Array(n);
    this.wallR = new Float64Array(n);
    this.noCut = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n;
      const b = (i + 1) % n;
      const dx = this.x[b]! - this.x[a]!;
      const dz = this.z[b]! - this.z[a]!;
      const len = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / len;
      this.tz[i] = dz / len;
    }
    // curvatura medida em ±3 m (mais estável que entre vizinhos)
    const span = Math.max(1, Math.round(3 / this.ds));
    for (let i = 0; i < n; i++) {
      const a = (i - span + n) % n;
      const b = (i + span) % n;
      const dh = wrapAngle(this.heading(b) - this.heading(a));
      this.curv[i] = dh / (2 * span * this.ds);
    }
    // zebra e brita valem um pouco antes e depois da curva
    const kerbPad = Math.round(8 / this.ds);
    const gravelPad = Math.round(14 / this.ds);
    for (let i = 0; i < n; i++) {
      const kk = this.curv[i]!;
      const rr = 1 / Math.max(1e-6, Math.abs(kk));
      if (rr < GP_KERB_RADIUS)
        for (let o = -kerbPad; o <= kerbPad; o++) this.kerb[(i + o + n) % n] = 1;
      if (rr < GP_GRAVEL_RADIUS) {
        // a brita fica do lado de fora da curva (curva à direita: fora é a esquerda)
        const side = kk > 0 ? -1 : 1;
        for (let o = -gravelPad; o <= gravelPad * 2; o++) {
          const idx = (i + o + n) % n;
          if (this.gravel[idx] === 0) this.gravel[idx] = side;
        }
      }
    }
    this.buildWalls();
    // nada de brita na reta do box
    for (let i = 0; i < n; i++)
      if (this.pitCenter(this.rel(i * this.ds)) !== null) this.gravel[i] = 0;
    for (const [from, to] of def.noCut) {
      const s0 = cp[from] ?? 0;
      const s1 = cp[to] ?? 0;
      for (let i = 0; i < n; i++) {
        const s = i * this.ds;
        if (s0 <= s1 ? s >= s0 && s <= s1 : s >= s0 || s <= s1) this.noCut[i] = 1;
      }
    }
    const sec = def.sectors ?? [Math.floor(def.points.length / 3), Math.floor((def.points.length * 2) / 3)];
    this.sectorS = [cp[sec[0]] ?? this.length / 3, cp[sec[1]] ?? (this.length * 2) / 3];
  }

  /**
   * A barreira de cada lado: no máximo `limit`; onde outro trecho da pista passa perto, ela fica no meio do caminho (um
   * muro só separa os dois trechos); do lado de dentro de uma curva mais fechada que a barreira, não há barreira.
   */
  private buildWalls() {
    const n = this.n;
    const minAlong = 70;
    const skip = Math.round(minAlong / this.ds);
    for (let i = 0; i < n; i++) {
      const nx = -this.tz[i]!;
      const nz = this.tx[i]!;
      let right = Infinity;
      let left = Infinity;
      for (let j = 0; j < n; j += 2) {
        const gap = Math.abs(i - j);
        if (Math.min(gap, n - gap) < skip) continue;
        const vx = this.x[j]! - this.x[i]!;
        const vz = this.z[j]! - this.z[i]!;
        const along = vx * nx + vz * nz;
        const lat = Math.abs(vx * this.tx[i]! + vz * this.tz[i]!);
        if (lat > 6 + Math.abs(along) * 0.2) continue;
        if (along > 0) right = Math.min(right, along);
        else left = Math.min(left, -along);
      }
      const kk = this.curv[i]!;
      const rr = 1 / Math.max(1e-6, Math.abs(kk));
      const fold = rr < this.limit + 4;
      const wall = (room: number, inside: boolean) => {
        if (room < Infinity) return Math.max(GP_HALF_WIDTH + GP_KERB_W + 0.6, Math.min(this.limit, room / 2 - 0.4));
        return inside ? Infinity : this.limit;
      };
      this.wallR[i] = wall(right, fold && kk > 0);
      this.wallL[i] = wall(left, fold && kk < 0);
      // a faixa do box fica dentro da barreira do lado dela
      const pc = this.pitCenter(this.rel(i * this.ds));
      if (pc !== null) {
        const need = Math.abs(pc) + GP_PIT_HALF + 1.5;
        if (pc > 0) this.wallR[i] = Math.max(this.wallR[i]!, need);
        else this.wallL[i] = Math.max(this.wallL[i]!, need);
      }
    }
  }

  /** Direção da pista na amostra i (o mesmo ângulo do carro). */
  heading(i: number): number {
    return Math.atan2(this.tx[i]!, -this.tz[i]!);
  }

  /** s em [0, L). */
  wrap(s: number): number {
    const L = this.length;
    return ((s % L) + L) % L;
  }

  /** s em (−L/2, L/2]: negativo é antes da linha de chegada. */
  rel(s: number): number {
    const w = this.wrap(s);
    return w > this.length / 2 ? w - this.length : w;
  }

  /** Menor diferença de b para a (positiva se b está à frente). */
  delta(a: number, b: number): number {
    return this.rel(b - a);
  }

  index(s: number): number {
    return Math.floor(this.wrap(s) / this.ds) % this.n;
  }

  /** Setor (0, 1 ou 2) da distância s. */
  sector(s: number): number {
    const w = this.wrap(s);
    return w < this.sectorS[0] ? 0 : w < this.sectorS[1] ? 1 : 2;
  }

  /** Ponto da pista na distância s, afastado d para a direita. */
  pointAt(s: number, d = 0): { x: number; z: number; h: number } {
    const w = this.wrap(s);
    const i = Math.floor(w / this.ds) % this.n;
    const j = (i + 1) % this.n;
    const f = (w - i * this.ds) / this.ds;
    const x = this.x[i]! + (this.x[j]! - this.x[i]!) * f;
    const z = this.z[i]! + (this.z[j]! - this.z[i]!) * f;
    const tx = this.tx[i]! + (this.tx[j]! - this.tx[i]!) * f;
    const tz = this.tz[i]! + (this.tz[j]! - this.tz[i]!) * f;
    const len = Math.hypot(tx, tz) || 1;
    // direita de quem corre: (−tz, tx)
    return { x: x - (tz / len) * d, z: z + (tx / len) * d, h: Math.atan2(tx, -tz) };
  }

  /** Projeção perto de uma amostra conhecida (rápida e sem pular para outro trecho da pista). */
  project(x: number, z: number, hint: number, window = 40): GpProjection {
    let best = 0;
    let bestD = Infinity;
    let bestT = 0;
    for (let o = -window; o <= window; o++) {
      const i = (((hint + o) % this.n) + this.n) % this.n;
      const r = this.segment(i, x, z);
      if (r.d2 < bestD) {
        bestD = r.d2;
        best = i;
        bestT = r.t;
      }
    }
    return this.finish(best, bestT, x, z);
  }

  /** Projeção na pista inteira (para achar quem cortou caminho e para começar). */
  projectGlobal(x: number, z: number): GpProjection {
    let best = 0;
    let bestD = Infinity;
    let bestT = 0;
    for (let i = 0; i < this.n; i++) {
      const r = this.segment(i, x, z);
      if (r.d2 < bestD) {
        bestD = r.d2;
        best = i;
        bestT = r.t;
      }
    }
    return this.finish(best, bestT, x, z);
  }

  private segment(i: number, x: number, z: number) {
    const j = (i + 1) % this.n;
    const ax = this.x[i]!;
    const az = this.z[i]!;
    const bx = this.x[j]! - ax;
    const bz = this.z[j]! - az;
    const l2 = bx * bx + bz * bz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / l2));
    const px = ax + bx * t - x;
    const pz = az + bz * t - z;
    return { t, d2: px * px + pz * pz };
  }

  private finish(i: number, t: number, x: number, z: number): GpProjection {
    const j = (i + 1) % this.n;
    const cx = this.x[i]! + (this.x[j]! - this.x[i]!) * t;
    const cz = this.z[i]! + (this.z[j]! - this.z[i]!) * t;
    const tx = this.tx[i]!;
    const tz = this.tz[i]!;
    // direita = (−tz, tx)
    const d = (x - cx) * -tz + (z - cz) * tx;
    return { i, s: this.wrap((i + t) * this.ds), d, dist: Math.hypot(x - cx, z - cz) };
  }

  /** Centro da faixa do box nesta distância (relativa à linha), ou null fora do box. */
  pitCenter(rel: number): number | null {
    const p = this.pit;
    const edge = GP_HALF_WIDTH - GP_PIT_HALF + 1;
    if (rel < p.inStart || rel > p.outEnd) return null;
    let off = p.offset;
    if (rel < p.inEnd) {
      const w = (rel - p.inStart) / (p.inEnd - p.inStart);
      off = edge + (p.offset - edge) * w;
    } else if (rel > p.outStart) {
      const w = (rel - p.outStart) / (p.outEnd - p.outStart);
      off = p.offset + (edge - p.offset) * w;
    }
    return off * p.side;
  }

  /** Está na faixa do box (fora do asfalto da pista)? */
  inPit(s: number, d: number): boolean {
    if (Math.abs(d) <= GP_HALF_WIDTH) return false;
    const c = this.pitCenter(this.rel(s));
    return c !== null && Math.abs(d - c) <= GP_PIT_HALF;
  }

  /** Está na vaga do box? */
  inBox(s: number, d: number): boolean {
    const r = this.rel(s);
    return this.inPit(s, d) && Math.abs(r - this.pit.box) <= GP_PIT_BOX_LEN / 2;
  }

  /** A superfície no ponto (a barreira é tratada à parte). */
  surface(p: GpProjection): GpSurface {
    if (this.inPit(p.s, p.d)) return 'pit';
    const a = Math.abs(p.d);
    if (a <= GP_HALF_WIDTH) return 'asphalt';
    if (a <= GP_HALF_WIDTH + GP_KERB_W && this.kerb[p.i] === 1) return 'kerb';
    const g = this.gravel[p.i]!;
    if (g !== 0 && Math.sign(p.d) === g && a > GP_HALF_WIDTH + GP_KERB_W + 1) return 'gravel';
    return 'grass';
  }

  /** Distância até a barreira deste lado nesta amostra (Infinity = sem barreira). */
  wallAt(i: number, d: number): number {
    return d > 0 ? this.wallR[i]! : this.wallL[i]!;
  }

  /** Tem barreira deste lado nesta amostra? */
  wallOn(i: number, d: number): boolean {
    return this.wallAt(i, d) < Infinity;
  }

  /** Ponto do desenho original (pixels) em metros da pista (minimapa, cenário). */
  mapPoint(px: number, pz: number): { x: number; z: number } {
    const k = this.def.scale ?? 1;
    const [ox, oz] = this.def.origin ?? [0, 0];
    return { x: (px - ox) * k, z: (pz - oz) * k };
  }
}

const cache = new Map<string, GpTrack>();
/** A pista pronta (calculada uma vez por aparelho). */
export function gpTrack(def: GpTrackDef = GP_TRACK_DEFAULT): GpTrack {
  let t = cache.get(def.id);
  if (!t) {
    t = new GpTrack(def);
    cache.set(def.id, t);
  }
  return t;
}
