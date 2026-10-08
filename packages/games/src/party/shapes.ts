import { createRng, randInt } from '../core/rng';
import { BIG_WEIGHT, MICRO_MAX } from './micro';

/**
 * Caça-Formas Caótico (minijogo grande): peças aparecem, andam, batem umas nas outras e somem; o
 * jogo sorteia o que clicar e o que evitar. Tudo vem da seed: o servidor regenera o cronograma e
 * confere cada clique pelo horário em que ele chega; o movimento é só visual e igual para todos.
 */

export type ShapeKind =
  | 'circle'
  | 'triangle'
  | 'square'
  | 'rect'
  | 'diamond'
  | 'star'
  | 'hexagon'
  | 'cross'
  | 'pentagon'
  | 'heart';
/** Só cores bem diferentes entre si (sem ciano, que se confunde com o azul). */
export type ShapeColor = 'orange' | 'blue' | 'yellow' | 'green' | 'purple';

export const SHAPE_KINDS: readonly ShapeKind[] = [
  'circle',
  'triangle',
  'square',
  'rect',
  'diamond',
  'star',
  'hexagon',
  'cross',
  'pentagon',
  'heart',
];
export const SHAPE_COLORS: readonly ShapeColor[] = ['orange', 'blue', 'yellow', 'green', 'purple'];

export const SHAPE_NAME: Record<ShapeKind, string> = {
  circle: 'círculos',
  triangle: 'triângulos',
  square: 'quadrados',
  rect: 'retângulos',
  diamond: 'losangos',
  star: 'estrelas',
  hexagon: 'hexágonos',
  cross: 'cruzes',
  pentagon: 'pentágonos',
  heart: 'corações',
};
/** O nome da cor no plural feminino, para "peças ...". */
export const COLOR_LABEL: Record<ShapeColor, string> = {
  orange: 'laranjas',
  blue: 'azuis',
  yellow: 'amarelas',
  green: 'verdes',
  purple: 'roxas',
};

/** Uma regra pode juntar várias formas e/ou várias cores ("quadrados e triângulos"). */
export interface Matcher {
  shapes?: ShapeKind[];
  colors?: ShapeColor[];
}

export interface ShapeItem {
  id: number;
  kind: ShapeKind;
  color: ShapeColor;
  /** Quando aparece e quanto tempo fica, em ms desde o começo do minijogo. */
  at: number;
  life: number;
  cls: 'good' | 'bad' | 'neutral';
}

export interface ShapesRound {
  click: Matcher;
  avoid: Matcher;
  items: ShapeItem[];
  durationMs: number;
}

export const SHAPES_ITEMS = 56;
export const SHAPES_STEP_MS = 500;
export const SHAPES_LIFE_MS = 2800;
export const SHAPES_DURATION_MS = SHAPES_ITEMS * SHAPES_STEP_MS;
/**
 * Peça certa: +200 se o clique vem logo que ela surge, +150 um pouco depois, +100 se demorou.
 * Peça proibida: -200 (para não compensar clicar em tudo). As outras não valem nada.
 */
export const POINTS_GOOD = 200;
export const POINTS_GOOD_MID = 150;
export const POINTS_GOOD_SLOW = 100;
export const POINTS_BAD = -200;
export const POINTS_NEUTRAL = 0;
export const GOOD_FAST_MS = 800;
export const GOOD_MID_MS = 1600;
/** Quantas peças certas e proibidas vêm numa partida (a mesma proporção para todos). */
const PLAN_GOOD = 12;
const PLAN_BAD = 16;

/** Pontos de um clique segundo o tipo da peça e a demora (ms) desde que ela apareceu. */
export function shapePointsFor(cls: ShapeItem['cls'], reactionMs: number): number {
  if (cls === 'bad') return POINTS_BAD;
  if (cls === 'neutral') return POINTS_NEUTRAL;
  if (reactionMs <= GOOD_FAST_MS) return POINTS_GOOD;
  return reactionMs <= GOOD_MID_MS ? POINTS_GOOD_MID : POINTS_GOOD_SLOW;
}
/** Folga de rede: o clique pode chegar um pouco depois de a peça sumir. */
export const SHAPES_GRACE_MS = 500;

const matches = (m: Matcher, kind: ShapeKind, color: ShapeColor) => {
  const hasShapes = !!m.shapes?.length;
  const hasColors = !!m.colors?.length;
  return (
    (hasShapes || hasColors) &&
    (!hasShapes || m.shapes!.includes(kind)) &&
    (!hasColors || m.colors!.includes(color))
  );
};

export const classify = (
  round: Pick<ShapesRound, 'click' | 'avoid'>,
  kind: ShapeKind,
  color: ShapeColor,
): ShapeItem['cls'] => {
  // Se bate nas duas regras, a de evitar vence.
  if (matches(round.avoid, kind, color)) return 'bad';
  return matches(round.click, kind, color) ? 'good' : 'neutral';
};

/** `n` valores distintos sorteados da lista, fora os de `except`. */
function pickSome<T>(
  rng: () => number,
  list: readonly T[],
  n: number,
  except: readonly T[] = [],
): T[] {
  const pool = list.filter((x) => !except.includes(x));
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    out.push(pool.splice(randInt(rng, 0, pool.length - 1), 1)[0]!);
  }
  return out;
}

/**
 * Sorteia o par de regras (clique / evite). Os modelos misturam formas e cores, com uma ou duas
 * opções cada: "clique em quadrados e triângulos, não em verde", "não clique em círculos e
 * triângulos, clique em azul", e assim por diante.
 */
function drawRules(rng: () => number): { click: Matcher; avoid: Matcher } {
  const some = (n: number) => (rng() < 0.5 ? 1 : n);
  const r = rng();
  if (r < 0.3) {
    // Formas certas, uma cor proibida.
    return {
      click: { shapes: pickSome(rng, SHAPE_KINDS, some(2)) },
      avoid: { colors: pickSome(rng, SHAPE_COLORS, 1) },
    };
  }
  if (r < 0.55) {
    // Cor certa, formas proibidas.
    return {
      click: { colors: pickSome(rng, SHAPE_COLORS, 1) },
      avoid: { shapes: pickSome(rng, SHAPE_KINDS, some(2)) },
    };
  }
  if (r < 0.8) {
    // Só formas: umas certas, outras proibidas.
    const click = pickSome(rng, SHAPE_KINDS, some(2));
    return {
      click: { shapes: click },
      avoid: { shapes: pickSome(rng, SHAPE_KINDS, some(2), click) },
    };
  }
  // Só cores: uma ou duas certas, outra proibida.
  const click = pickSome(rng, SHAPE_COLORS, some(2));
  return { click: { colors: click }, avoid: { colors: pickSome(rng, SHAPE_COLORS, 1, click) } };
}

export function shapesRound(seed: string): ShapesRound {
  const rng = createRng(`${seed}:shapes`);
  const { click, avoid } = drawRules(rng);

  // Proporção exata de certas, proibidas e inofensivas em ordem embaralhada: toda partida tem o
  // mesmo "preço" para quem clica em tudo (saldo negativo).
  const plan: ShapeItem['cls'][] = [
    ...Array<ShapeItem['cls']>(PLAN_GOOD).fill('good'),
    ...Array<ShapeItem['cls']>(PLAN_BAD).fill('bad'),
    ...Array<ShapeItem['cls']>(SHAPES_ITEMS - PLAN_GOOD - PLAN_BAD).fill('neutral'),
  ];
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [plan[i], plan[j]] = [plan[j]!, plan[i]!];
  }
  const items: ShapeItem[] = [];
  for (let i = 0; i < SHAPES_ITEMS; i++) {
    const want = plan[i]!;
    let kind: ShapeKind = SHAPE_KINDS[0]!;
    let color: ShapeColor = SHAPE_COLORS[0]!;
    for (let tries = 0; tries < 80; tries++) {
      kind = SHAPE_KINDS[randInt(rng, 0, SHAPE_KINDS.length - 1)]!;
      color = SHAPE_COLORS[randInt(rng, 0, SHAPE_COLORS.length - 1)]!;
      if (classify({ click, avoid }, kind, color) === want) break;
    }
    items.push({
      id: i,
      kind,
      color,
      at: i * SHAPES_STEP_MS,
      life: SHAPES_LIFE_MS,
      cls: classify({ click, avoid }, kind, color),
    });
  }
  return { click, avoid, items, durationMs: SHAPES_DURATION_MS };
}

const joinE = (xs: string[]) =>
  xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : (xs[0] ?? '');

/** A regra em português, para o comando e o tutorial. */
export function matcherLabel(m: Matcher): string {
  const shapes = joinE((m.shapes ?? []).map((k) => SHAPE_NAME[k]));
  const colors = joinE((m.colors ?? []).map((c) => COLOR_LABEL[c]));
  if (shapes && colors) return `${shapes} (${colors})`;
  if (shapes) return shapes;
  return `peças ${colors}`;
}

/**
 * Pontos de um clique: certo +200/+150/+100 (conforme a rapidez), proibido -200, outra peça 0. O
 * servidor chama com o tempo (ms desde o começo) em que o clique chegou; fora da janela da peça
 * não vale.
 */
export function shapeClickPoints(round: ShapesRound, id: number, atMs: number): number | null {
  const item = round.items[id];
  if (!item) return null;
  if (atMs < item.at || atMs > item.at + item.life + SHAPES_GRACE_MS) return null;
  return shapePointsFor(item.cls, atMs - item.at);
}

/** O máximo possível (todas as peças certas, na hora): vale o peso do minijogo grande. */
export const SHAPES_MAX_POINTS = MICRO_MAX * BIG_WEIGHT;

// ---- movimento (só visual: igual para todos, pela mesma seed) ----

/** A área de jogo tem 100 x 75 unidades; cada peça ocupa um disco de raio `SHAPES_R`. */
export const SHAPES_W = 100;
export const SHAPES_H = 75;
export const SHAPES_R = 6.5;
const SIM_DT_MS = 16;

export interface SimPiece {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Simula as peças: nascem num lugar livre, andam, rebatem nas bordas e batem umas nas outras sem
 * nunca ficar uma por cima da outra. Passos fixos de 16 ms, então qualquer aparelho que avance até
 * o mesmo instante chega às mesmas posições.
 */
export class ShapesSim {
  private t = 0;
  private next = 0;
  private active: SimPiece[] = [];
  private readonly rng: () => number;

  constructor(
    private readonly items: readonly Pick<ShapeItem, 'id' | 'at' | 'life'>[],
    simSeed: string,
  ) {
    this.rng = createRng(`${simSeed}:sim`);
  }

  /** As peças em cena no instante atual. */
  get pieces(): readonly SimPiece[] {
    return this.active;
  }

  advanceTo(ms: number) {
    while (this.t + SIM_DT_MS <= ms) this.step();
  }

  private spawn(id: number) {
    const min = 2 * SHAPES_R + 1;
    let best = { x: SHAPES_W / 2, y: SHAPES_H / 2, gap: -1 };
    for (let tries = 0; tries < 40; tries++) {
      const x = SHAPES_R + this.rng() * (SHAPES_W - 2 * SHAPES_R);
      const y = SHAPES_R + this.rng() * (SHAPES_H - 2 * SHAPES_R);
      const gap = this.active.reduce((m, a) => Math.min(m, Math.hypot(a.x - x, a.y - y)), 999);
      if (gap > best.gap) best = { x, y, gap };
      if (gap >= min) break;
    }
    const angle = this.rng() * Math.PI * 2;
    const speed = 16 + this.rng() * 16;
    this.active.push({
      id,
      x: best.x,
      y: best.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    });
  }

  private step() {
    this.t += SIM_DT_MS;
    while (this.next < this.items.length && this.items[this.next]!.at <= this.t) {
      this.spawn(this.items[this.next]!.id);
      this.next += 1;
    }
    this.active = this.active.filter(
      (a) => this.t <= this.items[a.id]!.at + this.items[a.id]!.life,
    );
    const dt = SIM_DT_MS / 1000;
    for (const a of this.active) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.x < SHAPES_R) {
        a.x = SHAPES_R;
        a.vx = Math.abs(a.vx);
      }
      if (a.x > SHAPES_W - SHAPES_R) {
        a.x = SHAPES_W - SHAPES_R;
        a.vx = -Math.abs(a.vx);
      }
      if (a.y < SHAPES_R) {
        a.y = SHAPES_R;
        a.vy = Math.abs(a.vy);
      }
      if (a.y > SHAPES_H - SHAPES_R) {
        a.y = SHAPES_H - SHAPES_R;
        a.vy = -Math.abs(a.vy);
      }
    }
    // Colisões entre discos de mesma massa: troca a componente da velocidade na direção do choque
    // e afasta as duas até se desencostarem. Repete para resolver choques em cadeia.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < this.active.length; i++) {
        for (let j = i + 1; j < this.active.length; j++) {
          const a = this.active[i]!;
          const b = this.active[j]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const min = 2 * SHAPES_R;
          if (dist >= min) continue;
          const nx = dx / dist;
          const ny = dy / dist;
          const push = (min - dist) / 2;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const va = a.vx * nx + a.vy * ny;
          const vb = b.vx * nx + b.vy * ny;
          if (va - vb > 0) {
            a.vx += (vb - va) * nx;
            a.vy += (vb - va) * ny;
            b.vx += (va - vb) * nx;
            b.vy += (va - vb) * ny;
          }
        }
      }
    }
    for (const a of this.active) {
      a.x = Math.min(SHAPES_W - SHAPES_R, Math.max(SHAPES_R, a.x));
      a.y = Math.min(SHAPES_H - SHAPES_R, Math.max(SHAPES_R, a.y));
    }
  }
}
