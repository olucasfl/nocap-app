import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  dailySeed,
  ecoPresets,
  evaluateRun,
  expectedTaps,
  minDurationMs,
  type EcoSettings,
} from '@nocap/games';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ELAPSED_SLACK_MS, scoreEcoMatch } from './match-scoring';
import { createMatchSchema } from './match.schema';
import type { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';
import { issueTimeSession } from './time-session';

const USER = '99999999-9999-4999-8999-999999999999';
const createAs = (service: MatchesService, input: unknown) => service.create(input as never, USER);
const classic = ecoPresets.classic;

/** Toques perfeitos das `n` primeiras rodadas. */
const perfect = (seed: string, s: EcoSettings, n: number) =>
  Array.from({ length: n }, (_, i) => expectedTaps(seed, s, i + 1)).flat();

/** Uma partida que erra na rodada `n + 1` (acerta `n` e erra o primeiro toque da seguinte). */
function failingAfter(seed: string, s: EcoSettings, n: number): number[] {
  const next = expectedTaps(seed, s, n + 1)[0]!;
  return [...perfect(seed, s, n), (next + 1) % s.pads];
}

const needed = (seed: string, s: EcoSettings, taps: number[]) =>
  minDurationMs(s, evaluateRun(seed, s, taps));

describe('scoreEcoMatch', () => {
  it('conta os passos pelos toques e guarda em décimos', () => {
    const taps = failingAfter('s1', classic, 7);
    const scored = scoreEcoMatch({ mode: 'classic', seed: 's1', taps, elapsedMs: 9e9 });
    expect(scored.total).toBe(7);
    expect(scored.totalTenths).toBe(70);
    expect(scored.encodedAnswers).toEqual(taps);
    expect(scored.settings).toMatchObject({ pads: 4, startLength: 1, scoreVersion: 1 });
  });

  it('o Reverso espera a ordem inversa', () => {
    const s = ecoPresets.reverso;
    const taps = perfect('rv', s, 4);
    const scored = scoreEcoMatch({ mode: 'reverso', seed: 'rv', taps, elapsedMs: 9e9 });
    // 4 rodadas completas começando em 2 passos: a maior sequência tem 5
    expect(scored.total).toBe(5);
  });

  it('recusa modo desconhecido e botão que não existe no modo', () => {
    expect(() => scoreEcoMatch({ mode: 'zzz', seed: 's', taps: [0], elapsedMs: 9e9 })).toThrow(
      BadRequestException,
    );
    expect(() => scoreEcoMatch({ mode: 'classic', seed: 's', taps: [5], elapsedMs: 9e9 })).toThrow(
      'Botão inexistente',
    );
  });

  it('recusa toques depois do fim da partida (depois do erro)', () => {
    const taps = [...failingAfter('s1', classic, 3), 0, 1, 2];
    expect(() => scoreEcoMatch({ mode: 'classic', seed: 's1', taps, elapsedMs: 9e9 })).toThrow(
      'depois do fim',
    );
  });

  it('recusa partida mais rápida que a reprodução permite, e aceita no limite', () => {
    const taps = failingAfter('s1', classic, 10);
    const min = needed('s1', classic, taps);
    expect(() =>
      scoreEcoMatch({ mode: 'classic', seed: 's1', taps, elapsedMs: min - ELAPSED_SLACK_MS - 1 }),
    ).toThrow('rápida demais');
    expect(() =>
      scoreEcoMatch({ mode: 'classic', seed: 's1', taps, elapsedMs: min - ELAPSED_SLACK_MS }),
    ).not.toThrow();
  });

  it('zero passos também é uma partida válida (errou no primeiro toque)', () => {
    const first = expectedTaps('z', classic, 1)[0]!;
    const scored = scoreEcoMatch({
      mode: 'classic',
      seed: 'z',
      taps: [(first + 1) % 4],
      elapsedMs: 9e9,
    });
    expect(scored.total).toBe(0);
  });
});

describe('createMatchSchema (Eco)', () => {
  const base = {
    game: 'eco',
    mode: 'classic',
    kind: 'solo',
    seed: 'abc',
    taps: [0, 1, 2],
    session: 'x'.repeat(40),
  };

  it('aceita toques e sessão, e exige a sessão', () => {
    expect(createMatchSchema.safeParse(base).success).toBe(true);
    expect(createMatchSchema.safeParse({ ...base, session: undefined }).success).toBe(false);
  });

  it('não aceita botão fora de 0 a 8, toque quebrado, nem lista gigante', () => {
    for (const taps of [[-1], [9], [1.5], Array(1001).fill(0)]) {
      expect(createMatchSchema.safeParse({ ...base, taps }).success).toBe(false);
    }
  });

  it('ignora nota enviada pelo cliente', () => {
    expect(createMatchSchema.parse({ ...base, score: 40 })).not.toHaveProperty('score');
  });
});

describe('MatchesService (Eco)', () => {
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
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    return {
      game: 'eco' as const,
      mode: 'classic',
      kind: 'solo' as const,
      seed,
      taps: failingAfter(seed, classic, 6),
      session: issueTimeSession(seed, Date.now() - agoMs),
      ...over,
    };
  };

  it('salva uma partida plausível como ranked, com os passos recalculados', async () => {
    const { service, save } = setup();
    const res = await createAs(service, play('seed-a', 10 * 60_000));
    expect(res.total).toBe(6);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'eco', mode: 'classic', ranked: true }),
    );
  });

  it('recusa sessão de outra seed, adulterada ou ausente', async () => {
    const { service } = setup();
    const a = play('seed-a', 60_000);
    await expect(
      createAs(service, { ...a, session: issueTimeSession('outra', Date.now() - 60_000) }),
    ).rejects.toThrow('Sessão');
    await expect(createAs(service, { ...a, session: 'lixo.lixo' })).rejects.toThrow('Sessão');
  });

  it('recusa uma partida rápida demais para a sessão', async () => {
    const { service, save } = setup();
    await expect(createAs(service, play('seed-a', 3000))).rejects.toThrow('rápida demais');
    expect(save).not.toHaveBeenCalled();
  });

  it('uma sessão solo não pode ser usada de novo', async () => {
    const { service } = setup(true);
    await expect(createAs(service, play('seed-a', 10 * 60_000))).rejects.toThrow(ConflictException);
  });

  it('Daily exige a seed e o modo do dia', async () => {
    const { service } = setup();
    // A data falsa vem antes da seed do dia: senão o teste só passa no dia em que foi escrito.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    const ok = play(dailySeed('eco'), 10 * 60_000, { kind: 'daily' });
    await expect(createAs(service, { ...ok, seed: 'eco:1999-01-01' })).rejects.toThrow(
      'Seed do Daily',
    );
    await expect(createAs(service, { ...ok, mode: 'escalada' })).rejects.toThrow('Daily só existe');
  });
});
