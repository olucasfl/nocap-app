import { apiClient } from './api-client';

export type Game = 'color' | 'time';
export type Board = 'classic' | 'flash' | 'quick' | 'strict' | 'daily';
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
  game: Game;
  board: Board;
  period: Period;
  total: number;
  entries: RankingEntry[];
  /** Sua posição (conta logada), mesmo fora do top. */
  me: RankingEntry | null;
}

export const GAMES: { id: Game; label: string }[] = [
  { id: 'color', label: 'Cor' },
  { id: 'time', label: 'Tempo' },
];

const ALL_BOARDS: { id: Board; label: string }[] = [
  { id: 'classic', label: 'Clássico' },
  { id: 'flash', label: 'Flash' },
  { id: 'quick', label: 'Rápido' },
  { id: 'strict', label: 'Sem estourar' },
  { id: 'daily', label: 'Daily' },
];

/** Quadros que cada jogo tem (Flash é da Cor; "Sem estourar" é do Tempo). */
const BOARD_IDS: Record<Game, Board[]> = {
  color: ['classic', 'flash', 'quick', 'daily'],
  time: ['classic', 'quick', 'strict', 'daily'],
};

export const boardsOf = (game: Game) => ALL_BOARDS.filter((b) => BOARD_IDS[game].includes(b.id));

export const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'all', label: 'Sempre' },
];

/** Máximo de pontos da partida (10 por rodada). */
export const BOARD_MAX: Record<Board, number> = {
  classic: 50,
  flash: 50,
  quick: 10,
  strict: 50,
  daily: 50,
};

export const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'friends', label: 'Amigos' },
];

export function fetchRanking(game: Game, board: Board, period: Period, scope: Scope = 'all') {
  return apiClient.get<Ranking>(
    `/rankings/${game}?board=${board}&period=${period}&scope=${scope}&limit=50`,
  );
}
