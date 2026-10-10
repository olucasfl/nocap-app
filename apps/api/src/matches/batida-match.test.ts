import { BadRequestException, ConflictException } from '@nestjs/common';
import { SONGS, barStart, evaluateBatida, notesBetween, notesInBar } from '@nocap/games';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ELAPSED_SLACK_MS, scoreBatidaMatch } from './match-scoring';
import { createMatchSchema } from './match.schema';
import type { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';
import { issueTimeSession } from './time-session';

const USER = '99999999-9999-4999-8999-999999999999';
const SONG = SONGS.mare;
/** [pista, apertou, soltou] */
type Beat = [number, number, number];
const createAs = (service: MatchesService, input: unknown) => service.create(input as never, USER);

/** Toques perfeitos nas notas dos primeiros `bars` compassos, no formato [pista, instante]. */
function perfectBeats(seed: string, bars: number): Beat[] {
  const out: Beat[] = [];
  for (let bar = 0; bar < bars; bar++) {
    for (const n of notesInBar(seed, SONG, bar))
      out.push([n.lane, Math.round(n.t), n.endT ? Math.round(n.endT) + 10 : Math.round(n.t) + 40]);
  }
  return out.sort((a, b) => a[1] - b[1]);
}

describe('scoreBatidaMatch', () => {
  it('refaz a nota pelos toques e guarda em décimos', () => {
    const beats = perfectBeats('b1', 30);
    const scored = scoreBatidaMatch({ seed: 'b1', song: SONG, beats, elapsedMs: 9e9 });
    const expected = evaluateBatida(
      'b1',
      SONG,
      beats.map(([lane, t, up]) => ({ lane, t, up })),
    );
    expect(scored.totalTenths).toBe(expected.tenths);
    expect(scored.totalTenths).toBeGreaterThan(0);
    expect(scored.total).toBe(expected.tenths / 10);
    expect(scored.settings).toMatchObject({ mode: 'batida-mare', scoreVersion: 2 });
  });

  it('sem toques é uma partida válida de zero pontos (a energia acaba sozinha)', () => {
    const scored = scoreBatidaMatch({ seed: 'b1', song: SONG, beats: [], elapsedMs: 9e9 });
    expect(scored.totalTenths).toBe(0);
  });

  it('recusa pista inválida, instante quebrado, fora de ordem e rajada impossível', () => {
    const bad = (beats: Beat[]) =>
      expect(() => scoreBatidaMatch({ seed: 'b1', song: SONG, beats, elapsedMs: 9e9 })).toThrow(
        BadRequestException,
      );
    bad([[5, 1000, 1040]]);
    bad([[0, 1000.5, 1040]]);
    bad([[0, 1000, 1000]]);
    bad([
      [0, 2000, 2040],
      [1, 1500, 1540],
    ]);
    bad([
      [2, 3000, 3005],
      [2, 3010, 3020],
    ]);
  });

  it('recusa toque depois de a energia acabar', () => {
    // Para de tocar cedo: a energia acaba sozinha, e um toque muito depois já não conta.
    const early = perfectBeats('b1', 4);
    const last = early[early.length - 1]![1];
    const beats: Beat[] = [...early.map((b) => b), [0, last + 60_000, last + 60_040]];
    expect(() => scoreBatidaMatch({ seed: 'b1', song: SONG, beats, elapsedMs: 9e9 })).toThrow(
      'depois do fim',
    );
  });

  it('recusa partida mais longa do que o relógio do servidor viu, e aceita no limite', () => {
    const beats = perfectBeats('b1', 12);
    const end = evaluateBatida(
      'b1',
      SONG,
      beats.map(([lane, t, up]) => ({ lane, t, up })),
    ).endedAtMs;
    expect(() =>
      scoreBatidaMatch({ seed: 'b1', song: SONG, beats, elapsedMs: end - ELAPSED_SLACK_MS - 1 }),
    ).toThrow('rápida demais');
    expect(() =>
      scoreBatidaMatch({ seed: 'b1', song: SONG, beats, elapsedMs: end - ELAPSED_SLACK_MS }),
    ).not.toThrow();
  });

  it('o resultado é o mesmo do que o jogo calcula (mesma música, mesmas regras)', () => {
    // Pula uma nota a cada 5: o servidor tem que contar os mesmos erros que o aparelho contou.
    const beats = perfectBeats('b2', 25).filter((_, i) => i % 5 !== 0);
    const server = scoreBatidaMatch({ seed: 'b2', song: SONG, beats, elapsedMs: 9e9 });
    const client = evaluateBatida(
      'b2',
      SONG,
      beats.map(([lane, t, up]) => ({ lane, t, up })),
    );
    expect(server.totalTenths).toBe(client.tenths);
  });
});

describe('scoreBatidaMatch: notas longas e acordes', () => {
  it('segurar as notas longas até o fim soma pontos que soltar cedo não soma', () => {
    const song = SONGS.frenesi;
    const holdsHeld = perfectBeats('hold-seed', 40);
    // (perfectBeats usa a mesma música "mare"; para o Frenesi monta os toques dele)
    const beats: Beat[] = [];
    for (let bar = 0; bar < 40; bar++) {
      for (const n of notesInBar('hold-seed', song, bar)) {
        beats.push([
          n.lane,
          Math.round(n.t),
          n.endT ? Math.round(n.endT) + 10 : Math.round(n.t) + 40,
        ]);
      }
    }
    beats.sort((a, b) => a[1] - b[1]);
    const held = scoreBatidaMatch({ seed: 'hold-seed', song, beats, elapsedMs: 9e9 });
    const early = scoreBatidaMatch({
      seed: 'hold-seed',
      song,
      beats: beats.map((b) => [b[0], b[1], b[2] > b[1] + 100 ? b[1] + 40 : b[2]] as Beat),
      elapsedMs: 9e9,
    });
    expect(holdsHeld.length).toBeGreaterThan(0);
    expect(held.settings).toMatchObject({ holds: expect.any(Number), scoreVersion: 2 });
    expect(Number((held.settings as { holds: number }).holds)).toBeGreaterThan(0);
    expect(held.totalTenths).toBeGreaterThan(early.totalTenths);
  });

  it('recusa apertar de novo uma pista que ainda está apertada', () => {
    const beats: Beat[] = [
      [1, 3000, 4000],
      [1, 3500, 3600],
    ];
    expect(() => scoreBatidaMatch({ seed: 'b1', song: SONG, beats, elapsedMs: 9e9 })).toThrow(
      'sem soltar',
    );
  });
});

describe('createMatchSchema (Batida)', () => {
  const base = {
    game: 'eco',
    mode: 'batida-mare',
    kind: 'solo',
    seed: 'abc',
    beats: [
      [0, 1500, 1540],
      [3, 1900, 1940],
    ],
    session: 'x'.repeat(40),
  };

  it('aceita os toques com instante e a sessão', () => {
    expect(createMatchSchema.safeParse(base).success).toBe(true);
    expect(createMatchSchema.safeParse({ ...base, session: undefined }).success).toBe(false);
  });

  it('as sequências do Ecooo continuam sem precisar de `beats`', () => {
    const eco = {
      game: 'eco',
      mode: 'classic',
      kind: 'solo',
      seed: 'a',
      taps: [0],
      session: 'x'.repeat(40),
    };
    expect(createMatchSchema.safeParse(eco).success).toBe(true);
  });

  it('não aceita pista fora de 0 a 4, instante negativo nem lista gigante', () => {
    for (const beats of [
      [[5, 1000, 1040]],
      [[0, -1, 5]],
      [[0, 1.5, 9]],
      [[0, 100]],
      Array(6001).fill([0, 1, 2]),
    ]) {
      expect(createMatchSchema.safeParse({ ...base, beats }).success).toBe(false);
    }
  });
});

describe('MatchesService (Batida)', () => {
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
      game: 'eco' as const,
      mode: 'batida-mare',
      kind: 'solo' as const,
      seed,
      beats: perfectBeats(seed, 10),
      session: issueTimeSession(seed, Date.now() - agoMs),
      ...over,
    };
  };

  it('salva como ranked, no jogo eco e modo batida, com a nota recalculada', async () => {
    const { service, save } = setup();
    const res = await createAs(service, play('seed-b', 10 * 60_000));
    expect(res.total).toBeGreaterThan(0);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'eco', mode: 'batida-mare', kind: 'solo', ranked: true }),
    );
  });

  it('o Batida ainda não tem Daily', async () => {
    const { service } = setup();
    await expect(createAs(service, play('seed-b', 10 * 60_000, { kind: 'daily' }))).rejects.toThrow(
      'Daily',
    );
  });

  it('recusa sessão de outra seed ou adulterada', async () => {
    const { service } = setup();
    const a = play('seed-b', 60_000);
    await expect(
      createAs(service, { ...a, session: issueTimeSession('outra', Date.now() - 60_000) }),
    ).rejects.toThrow('Sessão');
    await expect(createAs(service, { ...a, session: 'lixo.lixo' })).rejects.toThrow('Sessão');
  });

  it('uma sessão não pode ser usada de novo', async () => {
    const { service } = setup(true);
    await expect(createAs(service, play('seed-b', 10 * 60_000))).rejects.toThrow(ConflictException);
  });

  it('recusa partida mais longa do que o tempo da sessão', async () => {
    const { service, save } = setup();
    await expect(createAs(service, play('seed-b', 3000))).rejects.toThrow('rápida demais');
    expect(save).not.toHaveBeenCalled();
  });

  it('cada música é um modo próprio no ranking (batida-passo, batida-mare, batida-frenesi)', async () => {
    for (const id of ['passo', 'mare', 'frenesi'] as const) {
      const { service, save } = setup();
      const seed = `seed-${id}`;
      const beats = [] as Beat[];
      for (let bar = 0; bar < 10; bar++) {
        for (const n of notesInBar(seed, SONGS[id], bar))
          beats.push([
            n.lane,
            Math.round(n.t),
            n.endT ? Math.round(n.endT) + 10 : Math.round(n.t) + 40,
          ]);
      }
      beats.sort((a, b) => a[1] - b[1]);
      await createAs(service, play(seed, 10 * 60_000, { mode: `batida-${id}`, beats }));
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ game: 'eco', mode: `batida-${id}`, ranked: true }),
      );
    }
  });

  it('recusa música que não existe, e o modo "batida" sem música não vira Batida', async () => {
    const { service, save } = setup();
    await expect(
      createAs(service, play('seed-b', 10 * 60_000, { mode: 'batida-xyz' })),
    ).rejects.toThrow(BadRequestException);
    await expect(
      createAs(service, play('seed-b', 10 * 60_000, { mode: 'batida' })),
    ).rejects.toThrow(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('as notas usadas no teste existem (a música não está vazia)', () => {
    expect(notesBetween('seed-b', SONG, 0, barStart(SONG, 10)).length).toBeGreaterThan(20);
  });
});
