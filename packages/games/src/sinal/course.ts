import { createRng } from '../core/rng';
import {
  COVER_DURABILITY,
  COVER_FRAGILE,
  HALF,
  OWN_POWERS,
  SINAL_MAPS,
  TPS,
  UNLOCKED_POWERS,
  lerp,
  type PowerKind,
  type SinalMapId,
  type SinalMode,
} from './constants';
import type { TimelineParams } from './vigia';

/**
 * A pista de uma partida. No Infinito é uma só, sem fim. No Clássico cada fase é uma pista com
 * linha de chegada; a cada 5 fases o mapa troca (sorteado, sem repetir até fechar os três). Não há
 * chefe: a cada fase vêm mais poderes, mais obstáculos e uma escuridão mais ligeira.
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
    darkStart: Math.max(22, 36 - 1.2 * (n - 1)),
  };
}

export function infinitoCourse(seed: string): Course {
  const rng = createRng(`${seed}:mapa`);
  return {
    mode: 'infinito',
    n: 1,
    map: SINAL_MAPS[Math.floor(rng() * SINAL_MAPS.length)]!,
    length: Infinity,
    darkStart: 42,
  };
}

export function courseFor(seed: string, mode: SinalMode, n: number): Course {
  return mode === 'infinito' ? infinitoCourse(seed) : classicoCourse(seed, n);
}

/** Dificuldade (0 a 1) de uma fase do Clássico: sobe com o número da fase, sem nunca chegar a 1. */
export function phaseDifficulty(n: number): number {
  return n / (n + 9);
}

/** Os poderes de um Vigia na fase `level`: os três do mapa mais os que já foram liberados. */
export function powerPool(map: SinalMapId, level: number): PowerKind[] {
  const pool: PowerKind[] = [...OWN_POWERS[map]];
  for (const u of UNLOCKED_POWERS) {
    if (level >= u.level) for (const k of u.kinds) if (!pool.includes(k)) pool.push(k);
  }
  return pool;
}

/** Os parâmetros do Vigia de uma pista (os tempos e os poderes). */
export function timelineParams(course: Course): TimelineParams {
  if (course.mode === 'infinito') {
    // Tudo cresce com o tempo de corrida: o Vigia mais ligeiro, mais falsos avisos, poderes variados.
    const own = OWN_POWERS[course.map];
    return {
      dAt: (t) => t / (t + 240),
      pFake: (d, t) => (t < 45 ? 0 : lerp(0.08, 0.25, d)),
      pPower: (_d, t) => (t < 8 ? 0 : 0.95),
      minGap: (d) => lerp(4.5, 2.5, d),
      pool: (t): PowerKind[] => {
        const pool: PowerKind[] = [...own];
        const add = (...ks: PowerKind[]) => ks.forEach((k) => pool.includes(k) || pool.push(k));
        if (t >= 20) add('espelho', 'bolhas');
        if (t >= 45) add('rajada', 'cortina', 'soluco', 'negativo');
        if (t >= 90) add('lama', 'invertido', 'bebado', 'pixelado', 'patins');
        if (t >= 150) add('apagao', 'chuva', 'turbo', 'lupa');
        return pool;
      },
      chain: (t) => (t >= 120 ? 2 : 1),
      // os efeitos duram mais quanto mais tempo você aguenta (até 1,9x)
      effectScale: (t) => Math.min(1.9, 1 + t / 300),
      costasScale: 1,
    };
  }
  const d = phaseDifficulty(course.n);
  return {
    dAt: () => d,
    pFake: () => (course.n < 2 ? 0 : lerp(0.1, 0.3, d)),
    pPower: () => 0.95,
    minGap: () => lerp(4.5, 2.5, d),
    pool: () => powerPool(course.map, course.n),
    // dois poderes seguidos a partir da fase 6
    chain: () => (course.n >= 6 ? 2 : 1),
    // os efeitos duram mais a cada fase (até 1,9x)
    effectScale: () => Math.min(1.9, 1 + 0.07 * (course.n - 1)),
    costasScale: 1,
  };
}

// ---- esconderijos --------------------------------------------------------------

export interface CoverDef {
  id: number;
  x: number;
  y: number;
  fragile: boolean;
  /** Quanto aguenta, em segundos. */
  max: number;
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
      const [gapR, xR, fragR] = [this.rng(), this.rng(), this.rng()];
      const side = HALF - 1.6;
      // Troca de lado a cada esconderijo: nunca um atrás do outro.
      this.sign = this.sign === 0 ? (xR < 0.5 ? -1 : 1) : -this.sign;
      const x = this.sign * (1.8 + ((xR * 7.13) % 1) * (side - 1.8));
      const fragileFrom = this.course.mode === 'classico' ? this.course.n >= 4 : d > 0.2;
      const fragile = fragileFrom && fragR < lerp(0.1, 0.5, d);
      this.list.push({
        id: this.list.length,
        x,
        y: this.nextY,
        fragile,
        max: fragile ? COVER_FRAGILE : COVER_DURABILITY,
      });
      // O espaço entre eles cresce com a dificuldade.
      this.nextY += lerp(lerp(22, 34, d), lerp(45, 80, d), gapR);
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
  | 'gelo'
  | 'cola'
  | 'inversor'
  | 'turbina';

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
  { kind: 'cola', level: 3, weight: 1.6 },
  { kind: 'turbina', level: 3, weight: 1.6 },
  { kind: 'orbita', level: 4, weight: 1.8 },
  { kind: 'serra', level: 5, weight: 1.5 },
  { kind: 'inversor', level: 6, weight: 1.4 },
];

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
      const count = 1 + (r[0]! < 0.45 + 0.3 * d ? 1 : 0) + (r[1]! < 0.2 + 0.35 * d ? 1 : 0) + (r[2]! < 0.1 + 0.3 * d ? 1 : 0);
      const side = HALF - 1;
      const pool = OBSTACLE_UNLOCK.filter((u) => u.level <= level);
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
                    : kind === 'esteira' || kind === 'turbina'
                      ? 1.6 + sR * 0.5
                      : kind === 'ima'
                        ? 2.2
                        : kind === 'gelo' || kind === 'cola' || kind === 'inversor'
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
        const lim = Math.max(0.5, side - reach);
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
        const tooNearCover = this.covers.list.some(
          (c) => Math.abs(c.y - y) < 5 && (c.x - x) ** 2 + (c.y - y) ** 2 < 3.4 * 3.4,
        );
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
