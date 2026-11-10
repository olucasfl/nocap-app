import {
  GP_GRAVEL_RADIUS,
  GP_HALF_WIDTH,
  GP_KERB_RADIUS,
  GP_KERB_W,
  GP_LIMIT,
  GP_PIT_BOX,
  GP_PIT_BOX_LEN,
  GP_PIT_HALF,
  GP_PIT_IN_END,
  GP_PIT_IN_START,
  GP_PIT_OFFSET,
  GP_PIT_OUT_END,
  GP_PIT_OUT_START,
  GP_PIT_SIDE,
  GP_SAMPLE,
  type GpSurface,
} from './constants';

/** Uma pista: pontos de controle (x, z) da linha central, fechada, começando na linha de chegada e indo para a frente. */
export interface GpTrackDef {
  id: string;
  name: string;
  points: readonly (readonly [number, number])[];
  /** Trechos onde sair da pista é cortar caminho (chicane): índices de pontos de controle, de/até. */
  noCut: readonly (readonly [number, number])[];
}

/**
 * Circuito da Toca (a única pista do lançamento, decisão de 10/11/2026): reta grande com o box, curva 1 para a direita,
 * curva longa, chicane (sem corte), grampo à direita, reta de trás, grampo à esquerda e a curva que volta para a reta.
 * Cerca de 1,1 km: a volta dá uns 40 s. Os trechos que não são vizinhos ficam a mais de 40 m um do outro (as barreiras
 * não se cruzam): um teste confere.
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
};

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
  /** Existe barreira do lado esquerdo/direito (do lado de dentro de curva muito fechada a barreira se dobraria). */
  readonly wallL: Uint8Array;
  readonly wallR: Uint8Array;
  readonly noCut: Uint8Array;

  constructor(def: GpTrackDef) {
    this.def = def;
    const dense = denseSpline(def.points);
    const cum = [0];
    for (let i = 1; i <= dense.length; i++) {
      const a = dense[i - 1]!;
      const b = dense[i % dense.length]!;
      cum.push(cum[i - 1]! + Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!));
    }
    const total = cum[cum.length - 1]!;
    const n = Math.max(16, Math.round(total / GP_SAMPLE));
    this.n = n;
    this.length = total;
    this.ds = total / n;
    this.x = new Float64Array(n);
    this.z = new Float64Array(n);
    this.tx = new Float64Array(n);
    this.tz = new Float64Array(n);
    this.curv = new Float64Array(n);
    this.kerb = new Uint8Array(n);
    this.gravel = new Int8Array(n);
    this.wallL = new Uint8Array(n);
    this.wallR = new Uint8Array(n);
    this.noCut = new Uint8Array(n);
    // onde cada ponto de controle cai no traçado (para os trechos sem corte)
    const cpS: number[] = new Array<number>(def.points.length).fill(0);
    for (let k = 0; k < dense.length; k++) {
      const seg = dense[k]![2]!;
      if (k === 0 || dense[k - 1]![2] !== seg) cpS[seg] = cum[k]!;
    }
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = i * this.ds;
      while (j < dense.length - 1 && cum[j + 1]! < s) j++;
      const a = dense[j]!;
      const b = dense[(j + 1) % dense.length]!;
      const w = (s - cum[j]!) / Math.max(1e-9, cum[j + 1]! - cum[j]!);
      this.x[i] = a[0]! + (b[0]! - a[0]!) * w;
      this.z[i] = a[1]! + (b[1]! - a[1]!) * w;
    }
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
      const k = this.curv[i]!;
      const r = 1 / Math.max(1e-6, Math.abs(k));
      if (r < GP_KERB_RADIUS)
        for (let o = -kerbPad; o <= kerbPad; o++) this.kerb[(i + o + n) % n] = 1;
      if (r < GP_GRAVEL_RADIUS) {
        // a brita fica do lado de fora da curva (curva à direita: fora é a esquerda)
        const side = k > 0 ? -1 : 1;
        for (let o = -gravelPad; o <= gravelPad * 2; o++) {
          const idx = (i + o + n) % n;
          if (this.gravel[idx] === 0) this.gravel[idx] = side;
        }
      }
      // do lado de dentro de uma curva com raio menor que a barreira, ela se dobraria: ali não há barreira
      const fold = r < GP_LIMIT + 4;
      this.wallL[i] = fold && k < 0 ? 0 : 1;
      this.wallR[i] = fold && k > 0 ? 0 : 1;
    }
    // nada de brita na reta do box
    for (let i = 0; i < n; i++)
      if (this.pitCenter(this.rel(i * this.ds)) !== null) this.gravel[i] = 0;
    for (const [from, to] of def.noCut) {
      const s0 = cpS[from] ?? 0;
      const s1 = cpS[to] ?? 0;
      for (let i = 0; i < n; i++) {
        const s = i * this.ds;
        if (s0 <= s1 ? s >= s0 && s <= s1 : s >= s0 || s <= s1) this.noCut[i] = 1;
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
    const edge = GP_HALF_WIDTH - GP_PIT_HALF + 1;
    if (rel < GP_PIT_IN_START || rel > GP_PIT_OUT_END) return null;
    let off = GP_PIT_OFFSET;
    if (rel < GP_PIT_IN_END) {
      const w = (rel - GP_PIT_IN_START) / (GP_PIT_IN_END - GP_PIT_IN_START);
      off = edge + (GP_PIT_OFFSET - edge) * w;
    } else if (rel > GP_PIT_OUT_START) {
      const w = (rel - GP_PIT_OUT_START) / (GP_PIT_OUT_END - GP_PIT_OUT_START);
      off = GP_PIT_OFFSET + (edge - GP_PIT_OFFSET) * w;
    }
    return off * GP_PIT_SIDE;
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
    return this.inPit(s, d) && Math.abs(r - GP_PIT_BOX) <= GP_PIT_BOX_LEN / 2;
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

  /** Tem barreira deste lado nesta amostra? */
  wallOn(i: number, d: number): boolean {
    return (d > 0 ? this.wallR[i] : this.wallL[i]) === 1;
  }
}

const cache = new Map<string, GpTrack>();
/** A pista pronta (calculada uma vez por aparelho). */
export function gpTrack(def: GpTrackDef = GP_TRACK_TOCA): GpTrack {
  let t = cache.get(def.id);
  if (!t) {
    t = new GpTrack(def);
    cache.set(def.id, t);
  }
  return t;
}
