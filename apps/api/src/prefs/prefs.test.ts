import { describe, expect, it } from 'vitest';
import { blocksRunSchema, gpSchema, keepBlocksRun, mergeGp, prefsSchema, withBlocksRun } from './prefs.controller';

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

describe('Fox GP na conta (14/11/2026)', () => {
  it('aceita garagem, comandos e melhores voltas; recusa lixo', () => {
    const ok = {
      garage: { fur: 0xff7d26, paint: { body: 1 }, kart: { body: 2 } },
      binds: { left: ['KeyA', 'ArrowLeft'] },
      best: { marina: 71234 },
      guide: true,
      physics: 'real',
      vehicle: 'f1',
    };
    expect(gpSchema.safeParse(ok).success).toBe(true);
    expect(gpSchema.safeParse({ ...ok, best: { marina: -1 } }).success).toBe(false);
    expect(gpSchema.safeParse({ ...ok, physics: 'x' }).success).toBe(false);
    expect(gpSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });

  it('a melhor volta nunca piora ao mesclar, e salvar preferências não apaga o Fox GP', () => {
    const merged = mergeGp({ best: { marina: 70000, interlagos: 90000 }, guide: true }, { best: { marina: 72000, interlagos: 88000 }, guide: false });
    expect(merged.best).toEqual({ marina: 70000, interlagos: 88000 });
    expect(merged.guide).toBe(false);
    expect(keepBlocksRun({ gp: merged }, { mute: true }).gp).toEqual(merged);
  });
});
