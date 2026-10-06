import { apiClient } from './api-client';

export type Board = 'classic' | 'flash' | 'quick' | 'daily';
export type Period = 'day' | 'week' | 'all';
export type Scope = 'all' | 'friends';

export interface RankingEntry {
  rank: number;
  username: string;
  /** Décimos (500 = 50.0). */
  score: number;
  playedAt: string;
  isMe?: boolean;
}

export interface Ranking {
  board: Board;
  period: Period;
  total: number;
  entries: RankingEntry[];
  /** Sua posição (conta logada), mesmo fora do top. */
  me: RankingEntry | null;
}

export const BOARDS: { id: Board; label: string }[] = [
  { id: 'classic', label: 'Clássico' },
  { id: 'flash', label: 'Flash' },
  { id: 'quick', label: 'Rápido' },
  { id: 'daily', label: 'Daily' },
];

export const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'all', label: 'Sempre' },
];

/** Máximo de pontos da partida (10 por rodada). */
export const BOARD_MAX: Record<Board, number> = { classic: 50, flash: 50, quick: 10, daily: 50 };

export const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'friends', label: 'Amigos' },
];

export function fetchRanking(board: Board, period: Period, scope: Scope = 'all') {
  return apiClient.get<Ranking>(
    `/rankings/color?board=${board}&period=${period}&scope=${scope}&limit=50`,
  );
}
