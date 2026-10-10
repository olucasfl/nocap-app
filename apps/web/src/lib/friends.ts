import { apiClient } from './api-client';
import type { Stats } from './stats';

export type RelationState = 'none' | 'friends' | 'outgoing' | 'incoming';

export interface FriendUser {
  username: string;
}

/** Última partida de alguém (qualquer jogo ou tipo). */
export interface LastPlayed {
  game: string;
  mode: string;
  kind: string;
  playedAt: string;
}

/** Amigo aceito: além do @usuário, se está online, quando entrou por último e o que jogou por último. */
export interface Friend extends FriendUser {
  online: boolean;
  lastSeenAt: string | null;
  lastPlayed: LastPlayed | null;
}

export interface FriendsList {
  friends: Friend[];
  incoming: FriendUser[];
  outgoing: FriendUser[];
}

export interface SearchResult extends FriendUser {
  state: RelationState;
}

export const MIN_SEARCH = 2;

/** Uma partida recente de um amigo (só o que ele deixa ver: nunca a seed nem as respostas). */
export interface RecentMatch {
  game: string;
  mode: string;
  kind: string;
  playedAt: string;
  totalScore: number;
  placement: number | null;
}

export interface FriendProfile {
  username: string;
  stats: Stats;
  online: boolean;
  lastSeenAt: string | null;
  lastPlayed: LastPlayed | null;
  recent: RecentMatch[];
}

/** O app está aberto: avisa o servidor (alimenta "online" e "visto por último" dos amigos). */
export const sendPing = () => apiClient.post<{ ok: boolean }>('/me/ping', {});

export const fetchFriendProfile = (username: string) =>
  apiClient.get<FriendProfile>(`/friends/${encodeURIComponent(username)}/profile`);

export const fetchFriends = () => apiClient.get<FriendsList>('/friends');

export const searchUsers = (q: string) =>
  apiClient.get<SearchResult[]>(`/users/search?q=${encodeURIComponent(q.trim().toLowerCase())}`);

export const sendRequest = (username: string) =>
  apiClient.post<{ state: RelationState }>('/friends/requests', { username });

const enc = encodeURIComponent;

export const acceptRequest = (username: string) =>
  apiClient.post<{ state: RelationState }>(`/friends/requests/${enc(username)}/accept`, {});

export const declineRequest = (username: string) =>
  apiClient.post<{ state: RelationState }>(`/friends/requests/${enc(username)}/decline`, {});

export const removeFriend = (username: string) =>
  apiClient.delete<{ state: RelationState }>(`/friends/${enc(username)}`);

/** Rótulo do botão de ação de um resultado da busca. */
export function actionLabel(state: RelationState): string | null {
  switch (state) {
    case 'none':
      return 'Adicionar';
    case 'incoming':
      return 'Aceitar';
    default:
      return null;
  }
}

/** Texto de estado quando não há ação possível. */
export function stateLabel(state: RelationState): string {
  switch (state) {
    case 'friends':
      return 'AMIGOS';
    case 'outgoing':
      return 'PEDIDO ENVIADO';
    case 'incoming':
      return 'QUER SER SEU AMIGO';
    default:
      return '';
  }
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Hora e minuto em São Paulo (HH:mm), para "ontem às 14:30". */
function clock(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}

/** Dia do calendário em São Paulo (YYYY-MM-DD). */
function dayKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ms));
}

/**
 * Há quanto tempo, em palavras curtas: "agora", "há 5 min", "há 3 h", "ontem às 14:30" ou
 * "12/10 às 09:05". O calendário é o de São Paulo, como o resto do app.
 */
export function ago(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  if (diff < MIN) return 'agora';
  if (diff < HOUR) return `há ${Math.floor(diff / MIN)} min`;
  if (dayKey(t) === dayKey(now)) return `há ${Math.floor(diff / HOUR)} h`;
  if (dayKey(t) === dayKey(now - DAY)) return `ontem às ${clock(iso)}`;
  const [, m, d] = dayKey(t).split('-');
  return `${d}/${m} às ${clock(iso)}`;
}

/** "Online agora", "Visto há 5 min" ou "Ainda não entrou". */
export function presenceText(
  p: { online: boolean; lastSeenAt: string | null },
  now = Date.now(),
): string {
  if (p.online) return 'Online agora';
  return p.lastSeenAt ? `Visto ${ago(p.lastSeenAt, now)}` : 'Ainda não entrou';
}
