import {
  GP_DRS_CURV_MAX,
  GP_DRS_END_OFFSET,
  GP_DRS_MIN_STRAIGHT,
  GP_DRS_START_OFFSET,
  GP_GRAVEL_RADIUS,
  GP_HALF_WIDTH,
  GP_KERB_RADIUS,
  GP_KERB_W,
  GP_LIMIT,
  GP_PIT_BOX_LEN,
  GP_PAD_HALF,
  GP_PAD_LEN,
  GP_PIT_HALF,
  GP_SAMPLE,
  type GpSurface,
} from './constants';
import { GP_TRACK_BALA } from './track-bala';
import { GP_TRACK_CASTLE } from './track-castle';

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
  /** A faixa do box; `null` = pista sem box (a do kart). Sem o campo, o box padrão (pistas antigas). */
  pit?: GpPitDef | null;
  /**
   * Distância mínima da barreira ao centro onde outro trecho passa perto (m). Padrão: asfalto, zebra e uma folga; numa
   * pista de kart com faixas paralelas a barreira pode ficar mais perto (só o asfalto e uma folga).
   */
  wallMin?: number;
  /** Placas de turbo (spec 081, 6B.4): distância do traçado do começo da placa e o afastamento do centro (m). */
  pads?: readonly { s: number; d: number }[];
  /** Onde começam o setor 2 e o setor 3 (índices de pontos de controle). */
  sectors?: readonly [number, number];
  /** Arquibancadas: de um ponto de controle a outro, do lado indicado (só desenho). */
  stands?: readonly { from: number; to: number; side: 1 | -1; name: string }[];
  /** Área verde de público (só desenho): polígono nos mesmos pontos do traçado. */
  park?: readonly (readonly [number, number])[];
  /**
   * Trechos de barreira de pilha de pneus (o kart quica para trás, spec 081, 6B.4), de um ponto de controle a outro, do
   * lado indicado. No resto a barreira é muro (batida normal).
   */
  tyreWalls?: readonly { from: number; to: number; side: 1 | -1 }[];
  /**
   * Altura da estrada em cada ponto de controle (m, só desenho: a física é plana). Pistas de modelo (spec 086) têm morro e
   * ponte; o desenho põe o kart, as caixas e a câmera nessa altura.
   */
  heights?: readonly number[];
  /** Inclinação lateral da estrada em cada ponto de controle (rad; positiva = lado direito mais alto). */
  banks?: readonly number[];
  /** Desgaste do pneu nesta pista, em relação ao padrão (1). Interlagos é longa: gastava demais por volta. */
  wearK?: number;
  /** Arcade: fator da velocidade máxima (pista curta para o ritmo: a volta dura mais). */
  vmaxK?: number;
  /** Escala do tamanho do carro (desenho e caixa de colisão): 0,6 deixa o kart 40% menor na pista. */
  kartK?: number;
  /**
   * Distância (m) do centro da pista até a primeira parede do modelo de cada lado, em cada ponto de controle (99 = sem
   * parede). O kart encosta na parede de verdade em vez de numa barreira invisível mais longe (spec 086).
   */
  wallsL?: readonly number[];
  wallsR?: readonly number[];
}

/** O tipo da barreira: muro (batida normal) ou pilha de pneus (rebate o kart para trás). */
export type GpWallKind = 'metal' | 'tyres';

/** Folga (m) entre a parede do modelo e a barreira do jogo: o kart para antes de entrar na pedra. */
/** Diferença de altura (m) a partir da qual dois trechos da pista são andares diferentes (ponte e estrada). */
export const GP_LEVEL_APART = 3;
const GP_MODEL_WALL_GAP = 1.1;

const PIT_DEFAULT: GpPitDef = {
  side: 1,
  offset: 13,
  inStart: -95,
  inEnd: -65,
  outStart: 20,
  outEnd: 50,
  box: -18,
};

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
 * miolo de curvas e sobe de volta para a reta principal. O box fica na metade da volta, do lado de fora da curva.
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
  // box na metade da volta (pedido do Lucas, 16/11/2026): na curva longa antes da reta curta do norte, do lado de fora
  pit: { side: 1, offset: 12, inStart: -731, inEnd: -717, outStart: -655, outEnd: -633, box: -697 },
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

/**
 * Interlagos (pedido do Lucas, 14/11/2026): o traçado do mapa de DRS enviado por ele (reta principal descendo para o
 * sudoeste, S do Senna, Curva do Sol, reta oposta embaixo, subida pela direita, Descida do Lago, Ferradura, Laranjinha,
 * Pinheirinho, Bico de Pato, Mergulho, Junção e Subida dos Boxes de volta, no sentido da corrida). Pontos
 * em pixels do desenho; o cenário é o mesmo da Marina (só muda o traçado). O box fica na metade da volta, do lado de fora da curva.
 */
export const GP_TRACK_INTERLAGOS: GpTrackDef = {
  id: 'interlagos',
  name: 'Interlagos',
  scale: 0.4,
  origin: [1068, 600],
  smooth: 8,
  limit: 16,
  points: [
    [1250, 125], // 0 linha de chegada, no alto da reta principal
    [1100, 160],
    [900, 230],
    [700, 330],
    [520, 430],
    [400, 495], // 5 fim da reta (velocidade máxima)
    [320, 540],
    [285, 590], // 7 S do Senna
    [300, 640],
    [350, 670],
    [385, 720],
    [385, 800],
    [365, 880], // 12 Curva do Sol
    [385, 970],
    [460, 1040],
    [560, 1070],
    [700, 1078], // 16 Reta Oposta
    [900, 1075],
    [1150, 1070],
    [1400, 1065],
    [1530, 1060],
    [1590, 1020],
    [1605, 930],
    [1590, 840],
    [1520, 770], // 24 Descida do Lago
    [1380, 700],
    [1200, 610],
    [1050, 530],
    [975, 480],
    [945, 420], // 29 Ferradura
    [965, 350],
    [1030, 290],
    [1120, 235],
    [1190, 205],
    [1235, 225], // 34 Laranjinha
    [1250, 275],
    [1225, 320], // 36 Pinheirinho
    [1215, 360],
    [1250, 400],
    [1305, 405],
    [1350, 360],
    [1400, 290],
    [1450, 225],
    [1520, 190], // 43 Bico de Pato
    [1575, 200],
    [1590, 240],
    [1555, 320],
    [1500, 410],
    [1485, 470],
    [1520, 540],
    [1590, 585], // 50 Mergulho
    [1700, 625],
    [1790, 655],
    [1835, 620],
    [1850, 540],
    [1845, 460],
    [1800, 380], // 56 Junção
    [1740, 280],
    [1680, 200],
    [1600, 160],
    [1480, 140], // 60 Subida dos Boxes
  ],
  noCut: [],
  // box na metade da volta (pedido do Lucas, 16/11/2026): na curva aberta antes da reta do Pinheirinho, do lado de fora
  pit: { side: 1, offset: 12, inStart: 1124, inEnd: 1138, outStart: 1200, outEnd: 1222, box: 1158 },
  // Interlagos é longa: o pneu gastava quase tudo em uma volta
  wearK: 0.5,
  sectors: [20, 41],
  stands: [
    { from: 0, to: 3, side: 1, name: 'MAIN' },
    { from: 16, to: 18, side: 1, name: 'SOUTH' },
  ],
};

/** As pistas de cada modo, na ordem da escolha (a primeira é a padrão). */
export const GP_TRACKS_REAL: readonly GpTrackDef[] = [GP_TRACK_MARINA, GP_TRACK_INTERLAGOS];
/** Arcade sem poderes. */
export const GP_TRACKS_ARCADE: readonly GpTrackDef[] = [GP_TRACK_BALA];
/** Arcade com poderes (spec 086): as pistas novas, de modelo. A Bala Track também vale com poderes (a pessoa escolhe entre o Castelo e a Bala Track). */
export const GP_TRACKS_POWERS: readonly GpTrackDef[] = [GP_TRACK_CASTLE, GP_TRACK_BALA];
export const GP_TRACK_IDS = ['marina', 'interlagos', 'bala', 'castle'] as const;
export type GpTrackId = (typeof GP_TRACK_IDS)[number];
export const gpIsTrackId = (v: unknown): v is GpTrackId => GP_TRACK_IDS.includes(v as GpTrackId);

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
    const lerp = (
      a: readonly number[],
      b: readonly number[],
      ta: number,
      tb: number,
      t: number,
    ) => {
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
  /** Multiplicador do desgaste do pneu desta pista. */
  readonly wearK: number;
  readonly vmaxK: number;
  readonly kartK: number;
  /** A faixa do box (null = pista sem box). */
  readonly pit: GpPitDef | null;
  readonly pads: readonly { s: number; d: number }[];
  /** Distância do traçado onde começam os setores 2 e 3. */
  readonly sectorS: readonly [number, number];
  /** Distância do traçado de cada ponto de controle. */
  readonly cpS: readonly number[];
  /** Zonas de DRS (spec 080): distâncias do traçado onde começa e acaba cada uma (`to` pode passar de L). */
  readonly drsZones: readonly { from: number; to: number }[];
  /** 1 nas amostras dentro de uma zona de DRS. */
  readonly drsAt: Uint8Array;
  /** Barreira de pilha de pneus em cada amostra: 1 à esquerda, 2 à direita (bits). */
  readonly tyreAt: Uint8Array;
  /**
   * 1 nas amostras onde outro trecho da pista cruza este por cima ou por baixo (ponte, spec 086): ali a projeção global
   * pode cair no outro trecho, então o corte de caminho não vale.
   */
  readonly overlap: Uint8Array;

  constructor(def: GpTrackDef) {
    this.def = def;
    this.limit = def.limit ?? GP_LIMIT;
    this.wearK = def.wearK ?? 1;
    this.vmaxK = def.vmaxK ?? 1;
    this.kartK = def.kartK ?? 1;
    this.pit = def.pit === null ? null : (def.pit ?? PIT_DEFAULT);
    this.pads = def.pads ?? [];
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
        cum.push(
          cum[i - 1]! +
            Math.hypot(dense[i]![0]! - dense[i - 1]![0]!, dense[i]![1]! - dense[i - 1]![1]!),
        );
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
    this.overlap = this.findCrossings();
    this.drsZones = this.findDrsZones();
    this.drsAt = new Uint8Array(this.n);
    for (const zn of this.drsZones)
      for (let s = zn.from; s < zn.to; s += this.ds) this.drsAt[this.index(s)] = 1;
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
    this.tyreAt = new Uint8Array(n);
    for (const tw of def.tyreWalls ?? []) {
      const s0 = cp[tw.from] ?? 0;
      const s1 = cp[tw.to] ?? 0;
      for (let i = 0; i < n; i++) {
        const s = i * this.ds;
        if (s0 <= s1 ? s >= s0 && s <= s1 : s >= s0 || s <= s1)
          this.tyreAt[i]! |= tw.side > 0 ? 2 : 1;
      }
    }
    const sec = def.sectors ?? [
      Math.floor(def.points.length / 3),
      Math.floor((def.points.length * 2) / 3),
    ];
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
        // ponte e estrada de baixo não se encostam: outro andar não pede muro no meio do caminho
        if (this.def.heights && Math.abs(this.yAt(i * this.ds) - this.yAt(j * this.ds)) > GP_LEVEL_APART) continue;
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
      const wallMin = this.def.wallMin ?? GP_HALF_WIDTH + GP_KERB_W + 0.6;
      const wall = (room: number, inside: boolean) => {
        if (room < Infinity) return Math.max(wallMin, Math.min(this.limit, room / 2 - 0.4));
        return inside ? Infinity : this.limit;
      };
      this.wallR[i] = wall(right, fold && kk > 0);
      this.wallL[i] = wall(left, fold && kk < 0);
      // parede do modelo: o kart bate nela, não numa barreira invisível mais adiante
      if (this.def.wallsR || this.def.wallsL) {
        const s = i * this.ds;
        const mr = this.interp(this.def.wallsR, s) - GP_MODEL_WALL_GAP;
        const ml = this.interp(this.def.wallsL, s) - GP_MODEL_WALL_GAP;
        // com o chão do modelo na mão, a barreira pode ficar rente ao que existe (a estrada do modelo é mais estreita em alguns trechos)
        const floor = GP_HALF_WIDTH - 1.5;
        if (mr > 0 && mr < this.wallR[i]!) this.wallR[i] = Math.max(floor, mr);
        if (ml > 0 && ml < this.wallL[i]!) this.wallL[i] = Math.max(floor, ml);
      }
      // a faixa do box fica dentro da barreira do lado dela
      const pc = this.pitCenter(this.rel(i * this.ds));
      if (pc !== null) {
        const need = Math.abs(pc) + GP_PIT_HALF + 1.5;
        if (pc > 0) this.wallR[i] = Math.max(this.wallR[i]!, need);
        else this.wallL[i] = Math.max(this.wallL[i]!, need);
      }
    }
  }

  /** Marca onde a pista se cruza (outro trecho, longe no traçado, passa por cima e em outra direção). */
  private findCrossings(): Uint8Array {
    const n = this.n;
    const out = new Uint8Array(n);
    const skip = Math.round(70 / this.ds);
    const reach = 2 * GP_HALF_WIDTH + 6;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j += 2) {
        const gap = Math.abs(i - j);
        if (Math.min(gap, n - gap) < skip) continue;
        if (Math.hypot(this.x[j]! - this.x[i]!, this.z[j]! - this.z[i]!) > reach) continue;
        // só cruzamento de verdade: direções bem diferentes (faixas paralelas já têm a barreira no meio)
        if (Math.abs(this.tx[i]! * this.tx[j]! + this.tz[i]! * this.tz[j]!) < 0.75) {
          out[i] = 1;
          break;
        }
      }
    }
    // alarga um pouco para os dois lados
    const pad = Math.round(14 / this.ds);
    const wide = new Uint8Array(n);
    for (let i = 0; i < n; i++)
      if (out[i]) for (let o = -pad; o <= pad; o++) wide[(i + o + n) % n] = 1;
    return wide;
  }

  /** Retas com curvatura baixa por um bom trecho viram zona de DRS (começa depois da curva e acaba antes da freada). */
  private findDrsZones(): { from: number; to: number }[] {
    const n = this.n;
    const straight = (i: number) => Math.abs(this.curv[((i % n) + n) % n]!) < GP_DRS_CURV_MAX;
    // começa a varredura numa amostra de curva, para não partir uma reta no meio
    let i0 = 0;
    while (i0 < n && straight(i0)) i0++;
    if (i0 >= n) return [];
    const out: { from: number; to: number }[] = [];
    let start = -1;
    for (let k = 0; k <= n; k++) {
      const on = k < n && straight(i0 + k);
      if (on && start < 0) start = k;
      if (!on && start >= 0) {
        const len = (k - start) * this.ds;
        if (len >= GP_DRS_MIN_STRAIGHT) {
          const from = (i0 + start) * this.ds + GP_DRS_START_OFFSET;
          const to = (i0 + k) * this.ds - GP_DRS_END_OFFSET;
          const w = this.wrap(from);
          out.push({ from: w, to: w + (to - from) });
        }
        start = -1;
      }
    }
    return out.sort((a, b) => a.from - b.from);
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
    if (!p) return null;
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
    return !!this.pit && this.inPit(s, d) && Math.abs(r - this.pit.box) <= GP_PIT_BOX_LEN / 2;
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

  /** O tipo da barreira deste lado nesta amostra. */
  wallKind(i: number, d: number): GpWallKind {
    return (this.tyreAt[i]! & (d > 0 ? 2 : 1)) !== 0 ? 'tyres' : 'metal';
  }

  /** Tem barreira deste lado nesta amostra? */
  wallOn(i: number, d: number): boolean {
    return this.wallAt(i, d) < Infinity;
  }

  /** Está em cima de uma placa de turbo? Devolve o índice dela ou −1. */
  padAt(s: number, d: number): number {
    for (let k = 0; k < this.pads.length; k++) {
      const pd = this.pads[k]!;
      const ds = this.delta(pd.s, s);
      if (ds >= 0 && ds <= GP_PAD_LEN && Math.abs(d - pd.d) <= GP_PAD_HALF) return k;
    }
    return -1;
  }

  /**
   * Altura da estrada na distância s (m, só desenho): interpola `def.heights` entre os pontos de controle. 0 se a pista não
   * tem alturas.
   */
  yAt(s: number): number {
    return this.interp(this.def.heights, s);
  }

  /** Inclinação lateral da estrada na distância s (rad; positiva = lado direito mais alto). */
  bankAt(s: number): number {
    return this.interp(this.def.banks, s);
  }

  /** Altura da superfície no ponto (s, d), com a inclinação lateral: onde as rodas tocam a estrada (m, só desenho). */
  surfaceY(s: number, d: number): number {
    const h = this.def.heights;
    if (!h) return 0;
    return this.yAt(s) + (this.def.banks ? d * Math.tan(this.bankAt(s)) : 0);
  }

  /** Interpola um valor por ponto de controle ao longo da pista (cp[0] = 0; o último trecho fecha no comprimento). */
  private interp(arr: readonly number[] | undefined, s: number): number {
    if (!arr || arr.length < 2) return 0;
    const cp = this.cpS;
    const w = this.wrap(s);
    let lo = 0;
    let hi = cp.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cp[mid]! <= w) lo = mid;
      else hi = mid - 1;
    }
    const a = lo;
    const b = (lo + 1) % cp.length;
    const sa = cp[a]!;
    const sb = b === 0 ? this.length : cp[b]!;
    const f = sb > sa ? (w - sa) / (sb - sa) : 0;
    return arr[a]! + (arr[b]! - arr[a]!) * Math.min(1, Math.max(0, f));
  }

  /** Ponto do desenho original (pixels) em metros da pista (minimapa, cenário). */
  mapPoint(px: number, pz: number): { x: number; z: number } {
    const k = this.def.scale ?? 1;
    const [ox, oz] = this.def.origin ?? [0, 0];
    return { x: (px - ox) * k, z: (pz - oz) * k };
  }
}

/** A pista de cada modo (spec 081): o kart corre na Bala Track; o F1 na Marina. */
export function gpTrackDefFor(
  mode: 'arcade' | 'real',
  id?: string | null,
  powers = false,
): GpTrackDef {
  const list = mode === 'arcade' ? (powers ? GP_TRACKS_POWERS : GP_TRACKS_ARCADE) : GP_TRACKS_REAL;
  return list.find((t) => t.id === id) ?? list[0]!;
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
