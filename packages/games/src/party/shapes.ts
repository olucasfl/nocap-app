import { createRng, randInt } from '../core/rng';
import { BIG_WEIGHT, MICRO_MAX } from './micro';

/**
 * Caça-Formas Caótico (minijogo grande): peças aparecem e somem; o jogo sorteia o que clicar e o
 * que evitar. Tudo vem da seed: o servidor regenera o cronograma e confere cada clique pelo
 * horário em que ele chega.
 */

export type ShapeKind = 'circle' | 'triangle' | 'square' | 'rect';
export type ShapeColor = 'orange' | 'blue' | 'yellow' | 'green';

export const SHAPE_KINDS: readonly ShapeKind[] = ['circle', 'triangle', 'square', 'rect'];
export const SHAPE_COLORS: readonly ShapeColor[] = ['orange', 'blue', 'yellow', 'green'];

export const SHAPE_NAME: Record<ShapeKind, string> = {
  circle: 'círculos',
  triangle: 'triângulos',
  square: 'quadrados',
  rect: 'retângulos',
};
export const COLOR_NAME: Record<ShapeColor, string> = {
  orange: 'laranja',
  blue: 'azul',
  yellow: 'amarelas',
  green: 'verdes',
};
/** Nome no feminino ou masculino conforme o "peças ...". */
export const COLOR_LABEL: Record<ShapeColor, string> = {
  orange: 'laranja',
  blue: 'azuis',
  yellow: 'amarelas',
  green: 'verdes',
};

export interface Matcher {
  shape?: ShapeKind;
  color?: ShapeColor;
}

export interface ShapeItem {
  id: number;
  kind: ShapeKind;
  color: ShapeColor;
  /** Posição em % da área de jogo. */
  x: number;
  y: number;
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

export const SHAPES_ITEMS = 40;
export const SHAPES_STEP_MS = 800;
export const SHAPES_LIFE_MS = 2200;
export const SHAPES_DURATION_MS = SHAPES_ITEMS * SHAPES_STEP_MS;
/** Clique em peça que não importa custa pouco, para não valer clicar em tudo. */
export const POINTS_GOOD = 100;
export const POINTS_BAD = -150;
export const POINTS_NEUTRAL = -50;
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
    ? { shape: SHAPE_KINDS[randInt(rng, 0, 3)]! }
    : { color: SHAPE_COLORS[randInt(rng, 0, 3)]! };
  // Evitar usa o outro atributo (ou o mesmo atributo com outro valor), nunca igual ao clicar.
  const avoid: Matcher = {};
  if (rng() < 0.7) {
    if (byShape) avoid.color = SHAPE_COLORS[randInt(rng, 0, 3)]!;
    else avoid.shape = SHAPE_KINDS[randInt(rng, 0, 3)]!;
  } else if (byShape) {
    const others = SHAPE_KINDS.filter((k) => k !== click.shape);
    avoid.shape = others[randInt(rng, 0, others.length - 1)]!;
  } else {
    const others = SHAPE_COLORS.filter((c) => c !== click.color);
    avoid.color = others[randInt(rng, 0, others.length - 1)]!;
  }

  const items: ShapeItem[] = [];
  for (let i = 0; i < SHAPES_ITEMS; i++) {
    // Metade boa, um quarto proibida, um quarto neutra (para enganar).
    const r = rng();
    const want: ShapeItem['cls'] = r < 0.5 ? 'good' : r < 0.75 ? 'bad' : 'neutral';
    let kind: ShapeKind = SHAPE_KINDS[0]!;
    let color: ShapeColor = SHAPE_COLORS[0]!;
    for (let tries = 0; tries < 60; tries++) {
      kind = SHAPE_KINDS[randInt(rng, 0, 3)]!;
      color = SHAPE_COLORS[randInt(rng, 0, 3)]!;
      if (classify({ click, avoid }, kind, color) === want) break;
    }
    items.push({
      id: i,
      kind,
      color,
      x: randInt(rng, 10, 90),
      y: randInt(rng, 12, 88),
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
 * Pontos de um clique: certo +100, proibido -150, neutro -50. O servidor chama com o tempo (ms
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
