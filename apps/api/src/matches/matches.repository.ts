import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { matchPlayers, matches, players, userGameStats } from '../db/schema';
import { decodeCursor, encodeCursor } from './cursor';
import type { ScoredMatch } from './match-scoring';

export interface SaveMatchInput {
  matchId: string;
  guestId: string;
  game: string;
  mode: string;
  kind: 'solo' | 'daily';
  seed: string;
  ranked: boolean;
  scored: ScoredMatch;
}

export interface HistoryItem {
  matchId: string;
  game: string;
  mode: string;
  kind: string;
  /** Permite ao cliente regenerar os alvos de cada rodada (alvo x voce). */
  seed: string;
  playedAt: string;
  /** Soma das notas em décimos (500 = 50.0). */
  totalScore: number;
  placement: number | null;
  /** Respostas codificadas; `null` depois da retenção das últimas 200 partidas por jogo. */
  answers: number[] | null;
}

@Injectable()
export class MatchesRepository {
  constructor(@Inject(DB) private readonly maybeDb: Db | null) {}

  private get db(): Db {
    if (!this.maybeDb) throw new ServiceUnavailableException('Banco de dados não configurado');
    return this.maybeDb;
  }

  /**
   * Grava partida + jogador + agregados numa transação. Se o matchId já existe (reenvio da
   * fila offline), devolve `{ duplicate: true }` sem gravar de novo.
   * Retorna `'conflict'` se o matchId pertence a outro jogador.
   */
  async save(input: SaveMatchInput): Promise<{ duplicate: boolean } | 'conflict'> {
    const { matchId, guestId, scored } = input;
    // Mesmo instante nas duas tabelas, com precisão de ms (o cursor do histórico depende disso).
    const playedAt = new Date();

    return this.db.transaction(async (tx) => {
      await tx.insert(players).values({ id: guestId }).onConflictDoNothing();

      const inserted = await tx
        .insert(matches)
        .values({
          id: matchId,
          game: input.game,
          mode: input.mode,
          kind: input.kind,
          seed: input.seed,
          settings: scored.settings,
          ranked: input.ranked,
          playedAt,
        })
        .onConflictDoNothing()
        .returning({ id: matches.id });

      if (inserted.length === 0) {
        const mine = await tx
          .select({ matchId: matchPlayers.matchId })
          .from(matchPlayers)
          .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.playerId, guestId)));
        return mine.length > 0 ? { duplicate: true } : 'conflict';
      }

      await tx.insert(matchPlayers).values({
        matchId,
        playerId: guestId,
        answers: scored.encodedAnswers,
        totalScore: scored.totalTenths,
        playedAt,
      });

      await tx
        .insert(userGameStats)
        .values({
          playerId: guestId,
          game: input.game,
          mode: input.mode,
          matches: 1,
          scoreSum: scored.totalTenths,
          best: scored.totalTenths,
        })
        .onConflictDoUpdate({
          target: [userGameStats.playerId, userGameStats.game, userGameStats.mode],
          set: {
            matches: sql`${userGameStats.matches} + 1`,
            scoreSum: sql`${userGameStats.scoreSum} + ${scored.totalTenths}`,
            best: sql`greatest(${userGameStats.best}, ${scored.totalTenths})`,
          },
        });

      return { duplicate: false };
    });
  }

  /** Histórico do jogador, mais recente primeiro, paginado por keyset (played_at, match_id). */
  async history(guestId: string, limit: number, cursor?: string) {
    const after = cursor ? decodeCursor(cursor) : null;

    const rows = await this.db
      .select({
        matchId: matches.id,
        game: matches.game,
        mode: matches.mode,
        kind: matches.kind,
        seed: matches.seed,
        playedAt: matchPlayers.playedAt,
        totalScore: matchPlayers.totalScore,
        placement: matchPlayers.placement,
        answers: matchPlayers.answers,
      })
      .from(matchPlayers)
      .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
      .where(
        and(
          eq(matchPlayers.playerId, guestId),
          after
            ? sql`(${matchPlayers.playedAt}, ${matchPlayers.matchId}) < (${after.playedAt}::timestamptz, ${after.matchId}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(matchPlayers.playedAt), desc(matchPlayers.matchId))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const items: HistoryItem[] = page.map((r) => ({ ...r, playedAt: r.playedAt.toISOString() }));
    const nextCursor =
      rows.length > limit && last
        ? encodeCursor({ playedAt: last.playedAt.toISOString(), matchId: last.matchId })
        : null;

    return { items, nextCursor };
  }
}
