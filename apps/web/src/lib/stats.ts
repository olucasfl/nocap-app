import { apiClient } from './api-client';

export type GameId = 'color' | 'time';

export interface ModeStats {
  game: string;
  mode: string;
  matches: number;
  /** Décimos (500 = 50.0). */
  best: number;
  /** Média do total, em décimos. */
  average: number;
}

/** O Daily de um jogo: sequência própria e a nota de hoje (em décimos), se já jogou. */
export interface DailyInfo {
  current: number;
  best: number;
  playedToday: boolean;
  totalScore: number | null;
}

export interface Stats {
  modes: ModeStats[];
  daily: Record<GameId, DailyInfo>;
  /** Dias seguidos entrando no NoCap (não depende de jogar). */
  visit: { current: number; best: number; visitedToday: boolean };
}

/** Só com conta: convidado não tem recordes. */
export const fetchStats = () => apiClient.get<Stats>('/me/stats');

/** Avisa o servidor que o app foi aberto hoje e devolve a sequência de dias seguidos. */
export const recordVisit = () =>
  apiClient.post<{ current: number; best: number; visitedToday: boolean }>('/me/visit', {});

/** Máximo de pontos de uma partida: 10 por rodada. A Cor tem 5 rodadas; o Tempo, 3. */
const MODE_MAX_BY_GAME: Record<GameId, Record<string, number>> = {
  color: { classic: 50, flash: 50, quick: 10, blind: 50, survival: 0 },
  time: { classic: 30, quick: 10, strict: 30, sequence: 50, survival: 0 },
};

/** Sobrevivência: a nota é o número de rodadas jogadas (não tem máximo). */
export const isSurvival = (mode: string) => mode === 'survival';

export function modeMax(game: string, mode: string): number | undefined {
  return MODE_MAX_BY_GAME[game as GameId]?.[mode];
}

/** Máximo do Daily de um jogo (usa o clássico). */
export const dailyMax = (game: string) => modeMax(game, 'classic') ?? 50;

const ORDER = ['classic', 'flash', 'quick', 'strict', 'blind', 'sequence', 'survival'];

/** Só os modos conhecidos de um jogo, na ordem da tela de início. */
export function gameModes(stats: Stats, game: string): ModeStats[] {
  return stats.modes
    .filter((m) => m.game === game && modeMax(game, m.mode) !== undefined)
    .sort((a, b) => ORDER.indexOf(a.mode) - ORDER.indexOf(b.mode));
}

export function streakLabel(days: number): string {
  return days === 1 ? '1 dia' : `${days} dias`;
}
