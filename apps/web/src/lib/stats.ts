import { apiClient } from './api-client';
import { getToken } from './auth';
import { getGuestId } from './guest';

export interface ModeStats {
  game: string;
  mode: string;
  matches: number;
  /** Décimos (500 = 50.0). */
  best: number;
  /** Média do total, em décimos. */
  average: number;
}

export interface Stats {
  modes: ModeStats[];
  daily: { current: number; best: number; playedToday: boolean };
}

/** Com conta: soma dos aparelhos vinculados. Sem conta: só deste aparelho. */
export function fetchStats() {
  const path = getToken() ? '/me/stats' : `/players/${getGuestId()}/stats`;
  return apiClient.get<Stats>(path);
}

/** Máximo de pontos de uma partida do modo (10 por rodada). */
export const MODE_MAX: Record<string, number> = { classic: 50, flash: 50, quick: 10 };

const ORDER = ['classic', 'flash', 'quick'];

/** Só os modos da Cor, na ordem da tela de início. */
export function colorModes(stats: Stats): ModeStats[] {
  return stats.modes
    .filter((m) => m.game === 'color' && m.mode in MODE_MAX)
    .sort((a, b) => ORDER.indexOf(a.mode) - ORDER.indexOf(b.mode));
}

export function streakLabel(days: number): string {
  return days === 1 ? '1 dia' : `${days} dias`;
}
