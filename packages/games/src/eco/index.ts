import { createRng, randInt } from '../core/rng';

/**
 * Eco: repita a sequência de botões (spec 012). Lógica pura e determinística: o servidor
 * regenera a sequência pela seed e repassa os toques; o cliente nunca diz "acertei".
 */

export const ECO_MIN_PADS = 4;
export const ECO_MAX_PADS = 9;
/** Teto de passos: quem completa o 40º vence ("Eco perfeito"). */
export const ECO_MAX_STEPS = 40;
/** Ficar este tempo sem tocar encerra a partida. */
export const ECO_TAP_TIMEOUT_MS = 8000;
/** Pausa ("OBSERVE") antes de cada reprodução. */
export const ECO_PAUSE_MS = 600;
/** Menos que isto por toque nenhuma pessoa consegue (quem toca rápido numa sequência longa chega perto): limite inferior do plausível. */
export const ECO_MIN_TAP_MS = 60;

export type EcoMode = 'classic' | 'escalada' | 'velocidade' | 'reverso';
export const ECO_MODES: readonly EcoMode[] = ['classic', 'escalada', 'velocidade', 'reverso'];

export interface EcoSettings {
  /** Botões no começo da partida. */
  pads: number;
  /** Entra mais um botão a cada tanto de rodadas (0 = nunca). */
  growEvery: number;
  maxPads: number;
  /** Ritmo da reprodução: ms por passo (aceso + pausa). */
  stepMs: number;
  /** Quanto o ritmo encurta a cada rodada (0 = constante). */
  speedUpMs: number;
  /** O ritmo nunca fica mais rápido que isto. */
  minStepMs: number;
  /** Tamanho da sequência na rodada 1. */
  startLength: number;
  /** Reverso: repete de trás para frente. */
  reverse: boolean;
  maxSteps: number;
}

const BASE: EcoSettings = {
  pads: 4,
  growEvery: 0,
  maxPads: 4,
  stepMs: 700,
  speedUpMs: 0,
  minStepMs: 700,
  startLength: 1,
  reverse: false,
  maxSteps: ECO_MAX_STEPS,
};

/** Modos padrão (os únicos que contam para ranking). O Daily é o Clássico com a seed do dia. */
export const ecoPresets: Record<EcoMode, EcoSettings> = {
  classic: { ...BASE },
  /** Começa com 4 botões e ganha mais um a cada 3 rodadas, até 9 (na rodada 16); depois segue só com 9. */
  escalada: { ...BASE, growEvery: 3, maxPads: ECO_MAX_PADS },
  /**
   * Difícil, mas possível: o ritmo começa em 700 ms por passo, encurta 28 ms a cada rodada e chega
   * a 170 ms (botão aceso por ~110 ms) na rodada 20, onde fica. A rodada 20 é tão difícil quanto
   * era a 13 na primeira versão. O modo vai até 30 passos (o teto dos outros é 40).
   */
  velocidade: { ...BASE, stepMs: 700, speedUpMs: 28, minStepMs: 170, maxSteps: 30 },
  /** Você vê na ordem e repete de trás para frente; começa com 2 passos. */
  reverso: { ...BASE, startLength: 2, reverse: true },
};

export const ECO_SCORE_VERSION = 1;

/** Quantas rodadas a partida tem no máximo (a última tem `maxSteps` passos). */
export function maxRounds(s: EcoSettings): number {
  return s.maxSteps - s.startLength + 1;
}

/** Tamanho da sequência da rodada `round` (1, 2, 3...). */
export function lengthAt(s: EcoSettings, round: number): number {
  return s.startLength + round - 1;
}

/** Quantos botões estão em jogo na rodada `round`. */
export function padsAt(s: EcoSettings, round: number): number {
  if (s.growEvery <= 0) return s.pads;
  return Math.min(s.maxPads, s.pads + Math.floor((round - 1) / s.growEvery));
}

/** Ritmo da reprodução na rodada `round`, em ms por passo. */
export function stepMsAt(s: EcoSettings, round: number): number {
  return Math.max(s.minStepMs, s.stepMs - s.speedUpMs * (round - 1));
}

/** A primeira rodada em que o passo `index` (0, 1, 2...) já existe. */
function roundOfStep(s: EcoSettings, index: number): number {
  return Math.max(1, index + 2 - s.startLength);
}

/**
 * O passo `index` da sequência. Usa os botões que existiam na rodada em que ele entrou, então a
 * sequência só cresce no fim: o começo dela nunca muda de uma rodada para a outra.
 */
export function stepAt(seed: string, s: EcoSettings, index: number): number {
  const rng = createRng(`${seed}:eco:${index}`);
  return randInt(rng, 0, padsAt(s, roundOfStep(s, index)) - 1);
}

/** A sequência mostrada na rodada `round`. */
export function sequenceFor(seed: string, s: EcoSettings, round: number): number[] {
  return Array.from({ length: lengthAt(s, round) }, (_, i) => stepAt(seed, s, i));
}

/** O que a pessoa precisa tocar na rodada: a mesma sequência, ou ao contrário no Reverso. */
export function expectedTaps(seed: string, s: EcoSettings, round: number): number[] {
  const seq = sequenceFor(seed, s, round);
  return s.reverse ? seq.reverse() : seq;
}

export type EcoEnd = 'wrong' | 'timeout' | 'perfect';

export interface EcoRun {
  /** Rodadas completas. */
  completed: number;
  /** Passos da maior sequência repetida (0 se errou na primeira). */
  steps: number;
  /** Como acabou: errou um botão, parou de tocar, ou chegou ao teto. */
  ended: EcoEnd;
  /** Toques que contam: depois do fim da partida não pode haver mais nenhum. */
  usedTaps: number;
  /** Rodadas que chegaram a ser mostradas (a da queda conta: a reprodução já passou). */
  roundsShown: number;
}

/**
 * Repassa os toques contra a sequência da seed. Rodada a rodada: os próximos `L` toques precisam
 * ser os esperados. O primeiro toque errado encerra a partida.
 */
export function evaluateRun(seed: string, s: EcoSettings, taps: readonly number[]): EcoRun {
  const total = maxRounds(s);
  let pos = 0;
  let completed = 0;
  for (let round = 1; round <= total; round++) {
    const expected = expectedTaps(seed, s, round);
    for (let i = 0; i < expected.length; i++) {
      if (pos >= taps.length) {
        // Parou de tocar no meio da rodada (ou logo depois de fechar a anterior).
        return finish(s, completed, 'timeout', pos, round);
      }
      if (taps[pos] !== expected[i]) {
        return finish(s, completed, 'wrong', pos + 1, round);
      }
      pos++;
    }
    completed = round;
  }
  return finish(s, completed, 'perfect', pos, total);
}

function finish(
  s: EcoSettings,
  completed: number,
  ended: EcoEnd,
  usedTaps: number,
  roundsShown: number,
): EcoRun {
  return {
    completed,
    steps: completed === 0 ? 0 : lengthAt(s, completed),
    ended,
    usedTaps,
    roundsShown,
  };
}

/** Pontuação guardada: passos concluídos em décimos (12 passos = 120), como a Sobrevivência. */
export const ecoTenths = (run: EcoRun): number => run.steps * 10;

/**
 * O mínimo de tempo que uma partida com esta duração de reprodução e estes toques leva: tudo o que
 * foi mostrado mais o tempo de tocar. Abaixo disso a partida não aconteceu de verdade.
 */
export function minDurationMs(s: EcoSettings, run: EcoRun): number {
  let ms = run.usedTaps * ECO_MIN_TAP_MS;
  for (let round = 1; round <= run.roundsShown; round++) {
    ms += ECO_PAUSE_MS + lengthAt(s, round) * stepMsAt(s, round);
  }
  return ms;
}

/** Tempo da partida em ms só para mostrar; as telas usam o mesmo ritmo do servidor. */
export function playbackMs(s: EcoSettings, round: number): number {
  return lengthAt(s, round) * stepMsAt(s, round);
}


export * from './leader';
