import { BadRequestException, ConflictException } from '@nestjs/common';
import { colorGame, dailySeed, encodeAnswer } from '@nocap/games';
import { describe, expect, it, vi } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor';
import { scoreMatch } from './match-scoring';
import { createMatchSchema, historyQuerySchema } from './match.schema';
import { MatchesService } from './matches.service';
import type { MatchesRepository } from './matches.repository';

const settings = colorGame.presets.classic!;
const GUEST = '11111111-1111-4111-8111-111111111111';
const USER = '99999999-9999-4999-8999-999999999999';
const PLAYER = 'player-of-user';

/** Toda partida é de uma conta: o serviço recebe o id dela. */
const createAs = (service: MatchesService, input: unknown) => service.create(input as never, USER);

/** Respostas perfeitas: a própria cor-alvo regenerada pela seed. */
const perfectAnswers = (seed: string) =>
  Array.from({ length: settings.rounds }, (_, i) => colorGame.generateRound(seed, settings, i));

const fakeRepo = (
  result: { duplicate: boolean } | 'conflict' = { duplicate: false },
  dailyAlreadyPlayed = false,
) => {
  const save = vi.fn().mockResolvedValue(result);
  const dailyPlayed = vi.fn().mockResolvedValue(dailyAlreadyPlayed);
  const playerOfUser = vi.fn().mockResolvedValue(PLAYER);
  const playerIdsOf = vi.fn().mockResolvedValue([PLAYER]);
  return {
    repo: {
      save,
      history: vi.fn(),
      dailyPlayed,
      playerOfUser,
      playerIdsOf,
    } as unknown as MatchesRepository,
    save,
    dailyPlayed,
  };
};

describe('scoreMatch', () => {
  it('recalcula a nota pela seed: respostas perfeitas dão 50', () => {
    const scored = scoreMatch({ mode: 'classic', seed: 's1', answers: perfectAnswers('s1') });
    expect(scored.total).toBe(50);
    expect(scored.totalTenths).toBe(500);
    expect(scored.rounds.every((r) => r.score === 10)).toBe(true);
  });

  it('respostas ruins valem menos que perfeitas', () => {
    const bad = Array.from({ length: 5 }, () => ({ h: 0, s: 0, b: 0 }));
    const scored = scoreMatch({ mode: 'classic', seed: 's1', answers: bad });
    expect(scored.total).toBeLessThan(50);
    expect(scored.total).toBeGreaterThanOrEqual(0);
  });

  it('codifica as respostas como h*10000+s*100+b', () => {
    const answers = perfectAnswers('s2');
    const scored = scoreMatch({ mode: 'classic', seed: 's2', answers });
    expect(scored.encodedAnswers).toEqual(answers.map(encodeAnswer));
  });

  it('recusa modo desconhecido e quantidade errada de respostas', () => {
    expect(() => scoreMatch({ mode: 'zzz', seed: 's', answers: perfectAnswers('s') })).toThrow(
      BadRequestException,
    );
    expect(() =>
      scoreMatch({ mode: 'classic', seed: 's', answers: perfectAnswers('s').slice(0, 3) }),
    ).toThrow(BadRequestException);
  });
});

describe('createMatchSchema', () => {
  const base = {
    game: 'color',
    mode: 'classic',
    kind: 'solo',
    seed: 'abc',
    guestId: GUEST,
    answers: [{ h: 10, s: 50, b: 50 }],
  };

  it('aceita um corpo válido e ignora nota enviada pelo cliente', () => {
    const parsed = createMatchSchema.parse({ ...base, score: 50, total: 50 });
    expect(parsed).not.toHaveProperty('score');
    expect(parsed).not.toHaveProperty('total');
  });

  it('rejeita jogo, kind, uuid e faixa HSB inválidos', () => {
    expect(createMatchSchema.safeParse({ ...base, game: 'time' }).success).toBe(false);
    expect(createMatchSchema.safeParse({ ...base, kind: 'room' }).success).toBe(false);
    expect(createMatchSchema.safeParse({ ...base, guestId: 'x' }).success).toBe(false);
    expect(
      createMatchSchema.safeParse({ ...base, answers: [{ h: 400, s: 50, b: 50 }] }).success,
    ).toBe(false);
    expect(createMatchSchema.safeParse({ ...base, answers: [] }).success).toBe(false);
  });
});

describe('historyQuerySchema', () => {
  it('usa limit 20 por padrão e limita a 50', () => {
    expect(historyQuerySchema.parse({}).limit).toBe(20);
    expect(historyQuerySchema.safeParse({ limit: '100' }).success).toBe(false);
  });
});

describe('cursor', () => {
  it('encode/decode é reversível e recusa lixo', () => {
    const c = {
      playedAt: '2026-03-10T12:00:00.123Z',
      matchId: '22222222-2222-4222-8222-222222222222',
    };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(() => decodeCursor('lixo')).toThrow(BadRequestException);
  });
});

describe('MatchesService.create', () => {
  const body = (over = {}) => ({
    game: 'color' as const,
    mode: 'classic',
    kind: 'solo' as const,
    seed: 'seed-x',
    guestId: GUEST,
    answers: perfectAnswers('seed-x'),
    ...over,
  });

  it('salva com a nota recalculada e marca preset como ranked', async () => {
    const { repo, save } = fakeRepo();
    const res = await createAs(new MatchesService(repo), body());
    expect(res.total).toBe(50);
    expect(res.rounds).toHaveLength(5);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        ranked: true,
        scored: expect.objectContaining({ totalTenths: 500 }),
      }),
    );
  });

  it('reenvio com o mesmo matchId devolve o mesmo id', async () => {
    const { repo } = fakeRepo({ duplicate: true });
    const matchId = '33333333-3333-4333-8333-333333333333';
    const res = await createAs(new MatchesService(repo), body({ matchId }));
    expect(res.matchId).toBe(matchId);
  });

  it('matchId de outro jogador vira 409', async () => {
    const { repo } = fakeRepo('conflict');
    await expect(createAs(new MatchesService(repo), body())).rejects.toThrow(ConflictException);
  });

  it('Daily exige a seed de hoje e o modo classic', async () => {
    const { repo, save } = fakeRepo();
    const service = new MatchesService(repo);
    await expect(
      createAs(service, body({ kind: 'daily', seed: 'color:2000-01-01' })),
    ).rejects.toThrow(BadRequestException);
    const today = dailySeed('color');
    await expect(
      createAs(
        service,
        body({ kind: 'daily', seed: today, mode: 'flash', answers: perfectAnswers(today) }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(save).not.toHaveBeenCalled();

    const ok = await createAs(
      service,
      body({ kind: 'daily', seed: today, answers: perfectAnswers(today) }),
    );
    expect(ok.total).toBe(50);
  });
});

describe('Daily: uma partida por dia', () => {
  const body = (over = {}) => ({
    game: 'color' as const,
    mode: 'classic',
    kind: 'solo' as const,
    seed: 'seed-x',
    guestId: GUEST,
    answers: perfectAnswers('seed-x'),
    ...over,
  });
  const today = dailySeed('color');
  const daily = (over: Record<string, unknown> = {}) =>
    body({ kind: 'daily', seed: today, answers: perfectAnswers(today), ...over });

  it('quem já jogou o Daily de hoje não joga de novo (409) e nada é salvo', async () => {
    const { repo, save } = fakeRepo({ duplicate: false }, true);
    await expect(createAs(new MatchesService(repo), daily())).rejects.toThrow(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });

  it('confere pelas contas e aparelhos da pessoa, só neste jogo, e libera o reenvio do mesmo matchId', async () => {
    const { repo, dailyPlayed } = fakeRepo();
    const matchId = '22222222-2222-4222-8222-222222222222';
    await createAs(new MatchesService(repo), daily({ matchId }));
    expect(dailyPlayed).toHaveBeenCalledWith('color', [PLAYER], expect.any(Date), matchId);
  });

  it('partida solo não é limitada por dia', async () => {
    const { repo, dailyPlayed } = fakeRepo({ duplicate: false }, true);
    await createAs(new MatchesService(repo), body());
    expect(dailyPlayed).not.toHaveBeenCalled();
  });
});

describe('scoreMatch (modo rápido)', () => {
  const quick = colorGame.presets.quick!;
  const one = (seed: string) => [colorGame.generateRound(seed, quick, 0)];

  it('tem 1 rodada e vale no máximo 10', () => {
    const scored = scoreMatch({ mode: 'quick', seed: 'q1', answers: one('q1') });
    expect(scored.rounds).toHaveLength(1);
    expect(scored.total).toBe(10);
    expect(scored.totalTenths).toBe(100);
  });

  it('recusa 5 respostas no modo rápido', () => {
    const five = Array.from({ length: 5 }, () => one('q1')[0]!);
    expect(() => scoreMatch({ mode: 'quick', seed: 'q1', answers: five })).toThrow();
  });
});
