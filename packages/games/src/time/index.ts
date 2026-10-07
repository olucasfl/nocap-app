import { z } from 'zod';
import { createRng, randInt } from '../core/rng';
import type { GameDefinition } from '../core/types';

export const timeSettingsSchema = z.object({
  rounds: z.number().int().min(1).max(10),
  /** Faixa do alvo, em ms (múltiplos de 100). Médios 5–15 s; curtos 1–5 s; longos 15–30 s. */
  minMs: z.number().int().min(1000).max(30_000),
  maxMs: z.number().int().min(1000).max(30_000),
  /** "Sem estourar": passou do alvo, a rodada vale zero. */
  noOvershoot: z.boolean(),
});
export type TimeSettings = z.infer<typeof timeSettingsSchema>;

/** O alvo da rodada, em ms. Sempre regenerado pela seed (não é guardado no banco). */
export type TimeRound = number;
/** A resposta é a duração medida no aparelho, em ms. */
export type TimeAnswer = number;

export const timePresets: Record<string, TimeSettings> = {
  classic: { rounds: 5, minMs: 5000, maxMs: 15_000, noOvershoot: false },
  /** Jogo rápido: 1 rodada, ranking próprio. */
  quick: { rounds: 1, minMs: 5000, maxMs: 15_000, noOvershoot: false },
  /** Sem estourar: passou do alvo vale zero. */
  strict: { rounds: 5, minMs: 5000, maxMs: 15_000, noOvershoot: true },
};

/** Muda sempre que a curva muda; guardada em `matches.settings` para nunca misturar curvas. */
export const TIME_SCORE_VERSION = 1;

/**
 * Curva da nota do Tempo (PROPOSTA, brief #4: ajustar jogando). Erro relativo `e` = |resposta − alvo| / alvo:
 * `10 / (1 + (e / 0.15)^1.6)`, em [0, 10], 1 casa. Mesma filosofia da Cor: topo largo e cauda
 * longa (errar 20% ainda rende ~4).
 *
 * | erro | 1% | 3% | 5% | 10% | 20% | 40% | 80% |
 * | nota | 9,9| 9,3| 8,5| 6,6 | 3,9 | 1,7 | 0,6 |
 */
export function scoreFromError(e: number): number {
  const raw = 10 / (1 + (Math.max(0, e) / 0.15) ** 1.6);
  return Math.max(0, Math.min(10, Math.round(raw * 10) / 10));
}

/** Erro relativo ao alvo (ex.: 0,05 = 5%). */
export function relativeError(target: number, answer: number): number {
  return Math.abs(answer - target) / target;
}

export function generateTimeRound(seed: string, settings: TimeSettings, index: number): TimeRound {
  const rng = createRng(`${seed}:${index}`);
  const lo = Math.ceil(settings.minMs / 100);
  const hi = Math.max(lo, Math.floor(settings.maxMs / 100));
  return randInt(rng, lo, hi) * 100;
}

export function scoreTime(target: TimeRound, answer: TimeAnswer, settings: TimeSettings): number {
  if (settings.noOvershoot && answer > target) return 0;
  return scoreFromError(relativeError(target, answer));
}

/**
 * Respostas plausíveis para uma rodada: nem um toque duplo (< 200 ms) nem uma contagem absurda
 * (mais de 3× o alvo). O servidor recusa o que ficar fora disto (brief #6).
 */
export function isPlausibleAnswer(target: TimeRound, answer: TimeAnswer): boolean {
  return Number.isInteger(answer) && answer >= 200 && answer <= target * 3;
}

export const timeGame: GameDefinition<TimeSettings, TimeRound, TimeAnswer> = {
  id: 'time',
  meta: { minPlayers: 1, maxPlayers: 12, solo: true, daily: true, ranking: 'score' },
  settingsSchema: timeSettingsSchema,
  presets: timePresets,
  generateRound: generateTimeRound,
  score: scoreTime,
};
