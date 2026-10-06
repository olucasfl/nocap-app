import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { colorGame, dailyDate, dailySeed, dailyStreak } from '@nocap/games';
import { randomUUID } from 'node:crypto';
import { scoreMatch } from './match-scoring';
import type { CreateMatchInput, HistoryQuery } from './match.schema';
import { MatchesRepository } from './matches.repository';

@Injectable()
export class MatchesService {
  constructor(private readonly repo: MatchesRepository) {}

  async create(input: CreateMatchInput) {
    // Daily vale para o mundo todo: seed e modo são os do dia, não escolha do cliente.
    if (input.kind === 'daily') {
      if (input.seed !== dailySeed('color')) {
        throw new BadRequestException('Seed do Daily não é a de hoje');
      }
      if (input.mode !== 'classic') {
        throw new BadRequestException('O Daily só existe no modo classic');
      }
    }

    const scored = scoreMatch(input);
    const matchId = input.matchId ?? randomUUID();

    const saved = await this.repo.save({
      matchId,
      guestId: input.guestId,
      game: input.game,
      mode: input.mode,
      kind: input.kind,
      seed: input.seed,
      // Só os modos padrão (presets) contam para ranking; salas personalizadas nunca.
      ranked: input.mode in colorGame.presets,
      scored,
    });
    if (saved === 'conflict') throw new ConflictException('matchId já usado por outro jogador');

    return {
      matchId,
      rounds: scored.rounds.map((r) => ({ score: r.score })),
      total: scored.total,
    };
  }

  history(guestId: string, query: HistoryQuery) {
    return this.repo.history([guestId], query.limit, query.cursor);
  }

  /** Histórico da conta: todos os aparelhos vinculados a ela. */
  async historyOf(userId: string, query: HistoryQuery) {
    return this.repo.history(await this.repo.playerIdsOf(userId), query.limit, query.cursor);
  }

  async claim(userId: string, guestId: string) {
    if ((await this.repo.claim(userId, guestId)) === 'conflict') {
      throw new ConflictException('Este aparelho já pertence a outra conta');
    }
    return { claimed: true };
  }

  /** Recordes e sequência do Daily de um conjunto de aparelhos. */
  private async statsOf(playerIds: string[]) {
    const [modes, plays] = await Promise.all([
      this.repo.modeStats(playerIds),
      this.repo.dailyPlays(playerIds),
    ]);
    const streak = dailyStreak(
      plays.map((d) => dailyDate(d)),
      dailyDate(),
    );
    return {
      modes,
      daily: { ...streak, playedToday: plays.some((d) => dailyDate(d) === dailyDate()) },
    };
  }

  stats(guestId: string) {
    return this.statsOf([guestId]);
  }

  async statsOfUser(userId: string) {
    return this.statsOf(await this.repo.playerIdsOf(userId));
  }
}
