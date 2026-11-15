import { describe, expect, it } from 'vitest';
import {
  blocksRunSchema,
  golfSchema,
  gpSchema,
  keepBlocksRun,
  mergeGolf,
  mergeGp,
  mergeNh,
  nhSchema,
  prefsSchema,
  withBlocksRun,
} from './prefs.controller';

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
      physics: 'real',
      vehicle: 'f1',
    };
    expect(gpSchema.safeParse(ok).success).toBe(true);
    expect(gpSchema.safeParse({ ...ok, best: { marina: -1 } }).success).toBe(false);
    expect(gpSchema.safeParse({ ...ok, physics: 'x' }).success).toBe(false);
    expect(gpSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });

  it('a melhor volta nunca piora ao mesclar, e salvar preferências não apaga o Fox GP', () => {
    const merged = mergeGp(
      { best: { marina: 70000, interlagos: 90000 } },
      { best: { marina: 72000, interlagos: 88000 } },
    );
    expect(merged.best).toEqual({ marina: 70000, interlagos: 88000 });
    expect(keepBlocksRun({ gp: merged }, { mute: true }).gp).toEqual(merged);
  });

  it('Mini Golf: aceita bola e melhores marcas, recusa lixo, a menor marca nunca piora e outras preferências não apagam', () => {
    const ok = { ball: { color: 0x2f5bff, finish: 'estrela', trail: 'fogo' }, best: { '3': 2 } };
    expect(golfSchema.safeParse(ok).success).toBe(true);
    expect(golfSchema.safeParse({ ball: { ...ok.ball, finish: 'inexistente' } }).success).toBe(
      false,
    );
    expect(golfSchema.safeParse({ best: { '3': 0 } }).success).toBe(false);
    expect(golfSchema.safeParse({ best: { '3': 19 } }).success).toBe(false);
    expect(golfSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    const merged = mergeGolf({ best: { '3': 2, '4': 5 } }, { best: { '3': 4, '4': 3 } });
    expect(merged.best).toEqual({ '3': 2, '4': 3 });
    expect(keepBlocksRun({ golf: merged }, { mute: true }).golf).toEqual(merged);
  });
});

describe('Night Hunt na conta (spec 083)', () => {
  const ok = {
    v: 1 as const,
    rev: 5,
    gold: 120,
    highscore: 301.5,
    meta: { health: 2, reroll: 1 },
    stats: { runs: 3, kills: 200, upgradeBest: { halo: 6 } },
    achievements: { 'first-blood': 1731700000000 },
    seen: ['halo', 'axe'],
    heroes: ['kael', 'mara'],
    pick: { hero: 'mara', map: 'campo' },
    music: true,
    sound: true,
    damageNumbers: true,
    flashes: true,
  };
  it('valida formato e limites', () => {
    expect(nhSchema.safeParse(ok).success).toBe(true);
    expect(nhSchema.safeParse({ ...ok, gold: -1 }).success).toBe(false);
    expect(nhSchema.safeParse({ ...ok, gold: 1e12 }).success).toBe(false);
    expect(nhSchema.safeParse({ ...ok, meta: { health: 9 } }).success).toBe(false);
    expect(nhSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(nhSchema.safeParse({ ...ok, heroes: Array(30).fill('x') }).success).toBe(false);
  });
  it('um aparelho desatualizado não desfaz o progresso da conta', () => {
    const newer = { ...ok, rev: 9, gold: 500 };
    expect(mergeNh(newer, ok)).toBe(newer);
    expect(mergeNh(ok, newer)).toBe(newer);
    expect(mergeNh(undefined, ok)).toBe(ok);
  });
  it('gravar as preferências não apaga o save do Night Hunt', () => {
    expect(keepBlocksRun({ nh: ok }, { mute: true }).nh).toEqual(ok);
  });
});
