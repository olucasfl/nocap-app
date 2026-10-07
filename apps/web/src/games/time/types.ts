import type { TimeSettings } from '@nocap/games';

export type Mode = 'classic' | 'quick' | 'strict' | 'sequence' | 'survival' | 'daily';

export interface RoundResult {
  /** Alvo da rodada, em ms. */
  target: number;
  /** Duração que o jogador contou, em ms (medida no aparelho). */
  answer: number;
  /** 0 a 10, calculada no app só para mostrar; o servidor recalcula. */
  score: number;
}

/** Uma partida em andamento. A seed e a sessão vêm do servidor. */
export interface Run {
  matchId: string;
  mode: Mode;
  kind: 'solo' | 'daily';
  /** Nome do preset usado no servidor (o Daily é sempre `classic`). */
  preset: 'classic' | 'quick' | 'strict' | 'sequence' | 'survival';
  seed: string;
  /** Sessão assinada pelo servidor: prova de quando a partida começou. */
  session: string;
  settings: TimeSettings;
}
