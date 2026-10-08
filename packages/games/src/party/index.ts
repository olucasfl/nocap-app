import { createRng } from '../core/rng';
import { ECO_PAUSE_MS } from '../eco';
import {
  ECO_MICRO_STEP_MS,
  PAD_NAMES,
  TYPING_PICK_MS,
  TYPING_TRAP_MS,
  ecoChallenge,
  noteToPoints,
  timeChallenge,
} from './micro';
import { SHAPES_DURATION_MS, matcherLabel, shapesRound } from './shapes';
import { X1_LEAD_TO_WIN, X1_MAX_ROUNDS } from './x1';

export * from './micro';
export * from './shapes';
export * from './words';
export * from './x1';

/**
 * NoCap! (spec 016): party game de micro-desafios e minijogos grandes. Lógica pura e
 * determinística: o servidor monta o plano pela seed, valida as respostas e calcula os pontos.
 */

export const PARTY_MIN_ROUNDS = 1;
export const PARTY_MAX_ROUNDS = 5;
/** Quantos micro-desafios rápidos vêm antes de cada minijogo grande. */
export const PARTY_MICRO_PER_ROUND = 5;

export type MicroGame = 'color' | 'time' | 'eco' | 'typing';
export type BigGame = 'shapes' | 'x1';

export const ENABLED_MICRO: readonly MicroGame[] = ['color', 'time', 'eco', 'typing'];

export type ColorVariant = 'standard' | 'inverted' | 'blind';

export interface MicroSlot {
  kind: 'micro';
  game: MicroGame;
  /** Cada jogo tem as suas variantes (ver `VARIANTS`). */
  variant: string;
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

/** Sorteio de variante: ~80% normal e ~20% de pegadinhas (spec 016, seção 3). */
export const VARIANTS: Record<MicroGame, { id: string; weight: number }[]> = {
  color: [
    { id: 'standard', weight: 80 },
    { id: 'inverted', weight: 10 },
    { id: 'blind', weight: 10 },
  ],
  time: [
    { id: 'standard', weight: 80 },
    { id: 'falso', weight: 10 },
    { id: 'cego', weight: 10 },
  ],
  eco: [
    { id: 'standard', weight: 80 },
    { id: 'reverse', weight: 10 },
    { id: 'forbidden', weight: 10 },
  ],
  typing: [
    { id: 'standard', weight: 72 },
    { id: 'maohoba', weight: 8 },
    { id: 'reverse', weight: 8 },
    { id: 'novowels', weight: 4 },
    { id: 'noaccents', weight: 4 },
    { id: 'noa', weight: 4 },
  ],
};

function drawVariant(game: MicroGame, rng: () => number): string {
  const list = VARIANTS[game];
  const total = list.reduce((s, v) => s + v.weight, 0);
  let r = rng() * total;
  for (const v of list) {
    r -= v.weight;
    if (r < 0) return v.id;
  }
  return list[0]!.id;
}

/**
 * O plano da partida: por rodada, 5 micro-desafios e 1 minijogo grande (Caça-Formas nas rodadas
 * ímpares, Arena X1 nas pares). Com mais de um jogo disponível, todos aparecem em cada rodada e
 * nunca o mesmo jogo duas vezes seguidas.
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
    // Os jogos da rodada: todos uma vez, mais um extra sorteado; embaralha até não repetir em seguida.
    let order: MicroGame[] = [];
    for (let tries = 0; tries < 80; tries++) {
      const pool: MicroGame[] = [...enabled];
      while (pool.length < PARTY_MICRO_PER_ROUND) {
        pool.push(enabled[Math.floor(rng() * enabled.length)]!);
      }
      pool.length = PARTY_MICRO_PER_ROUND;
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j]!, pool[i]!];
      }
      order = pool;
      const clash = pool.some((g, i) => g === (i === 0 ? last : pool[i - 1]));
      if (!clash || enabled.length === 1) break;
    }
    order.forEach((game, i) => {
      plan.push({
        kind: 'micro',
        game,
        variant: drawVariant(game, rng),
        seed: `${seed}:r${round}:m${i + 1}`,
        round,
        position: i + 1,
      });
    });
    last = order[order.length - 1]!;
    plan.push({
      kind: 'big',
      game: round % 2 === 1 ? 'shapes' : 'x1',
      seed: `${seed}:r${round}:big`,
      round,
    });
  }
  return plan;
}

// ---- comando (sempre no mesmo estilo e lugar; a pegadinha está em ler com pressa) ----

export function commandText(slot: Slot): string {
  if (slot.kind === 'big') {
    if (slot.game === 'x1') return 'Clique no botão verde antes do adversário';
    const r = shapesRound(slot.seed);
    return `Clique em ${matcherLabel(r.click)}. Evite ${matcherLabel(r.avoid)}`;
  }
  const v = slot.variant;
  switch (slot.game) {
    case 'color':
      return v === 'inverted'
        ? 'Deixe a cor o mais DIFERENTE possível'
        : 'Deixe a cor o mais parecida possível';
    case 'time': {
      if (v === 'falso') {
        const c = timeChallenge(slot);
        return `O relógio está ${c.pct}% mais ${c.fast ? 'rápido' : 'lento'}. Pare quando ele marcar o alvo`;
      }
      return v === 'cego'
        ? 'Pare no tempo exato do alvo. O relógio some depois de 1 segundo'
        : 'Pare no tempo exato do alvo';
    }
    case 'eco': {
      if (v === 'reverse') return 'Faça a sequência de trás para frente';
      if (v === 'forbidden') {
        const c = ecoChallenge(slot);
        return `Repita a sequência e ignore o botão ${PAD_NAMES[c.forbidden ?? 0]}`;
      }
      return 'Repita a sequência';
    }
    case 'typing':
      return (
        (
          {
            maohoba: 'MANTENHA O CAMPO LIMPO',
            reverse: 'Digite a palavra de trás para frente',
            novowels: 'Digite a palavra sem vogais',
            noaccents: 'Digite a palavra sem acentos',
            noa: 'Digite a palavra sem a letra A',
          } as Record<string, string>
        )[v] ?? 'Digite a palavra exata'
      );
  }
}

/** O quadro do tutorial de cada minijogo grande. */
export function bigInfo(slot: BigSlot): { title: string; lines: string[] } {
  if (slot.game === 'x1') {
    return {
      title: 'ARENA X1',
      lines: [
        'Duelos de reflexo, um contra um, ao mesmo tempo. Quem sobra de fora enfrenta o Bot NoCap.',
        'Surge um botão verde em um ponto qualquer: quem clicar primeiro ganha 1 ponto e o outro perde 1.',
        `Vence quem abrir ${X1_LEAD_TO_WIN} pontos de diferença. Em ${X1_MAX_ROUNDS} disparos sem vencedor, empate.`,
        'Clicar antes de o botão aparecer perde o disparo. Vitória vale o dobro de um desafio.',
      ],
    };
  }
  const r = shapesRound(slot.seed);
  return {
    title: 'CAÇA-FORMAS CAÓTICO',
    lines: [
      `Peças aparecem e somem por ${Math.round(SHAPES_DURATION_MS / 1000)} segundos.`,
      `CLIQUE em ${matcherLabel(r.click)} (+100).`,
      `EVITE ${matcherLabel(r.avoid)} (-150).`,
      'Qualquer outra peça tira 50. Cuidado com formas parecidas: retângulo não é quadrado.',
    ],
  };
}

// ---- tempos de cada desafio (ms) ----

export interface MicroTiming {
  /** Fase de ver o desafio (alvo, sequência, palavra). */
  showMs: number;
  /** Fase de responder. */
  pickMs: number;
}

export function colorShowMs(variant: string): number {
  return variant === 'blind' ? 1500 : 3000;
}

export function microTiming(slot: MicroSlot): MicroTiming {
  switch (slot.game) {
    case 'color':
      return { showMs: colorShowMs(slot.variant), pickMs: 20_000 };
    case 'time': {
      const c = timeChallenge(slot);
      return { showMs: 3000, pickMs: Math.min(30_000, Math.round(c.expectedMs * 2.2) + 6000) };
    }
    case 'eco': {
      const c = ecoChallenge(slot);
      return {
        showMs: ECO_PAUSE_MS + c.sequence.length * ECO_MICRO_STEP_MS,
        pickMs: Math.min(30_000, c.expected.length * 1400 + 5000),
      };
    }
    case 'typing':
      return {
        showMs: 1500,
        pickMs: slot.variant === 'maohoba' ? TYPING_TRAP_MS : TYPING_PICK_MS,
      };
  }
}

// ---- Mesmíssima ----

/**
 * Pontos de um micro-desafio da Mesmíssima. No Invertido, quanto mais longe melhor; e acertar
 * perto demais tira pontos (até -500), então o total pode ficar negativo.
 */
export function colorPoints(variant: string, note: number): number {
  if (variant === 'inverted') {
    const penalty = note > 6 ? Math.round(((note - 6) / 4) * 500) : 0;
    return noteToPoints(10 - note) - penalty;
  }
  return noteToPoints(note);
}
