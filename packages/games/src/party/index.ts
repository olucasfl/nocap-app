import { createRng } from '../core/rng';
import { ECO_PAUSE_MS } from '../eco';
import {
  ECO_MICRO_STEP_MS,
  PAD_NAMES,
  typingPickMs,
  ecoChallenge,
  noteToPoints,
  timeChallenge,
} from './micro';
import { POINTS_BAD, POINTS_GOOD, SHAPES_DURATION_MS, matcherLabel, shapesRound } from './shapes';
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
    { id: 'standard', weight: 66 },
    { id: 'inverted', weight: 12 },
    { id: 'blind', weight: 12 },
    { id: 'wait', weight: 10 },
  ],
  time: [
    { id: 'standard', weight: 55 },
    { id: 'falso', weight: 12 },
    { id: 'cego', weight: 12 },
    { id: 'noover', weight: 11 },
    { id: 'quieto', weight: 10 },
  ],
  eco: [
    { id: 'standard', weight: 55 },
    { id: 'reverse', weight: 12 },
    { id: 'forbidden', weight: 13 },
    { id: 'oddonly', weight: 10 },
    { id: 'swap', weight: 10 },
  ],
  typing: [
    { id: 'standard', weight: 40 },
    { id: 'maohoba', weight: 10 },
    { id: 'reverse', weight: 9 },
    { id: 'novowels', weight: 7 },
    { id: 'noaccents', weight: 7 },
    { id: 'noa', weight: 7 },
    { id: 'count', weight: 7 },
    { id: 'ends', weight: 7 },
    { id: 'twice', weight: 6 },
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
 * sorteado a cada rodada). Com mais de um jogo disponível, todos aparecem em cada rodada e
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
  let lastBig: BigGame | null = null;
  const bigs: BigGame[] = ['shapes', 'x1'];
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
    // Minijogo grande sorteado: nunca o mesmo duas vezes seguidas, e a ordem muda a cada partida.
    const options = bigs.filter((b) => b !== lastBig);
    const big = options[Math.floor(rng() * options.length)]!;
    lastBig = big;
    plan.push({
      kind: 'big',
      game: big,
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
      if (v === 'wait') return 'NÃO TRAVE A COR. Espere o tempo acabar';
      return v === 'inverted'
        ? 'Deixe a cor o mais DIFERENTE possível'
        : 'Deixe a cor o mais parecida possível';
    case 'time': {
      if (v === 'falso') {
        const c = timeChallenge(slot);
        return `O relógio está ${c.pct}% mais ${c.fast ? 'rápido' : 'lento'}. Pare quando ele marcar o alvo`;
      }
      if (v === 'noover') return 'Pare no tempo do alvo, mas SEM PASSAR: passou, perde pontos';
      if (v === 'quieto') return 'NÃO APERTE NADA. Espere o tempo acabar';
      return v === 'cego'
        ? 'Pare no tempo exato do alvo. O relógio some depois de 1 segundo'
        : 'Pare no tempo exato do alvo';
    }
    case 'eco': {
      if (v === 'reverse') return 'Faça a sequência de trás para frente';
      if (v === 'oddonly') return 'Repita só os passos ÍMPARES (1º, 3º, 5º...)';
      if (v === 'swap')
        return 'Repita trocando esquerda e direita (laranja com azul, amarelo com verde)';
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
            count: 'Digite QUANTAS letras tem a palavra',
            ends: 'Digite só a primeira e a última letra',
            twice: 'Digite a palavra DUAS vezes, sem espaço',
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
      `Peças andam, batem umas nas outras e somem por ${Math.round(SHAPES_DURATION_MS / 1000)} segundos.`,
      `CLIQUE em ${matcherLabel(r.click)} (+${POINTS_GOOD}).`,
      `EVITE ${matcherLabel(r.avoid)} (${POINTS_BAD}).`,
      'Qualquer outra peça não vale nada. Cada cor tem uma letra e um padrão: leia a regra com calma.',
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
      return { showMs: colorShowMs(slot.variant), pickMs: slot.variant === 'wait' ? 8000 : 14_000 };
    case 'time': {
      const c = timeChallenge(slot);
      return {
        showMs: 3000,
        pickMs:
          slot.variant === 'quieto'
            ? 7000
            : Math.min(20_000, Math.round(c.expectedMs * 1.6) + 4000),
      };
    }
    case 'eco': {
      const c = ecoChallenge(slot);
      return {
        showMs: ECO_PAUSE_MS + c.sequence.length * ECO_MICRO_STEP_MS,
        pickMs: Math.min(18_000, c.expected.length * 900 + 4000),
      };
    }
    case 'typing':
      return {
        showMs: 1500,
        pickMs: typingPickMs(slot),
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
