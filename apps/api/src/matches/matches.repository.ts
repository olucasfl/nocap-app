import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { clampScore } from '../db/score';
import { matchPlayers, matches, players, userGameStats, userVisits } from '../db/schema';
import { randomUUID } from 'node:crypto';
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
    // Mesmo instante nas duas tabelas.
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
        // as respostas não são guardadas: não existe mais histórico de partidas para mostrar
        answers: null,
        totalScore: clampScore(scored.totalTenths),
        playedAt,
      });

      // O Daily (5 rodadas na Cor) tem ranking próprio e não mexe nos recordes do Clássico.
      if (input.kind === 'daily') return { duplicate: false };

      await tx
        .insert(userGameStats)
        .values({
          playerId: guestId,
          game: input.game,
          mode: input.mode,
          matches: 1,
          scoreSum: clampScore(scored.totalTenths),
          best: clampScore(scored.totalTenths),
        })
        .onConflictDoUpdate({
          target: [userGameStats.playerId, userGameStats.game, userGameStats.mode],
          set: {
            matches: sql`${userGameStats.matches} + 1`,
            scoreSum: sql`${userGameStats.scoreSum} + ${clampScore(scored.totalTenths)}`,
            best: sql`greatest(${userGameStats.best}, ${clampScore(scored.totalTenths)})`,
          },
        });

      return { duplicate: false };
    });
  }

  /** Aparelhos (convidados) vinculados a uma conta. */
  async playerIdsOf(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.userId, userId));
    return rows.map((r) => r.id);
  }

  /**
   * Vincula o convidado do aparelho à conta, sem copiar nem apagar nada: o histórico passa a
   * pertencer à conta. `'conflict'` se o aparelho já é de outra conta.
   */
  async claim(userId: string, guestId: string): Promise<'ok' | 'conflict'> {
    await this.db.insert(players).values({ id: guestId, userId }).onConflictDoNothing();
    const rows = await this.db
      .update(players)
      .set({ userId })
      .where(and(eq(players.id, guestId), or(isNull(players.userId), eq(players.userId, userId))))
      .returning({ id: players.id });
    return rows.length > 0 ? 'ok' : 'conflict';
  }

  /** Recordes por jogo e modo, somando os aparelhos da conta (décimos: 500 = 50.0). */
  async modeStats(playerIds: string[]) {
    if (playerIds.length === 0) return [];
    const rows = await this.db
      .select({
        game: userGameStats.game,
        mode: userGameStats.mode,
        matches: sql<number>`sum(${userGameStats.matches})::int`,
        scoreSum: sql<number>`sum(${userGameStats.scoreSum})::int`,
        best: sql<number>`max(${userGameStats.best})::int`,
      })
      .from(userGameStats)
      .where(inArray(userGameStats.playerId, playerIds))
      .groupBy(userGameStats.game, userGameStats.mode);
    return rows.map((r) => ({
      game: r.game,
      mode: r.mode,
      matches: r.matches,
      best: r.best,
      average: r.matches > 0 ? r.scoreSum / r.matches : 0,
    }));
  }

  /** Dailies jogados (jogo e instante), para a sequência de cada jogo. */
  async dailyPlays(playerIds: string[]): Promise<{ game: string; playedAt: Date }[]> {
    if (playerIds.length === 0) return [];
    return this.db
      .select({ game: matches.game, playedAt: matchPlayers.playedAt })
      .from(matchPlayers)
      .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
      .where(and(inArray(matchPlayers.playerId, playerIds), eq(matches.kind, 'daily')));
  }

  /** Já existe partida solo desse jogo com essa seed (de outro matchId)? Impede reusar uma sessão. */
  async seedUsed(game: string, seed: string, exceptMatchId?: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.game, game), eq(matches.seed, seed), eq(matches.kind, 'solo')))
      .limit(2);
    return rows.some((r) => r.id !== exceptMatchId);
  }

  /** O jogador da conta (cria o primeiro se ainda não houver). As partidas dela ficam nele. */
  async playerOfUser(userId: string): Promise<string> {
    const rows = await this.db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.userId, userId))
      .orderBy(players.createdAt)
      .limit(1);
    if (rows[0]) return rows[0].id;
    const id = randomUUID();
    await this.db.insert(players).values({ id, userId });
    return id;
  }

  /** Registra que a conta abriu o app neste dia. Repetir no mesmo dia não muda nada. */
  async recordVisit(userId: string, day: string) {
    await this.db.insert(userVisits).values({ userId, day }).onConflictDoNothing();
  }

  async visitDays(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ day: userVisits.day })
      .from(userVisits)
      .where(eq(userVisits.userId, userId));
    return rows.map((r) => r.day);
  }

  /** Já jogou o Daily deste jogo desde `since` (início do dia)? `exceptMatchId` libera o reenvio. */
  async dailyPlayed(
    game: string,
    playerIds: string[],
    since: Date,
    exceptMatchId?: string,
  ): Promise<boolean> {
    if (playerIds.length === 0) return false;
    const rows = await this.db
      .select({ matchId: matchPlayers.matchId })
      .from(matchPlayers)
      .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
      .where(
        and(
          inArray(matchPlayers.playerId, playerIds),
          eq(matches.game, game),
          eq(matches.kind, 'daily'),
          sql`${matchPlayers.playedAt} >= ${since.toISOString()}::timestamptz`,
        ),
      )
      .limit(5);
    return rows.some((r) => r.matchId !== exceptMatchId);
  }

  /** O Daily de hoje de cada jogo (nota em décimos), para mostrar "já jogou" na tela. */
  async dailyToday(
    playerIds: string[],
    since: Date,
  ): Promise<{ game: string; totalScore: number }[]> {
    if (playerIds.length === 0) return [];
    return this.db
      .select({ game: matches.game, totalScore: matchPlayers.totalScore })
      .from(matchPlayers)
      .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
      .where(
        and(
          inArray(matchPlayers.playerId, playerIds),
          eq(matches.kind, 'daily'),
          sql`${matchPlayers.playedAt} >= ${since.toISOString()}::timestamptz`,
        ),
      )
      .orderBy(matchPlayers.playedAt);
  }
}
