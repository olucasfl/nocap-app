/** Contas puras das telas de fim de partida (com teste). */

/** Segundos em "m:ss" (ex.: 83 → "1:23"). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Posição de cada item de uma lista já ordenada do melhor para o pior; empate divide a posição (1, 1, 3). */
export function places<T>(sorted: T[], same: (a: T, b: T) => boolean): number[] {
  return sorted.map((x, i) => {
    let p = i;
    while (p > 0 && same(sorted[p - 1] as T, x)) p--;
    return p + 1;
  });
}

/** "1º", "2º"… */
export const ordinal = (n: number) => `${n}º`;

/** Linhas por minuto, com uma casa (0 se a duração for zero). */
export function pace(rows: number, seconds: number): number {
  return seconds > 0 ? Math.round((rows / seconds) * 600) / 10 : 0;
}
