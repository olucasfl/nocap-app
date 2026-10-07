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

/** Melhor nota do modo, em décimos (0 = nunca jogou). */
export function bestTenths(stats: Stats | undefined, game: string, mode: string): number {
  return stats?.modes.find((m) => m.game === game && m.mode === mode)?.best ?? 0;
}

/** O recorde só vale quando já havia um (o primeiro jogo cria o recorde, não o bate). */
export function isNewRecord(previous: number | undefined, now: number): boolean {
  return previous !== undefined && previous > 0 && now > previous;
}

/** "3.5/50" ou, na Sobrevivência, "7 rodadas": o valor de uma nota de modo, para mostrar. */
export function formatBest(game: string, mode: string, tenths: number): string {
  if (isSurvival(mode))
    return `${Math.round(tenths / 10)} ${Math.round(tenths / 10) === 1 ? 'rodada' : 'rodadas'}`;
  return `${(tenths / 10).toFixed(1)}/${modeMax(game, mode) ?? ''}`;
}

/** Frase do recorde de um modo, na ficha dele. `null` para convidado (sem estatísticas). */
export function recordText(stats: Stats | undefined, game: string, mode: string): string | null {
  if (!stats) return null;
  const best = bestTenths(stats, game, mode);
  if (best <= 0) return 'Você ainda não tem recorde neste modo';
  return `Seu recorde aqui é de ${formatBest(game, mode, best)}`;
}
