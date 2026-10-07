import type { EcoMode, EcoSettings } from '@nocap/games';

export type Mode = EcoMode | 'daily';

/** Como a partida acabou: errou um botão, ficou parado, ou chegou ao teto de passos. */
export type EndReason = 'wrong' | 'timeout' | 'perfect';

/** Uma partida em andamento. A seed e a sessão vêm do servidor. */
export interface Run {
  matchId: string;
  mode: Mode;
  kind: 'solo' | 'daily';
  /** Nome do preset usado no servidor (o Daily é sempre `classic`). */
  preset: EcoMode;
  seed: string;
  /** Sessão assinada pelo servidor: prova de quando a partida começou (vazia = offline). */
  session: string;
  settings: EcoSettings;
}
