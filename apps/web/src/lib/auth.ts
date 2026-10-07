import { create } from 'zustand';
import { apiBase, apiClient } from './api-client';
import { isEmail, normalizeUsername, validateName, type RegisterForm } from './account-form';
import { getGuestId } from './guest';
import { sfx } from './sfx';
import { recordVisit } from './stats';

const TOKEN_KEY = 'nocap-token';
/** Último usuário confirmado pelo servidor: é ele que aparece offline, para a conta não "sair" sem rede. */
const USER_KEY = 'nocap-user';

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

function cachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw && getToken() ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function cacheUser(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* sem storage: só não fica salvo para o modo offline */
  }
}

const initialUser = cachedUser();

export const useAuth = create<AuthState>(() => ({
  user: initialUser,
  // Com usuário em cache o app já abre logado (a conferência acontece em segundo plano).
  status: getToken() && !initialUser ? 'loading' : 'ready',
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
  cacheUser(data.user);
  useAuth.setState({ user: data.user, status: 'ready' });
  sfx.success();
  // Em segundo plano: vincular o aparelho é uma chamada extra à API (pode demorar com o servidor
  // frio) e a tela não pode ficar parada nela depois de o som de "entrou" já ter tocado.
  void claimGuest();
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

/** Troca o nome de exibição (o @usuário não muda). Valida igual ao cadastro. */
export async function updateName(name: string) {
  const clean = name.trim();
  const error = validateName(clean);
  if (error) throw new Error(error);
  await authRequest('/update-user', { method: 'POST', body: JSON.stringify({ name: clean }) });
  const user = useAuth.getState().user;
  if (!user) return;
  const next = { ...user, name: clean };
  cacheUser(next);
  useAuth.setState({ user: next });
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
  cacheUser(null);
  useAuth.setState({ user: null, status: 'ready' });
}

/** Chamar na abertura do app: confere o token salvo e carrega o usuário. */
export async function restoreSession() {
  if (!getToken()) return useAuth.setState({ user: null, status: 'ready' });
  let res: Response;
  try {
    res = await fetch(`${apiBase}/api/auth/get-session`, {
      headers: { authorization: `Bearer ${getToken()}` },
    });
  } catch {
    // Sem rede não derruba a sessão: segue com o usuário guardado até a conexão voltar.
    return useAuth.setState({ status: 'ready' });
  }
  // Erro do servidor (5xx) também não desloga: só uma resposta "sem sessão" desloga.
  if (!res.ok) return useAuth.setState({ status: 'ready' });
  const data = (await res.json().catch(() => null)) as { user?: AuthUser } | null;
  const user = data?.user ?? null;
  if (!user) setToken(null);
  cacheUser(user);
  useAuth.setState({ user, status: 'ready' });
  if (user) void markVisit();
}
