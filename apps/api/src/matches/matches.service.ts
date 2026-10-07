import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  colorGame,
  dailyDate,
  dailySeed,
  dailyStreak,
  ecoPresets,
  periodStart,
  timePresets,
} from '@nocap/games';
import { randomUUID } from 'node:crypto';
import { scoreEcoMatch, scoreMatch, scoreTimeMatch, type ScoredMatch } from './match-scoring';
import type {
  ColorMatchInput,
  CreateMatchInput,
  EcoMatchInput,
  HistoryQuery,
  TimeMatchInput,
} from './match.schema';
import { verifyTimeSession } from './time-session';
import { MatchesRepository } from './matches.repository';

/** Quem joga: a conta da sessão e o jogador (aparelho) onde a partida fica guardada. */
interface Who {
  userId: string;
  playerId: string;
}

@Injectable()
export class MatchesService {
  constructor(private readonly repo: MatchesRepository) {}

  /** A partida é da conta da sessão: sem conta não se joga. */
  async create(input: CreateMatchInput, userId: string) {
    const playerId = await this.repo.playerOfUser(userId);
    const who = { userId, playerId };
    if (input.game === 'time') return this.createTime(input, who);
    if (input.game === 'eco') return this.createEco(input, who);
    return this.createColor(input, who);
  }

  /**
   * O Daily é uma partida só por dia, por jogo e por conta (vale para todos os aparelhos dela).
   * Reenviar a mesma partida (fila offline) continua valendo.
   */
  private async assertDailyAvailable(game: string, userId: string, matchId?: string) {
    const ids = await this.repo.playerIdsOf(userId);
    const since = periodStart('day')!;
    if (await this.repo.dailyPlayed(game, ids, since, matchId)) {
      throw new ConflictException('Você já jogou o Daily de hoje neste jogo');
    }
  }

  private async persist(input: CreateMatchInput, who: Who, scored: ScoredMatch, ranked: boolean) {
    const matchId = input.matchId ?? randomUUID();
    const saved = await this.repo.save({
      matchId,
      guestId: who.playerId,
      game: input.game,
      mode: input.mode,
      kind: input.kind,
      seed: input.seed,
      ranked,
      scored,
    });
    if (saved === 'conflict') throw new ConflictException('matchId já usado por outro jogador');
    return {
      matchId,
      rounds: scored.rounds.map((r) => ({ score: r.score })),
      total: scored.total,
    };
  }

  /**
   * Tempo: a nota sai dos ms medidos no aparelho. A sessão assinada pelo servidor prova quando a
   * partida começou, então tempos que somam mais do que o relógio do servidor viu são recusados.
   */
  private async createTime(input: TimeMatchInput, who: Who) {
    if (input.kind === 'daily') {
      if (input.seed !== dailySeed('time')) {
        throw new BadRequestException('Seed do Daily não é a de hoje');
      }
      if (input.mode !== 'classic') {
        throw new BadRequestException('O Daily só existe no modo classic');
      }
    }
    if (input.kind === 'daily') await this.assertDailyAvailable('time', who.userId, input.matchId);
    const session = verifyTimeSession(input.session);
    if (!session || session.seed !== input.seed) {
      throw new BadRequestException('Sessão da partida inválida ou expirada');
    }
    // Partida solo: a seed é de uma sessão só (senão dá para jogar o mesmo alvo de novo e de novo).
    if (input.kind === 'solo' && (await this.repo.seedUsed('time', input.seed, input.matchId))) {
      throw new ConflictException('Essa sessão já foi usada');
    }
    const scored = scoreTimeMatch({ ...input, elapsedMs: Date.now() - session.issuedAt });
    return this.persist(input, who, scored, input.mode in timePresets);
  }

  /**
   * Eco: a pontuação sai dos toques repassados contra a sequência da seed. A sessão assinada prova
   * quando a partida começou (para o tempo mínimo) e deixa a seed valer uma vez só no solo.
   */
  private async createEco(input: EcoMatchInput, who: Who) {
    if (input.kind === 'daily') {
      if (input.seed !== dailySeed('eco')) {
        throw new BadRequestException('Seed do Daily não é a de hoje');
      }
      if (input.mode !== 'classic') {
        throw new BadRequestException('O Daily só existe no modo classic');
      }
      await this.assertDailyAvailable('eco', who.userId, input.matchId);
    }
    const session = verifyTimeSession(input.session);
    if (!session || session.seed !== input.seed) {
      throw new BadRequestException('Sessão da partida inválida ou expirada');
    }
    if (input.kind === 'solo' && (await this.repo.seedUsed('eco', input.seed, input.matchId))) {
      throw new ConflictException('Essa sessão já foi usada');
    }
    const scored = scoreEcoMatch({ ...input, elapsedMs: Date.now() - session.issuedAt });
    return this.persist(input, who, scored, input.mode in ecoPresets);
  }

  private async createColor(input: ColorMatchInput, who: Who) {
    // Daily vale para o mundo todo: seed e modo são os do dia, não escolha do cliente.
    if (input.kind === 'daily') {
      if (input.seed !== dailySeed('color')) {
        throw new BadRequestException('Seed do Daily não é a de hoje');
      }
      if (input.mode !== 'classic') {
        throw new BadRequestException('O Daily só existe no modo classic');
      }
      await this.assertDailyAvailable('color', who.userId, input.matchId);
    }

    const scored = scoreMatch(input);
    // Só os modos padrão (presets) contam para ranking; salas personalizadas nunca.
    return this.persist(input, who, scored, input.mode in colorGame.presets);
  }

  /** Histórico da conta: todos os aparelhos vinculados a ela. */
  async historyOf(userId: string, query: HistoryQuery) {
    return this.repo.history(await this.repo.playerIdsOf(userId), query.limit, query.cursor, {
      game: query.game,
      mode: query.mode,
      kind: query.kind,
      since: periodStart(query.period),
    });
  }

  async claim(userId: string, guestId: string) {
    if ((await this.repo.claim(userId, guestId)) === 'conflict') {
      throw new ConflictException('Este aparelho já pertence a outra conta');
    }
    return { claimed: true };
  }

  /**
   * Recordes por modo, o Daily de cada jogo (sequência própria e nota de hoje) e a sequência de
   * dias seguidos entrando no app.
   */
  async statsOfUser(userId: string) {
    const ids = await this.repo.playerIdsOf(userId);
    const [modes, plays, today, visits] = await Promise.all([
      this.repo.modeStats(ids),
      this.repo.dailyPlays(ids),
      this.repo.dailyToday(ids, periodStart('day')!),
      this.repo.visitDays(userId),
    ]);
    const todayStr = dailyDate();
    const daily: Record<
      string,
      { current: number; best: number; playedToday: boolean; totalScore: number | null }
    > = {};
    for (const game of ['color', 'time', 'eco']) {
      const days = plays.filter((p) => p.game === game).map((p) => dailyDate(p.playedAt));
      const streak = dailyStreak(days, todayStr);
      const score = today.find((t) => t.game === game)?.totalScore ?? null;
      daily[game] = { ...streak, playedToday: days.includes(todayStr), totalScore: score };
    }
    return {
      modes,
      daily,
      visit: { ...dailyStreak(visits, todayStr), visitedToday: visits.includes(todayStr) },
    };
  }

  /** O app foi aberto hoje: grava o dia e devolve a sequência atualizada. */
  async visit(userId: string) {
    const day = dailyDate();
    await this.repo.recordVisit(userId, day);
    const streak = dailyStreak(await this.repo.visitDays(userId), day);
    return { ...streak, visitedToday: true };
  }
}
