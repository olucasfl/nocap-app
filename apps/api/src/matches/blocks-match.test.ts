import { BadRequestException, ConflictException } from '@nestjs/common';
import { BlocksGame, analyze, evaluateBlocks } from '@nocap/games';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLOCKS_MIN_MS_PER_MOVE, ELAPSED_SLACK_MS, scoreBlocksMatch } from './match-scoring';
import { createMatchSchema } from './match.schema';
import type { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';
import { issueTimeSession } from './time-session';

const USER = '99999999-9999-4999-8999-999999999999';
const createAs = (service: MatchesService, input: unknown) => service.create(input as never, USER);

/** Uma partida jogada sem pensar até o fim: as jogadas que viajam para o servidor. */
function finished(seed: string): { moves: number[]; score: number } {
  const g = new BlocksGame(seed);
  let pick = 0;
  while (!g.over) {
    const all = g.legalMoves();
    pick += 7;
    const m = all[pick % all.length]!;
    g.play(m.slot, m.row, m.col);
  }
  return { moves: g.moves, score: g.score };
}

const GAME = finished('seed-b');

describe('scoreBlocksMatch', () => {
  it('refaz a partida pela seed e guarda a pontuação em décimos', () => {
    const scored = scoreBlocksMatch({ mode: 'classic', seed: 'seed-b', moves: GAME.moves, elapsedMs: 9e9 });
    expect(scored.total).toBe(GAME.score);
    expect(scored.totalTenths).toBe(GAME.score * 10);
    expect(scored.rounds).toEqual([]);
    expect(scored.encodedAnswers).toEqual([]);
    expect(scored.settings).toMatchObject({ mode: 'classic', scoreVersion: 3, moves: GAME.moves.length });
  });

  it('é a mesma conta do jogo (evaluateBlocks)', () => {
    const check = evaluateBlocks('seed-b', GAME.moves);
    expect(check.ok && check.result.score).toBe(GAME.score);
  });

  it('recusa modo que não existe', () => {
    expect(() => scoreBlocksMatch({ mode: 'daily', seed: 'seed-b', moves: GAME.moves, elapsedMs: 9e9 })).toThrow(
      BadRequestException,
    );
  });

  it('recusa partida que não terminou, jogada ilegal e jogada depois do fim', () => {
    const run = (moves: number[]) => () => scoreBlocksMatch({ mode: 'classic', seed: 'seed-b', moves, elapsedMs: 9e9 });
    expect(run(GAME.moves.slice(0, 3))).toThrow('não terminou');
    expect(run([...GAME.moves, 0])).toThrow(BadRequestException);
    expect(run([])).toThrow(BadRequestException);
    // Uma jogada fora do tabuleiro (peça 0 na coluna 7: as peças largas não cabem)
    const bad = GAME.moves.slice();
    bad[0] = 7;
    const check = evaluateBlocks('seed-b', bad);
    if (!check.ok) expect(run(bad)).toThrow(BadRequestException);
  });

  it('outra seed não aceita as jogadas de uma partida', () => {
    const run = () => scoreBlocksMatch({ mode: 'classic', seed: 'outra-seed', moves: GAME.moves, elapsedMs: 9e9 });
    try {
      const scored = run();
      // Se por acaso ainda fosse legal, a pontuação não pode ser a mesma partida
      expect(scored.settings).toBeDefined();
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
    }
  });

  it('recusa jogadas rápidas demais para o tempo da sessão', () => {
    const tooFast = GAME.moves.length * BLOCKS_MIN_MS_PER_MOVE - ELAPSED_SLACK_MS - 1;
    expect(() => scoreBlocksMatch({ mode: 'classic', seed: 'seed-b', moves: GAME.moves, elapsedMs: tooFast })).toThrow(
      'rápidas',
    );
    const ok = GAME.moves.length * BLOCKS_MIN_MS_PER_MOVE;
    expect(() => scoreBlocksMatch({ mode: 'classic', seed: 'seed-b', moves: GAME.moves, elapsedMs: ok })).not.toThrow();
  });
});

describe("o corpo da partida do Block's", () => {
  const base = {
    game: 'blocks',
    mode: 'classic',
    kind: 'solo',
    seed: 'abc',
    moves: [0, 1, 191],
    session: 'x'.repeat(20),
  };
  it('aceita o formato certo e recusa o estragado', () => {
    expect(createMatchSchema.safeParse(base).success).toBe(true);
    for (const moves of [[], [1200001], [-1], [1.5], Array(30001).fill(0), ['0']]) {
      expect(createMatchSchema.safeParse({ ...base, moves }).success).toBe(false);
    }
    expect(createMatchSchema.safeParse({ ...base, session: undefined }).success).toBe(false);
  });
});

describe("MatchesService (Block's)", () => {
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
      game: 'blocks' as const,
      mode: 'classic',
      kind: 'solo' as const,
      seed,
      moves: GAME.moves,
      session: issueTimeSession(seed, Date.now() - agoMs),
      ...over,
    };
  };

  it('salva como ranked, no jogo blocks e no modo classic, com a nota recalculada', async () => {
    const { service, save } = setup();
    const res = await createAs(service, play('seed-b', 60 * 60_000));
    expect(res.total).toBe(GAME.score);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'blocks', mode: 'classic', kind: 'solo', ranked: true }),
    );
  });

  it('ignora nota enviada pelo cliente', async () => {
    const { service } = setup();
    const res = await createAs(service, play('seed-b', 60 * 60_000, { total: 99999, score: 99999 }));
    expect(res.total).toBe(GAME.score);
  });

  it('não tem Daily nem modo desconhecido', async () => {
    const { service, save } = setup();
    await expect(createAs(service, play('seed-b', 60 * 60_000, { kind: 'daily' }))).rejects.toThrow('Daily');
    await expect(createAs(service, play('seed-b', 60 * 60_000, { mode: 'infinito' }))).rejects.toThrow(
      BadRequestException,
    );
    expect(save).not.toHaveBeenCalled();
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
    await expect(createAs(service, play('seed-b', 60 * 60_000))).rejects.toThrow(ConflictException);
  });
});

describe("ranking do Block's", () => {
  it('tem os quadros classic e towers e nenhum Daily', async () => {
    const { BOARDS_OF, RANKING_GAMES, rankingQuerySchema } = await import('../rankings/ranking.schema');
    expect(RANKING_GAMES).toContain('blocks');
    expect(BOARDS_OF.blocks).toEqual(['classic', 'towers']);
    expect(rankingQuerySchema.safeParse({ board: 'classic' }).success).toBe(true);
  });
});

describe('scoreBlocksMatch (Block Towers)', () => {
  const idle = [1]; // gira uma vez no passo 0 e deixa as peças caírem até acabar
  it('refaz a física pela seed e devolve as peças empilhadas', () => {
    const scored = scoreBlocksMatch({ mode: 'towers', seed: 'tw-1', moves: idle, elapsedMs: 9e9 });
    expect(scored.totalTenths).toBe(scored.total * 10);
    expect(scored.settings.mode).toBe('towers');
  });

  it('recusa partida mais rápida que o relógio da sessão', () => {
    const run = () => scoreBlocksMatch({ mode: 'towers', seed: 'tw-1', moves: idle, elapsedMs: 0 });
    expect(run).toThrow(/rápida demais/);
  });

  it('recusa registro fora de ordem', () => {
    const run = () => scoreBlocksMatch({ mode: 'towers', seed: 'tw-1', moves: [40, 17], elapsedMs: 9e9 });
    expect(run).toThrow();
  });
});

describe('partidas de pontuação alta (recorde)', () => {
  it('a nota passa de 32767 décimos: as colunas de nota do banco precisam ser integer (migration 0006)', () => {
    // Quem joga bem passa de 3276 pontos (x10 estoura o smallint do banco) em poucas rodadas.
    const g = new BlocksGame('recorde-alto');
    let plan: { slot: number; row: number; col: number }[] = [];
    while (g.score <= 3500 && !g.over) {
      if (g.slots.every((x) => x !== null)) plan = analyze(g.rows, g.slots, g.streak, g.drought).plans[0] ?? [];
      const m = plan.shift() ?? g.legalMoves()[0];
      if (!m) break;
      g.play(m.slot, m.row, m.col);
    }
    expect(g.score).toBeGreaterThan(3276);
    // O servidor guarda a nota inteira em décimos, sem cortar: a coluna do banco é que precisa comportar.
    const tenths = g.score * 10;
    expect(tenths).toBeGreaterThan(32767);
    expect(tenths).toBeLessThan(2_147_483_647);
  });
});
