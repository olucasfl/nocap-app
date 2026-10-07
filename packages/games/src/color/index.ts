import { z } from 'zod';
import { createRng, randInt } from '../core/rng';
import { SURVIVAL_MAX_ROUNDS } from '../core/survival';
import type { GameDefinition } from '../core/types';
import { deltaE2000, hsbToRgb, rgbToLab, type Hsb } from './convert';

export * from './convert';

export const colorSettingsSchema = z.object({
  rounds: z.number().int().min(1).max(30),
  showMs: z.number().int().min(100).max(10000),
  /** Sobrevivência: 3 vidas, nota mínima crescente; `rounds` é só o limite. */
  survival: z.boolean().optional(),
  /** Às cegas: a recriação não mostra a prévia da cor nem a nota até o fim. */
  blind: z.boolean().optional(),
});
export type ColorSettings = z.infer<typeof colorSettingsSchema>;

/** A rodada é o próprio alvo, sempre regenerado pela seed (não é guardado no banco). */
export type ColorRound = Hsb;
export type ColorAnswer = Hsb;

export const colorPresets: Record<string, ColorSettings> = {
  classic: { rounds: 5, showMs: 3000 },
  flash: { rounds: 5, showMs: 400 },
  /** Jogo rápido: 1 rodada, ranking próprio (modo `quick`). */
  quick: { rounds: 1, showMs: 3000 },
  /** Às cegas: 5 rodadas sem ver a cor que está montando; as notas só aparecem no fim. */
  blind: { rounds: 5, showMs: 3000, blind: true },
  /** Sobrevivência: joga até perder as 3 vidas (o tempo de decorar cai a cada rodada). */
  survival: { rounds: SURVIVAL_MAX_ROUNDS.color, showMs: 3000, survival: true },
};

export function generateColorRound(seed: string, _settings: ColorSettings, index: number): Hsb {
  const rng = createRng(`${seed}:${index}`);
  return { h: randInt(rng, 0, 359), s: randInt(rng, 35, 95), b: randInt(rng, 40, 95) };
}

/** ΔE mínimo entre o alvo e a cor de partida: sair da cor inicial nunca é "já acertar". */
export const START_MIN_DELTA_E = 30;

/**
 * Cor em que os controles começam, na recriação. Deriva da seed (igual para todo mundo na
 * mesma rodada, sem depender do alvo escolhido) e nunca fica perto do alvo (ΔE >= 30), para
 * não virar atalho nem ficar fácil demais. Só o app usa: o servidor só confere a resposta.
 */
export function generateColorStart(seed: string, target: Hsb, index: number): Hsb {
  const rng = createRng(`${seed}:start:${index}`);
  let start: Hsb = { h: randInt(rng, 0, 359), s: randInt(rng, 40, 80), b: randInt(rng, 50, 85) };
  for (let i = 0; i < 6 && colorDeltaE(target, start) < START_MIN_DELTA_E; i++) {
    start = { ...start, h: (start.h + 60 + randInt(rng, 0, 120)) % 360 };
  }
  return start;
}

/** ΔE2000 (Lab) entre alvo e resposta. Nunca distância RGB. */
export function colorDeltaE(round: ColorRound, answer: ColorAnswer): number {
  return deltaE2000(rgbToLab(hsbToRgb(round)), rgbToLab(hsbToRgb(answer)));
}

/** Muda sempre que a curva muda; guardada em `matches.settings` para nunca misturar curvas no ranking. */
export const COLOR_SCORE_VERSION = 3;

/**
 * Curva logística 10 / (1 + (ΔE/22)^1.5), em [0, 10], 1 casa (v3: mais generosa que a v2, que
 * dava só ~3 para uma cor "minimamente parecida"). Topo largo e cauda longa:
 *
 * | ΔE   | 2   | 3,5 | 6   | 10  | 15  | 20  | 30  | 45  | 60  |
 * | nota | 9,7 | 9,4 | 8,7 | 7,6 | 6,4 | 5,4 | 3,9 | 2,5 | 1,8 |
 *
 * Uma cor "minimamente parecida" (ΔE ~20) rende ~5; bem próxima (ΔE ≤ 6) passa de 8,5; só o
 * praticamente idêntico (ΔE < 1) chega a 10.
 */
export function scoreFromDeltaE(dE: number): number {
  const raw = 10 / (1 + (Math.max(0, dE) / 22) ** 1.5);
  return Math.max(0, Math.min(10, Math.round(raw * 10) / 10));
}

export function scoreColor(round: ColorRound, answer: ColorAnswer): number {
  return scoreFromDeltaE(colorDeltaE(round, answer));
}

/** Resposta no banco: um int por rodada (h*10000 + s*100 + b). */
export function encodeAnswer({ h, s, b }: Hsb): number {
  return h * 10000 + s * 100 + b;
}

export function decodeAnswer(n: number): Hsb {
  return { h: Math.floor(n / 10000), s: Math.floor((n % 10000) / 100), b: n % 100 };
}

export const colorGame: GameDefinition<ColorSettings, ColorRound, ColorAnswer> = {
  id: 'color',
  meta: { minPlayers: 1, maxPlayers: 8, solo: true, daily: true, ranking: 'score' },
  settingsSchema: colorSettingsSchema,
  presets: colorPresets,
  generateRound: generateColorRound,
  score: (round, answer) => scoreColor(round, answer),
};
