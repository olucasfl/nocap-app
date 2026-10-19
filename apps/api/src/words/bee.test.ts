import { afterEach, describe, expect, it, vi } from 'vitest';
import { wordKey } from '@nocap/games';
import { BeePuzzles } from './bee-puzzles';
import { BeeService } from './bee.service';
import type { WordRun } from './words.repository';

describe('favos do Bee', () => {
  const puzzles = new BeePuzzles();

  it('todos os favos passam nas regras da spec', () => {
    expect(puzzles.problems()).toEqual([]);
    expect(puzzles.puzzles.length).toBeGreaterThanOrEqual(60);
  });

  it('não há dois favos com as mesmas letras nem nomes de favo repetidos', () => {
    const sets = puzzles.puzzles.map((p) => [p.center, ...p.letters].sort().join(''));
    expect(new Set(sets).size).toBe(sets.length);
    expect(new Set(puzzles.puzzles.map((p) => p.id)).size).toBe(puzzles.puzzles.length);
  });

  it('o dia 1 é o primeiro favo e o dia seguinte é o segundo; passando do último recomeça', () => {
    expect(puzzles.of('2026-10-19').puzzle.id).toBe(puzzles.puzzles[0]!.id);
    expect(puzzles.of('2026-10-20').puzzle.id).toBe(puzzles.puzzles[1]!.id);
    const n = puzzles.puzzles.length;
    const day = new Date(Date.parse('2026-10-19T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
    expect(puzzles.of(day).puzzle.id).toBe(puzzles.puzzles[0]!.id);
  });
});

function setup() {
  const rows = new Map<string, WordRun>();
  const calls: string[] = [];
  const runs = {
    byId: async (id: string, userId: string) => {
      const r = rows.get(id);
      return r && r.userId === userId ? r : null;
    },
    daily: async (userId: string, game: string, day: string) =>
      [...rows.values()].find((r) => r.userId === userId && r.game === game && r.day === day) ?? null,
    bySeed: async (userId: string, game: string, seed: string) =>
      [...rows.values()].find((r) => r.userId === userId && r.game === game && r.seed === seed) ?? null,
    openBefore: async (userId: string, game: string, day: string) =>
      [...rows.values()].filter((r) => r.userId === userId && r.game === game && r.state === 'open' && r.day !== null && r.day < day),
    create: async (row: Partial<WordRun>) => {
      const created = { id: crypto.randomUUID(), guesses: [], state: 'open', matchId: null, day: null, startedAt: new Date(), finishedAt: null, ...row } as WordRun;
      rows.set(created.id, created);
      return created;
    },
    update: async (id: string, patch: Partial<WordRun>) => {
      rows.set(id, { ...rows.get(id)!, ...patch });
    },
  };
  const matches = {
    playerOfUser: async () => 'p1',
    save: async () => {
      calls.push('save');
      return { duplicate: false };
    },
    updateScore: async () => {
      calls.push('update');
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new BeeService(runs as any, matches as any);
  return { service, rows, calls };
}

describe('Bee no servidor', () => {
  it('o Daily é um só por dia e retoma a mesma partida; a resposta traz só as letras', async () => {
    const { service } = setup();
    const a = await service.start('u1', 'daily');
    const b = await service.start('u1', 'daily');
    expect(b.id).toBe(a.id);
    expect(a.found).toEqual([]);
    expect(a.all).toBeNull();
    expect(JSON.stringify(a)).not.toContain('"words"');
  });

  it('palavra boa pontua, sobe a nota ao vivo e não conta duas vezes', async () => {
    const { service, calls } = setup();
    const run = await service.start('u1', 'daily');
    const puzzle = service.puzzles.byId(
      (await service.get('u1', run.id)).id && service.puzzles.of(run.day!).puzzle.id,
    )!;
    const [first, second] = puzzle.words.filter((w) => !w.pangram);
    const r1 = await service.move('u1', run.id, wordKey(first!.w));
    expect(r1.result).toBe('ok');
    const r2 = await service.move('u1', run.id, second!.w);
    expect(r2.result).toBe('ok');
    expect(calls).toEqual(['save', 'update']);
    expect(await service.move('u1', run.id, first!.w)).toEqual({ result: 'rejected', reason: 'dup' });
    const view = await service.get('u1', run.id);
    expect(view.found).toHaveLength(2);
    expect(view.all).toBeNull();
  });

  it('palavra fora do favo ou sem o centro é recusada sem pontuar', async () => {
    const { service } = setup();
    const run = await service.start('u1', 'daily');
    expect(await service.move('u1', run.id, 'xx')).toEqual({ result: 'rejected', reason: 'short' });
    expect(await service.move('u1', run.id, 'zzzzzz')).toMatchObject({ result: 'rejected' });
  });

  it('achar todas as palavras dá Rainha e nota 10; encerrar mostra o favo inteiro', async () => {
    const { service } = setup();
    const run = await service.start('u1', 'daily');
    const puzzle = service.puzzles.of(run.day!).puzzle;
    for (const w of puzzle.words) await service.move('u1', run.id, w.w);
    const view = await service.finish('u1', run.id);
    expect(view.rank.id).toBe('rainha');
    expect(view.nota).toBe(10);
    expect(view.closed).toBe(true);
    expect(view.all).toHaveLength(puzzle.words.length);
    await expect(service.move('u1', run.id, puzzle.words[0]!.w)).rejects.toThrow();
  });

  afterEach(() => vi.useRealTimers());

  it('o arquivo só aceita dias passados e não repete a partida', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T15:00:00Z'));
    const { service } = setup();
    await expect(service.start('u1', 'archive', '2999-01-01')).rejects.toThrow();
    const a = await service.start('u1', 'archive', '2026-10-25');
    const b = await service.start('u1', 'archive', '2026-10-25');
    expect(b.id).toBe(a.id);
    expect(a.kind).toBe('archive');
  });

  it('a partida de outra conta não aparece', async () => {
    const { service } = setup();
    const run = await service.start('u1', 'daily');
    await expect(service.get('u2', run.id)).rejects.toThrow();
  });
});
