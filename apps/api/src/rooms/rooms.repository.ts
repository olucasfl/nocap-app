import { randomUUID } from 'node:crypto';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { encodeAnswer } from '@nocap/games';
import { and, eq, gt, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { clampScore } from '../db/score';
import { authUser, matchPlayers, matches, players, reservedUsernames } from '../db/schema';
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

  /** Algum destes é o @usuário de uma conta (ou um @ reservado)? Apelido de convidado não pode imitar. */
  async usernameTaken(names: string[]): Promise<boolean> {
    if (names.length === 0) return false;
    const [account] = await this.db
      .select({ id: authUser.id })
      .from(authUser)
      .where(inArray(authUser.username, names))
      .limit(1);
    if (account) return true;
    const [held] = await this.db
      .select({ username: reservedUsernames.username })
      .from(reservedUsernames)
      .where(and(inArray(reservedUsernames.username, names), gt(reservedUsernames.until, new Date())))
      .limit(1);
    return !!held;
  }

  /**
   * Grava a partida de sala: uma `matches` (kind `room`, nunca ranked) e uma `match_players`
   * por pessoa, ligada ao aparelho (player) da conta; cria um se a conta ainda não tem.
   */
  async saveRoomMatch(input: {
    game: 'color' | 'time' | 'eco' | 'sinal';
    /** Modo guardado (o padrão é `room`; Intruso e Siga o Líder têm o seu). */
    mode?: string;
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
        mode: input.mode ?? 'room',
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
          totalScore: clampScore(row.totalTenths),
          placement: row.placement,
          playedAt,
        });
      }
    });
    return matchId;
  }
}
