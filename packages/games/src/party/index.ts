import { createRng } from '../core/rng';

/**
 * NoCap! (spec 016): party game de micro-desafios e minijogos grandes. Lógica pura e
 * determinística: o servidor monta o plano pela seed, valida as respostas e calcula os pontos.
 */

export const PARTY_MIN_ROUNDS = 1;
export const PARTY_MAX_ROUNDS = 5;
/** Quantos micro-desafios rápidos vêm antes de cada minijogo grande. */
export const PARTY_MICRO_PER_ROUND = 5;

/** Pontos máximos de um micro-desafio. O minijogo grande vale `BIG_WEIGHT` vezes isto. */
export const MICRO_MAX = 1000;
export const BIG_WEIGHT = 2;

export type MicroGame = 'color';
export type BigGame = 'tap';

/** Desafios já implementados (os outros entram nas próximas fases do plano). */
export const ENABLED_MICRO: readonly MicroGame[] = ['color'];

export type ColorVariant = 'standard' | 'inverted' | 'blind';

export interface MicroSlot {
  kind: 'micro';
  game: MicroGame;
  variant: ColorVariant;
  seed: string;
  /** Rodada (1...) e posição dentro da rodada (1 a 5). */
  round: number;
  position: number;
}

export interface BigSlot {
  kind: 'big';
  game: BigGame;
  seed: string;
  round: number;
}

export type Slot = MicroSlot | BigSlot;

/** Sorteio de variante: ~80% normal, ~10% e ~10% de pegadinhas (spec 016, seção 3). */
function drawColorVariant(rng: () => number): ColorVariant {
  const r = rng();
  return r < 0.8 ? 'standard' : r < 0.9 ? 'inverted' : 'blind';
}

/**
 * O plano da partida: por rodada, 5 micro-desafios e 1 minijogo grande. Com mais de um jogo
 * disponível, todos aparecem e nunca o mesmo duas vezes seguidas.
 */
export function buildPlan(
  seed: string,
  rounds: number,
  enabled: readonly MicroGame[] = ENABLED_MICRO,
): Slot[] {
  const rng = createRng(`${seed}:party-plan`);
  const plan: Slot[] = [];
  let last: MicroGame | null = null;
  for (let round = 1; round <= rounds; round++) {
    for (let position = 1; position <= PARTY_MICRO_PER_ROUND; position++) {
      const options = enabled.filter((g) => g !== last || enabled.length === 1);
      const game = options[Math.floor(rng() * options.length)]!;
      last = game;
      plan.push({
        kind: 'micro',
        game,
        variant: drawColorVariant(rng),
        seed: `${seed}:r${round}:m${position}`,
        round,
        position,
      });
    }
    plan.push({ kind: 'big', game: 'tap', seed: `${seed}:r${round}:big`, round });
  }
  return plan;
}

/** O comando do desafio: sempre no mesmo estilo e no mesmo lugar (a pegadinha está em ler com pressa). */
export function commandText(slot: Slot): string {
  if (slot.kind === 'big') return 'Toque o botão o mais rápido que conseguir';
  switch (slot.variant) {
    case 'inverted':
      return 'Deixe a cor o mais DIFERENTE possível';
    case 'blind':
      return 'Deixe a cor o mais parecida possível';
    default:
      return 'Deixe a cor o mais parecida possível';
  }
}

// ---- Mesmíssima ----

/** Quanto tempo o alvo fica à vista (o "às cegas" mostra só 1,5 s). */
export const colorShowMs = (variant: ColorVariant): number => (variant === 'blind' ? 1500 : 3000);

/** Nota 10 vale 1000 pontos; linear a partir da nota 5 (nota 5 ou menos vale 0). */
export function noteToPoints(note: number): number {
  return Math.round(Math.max(0, (note - 5) / 5) * MICRO_MAX);
}

/**
 * Pontos de um micro-desafio da Mesmíssima. No Invertido, quanto mais longe melhor; e acertar
 * perto demais tira pontos (até -500), então o total pode ficar negativo.
 */
export function colorPoints(variant: ColorVariant, note: number): number {
  if (variant === 'inverted') {
    const penalty = note > 6 ? Math.round(((note - 6) / 4) * 500) : 0;
    return noteToPoints(10 - note) - penalty;
  }
  return noteToPoints(note);
}

// ---- Minijogo grande provisório: Toque Toque ----

export const TAP_MS = 10_000;
/** Mais rápido que isto entre dois toques não conta (limite humano e anti-robô). */
export const TAP_MIN_GAP_MS = 40;
/** Toques que valem o máximo de pontos. */
export const TAP_FULL = 80;

export function tapPoints(count: number): number {
  return Math.round((Math.min(count, TAP_FULL) / TAP_FULL) * MICRO_MAX * BIG_WEIGHT);
}
