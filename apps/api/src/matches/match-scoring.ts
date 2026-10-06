import { BadRequestException } from '@nestjs/common';
import {
  COLOR_SCORE_VERSION,
  colorGame,
  colorDeltaE,
  encodeAnswer,
  scoreFromDeltaE,
} from '@nocap/games';
import type { CreateMatchInput } from './match.schema';

export interface ScoredMatch {
  rounds: { score: number; deltaE: number }[];
  /** Soma das notas, com 1 casa (0 a 50 na Cor). */
  total: number;
  /** Mesma soma em décimos (inteiro), formato de armazenamento. */
  totalTenths: number;
  /** Respostas no formato do banco (h*10000 + s*100 + b). */
  encodedAnswers: number[];
  settings: { rounds: number; showMs: number; scoreVersion: number };
}

/**
 * Regenera as rodadas pela seed e recalcula as notas. Nunca confia em nota vinda do cliente.
 */
export function scoreMatch(
  input: Pick<CreateMatchInput, 'mode' | 'seed' | 'answers'>,
): ScoredMatch {
  const settings = colorGame.presets[input.mode];
  if (!settings) {
    throw new BadRequestException(`Modo desconhecido: ${input.mode}`);
  }
  if (input.answers.length !== settings.rounds) {
    throw new BadRequestException(
      `O modo ${input.mode} tem ${settings.rounds} rodadas, mas vieram ${input.answers.length} respostas`,
    );
  }

  const rounds = input.answers.map((answer, index) => {
    const target = colorGame.generateRound(input.seed, settings, index);
    const deltaE = colorDeltaE(target, answer);
    return { score: scoreFromDeltaE(deltaE), deltaE };
  });

  const totalTenths = rounds.reduce((sum, r) => sum + Math.round(r.score * 10), 0);
  return {
    rounds,
    total: totalTenths / 10,
    totalTenths,
    encodedAnswers: input.answers.map(encodeAnswer),
    settings: { ...settings, scoreVersion: COLOR_SCORE_VERSION },
  };
}
