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
  /**
   * Como os alvos se distribuem: `uniform` (qualquer valor da faixa), `alternate` (curto, longo,
   * curto...) ou `mostly-low` (quase sempre curto, de vez em quando longo).
   */
  mix: z.enum(['uniform', 'alternate', 'mostly-low']),
});
export type TimeSettings = z.infer<typeof timeSettingsSchema>;

/** Alvos curtos (abaixo de 10 s) e longos (acima de 10 s) dos modos com `mix`. */
export const SHORT_TARGET_MS = { min: 3000, max: 9900 } as const;
export const LONG_TARGET_MS = { min: 10_100, max: 18_000 } as const;
/** No `mostly-low`, a chance de uma rodada sair longa (1 em 4). */
export const LONG_CHANCE = 0.25;

/** O alvo da rodada, em ms. Sempre regenerado pela seed (não é guardado no banco). */
export type TimeRound = number;
/** A resposta é a duração medida no aparelho, em ms. */
export type TimeAnswer = number;

export const timePresets: Record<string, TimeSettings> = {
  /** 3 rodadas, curto-longo-curto: prioriza alvos abaixo de 10 s sem deixar de variar. */
  classic: { rounds: 3, minMs: 3000, maxMs: 18_000, noOvershoot: false, mix: 'alternate' },
  /** Jogo rápido: 1 rodada, quase sempre curta. Ranking próprio. */
  quick: { rounds: 1, minMs: 3000, maxMs: 18_000, noOvershoot: false, mix: 'mostly-low' },
  /** Sem estourar: passou do alvo vale zero. Mesma cadência do clássico. */
  strict: { rounds: 3, minMs: 3000, maxMs: 18_000, noOvershoot: true, mix: 'alternate' },
};

/**
 * Presets de antes (5 rodadas, alvos uniformes de 5 a 15 s). Só servem para o histórico mostrar
 * certo as partidas antigas, que o servidor guardou com 5 respostas.
 */
export const legacyTimePresets: Record<string, TimeSettings> = {
  classic: { rounds: 5, minMs: 5000, maxMs: 15_000, noOvershoot: false, mix: 'uniform' },
  quick: { rounds: 1, minMs: 5000, maxMs: 15_000, noOvershoot: false, mix: 'uniform' },
  strict: { rounds: 5, minMs: 5000, maxMs: 15_000, noOvershoot: true, mix: 'uniform' },
};

/** O preset com que uma partida foi jogada, pelo número de respostas guardadas. */
export function presetFor(mode: string, answerCount: number): TimeSettings | undefined {
  const current = timePresets[mode];
  if (current && current.rounds === answerCount) return current;
  const legacy = legacyTimePresets[mode];
  return legacy && legacy.rounds === answerCount ? legacy : current;
}

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
  const mix = settings.mix ?? 'uniform';
  if (mix !== 'uniform') {
    const long = mix === 'alternate' ? index % 2 === 1 : rng() < LONG_CHANCE;
    const band = long ? LONG_TARGET_MS : SHORT_TARGET_MS;
    return randInt(rng, band.min / 100, band.max / 100) * 100;
  }
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
