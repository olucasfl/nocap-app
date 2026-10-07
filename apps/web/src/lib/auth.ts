import { create } from 'zustand';
import { apiBase, apiClient } from './api-client';
import { isEmail, normalizeUsername, type RegisterForm } from './account-form';
import { getGuestId } from './guest';
import { recordVisit } from './stats';

const TOKEN_KEY = 'nocap-token';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  username?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  /** `loading` só enquanto há token salvo e a sessão ainda não foi conferida. */
  status: 'loading' | 'ready';
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage indisponível: a sessão vale só até recarregar */
  }
}

export const useAuth = create<AuthState>(() => ({
  user: null,
  status: getToken() ? 'loading' : 'ready',
}));

/** Mensagem em pt-BR para o código de erro do Better Auth. */
export function errorMessage(status: number, code?: string): string {
  if (status === 429) return 'Muitas tentativas. Espere um minuto e tente de novo.';
  const c = code ?? '';
  if (c.startsWith('USERNAME_IS_ALREADY_TAKEN')) return 'Esse nome de usuário já está em uso';
  if (c.startsWith('USER_ALREADY_EXISTS')) return 'Já existe uma conta com esse e-mail';
  if (c === 'INVALID_USERNAME_OR_PASSWORD' || c === 'INVALID_EMAIL_OR_PASSWORD') {
    return 'Usuário/e-mail ou senha incorretos';
  }
  if (c.startsWith('INVALID_USERNAME')) return 'Nome de usuário inválido';
  if (c === 'PASSWORD_TOO_SHORT') return 'A senha é curta demais';
  if (c === 'INVALID_EMAIL') return 'E-mail inválido';
  return 'Não foi possível concluir. Tente de novo.';
}

interface AuthResponse {
  token?: string;
  user?: AuthUser;
}

async function authRequest(path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`${apiBase}/api/auth${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error('Sem conexão. Tente de novo quando a internet voltar.');
  }
  const data = (await res.json().catch(() => null)) as (AuthResponse & { code?: string }) | null;
  if (!res.ok) throw new Error(errorMessage(res.status, data?.code));
  return { res, data };
}

/**
 * O aparelho (convidado) passa a pertencer à conta: o histórico de antes de entrar não se
 * perde. Falha aqui não impede o login (ex.: aparelho já ligado a outra conta).
 */
async function claimGuest() {
  try {
    await apiClient.post('/players/claim', { guestId: getGuestId() });
  } catch {
    /* segue sem vincular */
  }
}

async function finishSignIn(res: Response, data: AuthResponse | null) {
  const token = res.headers.get('set-auth-token') ?? data?.token;
  if (!token || !data?.user) throw new Error(errorMessage(500));
  setToken(token);
  useAuth.setState({ user: data.user, status: 'ready' });
  await claimGuest();
  void markVisit();
}

/** Conta que o app foi aberto hoje (sequência de dias seguidos). Falha em silêncio. */
export function markVisit() {
  return recordVisit().catch(() => undefined);
}

export async function register(form: RegisterForm) {
  const { res, data } = await authRequest('/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({
      email: form.email.trim(),
      password: form.password,
      name: form.name.trim(),
      username: normalizeUsername(form.username),
    }),
  });
  await finishSignIn(res, data);
}

export async function login(identifier: string, password: string) {
  const id = identifier.trim();
  const { res, data } = isEmail(id)
    ? await authRequest('/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email: id, password }),
      })
    : await authRequest('/sign-in/username', {
        method: 'POST',
        body: JSON.stringify({ username: normalizeUsername(id), password }),
      });
  await finishSignIn(res, data);
}

export async function logout() {
  try {
    await authRequest('/sign-out', { method: 'POST', body: '{}' });
  } catch {
    /* sem rede: sai do aparelho do mesmo jeito */
  }
  setToken(null);
  useAuth.setState({ user: null, status: 'ready' });
}

/** Chamar na abertura do app: confere o token salvo e carrega o usuário. */
export async function restoreSession() {
  if (!getToken()) return useAuth.setState({ user: null, status: 'ready' });
  try {
    const { data } = await authRequest('/get-session');
    const user = (data as { user?: AuthUser } | null)?.user ?? null;
    if (!user) setToken(null);
    useAuth.setState({ user, status: 'ready' });
    if (user) void markVisit();
  } catch {
    // Sem rede não derruba a sessão: o token fica e o usuário aparece quando voltar.
    useAuth.setState({ status: 'ready' });
  }
}
