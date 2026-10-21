import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { newSave, press, type SaveState } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { AuthGuard } from '../auth/auth.guard';
import { ApertaController } from './aperta.controller';
import type { ApertaRepository, SaveFields, SaveRow } from './aperta.repository';
import { ApertaService, RECOVERY_DAYS } from './aperta.service';

const DAY = 86_400_000;
const T0 = Date.parse('2026-10-21T12:00:00Z');

/** Repositório em memória com a mesma atomicidade do SQL: `update` só grava se a revisão ainda bate. */
function memoryRepo() {
  const rows = new Map<string, SaveRow>();
  const key = (u: string, s: number) => `${u}:${s}`;
  const repo = {
    all: async (u: string) => [...rows].filter(([k]) => k.startsWith(`${u}:`)).map(([, r]) => ({ ...r })),
    get: async (u: string, s: number) => {
      const r = rows.get(key(u, s));
      return r ? { ...r } : null;
    },
    create: async (u: string, s: number, f: SaveFields, now: Date) => {
      const old = rows.get(key(u, s));
      if (old && !old.deletedAt) return null;
      const row: SaveRow = { slot: s, ...f, revision: 1, createdAt: now, updatedAt: now, deletedAt: null };
      rows.set(key(u, s), row);
      return { ...row };
    },
    update: async (u: string, s: number, base: number, f: SaveFields, now: Date) => {
      const old = rows.get(key(u, s));
      if (!old || old.deletedAt || old.revision !== base) return null;
      const row: SaveRow = { ...old, ...f, revision: old.revision + 1, updatedAt: now };
      rows.set(key(u, s), row);
      return { ...row };
    },
    softDelete: async (u: string, s: number, now: Date) => {
      const old = rows.get(key(u, s));
      if (!old || old.deletedAt) return false;
      old.deletedAt = now;
      return true;
    },
    restore: async (u: string, s: number) => {
      const old = rows.get(key(u, s));
      if (!old?.deletedAt) return null;
      old.deletedAt = null;
      return { ...old };
    },
    purgeDeletedBefore: async (u: string, before: Date) => {
      for (const [k, r] of rows) if (k.startsWith(`${u}:`) && r.deletedAt && r.deletedAt < before) rows.delete(k);
    },
  } as unknown as ApertaRepository;
  return repo;
}

function setup() {
  let t = T0;
  const service = new ApertaService(memoryRepo());
  service.clock = () => t;
  return { service, advance: (ms: number) => (t += ms) };
}

/** Um save que um aparelho jogou por alguns segundos. */
function played(taps: number, base: SaveState = newSave('seed', T0)): SaveState {
  let s = base;
  for (let i = 1; i <= taps; i++) s = press(s, base.clock + i * 0.2);
  return { ...s, playSeconds: taps * 0.2 };
}

const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as { getStatus?: () => number }).getStatus?.() ?? 500;
  }
};
const body = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as { getResponse: () => Record<string, unknown> }).getResponse();
  }
  throw new Error('não falhou');
};

describe('lista e leitura', () => {
  it('começa com os 2 espaços vazios', async () => {
    const { service } = setup();
    expect(await service.list('u')).toEqual([
      { slot: 1, save: null, recoverableUntil: null },
      { slot: 2, save: null, recoverableUntil: null },
    ]);
  });

  it('cria, lista o resumo e devolve o save completo', async () => {
    const { service } = setup();
    const r = await service.put('u', 2, { data: newSave('a', T0), baseRevision: 0 });
    expect(r).toMatchObject({ revision: 1, flagged: [] });
    const [one, two] = await service.list('u');
    expect(one!.save).toBeNull();
    expect(two!.save).toMatchObject({ slot: 2, name: 'Missão Perigeu', collapses: 0, atlasPages: 0, storySeen: false, revision: 1 });
    expect((await service.get('u', 2)).data.name).toBe('Missão Perigeu');
    expect(await status(service.get('u', 1))).toBe(404);
  });

  it('cada conta só vê os próprios saves', async () => {
    const { service } = setup();
    await service.put('u', 1, { data: newSave('a', T0), baseRevision: 0 });
    expect((await service.list('outra'))[0]!.save).toBeNull();
    expect(await status(service.get('outra', 1))).toBe(404);
  });
});

describe('gravação (formato, coerência e versão)', () => {
  it('grava a revisão seguinte e guarda o que mudou', async () => {
    const { service } = setup();
    await service.put('u', 1, { data: newSave('a', T0), baseRevision: 0 });
    const r = await service.put('u', 1, { data: played(40), baseRevision: 1 });
    expect(r.revision).toBe(2);
    expect((await service.get('u', 1)).data.run.clicks).toBeGreaterThan(0);
  });

  it('recusa formato inválido com 400 e a lista do que está errado', async () => {
    const { service } = setup();
    for (const data of [null, { lixo: 1 }, { ...newSave('a', T0), run: { ...newSave('a').run, dust: -5 } }]) {
      const res = await body(service.put('u', 1, { data, baseRevision: 0 }));
      expect(res).toMatchObject({ code: 'invalid-save' });
    }
    expect(await status(service.put('u', 1, { data: 'x', baseRevision: 0 }))).toBe(400);
    expect((await service.list('u'))[0]!.save).toBeNull();
  });

  it('recusa incoerência: melhoria que custa mais que a poeira, conteúdo de colapso futuro', async () => {
    const { service } = setup();
    const s = newSave('a', T0);
    const levels = s.run.upgradeLevels.slice();
    levels[0] = 30;
    expect(await status(service.put('u', 1, { data: { ...s, run: { ...s.run, upgradeLevels: levels } }, baseRevision: 0 }))).toBe(400);
    expect(await status(service.put('u', 1, { data: { ...s, regionId: 'oort-cloud' }, baseRevision: 0 }))).toBe(400);
  });

  it('corta o tempo jogado impossível e avisa, sem recusar', async () => {
    const { service } = setup();
    const r = await service.put('u', 1, { data: { ...newSave('a', T0), playSeconds: 999_999 }, baseRevision: 0 });
    expect(r.flagged).toContain('playSeconds');
    expect(r.data!.playSeconds).toBeLessThan(200);
    expect((await service.get('u', 1)).data.playSeconds).toBeLessThan(200);
  });

  it('o tempo desde a criação vem do relógio do servidor, não do aparelho', async () => {
    const { service, advance } = setup();
    await service.put('u', 1, { data: newSave('a', 0), baseRevision: 0 });
    advance(3_600_000);
    const ok = await service.put('u', 1, { data: { ...played(10), playSeconds: 3000 }, baseRevision: 1 });
    expect(ok.flagged).toEqual([]);
    const cheat = await service.put('u', 1, { data: { ...played(10), playSeconds: 90_000 }, baseRevision: 2 });
    expect(cheat.flagged).toContain('playSeconds');
  });

  it('espaço que não é 1 nem 2 dá 400 no controlador', async () => {
    const c = new ApertaController(setup().service);
    const req = { user: { id: 'u' } } as never;
    expect(await status(Promise.resolve().then(() => c.get(req, 3)))).toBe(400);
    expect(await status(Promise.resolve().then(() => c.get(req, 0)))).toBe(400);
  });
});

describe('vários aparelhos', () => {
  it('revisão velha dá 409 com o save da conta e a junção proposta; nada é sobrescrito', async () => {
    const { service } = setup();
    await service.put('u', 1, { data: newSave('a', T0), baseRevision: 0 });
    const phone = played(60);
    await service.put('u', 1, { data: phone, baseRevision: 1 }); // celular grava (revisão 2)
    const res = await body(service.put('u', 1, { data: played(20), baseRevision: 1 })); // PC ainda na 1
    expect(res).toMatchObject({ code: 'conflict', reason: 'stale', current: { revision: 2 } });
    const merged = (res as { merged: { data: SaveState } }).merged.data;
    expect(merged.run.clicks).toBe(phone.run.clicks); // fica com o mais adiantado
    expect((await service.get('u', 1)).data.run.clicks).toBe(phone.run.clicks);
  });

  it('depois do 409 o aparelho grava a junção com a revisão nova', async () => {
    const { service } = setup();
    await service.put('u', 1, { data: newSave('a', T0), baseRevision: 0 });
    await service.put('u', 1, { data: played(60), baseRevision: 1 });
    const res = (await body(service.put('u', 1, { data: played(20), baseRevision: 1 }))) as {
      current: { revision: number };
      merged: { data: SaveState };
    };
    const r = await service.put('u', 1, { data: res.merged.data, baseRevision: res.current.revision });
    expect(r.revision).toBe(3);
  });

  it('concorrência: dois aparelhos gravando ao mesmo tempo, um ganha e o outro recebe 409', async () => {
    const { service } = setup();
    await service.put('u', 1, { data: newSave('a', T0), baseRevision: 0 });
    const results = await Promise.all([
      status(service.put('u', 1, { data: played(30), baseRevision: 1 })),
      status(service.put('u', 1, { data: played(50), baseRevision: 1 })),
    ]);
    expect(results.sort()).toEqual([200, 409]);
    expect((await service.list('u'))[0]!.save!.revision).toBe(2);
  });

  it('criar em espaço ocupado dá 409', async () => {
    const { service } = setup();
    await service.put('u', 1, { data: newSave('a', T0), baseRevision: 0 });
    expect(await status(service.put('u', 1, { data: newSave('b', T0), baseRevision: 0 }))).toBe(409);
  });

  it('não deixa um aparelho voltar colapsos sem a escolha explícita', async () => {
    const { service } = setup();
    const ahead: SaveState = {
      ...newSave('a', T0),
      collapses: 1,
      tutorial: 'done',
      regionId: 'asteroid-belt',
      fragments: { earned: 4, spent: 0 },
      stats: { ...newSave('a', T0).stats, picks: 20, dustTotal: 6e6 },
    };
    await service.put('u', 1, { data: newSave('a', T0), baseRevision: 0 });
    await service.put('u', 1, { data: ahead, baseRevision: 1 });
    const res = await body(service.put('u', 1, { data: newSave('a', T0), baseRevision: 2 }));
    expect(res).toMatchObject({ code: 'conflict', reason: 'regress' });
    const forced = await service.put('u', 1, { data: newSave('a', T0), baseRevision: 2, overwrite: true });
    expect(forced.revision).toBe(3);
    expect((await service.get('u', 1)).data.collapses).toBe(0);
  });

  it('álbum e conquistas só crescem: o servidor une com o que a conta já tem', async () => {
    const { service } = setup();
    const a = played(40);
    const withMoon: SaveState = { ...a, album: ['moon'], run: { ...a.run, build: { moon: 1 }, picks: 1 }, stats: { ...a.stats, picks: 1 }, achievements: ['first'] };
    const b = played(80);
    const stale: SaveState = { ...b, album: ['mars'], run: { ...b.run, build: { mars: 1 }, picks: 1 }, stats: { ...b.stats, picks: 1 } };
    await service.put('u', 1, { data: newSave('a', T0), baseRevision: 0 });
    await service.put('u', 1, { data: withMoon, baseRevision: 1 });
    const r = await service.put('u', 1, { data: stale, baseRevision: 2 });
    expect(r.data!.album).toEqual(expect.arrayContaining(['moon', 'mars']));
    expect(r.data!.achievements).toEqual(['first']);
  });
});

describe('apagar e recuperar por 7 dias', () => {
  it('apagar esvazia o espaço; restaurar dentro do prazo traz de volta', async () => {
    const { service, advance } = setup();
    await service.put('u', 1, { data: played(30), baseRevision: 0 });
    await service.remove('u', 1);
    const [slot] = await service.list('u');
    expect(slot!.save).toBeNull();
    expect(slot!.recoverableUntil).toBe(new Date(T0 + RECOVERY_DAYS * DAY).toISOString());
    expect(await status(service.get('u', 1))).toBe(404);
    advance((RECOVERY_DAYS - 1) * DAY);
    expect((await service.restore('u', 1)).slot).toBe(1);
    expect((await service.get('u', 1)).data.run.clicks).toBeGreaterThan(0);
  });

  it('depois de 7 dias não volta mais', async () => {
    const { service, advance } = setup();
    await service.put('u', 1, { data: newSave('a', T0), baseRevision: 0 });
    await service.remove('u', 1);
    advance(RECOVERY_DAYS * DAY + 1000);
    expect(await status(service.restore('u', 1))).toBe(404);
    expect((await service.list('u'))[0]).toEqual({ slot: 1, save: null, recoverableUntil: null });
  });

  it('não restaura save vivo nem apaga o que não existe; gravar em save apagado dá 404', async () => {
    const { service } = setup();
    expect(await status(service.remove('u', 1))).toBe(404);
    await service.put('u', 1, { data: newSave('a', T0), baseRevision: 0 });
    expect(await status(service.restore('u', 1))).toBe(404);
    await service.remove('u', 1);
    expect(await status(service.put('u', 1, { data: played(5), baseRevision: 1 }))).toBe(404);
  });

  it('criar de novo no espaço apagado troca o save apagado', async () => {
    const { service } = setup();
    await service.put('u', 1, { data: played(30), baseRevision: 0 });
    await service.remove('u', 1);
    const r = await service.put('u', 1, { data: newSave('novo', T0), baseRevision: 0 });
    expect(r.revision).toBe(1);
    expect((await service.list('u'))[0]).toMatchObject({ recoverableUntil: null });
    expect((await service.get('u', 1)).data.run.clicks).toBe(0);
  });
});

describe('convidado', () => {
  it('as rotas exigem o AuthGuard e, sem sessão, a resposta é 401', async () => {
    const guards = Reflect.getMetadata('__guards__', ApertaController) as unknown[];
    expect(guards).toContain(AuthGuard);
    const guard = new AuthGuard({ api: { getSession: async () => null } } as never);
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }) } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});

describe('erros usados pelo cliente', () => {
  it('têm os tipos esperados', async () => {
    const { service } = setup();
    await expect(service.get('u', 1)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.put('u', 1, { data: null, baseRevision: 0 })).rejects.toBeInstanceOf(BadRequestException);
    await service.put('u', 1, { data: newSave('a', T0), baseRevision: 0 });
    await expect(service.put('u', 1, { data: newSave('a', T0), baseRevision: 0 })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('rotas do controlador', () => {
  it('GET, PUT, DELETE e restaurar chegam ao serviço pela conta da sessão', async () => {
    const { service } = setup();
    const c = new ApertaController(service);
    const req = { user: { id: 'u' } } as never;
    expect((await c.list(req)).slots.map((s) => s.save)).toEqual([null, null]);
    expect((await c.put(req, 1, { data: newSave('a', T0), baseRevision: 0 })).revision).toBe(1);
    expect((await c.get(req, 1)).revision).toBe(1);
    await c.remove(req, 1);
    expect((await c.list(req)).slots[0]).toMatchObject({ save: null });
    expect((await c.restore(req, 1)).slot).toBe(1);
    expect((await c.get(req, 1)).revision).toBe(1);
  });

  it('limita a gravação a 2 por 5 s (1 por save) e as outras rotas têm teto próprio', () => {
    const rule = (name: keyof ApertaController) =>
      Reflect.getMetadata('nocap:rate', ApertaController.prototype[name]) as { limit: number; windowMs: number };
    expect(rule('put')).toEqual({ limit: 2, windowMs: 5_000 });
    for (const name of ['list', 'get', 'remove', 'restore'] as const) expect(rule(name).windowMs).toBe(60_000);
  });
});
