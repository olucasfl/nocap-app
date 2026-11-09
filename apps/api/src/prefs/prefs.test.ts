import { describe, expect, it } from 'vitest';
import { blocksRunSchema, keepBlocksRun, prefsSchema, withBlocksRun } from './prefs.controller';

describe('prefsSchema', () => {
  it('aceita opções válidas e parciais', () => {
    expect(
      prefsSchema.safeParse({ fs: { sens: 0.1, binds: { fire: 'Mouse0' } }, mute: true }).success,
    ).toBe(true);
    expect(prefsSchema.safeParse({}).success).toBe(true);
  });
  it('recusa campos desconhecidos (desempenho fica no aparelho) e valores absurdos', () => {
    expect(prefsSchema.safeParse({ fs: { quality: 'low' } }).success).toBe(true); // fs é parcial; campo extra é descartado
    expect(prefsSchema.safeParse({ other: 1 }).success).toBe(false);
    expect(prefsSchema.safeParse({ fs: { sens: 99 } }).success).toBe(false);
  });
});

const run = {
  v: 1 as const,
  matchId: 'match-12345',
  seed: 'abcdef123456',
  session: 'tok',
  moves: [1, 2, 3],
  thumbs: 0,
  perfects: 0,
  hintsUsed: 1,
  before: 100,
  savedAt: 1,
};

describe('partida do Block Classic na conta', () => {
  it('valida o formato e recusa partida vazia, enorme ou com campo estranho', () => {
    expect(blocksRunSchema.safeParse(run).success).toBe(true);
    expect(blocksRunSchema.safeParse({ ...run, moves: [] }).success).toBe(false);
    expect(blocksRunSchema.safeParse({ ...run, moves: Array(3001).fill(1) }).success).toBe(false);
    expect(blocksRunSchema.safeParse({ ...run, extra: 1 }).success).toBe(false);
  });
  it('guardar e apagar a partida não mexe nas preferências', () => {
    const prefs = { mute: true, fs: { sens: 0.2 } };
    const saved = withBlocksRun(prefs, run);
    expect(saved).toMatchObject({ mute: true, blocksRun: { seed: 'abcdef123456' } });
    expect(withBlocksRun(saved, null)).toEqual(prefs);
    expect(withBlocksRun(undefined, run)).toEqual({ blocksRun: run });
  });
  it('gravar as preferências mantém a partida guardada', () => {
    expect(keepBlocksRun({ mute: false, blocksRun: run }, { mute: true })).toEqual({
      mute: true,
      blocksRun: run,
    });
    expect(keepBlocksRun(undefined, { mute: true })).toEqual({ mute: true });
  });
});
