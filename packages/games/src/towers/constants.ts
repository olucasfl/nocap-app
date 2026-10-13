import type { BlockColor } from '../blocks/constants';

/**
 * Block Towers (spec 022): constantes e catálogo das peças. Unidades: 1 casa = 1 unidade, y para
 * baixo, tempo em segundos. Só o modo das 3 vidas existe por enquanto (solo, offline).
 */
export type TowersMode = 'vidas';
export const TOWERS_MODES: readonly TowersMode[] = ['vidas'];
export const isTowersMode = (m: unknown): m is TowersMode => m === 'vidas';

/** Passo fixo da simulação. */
export const TOWERS_DT = 1 / 60;
export const MAX_LIVES = 3;

// --- Mundo -----------------------------------------------------------------------------------
export const PLATFORM_W = 7;
export const PLATFORM_H = 1.6;
/** Metade da largura por onde a peça pode andar. */
export const FIELD_HALF = 8;
/** Abaixo disto (y) o que caiu está perdido. */
export const KILL_Y = 15;
/** Quanto acima do topo da torre a peça nasce. */
export const SPAWN_GAP = 13;

// --- Peça que desce --------------------------------------------------------------------------
export const FALL_BASE = 2.0;
export const FALL_PER_PIECE = 0.05;
export const FALL_MAX = 5;
export const SOFT_DROP = 13;
/** A peça anda de bloco em bloco (1 casa por passo); segurar repete devagar. */
export const MOVE_STEP = 1;
export const MOVE_FIRST_DELAY = 0.22;
export const MOVE_REPEAT = 0.12;
/** A peça fica livre depois de tanto tempo apoiada (e menos se a pessoa está acelerando). */
export const LAND_TIME = 0.4;
export const LAND_TIME_FAST = 0.12;
/** Pausa entre soltar uma peça e nascer a próxima. */
export const SPAWN_DELAY = 0.3;
/** Parada o bastante (velocidade e giro) por este tempo, a peça está assentada. */
export const SETTLE_TIME = 0.7;
export const SETTLE_SPEED = 0.25;
export const SETTLE_SPIN = 0.4;
/** Tempo entre a última vida e o fim, para a queda terminar de ser vista. */
export const OVER_DELAY = 1.6;
/** Várias peças caindo neste intervalo viram "caiu tudo". */
export const COLLAPSE_COUNT = 3;
export const COLLAPSE_WINDOW = 1.5;

// --- Magias ----------------------------------------------------------------------------------
/** A cada tantas peças soltas chega uma magia. */
export const SPELL_EVERY = 5;
export const MAX_HELD_SPELLS = 2;
export const GOOD_CHANCE = 0.5;

export type GoodSpell = 'vinha' | 'cimento' | 'desfazer' | 'vida';
export type BadSpell = 'gelo' | 'grande' | 'rapida' | 'nevoa' | 'gira' | 'semgiro';
export const GOOD_SPELLS: readonly GoodSpell[] = ['vinha', 'cimento', 'desfazer', 'vida'];
export const BAD_SPELLS: readonly BadSpell[] = ['gelo', 'grande', 'rapida', 'nevoa', 'gira', 'semgiro'];

/** Quantas peças cada magia ruim dura. */
export const BAD_DURATION: Record<BadSpell, number> = {
  gelo: 2,
  grande: 1,
  rapida: 3,
  nevoa: 3,
  gira: 2,
  semgiro: 3,
};
export const BIG_SCALE = 1.6;
export const ICE_FRICTION = 0.04;
export const NORMAL_FRICTION = 0.7;
export const FAST_FACTOR = 2;
export const AUTO_ROTATE_EVERY = 0.75;

// --- Peças -----------------------------------------------------------------------------------
export interface TowerKind {
  id: number;
  name: string;
  /** Casas [coluna, linha], com a primeira linha e a primeira coluna em 0. */
  cells: readonly (readonly [number, number])[];
  color: BlockColor;
}

export const TOWER_KINDS: readonly TowerKind[] = [
  { id: 0, name: 'I', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: 'azul' },
  { id: 1, name: 'O', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: 'amarelo' },
  { id: 2, name: 'T', cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: 'roxo' },
  { id: 3, name: 'S', cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: 'verde' },
  { id: 4, name: 'Z', cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: 'vermelho' },
  { id: 5, name: 'J', cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: 'laranja' },
  { id: 6, name: 'L', cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: 'rosa' },
];
