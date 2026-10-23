import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('./api-client', () => ({ apiBase: 'http://api.test', apiClient: { get } }));
vi.mock('./auth', () => ({ useAuth: () => null }));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { refreshApertaAccess, useApertaAccess } = await import('./aperta-access');

beforeEach(() => {
  store.clear();
  get.mockReset();
  useApertaAccess.setState({ forUser: null, allowed: null });
});

describe('liberação do Aperta! (jogo em teste)', () => {
  it('guarda o sim do servidor e lembra dele por conta', async () => {
    get.mockResolvedValue({ allowed: true });
    await refreshApertaAccess('u1');
    expect(useApertaAccess.getState()).toMatchObject({ forUser: 'u1', allowed: true });
    expect(store.get('nocap-aperta-ok')).toBe('u1');
  });

  it('o não do servidor apaga o que estava lembrado', async () => {
    store.set('nocap-aperta-ok', 'u1');
    get.mockResolvedValue({ allowed: false });
    await refreshApertaAccess('u1');
    expect(useApertaAccess.getState().allowed).toBe(false);
    expect(store.has('nocap-aperta-ok')).toBe(false);
  });

  it('403 e 401 valem como não; falha de rede sem nada lembrado fica sem resposta', async () => {
    get.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 403 }));
    await refreshApertaAccess('u2');
    expect(useApertaAccess.getState()).toMatchObject({ forUser: 'u2', allowed: false });
    useApertaAccess.setState({ forUser: null, allowed: null });
    get.mockRejectedValueOnce(new Error('sem rede'));
    await refreshApertaAccess('u3');
    expect(useApertaAccess.getState()).toMatchObject({ forUser: 'u3', allowed: null });
  });

  it('sem rede, quem já foi liberado nesta conta continua vendo o cartão', async () => {
    store.set('nocap-aperta-ok', 'u4');
    get.mockRejectedValueOnce(new Error('sem rede'));
    await refreshApertaAccess('u4');
    expect(useApertaAccess.getState()).toMatchObject({ forUser: 'u4', allowed: true });
  });

  it('o lembrete de uma conta não vale para outra', async () => {
    store.set('nocap-aperta-ok', 'u4');
    get.mockRejectedValueOnce(new Error('sem rede'));
    await refreshApertaAccess('outra');
    expect(useApertaAccess.getState()).toMatchObject({ forUser: 'outra', allowed: null });
  });
});
