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

const DAY_MS = 86_400_000;
const dayNumber = (isoDate: string) => Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS);

export interface DailyStreak {
  /** Dias seguidos até hoje. Continua valendo se o último Daily foi ontem (ainda dá tempo de hoje). */
  current: number;
  best: number;
}

/**
 * Sequência de Dailies jogados. `dates` são datas `YYYY-MM-DD` do Daily (podem repetir e vir
 * em qualquer ordem); `today` é `dailyDate()`.
 */
export function dailyStreak(dates: string[], today: string): DailyStreak {
  const days = [...new Set(dates.map(dayNumber))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = Number.NaN;
  for (const d of days) {
    run = d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  // `run` agora é a sequência que termina no último dia jogado.
  const last = days[days.length - 1];
  const alive = last !== undefined && dayNumber(today) - last <= 1;
  return { current: alive ? run : 0, best };
}
