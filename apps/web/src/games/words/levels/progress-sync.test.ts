import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
// o teste roda sem navegador: um localStorage de mentira, em memória
const memory = vi.hoisted(() => {
  const data = new Map<string, string>();
  return {
    data,
    storage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
    },
  };
});
vi.stubGlobal('localStorage', memory.storage);
vi.mock('@/lib/api-client', () => ({ apiClient: api }));

import { beeProgress, classicProgress } from './progress';
import { pending, state, stopSync, syncNow } from './progress-sync';

const reset = () => {
  beeProgress.clear();
  classicProgress.classic.clear();
  stopSync();
  localStorage.clear();
  api.get.mockReset();
  api.put.mockReset();
  api.put.mockResolvedValue({ saved: 0 });
};

describe('sincronização do progresso com a conta', () => {
  beforeEach(reset);

  it('o que o aparelho já tinha sobe para a conta e o que a conta tinha desce para o aparelho', async () => {
    beeProgress.set(1, { found: ['casa', 'mesa'], closed: false, at: 5 });
    api.get.mockResolvedValue({
      bee: { '2': { found: ['rosa'], closed: true, at: 3 } },
      'classic-c': { '7': { guesses: ['casas'], at: 4, done: true } },
    });
    await syncNow('conta-a');
    // desceu
    expect(beeProgress.get(2)).toMatchObject({ found: ['rosa'], closed: true });
    expect(classicProgress.classic.get(7)).toMatchObject({ guesses: ['casas'], done: true });
    // subiu só o que o servidor não tinha
    const sent = api.put.mock.calls.flatMap(
      (c) => (c[1] as { entries: { game: string; level: number }[] }).entries,
    );
    expect(sent).toEqual([
      { game: 'bee', level: 1, data: { found: ['casa', 'mesa'], closed: false, at: 5 } },
    ]);
    expect(pending()).toHaveLength(0);
  });

  it('junta a mesma fase dos dois lados sem perder nada', async () => {
    beeProgress.set(1, { found: ['casa'], closed: false, at: 5 });
    api.get.mockResolvedValue({ bee: { '1': { found: ['mesa', 'rosa'], closed: false, at: 9 } } });
    await syncNow('conta-a');
    expect(beeProgress.get(1)?.found.sort()).toEqual(['casa', 'mesa', 'rosa']);
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  it('se o servidor não responde, nada some do aparelho', async () => {
    beeProgress.set(1, { found: ['casa'], closed: false, at: 5 });
    api.get.mockRejectedValue(new Error('sem rede'));
    await expect(syncNow('conta-a')).rejects.toThrow();
    expect(beeProgress.get(1)?.found).toEqual(['casa']);
  });

  it('outra conta no mesmo aparelho não herda o progresso: ele fica guardado de lado e volta para a dona', async () => {
    api.get.mockResolvedValue({});
    beeProgress.set(1, { found: ['casa'], closed: false, at: 5 });
    await syncNow('conta-a');
    stopSync();
    // a conta B entra no mesmo aparelho
    api.get.mockResolvedValue({ bee: { '9': { found: ['rosa'], closed: false, at: 2 } } });
    await syncNow('conta-b');
    expect(beeProgress.get(1)).toBeUndefined();
    expect(beeProgress.get(9)?.found).toEqual(['rosa']);
    const sent = api.put.mock.calls
      .flatMap((c) => (c[1] as { entries: { level: number }[] }).entries)
      .map((e) => e.level);
    expect(sent).not.toContain(9);
    // a conta A volta: o progresso dela reaparece
    stopSync();
    api.get.mockResolvedValue({ bee: { '1': { found: ['casa'], closed: false, at: 5 } } });
    await syncNow('conta-a');
    expect(beeProgress.get(1)?.found).toEqual(['casa']);
    expect(state.userId).toBe('conta-a');
  });

  it('sem conta ligada nada é enviado', async () => {
    beeProgress.set(1, { found: ['casa'], closed: false, at: 5 });
    stopSync();
    expect(api.put).not.toHaveBeenCalled();
  });
});
