import { BOL_MAX_PLAYERS } from './constants';

export interface BolFormat {
  /** Quantos times (2 a 4). */
  teams: number;
  /** Quantas raposas por time (1 a 3). */
  perTeam: number;
}

/** Texto do formato, como "2x2x2". */
export const bolFormatLabel = (f: BolFormat): string =>
  Array.from({ length: f.teams }, () => String(f.perTeam)).join('x');

/** Todos os formatos possíveis (até 12 jogadores). */
export function bolFormats(): BolFormat[] {
  const out: BolFormat[] = [];
  for (let teams = 2; teams <= 4; teams++) {
    for (let perTeam = 1; perTeam <= 3; perTeam++)
      if (teams * perTeam <= BOL_MAX_PLAYERS) out.push({ teams, perTeam });
  }
  return out;
}

/**
 * O formato que melhor encaixa na quantidade de pessoas da sala. O líder pode trocar. Gente que sobra do formato
 * vira espectador; número quebrado (5 pessoas) vai para o formato maior (3x3) e o líder completa com bots.
 */
export function bolSuggestFormat(people: number): BolFormat {
  const n = Math.max(1, Math.floor(people));
  if (n <= 2) return { teams: 2, perTeam: 1 };
  if (n === 3) return { teams: 3, perTeam: 1 };
  if (n === 4) return { teams: 2, perTeam: 2 };
  if (n <= 6) return { teams: 2, perTeam: 3 };
  if (n <= 8) return { teams: 4, perTeam: 2 };
  if (n === 9) return { teams: 3, perTeam: 3 };
  return { teams: 4, perTeam: 3 };
}
