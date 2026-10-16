import { BadRequestException } from '@nestjs/common';
import {
  ECO_SCORE_VERSION,
  COLOR_SCORE_VERSION,
  TIME_SCORE_VERSION,
  colorDailySettings,
  colorGame,
  colorDeltaE,
  ecoPresets,
  evaluateBatida,
  validateTaps,
  BATIDA_MAX_RUN_MS,
  type Song,
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
  evaluateBlocks,
  evaluateTowers,
  TOWERS_DT,
  evaluateAtravessa,
  isAtravessaMode,
  validateAtravessaInputs,
  ATR_TPS,
  isBlocksMode,
} from '@nocap/games';
import type {
  AtravessaMatchInput,
  BlocksMatchInput,
  ColorMatchInput,
  EcoMatchInput,
  TimeMatchInput,
} from './match.schema';

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

/**
 * Eco Hero: o servidor refaz a partida (acertos, notas longas, combo, energia) a partir dos instantes de apertar e soltar e
 * da música da seed. Recusa o que não é possível: pista ou instante inválido, rajada impossível,
 * toques depois da energia zerar, ou uma partida mais longa do que o relógio do servidor viu.
 */
export function scoreBatidaMatch(
  input: Pick<EcoMatchInput, 'seed' | 'beats'> & { song: Song; elapsedMs: number },
): ScoredMatch {
  const taps = (input.beats ?? []).map(([lane, t, up]) => ({ lane, t, up }));
  const problem = validateTaps(taps);
  if (problem) throw new BadRequestException(problem);
  const run = evaluateBatida(input.seed, input.song, taps);
  if (run.usedTaps !== taps.length) {
    throw new BadRequestException('Há toques depois do fim da partida');
  }
  // A música só começa depois de a sessão ser pedida: a partida não pode ser mais longa que isso.
  if (run.endedAtMs > BATIDA_MAX_RUN_MS || run.endedAtMs > input.elapsedMs + ELAPSED_SLACK_MS) {
    throw new BadRequestException('A partida foi rápida demais para ser verdade');
  }
  return {
    rounds: [],
    total: run.tenths / 10,
    totalTenths: run.tenths,
    // O histórico não guarda os toques (seriam milhares de números por partida).
    encodedAnswers: [],
    settings: {
      mode: `batida-${input.song.id}`,
      scoreVersion: 2,
      perfect: run.perfect,
      good: run.good,
      missed: run.missed,
      holds: run.holds,
    },
  };
}

/**
 * Atravessa!: o servidor refaz a partida pela seed e pelos passos; a nota é a maior linha atingida
 * (guardada em décimos). Só vale partida que terminou (um perigo pegou: veículo, trem, água...) e que não
 * durou mais que o relógio do servidor viu desde o início da sessão.
 */
export function scoreAtravessaMatch(
  input: Pick<AtravessaMatchInput, 'mode' | 'seed' | 'steps'> & { elapsedMs: number },
): ScoredMatch {
  if (!isAtravessaMode(input.mode)) {
    throw new BadRequestException(`Modo desconhecido: ${input.mode}`);
  }
  const steps = input.steps.map(([t, d]) => ({ t, d: d as 0 | 1 | 2 | 3 }));
  if (!validateAtravessaInputs(steps)) throw new BadRequestException('Passos inválidos');
  const maxTicks = Math.ceil(((input.elapsedMs + ELAPSED_SLACK_MS) / 1000) * ATR_TPS);
  const result = evaluateAtravessa(input.seed, steps, maxTicks);
  if (result.end === null) {
    throw new BadRequestException('A partida enviada não terminou (ou durou mais que a sessão)');
  }
  return {
    rounds: [],
    total: result.score,
    totalTenths: result.score * 10,
    // Os passos não ficam no histórico (seriam milhares por partida).
    encodedAnswers: [],
    settings: { mode: input.mode, scoreVersion: 1, ended: result.end },
  };
}

/** Uma jogada de Block's leva pelo menos isto: mais rápido que isso não é gente jogando. */
export const BLOCKS_MIN_MS_PER_MOVE = 100;

/**
 * Block's: o servidor refaz a partida inteira pela seed (gera as peças de cada rodada e confere
 * cada jogada) e a nota é a pontuação, em décimos. Só vale uma partida que terminou, e não pode
 * ter mais jogadas do que o tempo da sessão permite.
 */
export function scoreBlocksMatch(
  input: Pick<BlocksMatchInput, 'mode' | 'seed' | 'moves'> & { elapsedMs: number },
): ScoredMatch {
  if (!isBlocksMode(input.mode)) {
    throw new BadRequestException(`Modo desconhecido: ${input.mode}`);
  }
  if (input.mode === 'towers') return scoreTowersMatch(input);
  if ((input.elapsedMs + ELAPSED_SLACK_MS) < input.moves.length * BLOCKS_MIN_MS_PER_MOVE) {
    throw new BadRequestException('Jogadas rápidas demais para o tempo da sessão');
  }
  if (input.moves.some((n) => n > 191)) throw new BadRequestException('Jogada inválida');
  const check = evaluateBlocks(input.seed, input.moves);
  if (!check.ok) throw new BadRequestException(check.error);
  const r = check.result;
  return {
    rounds: [],
    total: r.score,
    totalTenths: r.score * 10,
    // As jogadas não ficam no histórico (seriam milhares de números por partida).
    encodedAnswers: [],
    settings: {
      mode: input.mode,
      scoreVersion: 3,
      moves: r.moves,
      lines: r.lines,
      bestStreak: r.bestStreak,
      sets: r.sets,
    },
  };
}

/**
 * Block Towers: o servidor refaz a física pela seed e pelo registro de teclas, em passo fixo. A
 * nota é o máximo de peças empilhadas (em décimos). A partida não pode durar mais passos do que o
 * tempo da sessão deixa (a física roda no máximo em tempo real no aparelho).
 */
function scoreTowersMatch(
  input: Pick<BlocksMatchInput, 'seed' | 'moves'> & { elapsedMs: number },
): ScoredMatch {
  const check = evaluateTowers(input.seed, input.moves);
  if (!check.ok) throw new BadRequestException(check.error);
  if (input.elapsedMs + ELAPSED_SLACK_MS < check.steps * TOWERS_DT * 1000 * 0.9) {
    throw new BadRequestException('Partida rápida demais para o tempo da sessão');
  }
  const r = check.result;
  return {
    rounds: [],
    total: r.score,
    totalTenths: r.score * 10,
    encodedAnswers: [],
    settings: {
      mode: 'towers',
      scoreVersion: 1,
      pieces: r.pieces,
      lives: r.lives,
      seconds: Math.round(r.time),
    },
  };
}
