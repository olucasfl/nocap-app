import type { GameId } from './types';

const DAILY_TZ = 'America/Sao_Paulo';

/** Data (YYYY-MM-DD) do Daily: o dia vira à meia-noite de São Paulo para o mundo todo. */
export function dailyDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Seed do Daily: `"<game>:YYYY-MM-DD"`. */
export function dailySeed(game: GameId, now: Date = new Date()): string {
  return `${game}:${dailyDate(now)}`;
}
