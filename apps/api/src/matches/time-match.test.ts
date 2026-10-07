import { BadRequestException, ConflictException } from '@nestjs/common';
import { dailySeed, generateTimeRound, timePresets } from '@nocap/games';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ELAPSED_SLACK_MS, scoreTimeMatch } from './match-scoring';
import { createMatchSchema } from './match.schema';
import type { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';
import { issueTimeSession } from './time-session';

const GUEST = '11111111-1111-4111-8111-111111111111';
const USER = '99999999-9999-4999-8999-999999999999';
const createAs = (service: MatchesService, input: unknown) => service.create(input as never, USER);
const classic = timePresets.classic!;

/** Respostas exatas: o tempo do próprio alvo. */
const exact = (seed: string, rounds = classic.rounds) =>
  Array.from({ length: rounds }, (_, i) => generateTimeRound(seed, classic, i));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe('scoreTimeMatch', () => {
  it('respostas exatas valem 50 e a nota é recalculada no servidor', () => {
    const answers = exact('s1');
    const scored = scoreTimeMatch({
      mode: 'classic',
      seed: 's1',
      answers,
      elapsedMs: sum(answers),
    });
    expect(scored.total).toBe(50);
    expect(scored.encodedAnswers).toEqual(answers);
    expect(scored.settings).toMatchObject({ rounds: 5, scoreVersion: 1 });
  });

  it('errar vale menos e fica em [0, 50]', () => {
    const answers = exact('s1').map((t) => Math.round(t * 1.2));
    const scored = scoreTimeMatch({
      mode: 'classic',
      seed: 's1',
      answers,
      elapsedMs: sum(answers),
    });
    expect(scored.total).toBeLessThan(50);
    expect(scored.total).toBeGreaterThan(0);
  });

  it('"sem estourar": passou do alvo vale zero na rodada', () => {
    const t = generateTimeRound('s1', timePresets.strict!, 0);
    const answers = exact('s1').map((x, i) => (i === 0 ? t + 500 : x));
    const scored = scoreTimeMatch({ mode: 'strict', seed: 's1', answers, elapsedMs: sum(answers) });
    expect(scored.rounds[0]!.score).toBe(0);
    expect(scored.rounds[1]!.score).toBe(10);
  });

  it('recusa modo desconhecido e número errado de rodadas', () => {
    expect(() =>
      scoreTimeMatch({ mode: 'zzz', seed: 's', answers: [5000], elapsedMs: 9e9 }),
    ).toThrow(BadRequestException);
    expect(() =>
      scoreTimeMatch({ mode: 'classic', seed: 's', answers: [5000], elapsedMs: 9e9 }),
    ).toThrow(BadRequestException);
  });

  it('recusa tempo fora do plausível (toque duplo e contagem absurda)', () => {
    const answers = exact('s1');
    const tooShort = answers.map((x, i) => (i === 2 ? 100 : x));
    const tooLong = answers.map((x, i) => (i === 2 ? x * 4 : x));
    for (const a of [tooShort, tooLong]) {
      expect(() =>
        scoreTimeMatch({ mode: 'classic', seed: 's1', answers: a, elapsedMs: 9e9 }),
      ).toThrow('fora do plausível');
    }
  });

  it('recusa quando os tempos somam mais do que o relógio do servidor viu', () => {
    const answers = exact('s1');
    expect(() =>
      scoreTimeMatch({
        mode: 'classic',
        seed: 's1',
        answers,
        elapsedMs: sum(answers) - ELAPSED_SLACK_MS - 1,
      }),
    ).toThrow('mais do que o tempo da partida');
    expect(() =>
      scoreTimeMatch({
        mode: 'classic',
        seed: 's1',
        answers,
        elapsedMs: sum(answers) - ELAPSED_SLACK_MS,
      }),
    ).not.toThrow();
  });
});

describe('createMatchSchema (Tempo)', () => {
  const base = {
    game: 'time',
    mode: 'classic',
    kind: 'solo',
    seed: 'abc',
    guestId: GUEST,
    answers: [5000],
    session: 'x'.repeat(40),
  };

  it('aceita o Tempo com ms e sessão, e exige a sessão', () => {
    expect(createMatchSchema.safeParse(base).success).toBe(true);
    expect(createMatchSchema.safeParse({ ...base, session: undefined }).success).toBe(false);
  });

  it('não aceita ms negativo, quebrado ou gigante, nem cor no Tempo', () => {
    for (const answers of [[-1], [10.5], [9_000_000]]) {
      expect(createMatchSchema.safeParse({ ...base, answers }).success).toBe(false);
    }
    expect(createMatchSchema.safeParse({ ...base, answers: [{ h: 1, s: 1, b: 1 }] }).success).toBe(
      false,
    );
  });

  it('ignora nota enviada pelo cliente', () => {
    const parsed = createMatchSchema.parse({ ...base, score: 50, total: 50 });
    expect(parsed).not.toHaveProperty('score');
  });
});

describe('MatchesService (Tempo)', () => {
  afterEach(() => vi.useRealTimers());

  const setup = (seedUsed = false) => {
    const save = vi.fn().mockResolvedValue({ duplicate: false });
    const seedUsedFn = vi.fn().mockResolvedValue(seedUsed);
    const repo = {
      save,
      seedUsed: seedUsedFn,
      playerOfUser: vi.fn().mockResolvedValue('player-of-user'),
      playerIdsOf: vi.fn().mockResolvedValue(['player-of-user']),
      dailyPlayed: vi.fn().mockResolvedValue(false),
    } as unknown as MatchesRepository;
    return { service: new MatchesService(repo), save, seedUsed: seedUsedFn };
  };

  /** Sessão iniciada há `agoMs` (o relógio é congelado para o teste ser exato). */
  const play = (seed: string, agoMs: number, over: Record<string, unknown> = {}) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    const answers = exact(seed);
    return {
      game: 'time' as const,
      mode: 'classic',
      kind: 'solo' as const,
      seed,
      guestId: GUEST,
      answers,
      session: issueTimeSession(seed, Date.now() - agoMs),
      ...over,
    };
  };

  it('salva uma partida plausível como ranked, com nota recalculada', async () => {
    const { service, save } = setup();
    const input = play('seed-a', sum(exact('seed-a')) + 2000);
    const res = await createAs(service, input);
    expect(res.total).toBe(50);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ game: 'time', ranked: true }));
  });

  it('recusa sessão de outra seed, adulterada ou ausente', async () => {
    const { service } = setup();
    const a = play('seed-a', 60_000);
    await expect(
      createAs(service, { ...a, session: issueTimeSession('outra', Date.now() - 60_000) }),
    ).rejects.toThrow('Sessão');
    await expect(createAs(service, { ...a, session: 'lixo.lixo' })).rejects.toThrow('Sessão');
  });

  it('recusa respostas que não cabem no tempo decorrido', async () => {
    const { service, save } = setup();
    const input = play('seed-a', 5000);
    await expect(createAs(service, input)).rejects.toThrow('mais do que o tempo da partida');
    expect(save).not.toHaveBeenCalled();
  });

  it('uma sessão solo não pode ser usada de novo', async () => {
    const { service } = setup(true);
    const input = play('seed-a', 10 * 60_000);
    await expect(createAs(service, input)).rejects.toThrow(ConflictException);
  });

  it('Daily exige a seed e o modo do dia', async () => {
    const { service } = setup();
    const seed = dailySeed('time');
    const ok = play(seed, 10 * 60_000, { kind: 'daily' });
    // o relógio falso muda o "dia": usa a seed do dia congelado
    await expect(createAs(service, { ...ok, seed: 'time:1999-01-01' })).rejects.toThrow(
      'Seed do Daily',
    );
    await expect(createAs(service, { ...ok, mode: 'quick' })).rejects.toThrow();
  });
});
