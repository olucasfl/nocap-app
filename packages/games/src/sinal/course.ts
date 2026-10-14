import { createRng } from '../core/rng';
import {
  COVER_DURABILITY,
  COVER_FRAGILE,
  COVER_LONG_DURABILITY,
  COVER_LONG_MAX,
  COVER_LONG_MIN,
  HALF,
  HALF_MAX,
  HALF_MIN,
  MIN_GAP,
  SINAL_MAPS,
  TPS,
  lerp,
  type SinalMapId,
  type SinalMode,
} from './constants';
import type { TimelineParams } from './vigia';

/**
 * A pista de uma partida. No Infinito é uma só, sem fim. No Clássico cada fase é uma pista com
 * linha de chegada; a cada 5 fases o mapa troca (sorteado, sem repetir até fechar os três). Não há
 * chefe: a cada fase vêm mais obstáculos, desfiladeiros e uma escuridão mais ligeira.
 */

export interface Course {
  mode: SinalMode;
  /** Número da fase na corrida (1, 2, 3...). No Infinito é sempre 1. */
  n: number;
  map: SinalMapId;
  /** Linha de chegada em metros (Infinity no Infinito). */
  length: number;
  /** Quanto a escuridão começa atrás da largada (m). */
  darkStart: number;
}

export const PHASES_PER_MAP = 5; // o mapa troca a cada 5 fases

/** A ordem dos mapas numa corrida do Clássico: os três, sem repetir, e depois tudo de novo. */
export function mapOrder(seed: string): SinalMapId[] {
  const rng = createRng(`${seed}:mapas`);
  const maps = [...SINAL_MAPS];
  for (let i = maps.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [maps[i], maps[j]] = [maps[j]!, maps[i]!];
  }
  return maps;
}

export function classicoCourse(seed: string, n: number): Course {
  const order = mapOrder(seed);
  const round = Math.floor((n - 1) / PHASES_PER_MAP);
  return {
    mode: 'classico',
    n,
    map: order[round % order.length]!,
    // a primeira fase é curta (65 m) e cada uma acrescenta 15 m, até 320 m
    length: Math.min(320, 50 + 15 * n),
    // a escuridão larga mais perto a cada fase
    darkStart: Math.max(18, 28 - 1.2 * (n - 1)),
  };
}

export function infinitoCourse(seed: string): Course {
  const rng = createRng(`${seed}:mapa`);
  return {
    mode: 'infinito',
    n: 1,
    map: SINAL_MAPS[Math.floor(rng() * SINAL_MAPS.length)]!,
    length: Infinity,
    darkStart: 30,
  };
}

export function courseFor(seed: string, mode: SinalMode, n: number): Course {
  return mode === 'infinito' ? infinitoCourse(seed) : classicoCourse(seed, n);
}

/** Dificuldade (0 a 1) de uma fase do Clássico: sobe com o número da fase, sem nunca chegar a 1. */
export function phaseDifficulty(n: number): number {
  return n / (n + 9);
}

/** Os parâmetros do Vigia de uma pista: só a dificuldade (a cantiga sai dela e da seed). */
export function timelineParams(course: Course): TimelineParams {
  if (course.mode === 'infinito') return { dAt: (t) => t / (t + 240) };
  const d = phaseDifficulty(course.n);
  return { dAt: () => d };
}

// ---- largura do corredor ---------------------------------------------------------

/**
 * O corredor não tem sempre a mesma largura: de vez em quando estreita num desfiladeiro e de vez em
 * quando alarga numa clareira, com transições suaves. Os primeiros 30 m são sempre normais. Com a
 * dificuldade os desfiladeiros ficam mais frequentes e mais estreitos.
 */
const WIDTH_RAMP = 7;

export class WidthField {
  /** Pontos (altura, meia largura) ligados por retas. */
  readonly pts: { y: number; h: number }[] = [
    { y: -20, h: HALF },
    { y: 30, h: HALF },
  ];
  private readonly rng: () => number;
  private nextY = 30;

  constructor(
    private readonly course: Course,
    seedKey: string,
  ) {
    this.rng = createRng(seedKey);
  }

  private dAt(y: number): number {
    return this.course.mode === 'infinito' ? y / (y + 600) : phaseDifficulty(this.course.n);
  }

  ensure(untilY: number) {
    while (this.nextY <= untilY) {
      const d = this.dAt(this.nextY);
      const [gapR, kindR, lenR, hR] = [this.rng(), this.rng(), this.rng(), this.rng()];
      const gap = lerp(lerp(45, 26, d), lerp(80, 45, d), gapR);
      const start = this.nextY + gap;
      const clearing = kindR < 0.3;
      const h = clearing ? lerp(8.2, HALF_MAX, hR) : lerp(4.6, HALF_MIN, d * 0.7 + hR * 0.3);
      const len = clearing ? 14 + lenR * 20 : 14 + lenR * 14;
      this.pts.push(
        { y: start, h: HALF },
        { y: start + WIDTH_RAMP, h },
        { y: start + WIDTH_RAMP + len, h },
        { y: start + 2 * WIDTH_RAMP + len, h: HALF },
      );
      this.nextY = start + 2 * WIDTH_RAMP + len;
    }
  }

  /** A meia largura do corredor na altura `y`. */
  halfAt(y: number): number {
    this.ensure(y + 60);
    const pts = this.pts;
    if (y <= pts[0]!.y) return pts[0]!.h;
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid]!.y <= y) lo = mid;
      else hi = mid;
    }
    const a = pts[lo]!;
    const b = pts[hi]!;
    if (b.y === a.y) return b.h;
    return a.h + (b.h - a.h) * ((y - a.y) / (b.y - a.y));
  }
}

// ---- esconderijos --------------------------------------------------------------

export interface CoverDef {
  id: number;
  x: number;
  y: number;
  fragile: boolean;
  /** Quanto aguenta, em segundos. */
  max: number;
  /** 0 = moita; maior que 0 = moita comprida: o esconderijo vai de `y` até `y + len` (para a frente). */
  len: number;
}

/**
 * Os esconderijos ao longo da pista, gerados à medida que a pessoa avança. Pequenos, espaçados
 * (cada vez mais) e com a posição lateral sempre mudando: nunca formam fila de um até o outro.
 */
export class CoverField {
  readonly list: CoverDef[] = [];
  private readonly rng: () => number;
  private nextY = 0;
  private sign = 0;

  constructor(
    private readonly course: Course,
    seedKey: string,
    private readonly width: WidthField,
  ) {
    this.rng = createRng(seedKey);
    this.nextY = 16 + this.rng() * 10;
  }

  private dAt(y: number): number {
    return this.course.mode === 'infinito'
      ? y / (y + 700)
      : phaseDifficulty(this.course.n);
  }

  /** Garante os esconderijos até a altura `untilY`. */
  ensure(untilY: number) {
    while (this.nextY <= untilY) {
      const d = this.dAt(this.nextY);
      const [gapR, xR, fragR, longR, lenR] = [this.rng(), this.rng(), this.rng(), this.rng(), this.rng()];
      const fragileFrom = this.course.mode === 'classico' ? this.course.n >= 4 : d > 0.2;
      // Moita comprida: nas primeiras fases é mais comum (ajuda a aprender), depois fica mais rara.
      const long = longR < lerp(0.42, 0.2, d);
      const len = long ? COVER_LONG_MIN + lenR * (COVER_LONG_MAX - COVER_LONG_MIN) : 0;
      // O lado respeita o corredor em toda a extensão da moita (ele pode estreitar no meio dela).
      let narrowest = this.width.halfAt(this.nextY);
      for (let dy = 2; dy <= len + 2; dy += 2) narrowest = Math.min(narrowest, this.width.halfAt(this.nextY + Math.min(dy, len)));
      const side = Math.max(1.9, narrowest - 1.6);
      // Troca de lado a cada esconderijo: nunca um atrás do outro.
      this.sign = this.sign === 0 ? (xR < 0.5 ? -1 : 1) : -this.sign;
      const x = this.sign * (1.8 + ((xR * 7.13) % 1) * Math.max(0, side - 1.8));
      const fragile = !long && fragileFrom && fragR < lerp(0.1, 0.5, d);
      this.list.push({
        id: this.list.length,
        x,
        y: this.nextY,
        fragile,
        max: long ? COVER_LONG_DURABILITY : fragile ? COVER_FRAGILE : COVER_DURABILITY,
        len,
      });
      // O espaço até o próximo cresce com a dificuldade (e conta depois do fim da moita comprida).
      this.nextY += len + lerp(lerp(16, 28, d), lerp(40, 76, d), gapR);
    }
  }
}

// ---- obstáculos ----------------------------------------------------------------

/**
 * Os obstáculos do caminho. Os sólidos o boneco contorna (pequeno, médio e grande); alguns se mexem
 * (deslizante vai de um lado a outro, vaivém vem e vai); a mola joga para trás; e os que ficam no chão
 * agem em quem passa: lamaçal (devagar), esteira (empurra de lado) e ímã (puxa para o centro).
 */
export type ObstacleKind =
  | 'pequeno'
  | 'medio'
  | 'grande'
  | 'deslizante'
  | 'vaivem'
  | 'mola'
  | 'orbita'
  | 'serra'
  | 'lamacal'
  | 'esteira'
  | 'ima'
  | 'gelo';

/** Os que o boneco não atravessa (bater neles joga para trás). */
export const SOLID_KINDS: readonly ObstacleKind[] = [
  'pequeno',
  'medio',
  'grande',
  'deslizante',
  'vaivem',
  'mola',
  'orbita',
  'serra',
];
/** Os que andam sozinhos. */
export const MOVER_KINDS: readonly ObstacleKind[] = ['deslizante', 'vaivem', 'orbita', 'serra'];
export const isSolid = (k: ObstacleKind) => SOLID_KINDS.includes(k);

/** A partir de que nível (fase no Clássico) cada obstáculo aparece, e o peso do sorteio. */
const OBSTACLE_UNLOCK: { kind: ObstacleKind; level: number; weight: number }[] = [
  { kind: 'pequeno', level: 1, weight: 4 },
  { kind: 'medio', level: 1, weight: 4 },
  { kind: 'lamacal', level: 1, weight: 2 },
  { kind: 'mola', level: 1, weight: 1.4 },
  { kind: 'esteira', level: 1, weight: 1.4 },
  { kind: 'grande', level: 2, weight: 2.5 },
  { kind: 'deslizante', level: 2, weight: 2.5 },
  { kind: 'vaivem', level: 3, weight: 2.2 },
  { kind: 'ima', level: 4, weight: 1.6 },
  { kind: 'gelo', level: 2, weight: 1.8 },
  { kind: 'orbita', level: 4, weight: 1.8 },
  { kind: 'serra', level: 5, weight: 1.5 },
];

/** Nos desfiladeiros só entra o que dá para passar: nada que varra o corredor de lado. */
const NARROW_KINDS: readonly ObstacleKind[] = ['pequeno', 'vaivem', 'lamacal', 'esteira', 'gelo', 'mola'];
const NARROW_HALF = 5.5;

export interface ObstacleDef {
  id: number;
  /** Posição-base (no mundo). Os que se mexem oscilam em volta dela. */
  x: number;
  y: number;
  /** Raio (m): do corpo, ou da zona nos de chão. */
  r: number;
  kind: ObstacleKind;
  /** Para os que se mexem: amplitude (m), período (passos), defasagem (passos) e eixo. */
  amp: number;
  period: number;
  offset: number;
  axis: 'x' | 'y' | 'xy';
  /** Esteira: para que lado empurra (-1 ou 1). */
  dir: -1 | 1;
}

/** Posição de um obstáculo no passo `tick` da fase: onda triangular, só soma e multiplicação. */
export function obstaclePos(o: ObstacleDef, tick: number): { x: number; y: number } {
  if (o.amp === 0) return { x: o.x, y: o.y };
  const wave = (shift: number) => {
    const ph = ((tick + o.offset + shift) % o.period) / o.period;
    return ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
  };
  if (o.axis === 'xy') {
    // a órbita: duas ondas defasadas em um quarto de volta desenham um losango arredondado
    return { x: o.x + o.amp * wave(0), y: o.y + o.amp * wave(Math.round(o.period / 4)) };
  }
  const tri = wave(0);
  return o.axis === 'x' ? { x: o.x + o.amp * tri, y: o.y } : { x: o.x, y: o.y + o.amp * tri };
}

/**
 * Surgem em grupos de um a quatro e sempre sobra um vão para passar. Quanto mais avançado, mais
 * seguidos, mais numerosos e mais variados (os tipos novos vão sendo liberados fase a fase).
 */
export class ObstacleField {
  readonly list: ObstacleDef[] = [];
  private readonly rng: () => number;
  private nextY: number;

  constructor(
    private readonly course: Course,
    seedKey: string,
    private readonly covers: CoverField,
    private readonly width: WidthField,
  ) {
    this.rng = createRng(seedKey);
    this.nextY = 11 + this.rng() * 6;
  }

  /** O "nível" da pista: a fase no Clássico; no Infinito sobe com a distância. */
  private levelAt(y: number): number {
    return this.course.mode === 'infinito' ? 1 + Math.floor(y / 70) : this.course.n;
  }

  private dAt(y: number): number {
    return this.course.mode === 'infinito'
      ? y / (y + 500)
      : phaseDifficulty(this.course.n);
  }

  ensure(untilY: number) {
    while (this.nextY <= untilY) {
      const d = this.dAt(this.nextY);
      const level = this.levelAt(this.nextY);
      const r = Array.from({ length: 12 }, () => this.rng());
      this.covers.ensure(this.nextY + 8);
      // a largura vale para o grupo todo (o corredor pode estreitar logo adiante)
      const half = Math.min(this.width.halfAt(this.nextY), this.width.halfAt(this.nextY + 7));
      const narrow = half < NARROW_HALF;
      const count = narrow
        ? 1
        : 1 + (r[0]! < 0.45 + 0.3 * d ? 1 : 0) + (r[1]! < 0.2 + 0.35 * d ? 1 : 0) + (r[2]! < 0.1 + 0.3 * d ? 1 : 0);
      const side = half - 1;
      const pool = OBSTACLE_UNLOCK.filter((u) => u.level <= level && (!narrow || NARROW_KINDS.includes(u.kind)));
      const total = pool.reduce((s, u) => s + u.weight, 0);
      const placed: { x: number; e: number }[] = [];
      for (let i = 0; i < count; i++) {
        // cada item sorteia o tipo, o tamanho e o lugar com números novos (a pista não "desanda")
        const [kR, sR, xR, aR, pR] = [this.rng(), this.rng(), this.rng(), this.rng(), this.rng()];
        let pick = kR * total;
        let kind: ObstacleKind = 'pequeno';
        for (const u of pool) {
          pick -= u.weight;
          if (pick <= 0) {
            kind = u.kind;
            break;
          }
        }
        const rad =
          kind === 'pequeno'
            ? 0.35 + sR * 0.15
            : kind === 'medio'
              ? 0.6 + sR * 0.25
              : kind === 'grande'
                ? 1.1 + sR * 0.4
                : kind === 'mola'
                  ? 0.55 + sR * 0.1
                  : kind === 'lamacal'
                    ? 1.8 + sR * 0.7
                    : kind === 'esteira'
                      ? 1.6 + sR * 0.5
                      : kind === 'ima'
                        ? 2.2
                        : kind === 'gelo'
                          ? 2.0 + sR * 0.8
                          : kind === 'serra'
                            ? 0.6 + sR * 0.15
                            : 0.7 + sR * 0.2; // deslizante, vaivém, órbita
        const amp =
          kind === 'deslizante'
            ? 2.2 + aR * 1.6
            : kind === 'vaivem'
              ? 1.8 + aR * 1.4
              : kind === 'orbita'
                ? 1.5 + aR * 1.0
                : kind === 'serra'
                  ? 3 + aR * 1.2
                  : 0;
        // quanto o obstáculo se espalha para os lados (as órbitas e os que deslizam)
        const reach = rad + (kind === 'deslizante' || kind === 'orbita' || kind === 'serra' ? amp : 0);
        if (narrow && (kind === 'deslizante' || kind === 'orbita' || kind === 'serra')) continue;
        const lim = Math.max(0.3, side - reach);
        let x = (xR * 2 - 1) * lim;
        // sem sobreposição com os outros do grupo: se não couber, este item fica de fora
        let ok = true;
        for (const p of placed) {
          const min = p.e + reach + 2.4;
          if (Math.abs(x - p.x) < min) {
            x = p.x >= 0 ? p.x - min : p.x + min;
            if (Math.abs(x) > lim) ok = false;
          }
        }
        if (!ok) continue;
        const y = this.nextY + i * 1.6;
        // Sempre sobra passagem: o vão mais largo de um dos lados cabe o boneco com folga.
        if (isSolid(kind)) {
          const hy = this.width.halfAt(y);
          if (Math.max(x - rad + hy, hy - (x + rad)) < MIN_GAP) continue;
        }
        // longe dos esconderijos (inclusive de toda a extensão das moitas compridas)
        const tooNearCover = this.covers.list.some((c) => {
          const cy = Math.max(c.y, Math.min(y, c.y + c.len));
          return Math.abs(cy - y) < 5 && (c.x - x) ** 2 + (cy - y) ** 2 < 3.4 * 3.4;
        });
        if (tooNearCover) continue;
        placed.push({ x, e: reach });
        const period = Math.round(
          (kind === 'vaivem' ? 3.6 + pR * 1.6 : kind === 'serra' ? 2.2 + pR * 0.8 : kind === 'orbita' ? 5 + pR * 2 : 4.4 + pR * 2) *
            TPS,
        );
        this.list.push({
          id: this.list.length,
          x,
          y,
          r: rad,
          kind,
          amp,
          period,
          offset: Math.floor(pR * period),
          axis: kind === 'vaivem' ? 'y' : kind === 'orbita' ? 'xy' : 'x',
          dir: aR < 0.5 ? -1 : 1,
        });
      }
      // os grupos vêm mais seguidos conforme a fase avança
      this.nextY += lerp(lerp(14, 8, d), lerp(24, 12, d), r[5]!);
    }
  }
}
