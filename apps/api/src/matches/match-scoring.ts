import { BadRequestException } from '@nestjs/common';
import {
  ECO_SCORE_VERSION,
  COLOR_SCORE_VERSION,
  TIME_SCORE_VERSION,
  colorDailySettings,
  colorGame,
  colorDeltaE,
  ecoPresets,
  ecoTenths,
  encodeAnswer,
  evaluateRun,
  evaluateSurvival,
  generateTimeRound,
  isPlausibleAnswer,
  minDurationMs,
  scoreFromDeltaE,
  scoreTime,
  timePresets,
} from '@nocap/games';
import type { ColorMatchInput, EcoMatchInput, TimeMatchInput } from './match.schema';

export interface ScoredMatch {
  rounds: { score: number; deltaE?: number }[];
  /** Soma das notas, com 1 casa (0 a 50 em 5 rodadas). */
  total: number;
  /** Mesma soma em décimos (inteiro), formato de armazenamento. */
  totalTenths: number;
  /** Respostas no formato do banco (Cor: h*10000 + s*100 + b; Tempo: ms). */
  encodedAnswers: number[];
  settings: Record<string, number | boolean | string>;
}

/**
 * Sobrevivência: a nota guardada é quantas rodadas a pessoa jogou (em décimos, 7 rodadas = 70).
 * Só vale uma partida completa: as vidas acabaram na última resposta (ou chegou ao limite).
 */
function survivalTenths(game: 'color' | 'time', scores: number[]): number {
  const state = evaluateSurvival(game, scores);
  if (state.ended === null || state.played !== scores.length) {
    throw new BadRequestException('A sobrevivência enviada não terminou (ou tem rodadas a mais)');
  }
  return state.played * 10;
}

/** Folga entre o relógio do servidor e a soma dos tempos (rede, arredondamento). */
export const ELAPSED_SLACK_MS = 1500;

/**
 * Regenera as rodadas pela seed e recalcula as notas. Nunca confia em nota vinda do cliente.
 */
export function scoreMatch(
  input: Pick<ColorMatchInput, 'mode' | 'seed' | 'answers'> & { kind?: 'solo' | 'daily' },
): ScoredMatch {
  const settings = input.kind === 'daily' ? colorDailySettings : colorGame.presets[input.mode];
  if (!settings) {
    throw new BadRequestException(`Modo desconhecido: ${input.mode}`);
  }
  if (!settings.survival && input.answers.length !== settings.rounds) {
    throw new BadRequestException(
      `O modo ${input.mode} tem ${settings.rounds} rodadas, mas vieram ${input.answers.length} respostas`,
    );
  }

  const rounds = input.answers.map((answer, index) => {
    const target = colorGame.generateRound(input.seed, settings, index);
    const deltaE = colorDeltaE(target, answer);
    return { score: scoreFromDeltaE(deltaE), deltaE };
  });

  const totalTenths = settings.survival
    ? survivalTenths(
        'color',
        rounds.map((r) => r.score),
      )
    : rounds.reduce((sum, r) => sum + Math.round(r.score * 10), 0);
  return {
    rounds,
    total: totalTenths / 10,
    totalTenths,
    encodedAnswers: input.answers.map(encodeAnswer),
    settings: { ...settings, scoreVersion: COLOR_SCORE_VERSION },
  };
}

/**
 * Nota do Tempo a partir dos ms medidos no aparelho. Recusa o que não é plausível (brief #6):
 * duração fora do razoável para o alvo, ou respostas que somam mais do que o tempo que o
 * servidor viu passar desde o início da sessão.
 */
export function scoreTimeMatch(
  input: Pick<TimeMatchInput, 'mode' | 'seed' | 'answers'> & { elapsedMs: number },
): ScoredMatch {
  const settings = timePresets[input.mode];
  if (!settings) {
    throw new BadRequestException(`Modo desconhecido: ${input.mode}`);
  }
  if (!settings.survival && input.answers.length !== settings.rounds) {
    throw new BadRequestException(
      `O modo ${input.mode} tem ${settings.rounds} rodadas, mas vieram ${input.answers.length} respostas`,
    );
  }

  const rounds = input.answers.map((answer, index) => {
    const target = generateTimeRound(input.seed, settings, index);
    if (!isPlausibleAnswer(target, answer)) {
      throw new BadRequestException('Tempo da rodada fora do plausível');
    }
    return { score: scoreTime(target, answer, settings) };
  });

  const counted = input.answers.reduce((a, b) => a + b, 0);
  if (counted > input.elapsedMs + ELAPSED_SLACK_MS) {
    throw new BadRequestException('Os tempos somam mais do que o tempo da partida');
  }

  const totalTenths = settings.survival
    ? survivalTenths(
        'time',
        rounds.map((r) => r.score),
      )
    : rounds.reduce((sum, r) => sum + Math.round(r.score * 10), 0);
  return {
    rounds,
    total: totalTenths / 10,
    totalTenths,
    encodedAnswers: [...input.answers],
    settings: { ...settings, scoreVersion: TIME_SCORE_VERSION },
  };
}

/**
 * Eco: o servidor repassa os toques contra a sequência da seed e conta os passos. Recusa o que não
 * é plausível: toques depois do fim da partida, ou uma partida mais rápida do que o mínimo que a
 * reprodução e o tempo de tocar permitem (a sessão assinada diz quando ela começou).
 */
export function scoreEcoMatch(
  input: Pick<EcoMatchInput, 'mode' | 'seed' | 'taps'> & { elapsedMs: number },
): ScoredMatch {
  const settings = (ecoPresets as Record<string, (typeof ecoPresets)['classic']>)[input.mode];
  if (!settings) {
    throw new BadRequestException(`Modo desconhecido: ${input.mode}`);
  }
  const maxPad = settings.maxPads - 1;
  if (input.taps.some((t) => t > maxPad)) {
    throw new BadRequestException('Botão inexistente neste modo');
  }

  const run = evaluateRun(input.seed, settings, input.taps);
  if (run.usedTaps !== input.taps.length) {
    throw new BadRequestException('Há toques depois do fim da partida');
  }
  if (input.elapsedMs + ELAPSED_SLACK_MS < minDurationMs(settings, run)) {
    throw new BadRequestException('A partida foi rápida demais para ser verdade');
  }

  const totalTenths = ecoTenths(run);
  return {
    rounds: [],
    total: totalTenths / 10,
    totalTenths,
    encodedAnswers: [...input.taps],
    settings: { ...settings, scoreVersion: ECO_SCORE_VERSION },
  };
}
