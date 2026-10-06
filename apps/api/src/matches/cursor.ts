import { BadRequestException } from '@nestjs/common';

export interface HistoryCursor {
  playedAt: string; // ISO
  matchId: string;
}

/** Cursor opaco para paginação por keyset: (played_at, match_id). */
export function encodeCursor(c: HistoryCursor): string {
  return Buffer.from(`${c.playedAt}|${c.matchId}`).toString('base64url');
}

export function decodeCursor(raw: string): HistoryCursor {
  const [playedAt, matchId, ...rest] = Buffer.from(raw, 'base64url').toString().split('|');
  const valid =
    rest.length === 0 &&
    !!playedAt &&
    !!matchId &&
    !Number.isNaN(Date.parse(playedAt)) &&
    /^[0-9a-f-]{36}$/i.test(matchId);
  if (!valid) throw new BadRequestException('Cursor inválido');
  return { playedAt, matchId };
}
