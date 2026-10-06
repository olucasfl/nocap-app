import type { z } from 'zod';

export type GameId = 'color' | 'time';

export interface GameMeta {
  minPlayers: number;
  maxPlayers: number;
  solo: boolean;
  daily: boolean;
  ranking: 'score' | 'wins' | 'none';
}

/**
 * Contrato de todo jogo do NoCap. A lógica é pura e determinística: o servidor
 * regenera as rodadas pela seed e recalcula a nota, nunca confia no cliente.
 */
export interface GameDefinition<Settings, Round, Answer> {
  id: GameId;
  meta: GameMeta;
  settingsSchema: z.ZodType<Settings>;
  /** Modos padrão. Só eles contam para ranking. */
  presets: Record<string, Settings>;
  generateRound(seed: string, settings: Settings, index: number): Round;
  /** Nota de 0 a 10, com 1 casa decimal. */
  score(round: Round, answer: Answer, settings: Settings): number;
}
