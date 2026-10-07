import { randomUUID } from 'node:crypto';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { encodeAnswer } from '@nocap/games';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { matchPlayers, matches, players } from '../db/schema';
import type { AnySettings, FinalRow } from './color-room.engine';

/** Rodada sem resposta no banco (a coluna é um array de inteiros). */
export const NO_ANSWER = -1;

@Injectable()
export class RoomsRepository {
  constructor(@Inject(DB) private readonly maybeDb: Db | null) {}

  private get db(): Db {
    if (!this.maybeDb) throw new ServiceUnavailableException('Banco de dados não configurado');
    return this.maybeDb;
  }

  /**
   * Grava a partida de sala: uma `matches` (kind `room`, nunca ranked) e uma `match_players`
   * por pessoa, ligada ao aparelho (player) da conta; cria um se a conta ainda não tem.
   */
  async saveRoomMatch(input: {
    game: 'color' | 'time';
    seed: string;
    settings: AnySettings;
    rows: FinalRow[];
  }) {
    const matchId = randomUUID();
    const playedAt = new Date();
    await this.db.transaction(async (tx) => {
      await tx.insert(matches).values({
        id: matchId,
        game: input.game,
        mode: 'room',
        kind: 'room',
        seed: input.seed,
        settings: input.settings,
        ranked: false,
        playedAt,
      });
      for (const row of input.rows) {
        const owned = await tx
          .select({ id: players.id })
          .from(players)
          .where(eq(players.userId, row.userId))
          .limit(1);
        let playerId = owned[0]?.id;
        if (!playerId) {
          playerId = randomUUID();
          await tx.insert(players).values({ id: playerId, userId: row.userId });
        }
        await tx.insert(matchPlayers).values({
          matchId,
          playerId,
          // Cor guarda o HSB codificado; Tempo guarda os ms.
          answers: row.answers.map((a) =>
            a === null ? NO_ANSWER : typeof a === 'number' ? a : encodeAnswer(a),
          ),
          totalScore: row.totalTenths,
          placement: row.placement,
          playedAt,
        });
      }
    });
    return matchId;
  }
}
