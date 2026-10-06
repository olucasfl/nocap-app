import type { ColorSettings, Hsb } from '@nocap/games';

export type Mode = 'classic' | 'flash' | 'daily';

export interface RoundResult {
  target: Hsb;
  guess: Hsb;
  deltaE: number;
  score: number;
}

/** Uma partida em andamento. A seed define todos os alvos (o servidor os regenera). */
export interface Run {
  matchId: string;
  mode: Mode;
  kind: 'solo' | 'daily';
  /** Nome do preset usado no servidor (o Daily é sempre `classic`). */
  preset: 'classic' | 'flash';
  seed: string;
  settings: ColorSettings;
}
