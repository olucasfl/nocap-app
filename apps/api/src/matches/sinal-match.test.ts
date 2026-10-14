import { BadRequestException, ConflictException } from '@nestjs/common';
import { evaluateSinal } from '@nocap/games';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ELAPSED_SLACK_MS, scoreSinalMatch } from './match-scoring';
import { createMatchSchema } from './match.schema';
import type { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';
import { issueTimeSession } from './time-session';

const USER = '99999999-9999-4999-8999-999999999999';
/** [passo, x, y] */
type Move = [number, number, number];
const createAs = (service: MatchesService, input: unknown) => service.create(input as never, USER);

/** Anda sempre para a frente: o Vigia acaba vendo (a corrida termina em poucos segundos). */
const WALK: Move[] = [[0, 0, 100]];
const asInputs = (m: Move[]) => m.map(([tick, x, y]) => ({ tick, x, y }));

describe('scoreSinalMatch', () => {
  it('refaz a corrida pelos movimentos e guarda a distância em décimos', () => {
    const scored = scoreSinalMatch({ mode: 'infinito', seed: 's1', inputs: WALK, elapsedMs: 9e9 });
    const expected = evaluateSinal('s1', 'infinito', asInputs(WALK));
    expect(expected.ended).not.toBeNull();
    expect(scored.totalTenths).toBe(expected.tenths);
    expect(scored.total).toBe(expected.tenths / 10);
    expect(scored.totalTenths).toBeGreaterThan(0);
    expect(scored.rounds).toEqual([]);
    expect(scored.encodedAnswers).toEqual([]);
    expect(scored.settings).toMatchObject({ mode: 'infinito', scoreVersion: 1, ended: expected.ended });
  });

  it('o Clássico também: conta as fases cumpridas e a distância total', () => {
    const scored = scoreSinalMatch({ mode: 'classico', seed: 's2', inputs: WALK, elapsedMs: 9e9 });
    const expected = evaluateSinal('s2', 'classico', asInputs(WALK));
    expect(scored.totalTenths).toBe(expected.tenths);
    expect(scored.settings).toMatchObject({ mode: 'classico', phases: expected.phases });
  });

  it('mesma seed e mesmos movimentos dão sempre a mesma nota; outra seed pode dar outra', () => {
    const a = scoreSinalMatch({ mode: 'infinito', seed: 'x', inputs: WALK, elapsedMs: 9e9 });
    const b = scoreSinalMatch({ mode: 'infinito', seed: 'x', inputs: WALK, elapsedMs: 9e9 });
    expect(a.totalTenths).toBe(b.totalTenths);
  });

  it('recusa modo que não existe', () => {
    expect(() => scoreSinalMatch({ mode: 'daily', seed: 's', inputs: WALK, elapsedMs: 9e9 })).toThrow(
      BadRequestException,
    );
  });

  it('recusa movimentos fora de ordem ou repetidos', () => {
    const bad = (inputs: Move[]) =>
      expect(() => scoreSinalMatch({ mode: 'infinito', seed: 's', inputs, elapsedMs: 9e9 })).toThrow(
        BadRequestException,
      );
    bad([
      [10, 0, 100],
      [5, 0, 0],
    ]);
    bad([
      [10, 0, 100],
      [10, 0, 0],
    ]);
  });

  it('recusa corrida que não terminou (parado por pouco tempo, ou mais longa que a sessão)', () => {
    // sessão de 3 s: a corrida refeita só vai até aí, e quem anda não acabou ainda
    expect(() =>
      scoreSinalMatch({ mode: 'infinito', seed: 's1', inputs: [[0, 0, 0]], elapsedMs: 1000 }),
    ).toThrow('não terminou');
  });

  it('aceita no limite do relógio do servidor e recusa um pouco antes', () => {
    const ended = evaluateSinal('s1', 'infinito', asInputs(WALK)).endedTick;
    const ms = (ended / 60) * 1000;
    expect(() =>
      scoreSinalMatch({ mode: 'infinito', seed: 's1', inputs: WALK, elapsedMs: ms - ELAPSED_SLACK_MS + 50 }),
    ).not.toThrow();
    expect(() =>
      scoreSinalMatch({ mode: 'infinito', seed: 's1', inputs: WALK, elapsedMs: ms - ELAPSED_SLACK_MS - 2000 }),
    ).toThrow('não terminou');
  });
});

describe('o corpo da partida do Sinal Vermelho', () => {
  const base = {
    game: 'sinal',
    mode: 'infinito',
    kind: 'solo',
    seed: 'abc',
    inputs: [[0, 0, 100]],
    session: 'x'.repeat(20),
  };
  it('aceita o formato certo e recusa o estragado', () => {
    expect(createMatchSchema.safeParse(base).success).toBe(true);
    for (const inputs of [
      [[0, 128, 0]],
      [[0, 0, -101]],
      [[-1, 0, 0]],
      [[0.5, 0, 0]],
      [[0, 0]],
      Array(40_001).fill([0, 0, 0]),
    ]) {
      expect(createMatchSchema.safeParse({ ...base, inputs }).success).toBe(false);
    }
    expect(createMatchSchema.safeParse({ ...base, session: undefined }).success).toBe(false);
  });
});

describe('MatchesService (Sinal Vermelho)', () => {
  afterEach(() => vi.useRealTimers());

  const setup = (seedUsed = false) => {
    const save = vi.fn().mockResolvedValue({ duplicate: false });
    const repo = {
      save,
      seedUsed: vi.fn().mockResolvedValue(seedUsed),
      playerOfUser: vi.fn().mockResolvedValue('player-of-user'),
      playerIdsOf: vi.fn().mockResolvedValue(['player-of-user']),
      dailyPlayed: vi.fn().mockResolvedValue(false),
    } as unknown as MatchesRepository;
    return { service: new MatchesService(repo), save };
  };

  const play = (seed: string, agoMs: number, over: Record<string, unknown> = {}) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    return {
      game: 'sinal' as const,
      mode: 'infinito',
      kind: 'solo' as const,
      seed,
      inputs: WALK,
      session: issueTimeSession(seed, Date.now() - agoMs),
      ...over,
    };
  };

  it('salva como ranked, no jogo sinal e no modo escolhido, com a nota recalculada', async () => {
    for (const mode of ['infinito', 'classico']) {
      const { service, save } = setup();
      const res = await createAs(service, play('seed-s', 10 * 60_000, { mode }));
      expect(res.total).toBeGreaterThan(0);
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ game: 'sinal', mode, kind: 'solo', ranked: true }),
      );
    }
  });

  it('ignora nota enviada pelo cliente: vale a que o servidor refez', async () => {
    const { service } = setup();
    const res = await createAs(service, play('seed-s', 10 * 60_000, { total: 99999, score: 99999 }));
    expect(res.total).toBe(evaluateSinal('seed-s', 'infinito', asInputs(WALK)).tenths / 10);
  });

  it('não tem Daily nem modo desconhecido', async () => {
    const { service, save } = setup();
    await expect(createAs(service, play('seed-s', 10 * 60_000, { kind: 'daily' }))).rejects.toThrow('Daily');
    await expect(createAs(service, play('seed-s', 10 * 60_000, { mode: 'classic' }))).rejects.toThrow(
      BadRequestException,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('recusa sessão de outra seed ou adulterada', async () => {
    const { service } = setup();
    const a = play('seed-s', 60_000);
    await expect(
      createAs(service, { ...a, session: issueTimeSession('outra', Date.now() - 60_000) }),
    ).rejects.toThrow('Sessão');
    await expect(createAs(service, { ...a, session: 'lixo.lixo' })).rejects.toThrow('Sessão');
  });

  it('uma sessão não pode ser usada de novo', async () => {
    const { service } = setup(true);
    await expect(createAs(service, play('seed-s', 10 * 60_000))).rejects.toThrow(ConflictException);
  });

  it('recusa corrida mais longa do que o tempo da sessão', async () => {
    const { service, save } = setup();
    await expect(createAs(service, play('seed-s', 500))).rejects.toThrow('não terminou');
    expect(save).not.toHaveBeenCalled();
  });
});

describe('ranking do Sinal Vermelho', () => {
  it('tem os quadros infinito e classico, e nenhum Daily', async () => {
    const { BOARDS_OF, RANKING_GAMES, rankingQuerySchema } = await import('../rankings/ranking.schema');
    expect(RANKING_GAMES).toContain('sinal');
    expect(BOARDS_OF.sinal).toEqual(['infinito', 'classico']);
    expect(rankingQuerySchema.safeParse({ board: 'infinito' }).success).toBe(true);
    expect(rankingQuerySchema.safeParse({ board: 'classico' }).success).toBe(true);
  });
});
