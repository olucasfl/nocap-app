import { createRng, randInt } from '../core/rng';
import { BIG_WEIGHT, MICRO_MAX } from './micro';

/**
 * Caça-Formas Caótico (minijogo grande): peças aparecem, andam, batem umas nas outras e somem; o
 * jogo sorteia o que clicar e o que evitar. Tudo vem da seed: o servidor regenera o cronograma e
 * confere cada clique pelo horário em que ele chega; o movimento é só visual e igual para todos.
 */

export type ShapeKind =
  'circle' | 'triangle' | 'square' | 'rect' | 'diamond' | 'star' | 'hexagon' | 'cross';
export type ShapeColor = 'orange' | 'blue' | 'yellow' | 'green' | 'purple' | 'cyan';

export const SHAPE_KINDS: readonly ShapeKind[] = [
  'circle',
  'triangle',
  'square',
  'rect',
  'diamond',
  'star',
  'hexagon',
  'cross',
];
export const SHAPE_COLORS: readonly ShapeColor[] = [
  'orange',
  'blue',
  'yellow',
  'green',
  'purple',
  'cyan',
];

export const SHAPE_NAME: Record<ShapeKind, string> = {
  circle: 'círculos',
  triangle: 'triângulos',
  square: 'quadrados',
  rect: 'retângulos',
  diamond: 'losangos',
  star: 'estrelas',
  hexagon: 'hexágonos',
  cross: 'cruzes',
};
/** O nome da cor no plural feminino, para "peças ...". */
export const COLOR_LABEL: Record<ShapeColor, string> = {
  orange: 'laranja',
  blue: 'azuis',
  yellow: 'amarelas',
  green: 'verdes',
  purple: 'roxas',
  cyan: 'ciano',
};

export interface Matcher {
  shape?: ShapeKind;
  color?: ShapeColor;
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

export const SHAPES_ITEMS = 72;
export const SHAPES_STEP_MS = 450;
export const SHAPES_LIFE_MS = 2800;
export const SHAPES_DURATION_MS = SHAPES_ITEMS * SHAPES_STEP_MS;
/** Certo +60; proibido -120 (para não valer clicar em tudo); as outras peças não valem nada. */
export const POINTS_GOOD = 60;
export const POINTS_BAD = -120;
export const POINTS_NEUTRAL = 0;
/** Folga de rede: o clique pode chegar um pouco depois de a peça sumir. */
export const SHAPES_GRACE_MS = 500;

const matches = (m: Matcher, kind: ShapeKind, color: ShapeColor) =>
  (!m.shape || m.shape === kind) && (!m.color || m.color === color) && (!!m.shape || !!m.color);

export const classify = (
  round: Pick<ShapesRound, 'click' | 'avoid'>,
  kind: ShapeKind,
  color: ShapeColor,
): ShapeItem['cls'] => {
  // Se bate nas duas regras, a de evitar vence.
  if (matches(round.avoid, kind, color)) return 'bad';
  return matches(round.click, kind, color) ? 'good' : 'neutral';
};

export function shapesRound(seed: string): ShapesRound {
  const rng = createRng(`${seed}:shapes`);
  const byShape = rng() < 0.5;
  const click: Matcher = byShape
    ? { shape: SHAPE_KINDS[randInt(rng, 0, SHAPE_KINDS.length - 1)]! }
    : { color: SHAPE_COLORS[randInt(rng, 0, SHAPE_COLORS.length - 1)]! };
  // Evitar usa o outro atributo (ou o mesmo atributo com outro valor), nunca igual ao clicar.
  const avoid: Matcher = {};
  if (rng() < 0.7) {
    if (byShape) avoid.color = SHAPE_COLORS[randInt(rng, 0, SHAPE_COLORS.length - 1)]!;
    else avoid.shape = SHAPE_KINDS[randInt(rng, 0, SHAPE_KINDS.length - 1)]!;
  } else if (byShape) {
    const others = SHAPE_KINDS.filter((k) => k !== click.shape);
    avoid.shape = others[randInt(rng, 0, others.length - 1)]!;
  } else {
    const others = SHAPE_COLORS.filter((c) => c !== click.color);
    avoid.color = others[randInt(rng, 0, others.length - 1)]!;
  }

  // Proporção exata (33 certas, 21 proibidas, 18 inofensivas) em ordem embaralhada: toda partida
  // tem o mesmo "preço" para quem clica em tudo (saldo negativo).
  const plan: ShapeItem['cls'][] = [
    ...Array<ShapeItem['cls']>(33).fill('good'),
    ...Array<ShapeItem['cls']>(21).fill('bad'),
    ...Array<ShapeItem['cls']>(SHAPES_ITEMS - 54).fill('neutral'),
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

/** A regra em português, para o comando e o tutorial. */
export function matcherLabel(m: Matcher): string {
  if (m.shape && m.color) return `${SHAPE_NAME[m.shape]} ${COLOR_LABEL[m.color]}`;
  if (m.shape) return SHAPE_NAME[m.shape];
  return `peças ${COLOR_LABEL[m.color!]}`;
}

/**
 * Pontos de um clique: certo +100, proibido -200, outra peça 0. O servidor chama com o tempo (ms
 * desde o começo) em que o clique chegou; fora da janela da peça não vale.
 */
export function shapeClickPoints(round: ShapesRound, id: number, atMs: number): number | null {
  const item = round.items[id];
  if (!item) return null;
  if (atMs < item.at || atMs > item.at + item.life + SHAPES_GRACE_MS) return null;
  return item.cls === 'good' ? POINTS_GOOD : item.cls === 'bad' ? POINTS_BAD : POINTS_NEUTRAL;
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
