import { beforeEach, describe, expect, it, vi } from 'vitest';

// Chamadas de rede que não fazem parte do cadastro nunca respondem: simulam um servidor lento.
const never = () => new Promise<never>(() => {});
const claim = vi.fn(never);
const visit = vi.fn(never);

vi.mock('./api-client', () => ({
  apiBase: 'http://api.test',
  apiClient: { post: claim },
}));
vi.mock('./stats', () => ({ recordVisit: visit }));
vi.mock('./sfx', () => ({ sfx: { success: vi.fn(), error: vi.fn() } }));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const signUpResponse = () =>
  new Response(
    JSON.stringify({
      token: 'tok',
      user: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', username: 'ana' },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const form = {
  username: 'ana',
  name: 'Ana',
  email: 'ana@exemplo.com',
  password: 'senha-de-teste-1',
  confirm: 'senha-de-teste-1',
};

/** Resolve com 'travou' se a promessa não terminar logo (o app ficaria parado na tela). */
const settlesQuickly = (p: Promise<unknown>) =>
  Promise.race([p.then(() => 'ok'), new Promise((r) => setTimeout(() => r('travou'), 300))]);

describe('entrada na conta', () => {
  beforeEach(() => {
    store.clear();
    claim.mockClear();
    visit.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => signUpResponse()),
    );
  });

  it('criar conta termina assim que o servidor responde, sem esperar a vinculação do aparelho', async () => {
    const { register, useAuth } = await import('./auth');
    expect(await settlesQuickly(register(form))).toBe('ok');
    expect(useAuth.getState().user?.username).toBe('ana');
    // A vinculação do histórico do aparelho continua acontecendo, só que em segundo plano.
    expect(claim).toHaveBeenCalledWith('/players/claim', expect.anything());
  });

  it('entrar também não espera a vinculação do aparelho', async () => {
    const { login } = await import('./auth');
    expect(await settlesQuickly(login('ana@exemplo.com', 'senha-de-teste-1'))).toBe('ok');
  });

  it('falha ao vincular o aparelho não derruba o cadastro', async () => {
    claim.mockRejectedValueOnce(new Error('timeout'));
    const { register, useAuth } = await import('./auth');
    await expect(register(form)).resolves.toBeUndefined();
    expect(useAuth.getState().user?.id).toBe('u1');
  });
});
