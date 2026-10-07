import { apiClient } from './api-client';

export type Game = 'color' | 'time' | 'eco';
export type Board =
  | 'classic'
  | 'flash'
  | 'quick'
  | 'strict'
  | 'blind'
  | 'sequence'
  | 'survival'
  | 'escalada'
  | 'velocidade'
  | 'reverso'
  | 'daily';
export type Period = 'day' | 'week' | 'all';
export type Scope = 'all' | 'friends';

export interface RankingEntry {
  rank: number;
  username: string;
  /** Décimos (500 = 50.0). */
  score: number;
  /** Dias jogados no período (só no Daily, onde a nota é a soma dos dias). */
  days?: number;
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
  { id: 'color', label: 'Mesmíssima' },
  { id: 'time', label: 'Já Deu?' },
  { id: 'eco', label: 'Ecooo' },
];

const ALL_BOARDS: { id: Board; label: string }[] = [
  { id: 'classic', label: 'Clássico' },
  { id: 'flash', label: 'Flash' },
  { id: 'quick', label: 'Rápido' },
  { id: 'strict', label: 'Sem estourar' },
  { id: 'blind', label: 'Às cegas' },
  { id: 'sequence', label: 'Sequência' },
  { id: 'survival', label: 'Sobrevivência' },
  { id: 'escalada', label: 'Escalada' },
  { id: 'velocidade', label: 'Velocidade' },
  { id: 'reverso', label: 'Reverso' },
  { id: 'daily', label: 'Daily' },
];

/** Quadros de cada jogo. O Daily tem ranking próprio (tela do Daily), fora dos modos normais. */
const BOARD_IDS: Record<Game, Board[]> = {
  color: ['classic', 'flash', 'quick', 'blind', 'survival'],
  time: ['classic', 'quick', 'strict', 'sequence', 'survival'],
  eco: ['classic', 'escalada', 'velocidade', 'reverso'],
};

export const boardsOf = (game: Game) => ALL_BOARDS.filter((b) => BOARD_IDS[game].includes(b.id));

export const GAME_NAME: Record<Game, string> = {
  color: 'Mesmíssima',
  time: 'Já Deu?',
  eco: 'Ecooo',
};

export const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'all', label: 'Sempre' },
];

/** Máximo de pontos de uma partida no quadro (10 por rodada; o Daily da Cor tem 5 rodadas). */
export function boardMax(game: Game, board: Board): number {
  // Sobrevivência (rodadas) e Eco (passos) não têm máximo de pontos.
  if (board === 'survival' || game === 'eco') return 0;
  if (board === 'quick') return 10;
  if (board === 'sequence') return 50;
  if (board === 'daily') return game === 'time' ? 30 : 50;
  if (board === 'blind') return 50;
  return 30;
}

export const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'friends', label: 'Amigos' },
];

export function fetchRanking(game: Game, board: Board, period: Period, scope: Scope = 'all') {
  return apiClient.get<Ranking>(
    `/rankings/${game}?board=${board}&period=${period}&scope=${scope}&limit=50`,
  );
}
