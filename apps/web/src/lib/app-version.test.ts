import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appOutdated, saveResume, takeResume } from './app-version';
import { BUILD_ID } from './build-id';

const answer = (init: { ok?: boolean; json?: unknown; fail?: boolean }) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (init.fail) throw new Error('offline');
      return { ok: init.ok ?? true, json: async () => init.json };
    }),
  );

/** O ambiente de teste não tem sessionStorage: um de mentira basta. */
function fakeStorage() {
  const m = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
}

beforeEach(fakeStorage);
afterEach(() => vi.unstubAllGlobals());

describe('versão do app antes de entrar na sala', () => {
  it('uma versão diferente no ar é versão velha', async () => {
    if (BUILD_ID === 'dev') return;
    answer({ json: { id: 'outra123' } });
    expect(await appOutdated()).toBe(true);
  });

  it('a mesma versão, resposta ruim ou sem rede não bloqueia ninguém', async () => {
    answer({ json: { id: BUILD_ID } });
    expect(await appOutdated()).toBe(false);
    answer({ ok: false });
    expect(await appOutdated()).toBe(false);
    answer({ json: { sem: 'id' } });
    expect(await appOutdated()).toBe(false);
    answer({ fail: true });
    expect(await appOutdated()).toBe(false);
  });

  it('guarda o que a pessoa pediu e devolve uma vez só', () => {
    saveResume({ kind: 'join', code: 'ABCD' });
    expect(takeResume()).toEqual({ kind: 'join', code: 'ABCD' });
    expect(takeResume()).toBeNull();
  });

  it('descarta o que ficou guardado há muito tempo', () => {
    sessionStorage.setItem(
      'nocap-resume-entry',
      JSON.stringify({ a: { kind: 'join', code: 'ABCD' }, at: Date.now() - 10 * 60_000 }),
    );
    expect(takeResume()).toBeNull();
  });
});
