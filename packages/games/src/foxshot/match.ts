/** Partida de mata-mata do Counter Fox (spec 057): durações, número de bots, pontos e resultado. Lógica pura. */

export const FS_MATCH_MINUTES = [2, 3, 5, 7, 10] as const;
export type FsMatchMinutes = (typeof FS_MATCH_MINUTES)[number];
/** Bots por partida: com você são no máximo 10 jogadores. */
export const FS_MATCH_BOTS = { min: 1, max: 9, default: 5 } as const;
export const FS_POINTS = { kill: 10, assist: 5 } as const;
/** Tempo morto antes de renascer (s). */
export const FS_RESPAWN_S = 3;

export interface FsMatchConfig {
  minutes: FsMatchMinutes;
  bots: number;
  /** 'bomb' = modo Bomba (spec 059): rounds, TR contra CT, economia. Ausente = mata-mata. */
  mode?: 'dm' | 'bomb';
  /** Seu lado no modo Bomba. */
  side?: 'tr' | 'ct';
  /** Opções do modo Bomba (rounds para vencer, tempos); o resto vem do padrão. */
  bomb?: { winRounds?: number; roundSec?: number; buySec?: number; /** Bots aliados e inimigos (você escolhe; 0 a 4 e 0 a 5). */ allies?: number; foes?: number };
}

/** Ajusta o que veio da tela (ou de um save antigo) para valores que existem. */
export function fsMatchConfig(minutes: number, bots: number): FsMatchConfig {
  const m = (FS_MATCH_MINUTES as readonly number[]).includes(minutes) ? (minutes as FsMatchMinutes) : 5;
  const b = Number.isFinite(bots) ? Math.round(bots) : FS_MATCH_BOTS.default;
  return { minutes: m, bots: Math.min(FS_MATCH_BOTS.max, Math.max(FS_MATCH_BOTS.min, b)) };
}

export const fsMatchScore = (p: { kills: number; assists: number }) => p.kills * FS_POINTS.kill + p.assists * FS_POINTS.assist;

export interface FsMatchPlayer {
  id: string;
  name: string;
  kills: number;
  assists: number;
  deaths: number;
}
export interface FsMatchRow extends FsMatchPlayer {
  points: number;
  /** 1 = primeiro. Empatados em tudo dividem a posição. */
  place: number;
  winner: boolean;
}

/** Ordem do placar: mais pontos, depois mais abates, depois menos mortes. */
const cmp = (a: FsMatchPlayer, b: FsMatchPlayer) =>
  fsMatchScore(b) - fsMatchScore(a) || b.kills - a.kills || a.deaths - b.deaths;

/** Tabela final ordenada. Quem empata em pontos, abates e mortes com o primeiro também vence (empate). */
export function fsMatchResult(players: readonly FsMatchPlayer[]): FsMatchRow[] {
  const sorted = [...players].sort(cmp);
  const rows: FsMatchRow[] = [];
  sorted.forEach((p, i) => {
    const prev = rows[i - 1];
    const place = prev && cmp(prev, p) === 0 ? prev.place : i + 1;
    rows.push({ ...p, points: fsMatchScore(p), place, winner: place === 1 });
  });
  return rows;
}
