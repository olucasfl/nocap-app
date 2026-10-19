import { describe, expect, it, vi } from 'vitest';
import { ConnectPuzzles } from './connect-puzzles';
import { ConnectService } from './connect.service';
import type { WordRun } from './words.repository';

describe('puzzles do Connect', () => {
  const puzzles = new ConnectPuzzles();

  it('todos passam nas regras da spec (uma divisão, 16 palavras diferentes, sem repetir em 14 dias)', () => {
    expect(puzzles.problems()).toEqual([]);
    expect(puzzles.puzzles.length).toBeGreaterThanOrEqual(12);
  });

  it('o dia 1 é o primeiro puzzle e o seguinte é o segundo', () => {
    expect(puzzles.of('2026-10-19').puzzle.id).toBe(puzzles.puzzles[0]!.id);
    expect(puzzles.of('2026-10-20').puzzle.id).toBe(puzzles.puzzles[1]!.id);
  });
});

function setup() {
  const rows = new Map<string, WordRun>();
  const saved: { ranked: boolean; kind: string }[] = [];
  const runs = {
    byId: async (id: string, userId: string) => {
      const r = rows.get(id);
      return r && r.userId === userId ? r : null;
    },
    daily: async (userId: string, game: string, day: string) =>
      [...rows.values()].find((r) => r.userId === userId && r.game === game && r.day === day) ?? null,
    bySeed: async (userId: string, game: string, seed: string) =>
      [...rows.values()].find((r) => r.userId === userId && r.game === game && r.seed === seed) ?? null,
    runsOf: async (userId: string, game: string) => [...rows.values()].filter((r) => r.userId === userId && r.game === game),
    puzzleRun: async (userId: string, game: string, puzzleId: string) =>
      [...rows.values()].find((r) => r.userId === userId && r.game === game && r.answers.includes(puzzleId)) ?? null,
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
    save: async (m: { ranked: boolean; kind: string }) => {
      saved.push(m);
      return { duplicate: false };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new ConnectService(runs as any, matches as any);
  return { service, saved };
}

describe('Connect no servidor', () => {
  it('a abertura traz as 16 palavras embaralhadas e nenhum grupo', async () => {
    const { service } = setup();
    const run = await service.start('u1', 'daily');
    expect(run.words).toHaveLength(16);
    expect(run.found).toEqual([]);
    expect(run.reveal).toBeNull();
    expect(run.lives).toBe(5);
    expect(JSON.stringify(run)).not.toContain('"title"');
    const again = await service.start('u1', 'daily');
    expect(again.words).toEqual(run.words);
  });

  it('acerto trava o grupo com título; "falta uma" e erro custam vida; repetido não custa', async () => {
    const { service } = setup();
    const run = await service.start('u1', 'daily');
    const puzzle = service.puzzles.of(run.day!).puzzle;
    const [g1, g2] = puzzle.groups;
    const ok = await service.move('u1', run.id, g1!.words);
    expect(ok.result).toBe('correct');
    if (ok.result === 'correct') expect(ok.group.title).toBe(g1!.title);
    const oneAway = [...g2!.words.slice(0, 3), puzzle.groups[2]!.words[0]!];
    const r1 = await service.move('u1', run.id, oneAway);
    expect(r1.result).toBe('one_away');
    expect(r1.run.lives).toBe(4);
    const r2 = await service.move('u1', run.id, oneAway);
    expect(r2.result).toBe('repeat');
    expect(r2.run.lives).toBe(4);
    const wrong = [g2!.words[0]!, g2!.words[1]!, puzzle.groups[2]!.words[0]!, puzzle.groups[3]!.words[0]!];
    expect((await service.move('u1', run.id, wrong)).result).toBe('wrong');
  });

  it('vencer salva a partida como ranqueada no Daily e mostra a nota', async () => {
    const { service, saved } = setup();
    const run = await service.start('u1', 'daily');
    const puzzle = service.puzzles.of(run.day!).puzzle;
    let last;
    for (const g of puzzle.groups) last = await service.move('u1', run.id, g.words);
    expect(last!.run.won).toBe(true);
    expect(last!.run.nota).toBe(10);
    expect(saved).toEqual([{ ...saved[0]!, ranked: true, kind: 'daily' }]);
    await expect(service.start('u1', 'daily')).rejects.toThrow();
  });

  it('perder revela os grupos que faltam', async () => {
    const { service } = setup();
    const run = await service.start('u1', 'daily');
    const puzzle = service.puzzles.of(run.day!).puzzle;
    const gs = puzzle.groups;
    const attempts = [
      [gs[0]!.words[0]!, gs[0]!.words[1]!, gs[1]!.words[0]!, gs[2]!.words[0]!],
      [gs[0]!.words[0]!, gs[0]!.words[2]!, gs[1]!.words[1]!, gs[2]!.words[1]!],
      [gs[0]!.words[0]!, gs[0]!.words[3]!, gs[1]!.words[2]!, gs[2]!.words[2]!],
      [gs[0]!.words[1]!, gs[0]!.words[2]!, gs[1]!.words[3]!, gs[3]!.words[0]!],
      [gs[0]!.words[1]!, gs[0]!.words[3]!, gs[3]!.words[1]!, gs[3]!.words[2]!],
    ];
    let last;
    for (const a of attempts) last = await service.move('u1', run.id, a);
    expect(last!.run.over).toBe(true);
    expect(last!.run.won).toBe(false);
    expect(last!.run.reveal).toHaveLength(4);
    expect(last!.run.nota).toBe(0);
  });

  it('palavras que não estão soltas ou repetidas são recusadas', async () => {
    const { service } = setup();
    const run = await service.start('u1', 'daily');
    await expect(service.move('u1', run.id, ['x', 'y', 'z', 'w'])).rejects.toThrow();
    await expect(service.move('u1', run.id, [run.words[0]!, run.words[0]!, run.words[1]!, run.words[2]!])).rejects.toThrow();
  });

  it('puzzle já jogado não volta: nem no arquivo, nem quando a lista dá a volta', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-19T15:00:00Z'));
    const { service } = setup();
    const first = await service.start('u1', 'daily');
    for (const g of service.puzzles.of(first.day!).puzzle.groups) await service.move('u1', first.id, g.words);
    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
    // o arquivo oferece o dia 19, que a conta já jogou
    await expect(service.start('u1', 'archive', '2026-10-19')).rejects.toThrow();
    // o arquivo deixa jogar um dia que a conta ainda não jogou
    const other = await service.start('u1', 'archive', '2026-10-20');
    expect(other.kind).toBe('archive');
    expect((await service.start('u1', 'archive', '2026-10-20')).id).toBe(other.id);
    // 100 dias depois o Daily repete o puzzle 1: quem já jogou não joga de novo
    vi.setSystemTime(new Date(Date.parse('2026-10-19T15:00:00Z') + service.puzzles.puzzles.length * 86_400_000));
    await expect(service.start('u1', 'daily')).rejects.toThrow();
    vi.useRealTimers();
  });

  it('jogo livre: qualquer hora, sem repetir puzzle e sem usar os próximos dias do Daily', async () => {
    const { service } = setup();
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const run = await service.start('u1', 'free');
      expect(run.kind).toBe('free');
      const puzzle = service.puzzles.puzzles.find((p) => p.groups.every((g) => g.words.every((w) => run.words.includes(w) || true)) && p.groups.flatMap((g) => g.words).sort().join() === [...run.words].sort().join());
      expect(puzzle).toBeDefined();
      expect(seen.has(puzzle!.id)).toBe(false);
      seen.add(puzzle!.id);
      const idx = service.puzzles.puzzles.findIndex((p) => p.id === puzzle!.id);
      expect(idx >= 30).toBe(true); // hoje é o dia 1: os 30 próximos ficam reservados ao Daily
      for (const g of puzzle!.groups) await service.move('u1', run.id, g.words);
    }
  });

  it('a partida de outra conta não aparece', async () => {
    const { service } = setup();
    const run = await service.start('u1', 'daily');
    await expect(service.get('u2', run.id)).rejects.toThrow();
  });
});
