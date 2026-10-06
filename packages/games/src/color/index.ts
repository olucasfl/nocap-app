import { z } from 'zod';
import { createRng, randInt } from '../core/rng';
import type { GameDefinition } from '../core/types';
import { deltaE2000, hsbToRgb, rgbToLab, type Hsb } from './convert';

export * from './convert';

export const colorSettingsSchema = z.object({
  rounds: z.number().int().min(1).max(10),
  showMs: z.number().int().min(100).max(10000),
});
export type ColorSettings = z.infer<typeof colorSettingsSchema>;

/** A rodada é o próprio alvo, sempre regenerado pela seed (não é guardado no banco). */
export type ColorRound = Hsb;
export type ColorAnswer = Hsb;

export const colorPresets: Record<string, ColorSettings> = {
  classic: { rounds: 5, showMs: 3000 },
  flash: { rounds: 5, showMs: 400 },
};

export function generateColorRound(seed: string, _settings: ColorSettings, index: number): Hsb {
  const rng = createRng(`${seed}:${index}`);
  return { h: randInt(rng, 0, 359), s: randInt(rng, 35, 95), b: randInt(rng, 40, 95) };
}

/** ΔE2000 (Lab) entre alvo e resposta. Nunca distância RGB. */
export function colorDeltaE(round: ColorRound, answer: ColorAnswer): number {
  return deltaE2000(rgbToLab(hsbToRgb(round)), rgbToLab(hsbToRgb(answer)));
}

/** Muda sempre que a curva muda; guardada em `matches.settings` para nunca misturar curvas no ranking. */
export const COLOR_SCORE_VERSION = 2;

/**
 * Curva logística 10 / (1 + (ΔE/12)^1.6), em [0, 10], 1 casa (brief #3, spec 001).
 * Cauda longa embaixo (ΔE 20 ainda rende ~3) e topo largo (ΔE 3 a 4 rende ~9).
 */
export function scoreFromDeltaE(dE: number): number {
  const raw = 10 / (1 + (Math.max(0, dE) / 12) ** 1.6);
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
