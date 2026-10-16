import { BadRequestException, ConflictException } from '@nestjs/common';
import { evaluateAtravessa } from '@nocap/games';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ELAPSED_SLACK_MS, scoreAtravessaMatch } from './match-scoring';
import { createMatchSchema } from './match.schema';
import type { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';
import { issueTimeSession } from './time-session';

const USER = '99999999-9999-4999-8999-999999999999';
type Step = [number, number];
const createAs = (service: MatchesService, input: unknown) => service.create(input as never, USER);

/** Um jogador que só anda para a frente: a partida acaba em morte logo (na seed s1, atropelado na primeira estrada). */
const TWO: Step[] = Array.from({ length: 60 }, (_, i): Step => [1 + i * 14, 0]);
const asSteps = (s: Step[]) => s.map(([t, d]) => ({ t, d: d as 0 | 1 | 2 | 3 }));

describe('scoreAtravessaMatch', () => {
  it('refaz a partida pelos passos e guarda a nota em décimos', () => {
    const scored = scoreAtravessaMatch({ mode: 'infinito', seed: 's1', steps: TWO, elapsedMs: 9e9 });
    const expected = evaluateAtravessa('s1', asSteps(TWO));
    expect(expected.end).toBe('veiculo');
    expect(expected.score).toBe(0);
    expect(scored.total).toBe(0);
    expect(scored.totalTenths).toBe(0);
    expect(scored.rounds).toEqual([]);
    expect(scored.encodedAnswers).toEqual([]);
    expect(scored.settings).toMatchObject({ mode: 'infinito', scoreVersion: 1, ended: 'veiculo' });
  });

  it('mesma seed e mesmos passos dão sempre a mesma nota', () => {
    const a = scoreAtravessaMatch({ mode: 'infinito', seed: 'x', steps: TWO, elapsedMs: 9e9 });
    const b = scoreAtravessaMatch({ mode: 'infinito', seed: 'x', steps: TWO, elapsedMs: 9e9 });
    expect(a.totalTenths).toBe(b.totalTenths);
  });

  it('recusa modo que não existe', () => {
    expect(() => scoreAtravessaMatch({ mode: 'daily', seed: 's', steps: TWO, elapsedMs: 9e9 })).toThrow(
      BadRequestException,
    );
  });

  it('recusa passos fora de ordem', () => {
    expect(() =>
      scoreAtravessaMatch({
        mode: 'infinito',
        seed: 's',
        steps: [
          [20, 0],
          [5, 0],
        ],
        elapsedMs: 9e9,
      }),
    ).toThrow('Passos inválidos');
  });

  it('recusa partida que não terminou no tempo da sessão', () => {
    // sem escuridão, quem não faz nada na largada nunca morre: a partida não terminou
    expect(() => scoreAtravessaMatch({ mode: 'infinito', seed: 's1', steps: [], elapsedMs: 9e9 })).toThrow('não terminou');
  });

  it('aceita no limite do relógio do servidor e recusa um pouco antes', () => {
    const ticks = evaluateAtravessa('s1', asSteps(TWO)).ticks;
    const ms = (ticks / 60) * 1000;
    expect(() =>
      scoreAtravessaMatch({ mode: 'infinito', seed: 's1', steps: TWO, elapsedMs: ms - ELAPSED_SLACK_MS + 50 }),
    ).not.toThrow();
    expect(() =>
      scoreAtravessaMatch({ mode: 'infinito', seed: 's1', steps: TWO, elapsedMs: ms - ELAPSED_SLACK_MS - 2000 }),
    ).toThrow('não terminou');
  });
});

describe('o corpo da partida do Atravessa!', () => {
  const base = {
    game: 'atravessa',
    mode: 'infinito',
    kind: 'solo',
    seed: 'abc',
    steps: [[1, 0]],
    session: 'x'.repeat(20),
  };
  it('aceita o formato certo e recusa o estragado', () => {
    expect(createMatchSchema.safeParse(base).success).toBe(true);
    for (const steps of [[[0, 0]], [[1, 4]], [[1, -1]], [[1.5, 0]], [[1]], Array(20_001).fill([1, 0])]) {
      expect(createMatchSchema.safeParse({ ...base, steps }).success).toBe(false);
    }
    expect(createMatchSchema.safeParse({ ...base, session: undefined }).success).toBe(false);
  });
});

describe('MatchesService (Atravessa!)', () => {
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
      game: 'atravessa' as const,
      mode: 'infinito',
      kind: 'solo' as const,
      seed,
      steps: TWO,
      session: issueTimeSession(seed, Date.now() - agoMs),
      ...over,
    };
  };

  it('salva como ranked, no jogo atravessa e no modo infinito, com a nota recalculada', async () => {
    const { service, save } = setup();
    const res = await createAs(service, play('seed-a', 10 * 60_000));
    expect(res.total).toBe(evaluateAtravessa('seed-a', asSteps(TWO)).score);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'atravessa', mode: 'infinito', kind: 'solo', ranked: true }),
    );
  });

  it('ignora nota enviada pelo cliente: vale a que o servidor refez', async () => {
    const { service } = setup();
    const res = await createAs(service, play('seed-a', 10 * 60_000, { total: 99999, score: 99999 }));
    expect(res.total).toBe(evaluateAtravessa('seed-a', asSteps(TWO)).score);
  });

  it('não tem Daily nem modo desconhecido', async () => {
    const { service, save } = setup();
    await expect(createAs(service, play('seed-a', 10 * 60_000, { kind: 'daily' }))).rejects.toThrow('Daily');
    await expect(createAs(service, play('seed-a', 10 * 60_000, { mode: 'classic' }))).rejects.toThrow(
      BadRequestException,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('recusa sessão de outra seed ou adulterada', async () => {
    const { service } = setup();
    const a = play('seed-a', 60_000);
    await expect(
      createAs(service, { ...a, session: issueTimeSession('outra', Date.now() - 60_000) }),
    ).rejects.toThrow('Sessão');
    await expect(createAs(service, { ...a, session: 'lixo.lixo' })).rejects.toThrow('Sessão');
  });

  it('uma sessão não pode ser usada de novo', async () => {
    const { service } = setup(true);
    await expect(createAs(service, play('seed-a', 10 * 60_000))).rejects.toThrow(ConflictException);
  });

  it('recusa partida mais longa do que o tempo da sessão', async () => {
    const { service, save } = setup();
    // o herói espera 50 s na largada e só então anda: a sessão de 0,5 s não cobre a morte dele
    const late = Array.from({ length: 60 }, (_, i): Step => [3000 + i * 14, 0]);
    await expect(createAs(service, play('seed-a', 500, { steps: late }))).rejects.toThrow('não terminou');
    expect(save).not.toHaveBeenCalled();
  });
});

describe('ranking do Atravessa!', () => {
  it('tem só o quadro infinito, sem Daily', async () => {
    const { BOARDS_OF, RANKING_GAMES, rankingQuerySchema } = await import('../rankings/ranking.schema');
    expect(RANKING_GAMES).toContain('atravessa');
    expect(BOARDS_OF.atravessa).toEqual(['infinito']);
    expect(rankingQuerySchema.safeParse({ board: 'infinito' }).success).toBe(true);
  });
});
