import { mergeSaves, newSave, press, type SaveState } from '@nocap/games';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { AUTOSAVE_MS, createApiSaveStore, MIN_UPLOAD_GAP_MS, type Env, type SyncEvent } from './api-save-store';

const NOW = Date.parse('2026-10-21T12:00:00Z');

/** Um servidor de mentira com as mesmas regras de revisão do real (409 com o save da conta e a junção). */
function fakeServer() {
  const rows = new Map<number, { revision: number; data: SaveState; deleted: boolean }>();
  const calls: string[] = [];
  const down = { network: false, status: 0 };
  const api: Env['api'] = {
    get: async <T,>(p: string) => {
      calls.push(`GET ${p}`);
      if (down.network) throw new TypeError('Failed to fetch');
      if (p === '/me/aperta/saves') {
        const slots = [1, 2].map((slot) => {
          const r = rows.get(slot);
          const live = r && !r.deleted ? r : null;
          return {
            slot,
            save: live
              ? { slot, name: live.data.name, collapses: live.data.collapses, atlasPages: 0, lastPlayedAt: 'x', storySeen: live.data.storySeen, revision: live.revision }
              : null,
            recoverableUntil: null,
          };
        });
        return { slots } as T;
      }
      const r = rows.get(Number(p.split('/').pop()));
      if (!r || r.deleted) throw new ApiError(404, 'Save não encontrado');
      return { slot: 1, revision: r.revision, data: r.data } as T;
    },
    put: async <T,>(p: string, body: unknown) => {
      calls.push(`PUT ${p}`);
      if (down.network) throw new TypeError('Failed to fetch');
      if (down.status) throw new ApiError(down.status, 'falhou', { code: 'invalid-save' });
      const slot = Number(p.split('/').pop());
      const { data, baseRevision, overwrite } = body as { data: SaveState; baseRevision: number; overwrite?: boolean };
      const r = rows.get(slot);
      if (baseRevision === 0) {
        if (r && !r.deleted) throw new ApiError(409, 'ocupado', { code: 'conflict', reason: 'slot-taken' });
        rows.set(slot, { revision: 1, data, deleted: false });
        return { revision: 1, flagged: [] } as T;
      }
      if (!r || r.deleted) throw new ApiError(404, 'apagado');
      if (r.revision !== baseRevision) {
        const merged = mergeSaves(r.data, data);
        throw new ApiError(409, 'mudou', {
          code: 'conflict',
          reason: 'stale',
          current: { slot, revision: r.revision, data: r.data },
          merged: { data: merged.save, conflict: merged.conflict },
        });
      }
      r.revision++;
      r.data = data;
      void overwrite;
      return { revision: r.revision, flagged: [] } as T;
    },
    post: async <T,>(p: string) => {
      calls.push(`POST ${p}`);
      const r = rows.get(Number(p.split('/')[4]));
      if (!r?.deleted) throw new ApiError(404, 'nada para restaurar');
      r.deleted = false;
      return { slot: 1, name: r.data.name, collapses: 0, atlasPages: 0, lastPlayedAt: 'x', storySeen: false, revision: r.revision } as T;
    },
    delete: async <T,>(p: string) => {
      calls.push(`DELETE ${p}`);
      const r = rows.get(Number(p.split('/').pop()));
      if (r) r.deleted = true;
      return undefined as T;
    },
  };
  return { api, rows, calls, down, puts: () => calls.filter((c) => c.startsWith('PUT')).length };
}

function memoryStorage(): Env['storage'] & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** Os ouvintes de aba e de rede que o store registra (o teste roda sem DOM). */
function fakeBrowser() {
  const handlers = new Map<string, Set<() => void>>();
  const target = {
    addEventListener: (type: string, fn: () => void) => void (handlers.get(type) ?? handlers.set(type, new Set()).get(type)!).add(fn),
    removeEventListener: (type: string, fn: () => void) => void handlers.get(type)?.delete(fn),
  };
  const doc = { ...target, visibilityState: 'visible' };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', target);
  vi.stubGlobal('navigator', { onLine: true });
  return {
    fire: (type: string) => handlers.get(type)?.forEach((fn) => fn()),
    hide: () => {
      doc.visibilityState = 'hidden';
      handlers.get('visibilitychange')?.forEach((fn) => fn());
    },
    listeners: () => [...handlers.values()].reduce((n, s) => n + s.size, 0),
    setOnline: (v: boolean) => vi.stubGlobal('navigator', { onLine: v }),
  };
}

function played(taps: number, base: SaveState = newSave('seed', NOW)): SaveState {
  let s = base;
  for (let i = 1; i <= taps; i++) s = press(s, base.clock + i * 0.2);
  return s;
}

function setup() {
  const server = fakeServer();
  const storage = memoryStorage();
  const browser = fakeBrowser();
  const store = createApiSaveStore('u1', { api: server.api, storage, now: () => Date.now() });
  return { server, storage, browser, store };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('lista, criar, apagar e recuperar (a interface das telas)', () => {
  it('lista os 2 espaços da conta e guarda a última lista para quando a internet cair', async () => {
    const { store, server } = setup();
    expect(await store.list()).toEqual([null, null]);
    await store.create(2);
    const list = await store.list();
    expect(list[0]).toBeNull();
    expect(list[1]).toMatchObject({ slot: 2, name: 'Missão Perigeu', collapses: 0 });
    expect(list[1]).not.toHaveProperty('revision');
    server.down.network = true;
    expect(await store.list()).toEqual(list);
  });

  it('criar grava um save novo na conta e recusa espaço ocupado', async () => {
    const { store, server } = setup();
    const created = await store.create(1);
    expect(created).toMatchObject({ slot: 1, storySeen: false });
    expect(server.rows.get(1)?.revision).toBe(1);
    await expect(store.create(1)).rejects.toThrow('slot-taken');
  });

  it('apagar e recuperar passam pela conta; recuperar sem nada apagado devolve null', async () => {
    const { store, server } = setup();
    await store.create(1);
    await store.remove(1);
    expect((await store.list())[0]).toBeNull();
    expect((await store.restore(1))?.slot).toBe(1);
    expect(server.rows.get(1)?.deleted).toBe(false);
    expect(await store.restore(2)).toBeNull();
  });

  it('um erro que não é de rede aparece para a tela (não vira lista vazia)', async () => {
    const failing = createApiSaveStore('u1', {
      api: { ...fakeServer().api, get: async () => Promise.reject(new ApiError(500, 'boom')) },
      storage: memoryStorage(),
      now: Date.now,
    });
    await expect(failing.list()).rejects.toThrow('boom');
  });
});

describe('abrir o save', () => {
  it('baixa da conta e começa limpo', async () => {
    const { store } = setup();
    await store.create(1);
    const opened = await store.open(1);
    expect(opened).toMatchObject({ sync: 'saved', conflict: null });
    expect(opened.state.name).toBe('Missão Perigeu');
  });

  it('sem internet abre a cópia do aparelho e sobe quando a conexão voltar', async () => {
    const { store, server, browser } = setup();
    await store.create(1);
    await store.open(1);
    const state = played(30);
    store.update(1, state);
    await store.close(1); // subiu
    store.update(1, state); // sem efeito: não está aberto
    server.down.network = true;
    const reopened = await store.open(1);
    expect(reopened.sync).toBe('offline');
    const more = played(60);
    store.update(1, more);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(store.sync(1)).toBe('offline');
    server.down.network = false;
    browser.fire('online');
    await vi.advanceTimersByTimeAsync(1);
    expect(store.sync(1)).toBe('saved');
    expect(server.rows.get(1)?.data.run.clicks).toBe(more.run.clicks);
  });

  it('sem internet e sem cópia local não abre; save apagado em outro aparelho vira "gone"', async () => {
    const { store, server } = setup();
    server.down.network = true;
    await expect(store.open(1)).rejects.toThrow();
    server.down.network = false;
    await store.create(1);
    await store.remove(1);
    await expect(store.open(1)).rejects.toThrow('gone');
  });

  it('cópia local mexida e conta que não mudou (o app fechou antes de subir): a cópia local vale', async () => {
    const { store, server, storage } = setup();
    await store.create(1);
    await store.open(1);
    const state = played(20);
    store.update(1, state); // só no aparelho; o app fecha aqui, sem subir
    const next = createApiSaveStore('u1', { api: server.api, storage, now: () => Date.now() });
    const opened = await next.open(1);
    expect(opened.conflict).toBeNull();
    expect(opened.state.run.clicks).toBe(state.run.clicks);
    await vi.advanceTimersByTimeAsync(MIN_UPLOAD_GAP_MS);
    expect(server.rows.get(1)?.data.run.clicks).toBe(state.run.clicks);
  });
});

describe('autosave', () => {
  it('a cada 30 s sobe o que mudou; sem mudança não sobe nada', async () => {
    const { store, server } = setup();
    await store.create(1);
    await store.open(1);
    const base = server.puts();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS * 2);
    expect(server.puts()).toBe(base);
    const state = played(25);
    store.update(1, state);
    expect(server.puts()).toBe(base); // nada na hora, só a cópia local
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(server.puts()).toBe(base + 1);
    expect(server.rows.get(1)?.revision).toBe(2);
    expect(server.rows.get(1)?.data.run.clicks).toBe(state.run.clicks);
    expect(store.sync(1)).toBe('saved');
  });

  it('a cópia local é gravada na hora, antes de qualquer subida', async () => {
    const { store, storage } = setup();
    await store.create(1);
    await store.open(1);
    store.update(1, played(10));
    const copy = JSON.parse(storage.data.get('nocap-aperta:u1:save:1')!) as { dirty: boolean; state: SaveState };
    expect(copy.dirty).toBe(true);
    expect(copy.state.run.clicks).toBeGreaterThan(0);
  });

  it('esconder a aba sobe na hora', async () => {
    const { store, server, browser } = setup();
    await store.create(1);
    await store.open(1);
    store.update(1, played(10));
    browser.hide();
    await vi.advanceTimersByTimeAsync(1);
    expect(server.rows.get(1)?.revision).toBe(2);
  });

  it('flush respeita o intervalo mínimo entre subidas', async () => {
    const { store, server } = setup();
    await store.create(1);
    await store.open(1);
    store.update(1, played(10));
    await store.flush(1);
    const first = server.puts();
    store.update(1, played(20));
    const pending = store.flush(1);
    await vi.advanceTimersByTimeAsync(MIN_UPLOAD_GAP_MS - 100);
    expect(server.puts()).toBe(first);
    await vi.advanceTimersByTimeAsync(200);
    await pending;
    expect(server.puts()).toBe(first + 1);
  });

  it('uma mudança durante a subida continua pendente para a próxima', async () => {
    const { store, server } = setup();
    await store.create(1);
    await store.open(1);
    store.update(1, played(10));
    const up = store.flush(1);
    store.update(1, played(30)); // muda enquanto sobe
    await up;
    expect(server.rows.get(1)?.revision).toBe(2);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(server.rows.get(1)?.revision).toBe(3);
  });

  it('save recusado (400) não é reenviado igual a cada 30 s', async () => {
    const { store, server } = setup();
    await store.create(1);
    await store.open(1);
    store.update(1, played(10));
    server.down.status = 400;
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(store.sync(1)).toBe('error');
    const puts = server.puts();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS * 3);
    expect(server.puts()).toBe(puts);
    server.down.status = 0;
    store.update(1, played(11));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(store.sync(1)).toBe('saved');
  });

  it('fechar sobe o que falta e solta os ouvintes do navegador', async () => {
    const { store, server, browser } = setup();
    await store.create(1);
    await store.open(1);
    expect(browser.listeners()).toBeGreaterThan(0);
    store.update(1, played(10));
    await store.close(1);
    expect(server.rows.get(1)?.revision).toBe(2);
    expect(browser.listeners()).toBe(0);
  });
});

describe('vários aparelhos', () => {
  /** Outro aparelho joga por um caminho diferente e grava na conta (revisão sobe). */
  function otherDevice(server: ReturnType<typeof fakeServer>, patch: (s: SaveState) => SaveState) {
    const row = server.rows.get(1)!;
    row.data = patch(row.data);
    row.revision++;
  }
  const diverge = (extra: string) => (s: SaveState): SaveState => ({
    ...s,
    run: { ...s.run, picks: s.run.picks + 2, build: { ...s.run.build, [extra]: 1 } },
    album: [...s.album, extra],
  });

  it('quem só estava atrasado junta sozinho e avisa o jogo com o estado novo', async () => {
    const { store, server } = setup();
    await store.create(1);
    const root = (await store.open(1)).state;
    store.update(1, played(10, root));
    await store.flush(1);
    otherDevice(server, () => played(80, root));
    const events: SyncEvent[] = [];
    store.subscribe((e) => events.push(e));
    store.update(1, played(15, root));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(events.some((e) => e.game)).toBe(true);
    expect(store.conflict(1)).toBeNull();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(store.sync(1)).toBe('saved');
    expect(server.rows.get(1)?.data.run.clicks).toBe(played(80, root).run.clicks);
  });

  it('vidas diferentes: 409 vira aviso, nada é sobrescrito até a pessoa escolher', async () => {
    const { store, server } = setup();
    await store.create(1);
    const root = (await store.open(1)).state;
    otherDevice(server, diverge('mars'));
    store.update(1, diverge('moon')(root));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(store.sync(1)).toBe('conflict');
    const c = store.conflict(1)!;
    expect(c.account.album).toContain('mars');
    expect(c.local.album).toContain('moon');
    expect(c.merged.album).toEqual(expect.arrayContaining(['mars', 'moon']));
    const puts = server.puts();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS * 2);
    expect(server.puts()).toBe(puts); // parado até escolher
    expect(server.rows.get(1)?.data.album).toContain('mars');
    expect(server.rows.get(1)?.data.album).not.toContain('moon');
  });

  it('Juntar (recomendado): grava a junção na revisão da conta', async () => {
    const { store, server } = setup();
    await store.create(1);
    const root = (await store.open(1)).state;
    otherDevice(server, diverge('mars'));
    store.update(1, diverge('moon')(root));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    const state = await store.resolveConflict(1, 'merge');
    expect(state.album).toEqual(expect.arrayContaining(['mars', 'moon']));
    expect(store.sync(1)).toBe('saved');
    expect(store.conflict(1)).toBeNull();
    expect(server.rows.get(1)?.data.album).toEqual(expect.arrayContaining(['mars', 'moon']));
  });

  it('Usar o da conta: descarta o do aparelho (e guarda uma cópia dele)', async () => {
    const { store, server, storage } = setup();
    await store.create(1);
    const root = (await store.open(1)).state;
    otherDevice(server, diverge('mars'));
    store.update(1, diverge('moon')(root));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    const before = server.rows.get(1)!.revision;
    const state = await store.resolveConflict(1, 'account');
    expect(state.album).toContain('mars');
    expect(state.album).not.toContain('moon');
    expect(server.rows.get(1)!.revision).toBe(before);
    expect(storage.data.get('nocap-aperta:u1:backup:1')).toContain('moon');
  });

  it('Usar o deste aparelho: sobe o do aparelho sobre o da conta', async () => {
    const { store, server } = setup();
    await store.create(1);
    const root = (await store.open(1)).state;
    otherDevice(server, diverge('mars'));
    store.update(1, diverge('moon')(root));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    await store.resolveConflict(1, 'device');
    expect(server.rows.get(1)?.data.album).toContain('moon');
    expect(server.rows.get(1)?.data.album).not.toContain('mars');
  });

  it('ao abrir com cópia local mexida e a conta mais nova, de vidas diferentes, devolve o conflito', async () => {
    const { store, server, storage } = setup();
    await store.create(1);
    const root = (await store.open(1)).state;
    store.update(1, diverge('moon')(root)); // só local (suja)
    await store.close(1).catch(() => undefined);
    // o close sobe; simula o aparelho que não conseguiu subir: volta a cópia local a "suja" na revisão antiga
    const key = 'nocap-aperta:u1:save:1';
    storage.data.set(key, JSON.stringify({ revision: 1, state: diverge('moon')(root), dirty: true }));
    otherDevice(server, () => diverge('mars')(root));
    server.rows.get(1)!.revision = 3;
    const opened = await store.open(1);
    expect(opened.sync).toBe('conflict');
    expect(opened.conflict?.account.album).toContain('mars');
    expect(opened.conflict?.local.album).toContain('moon');
  });

  it('abrir com a cópia local suja e a conta mais nova mas sem divergência junta sem perguntar', async () => {
    const { store, server, storage } = setup();
    await store.create(1);
    const root = (await store.open(1)).state;
    await store.close(1);
    storage.data.set('nocap-aperta:u1:save:1', JSON.stringify({ revision: 1, state: played(5, root), dirty: true }));
    server.rows.get(1)!.data = played(90, root);
    server.rows.get(1)!.revision = 4;
    const opened = await store.open(1);
    expect(opened.conflict).toBeNull();
    expect(opened.state.run.clicks).toBe(played(90, root).run.clicks);
  });
});

describe('história vista', () => {
  it('marca no save da conta e sobe na hora', async () => {
    const { store, server } = setup();
    await store.create(1);
    const promise = store.markStorySeen(1);
    await vi.advanceTimersByTimeAsync(MIN_UPLOAD_GAP_MS);
    await promise;
    expect(server.rows.get(1)?.data.storySeen).toBe(true);
    expect((await store.list())[0]?.storySeen).toBe(true);
  });
});
