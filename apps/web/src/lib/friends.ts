import { apiClient } from './api-client';
import type { Stats } from './stats';

export type RelationState = 'none' | 'friends' | 'outgoing' | 'incoming';

export interface FriendUser {
  username: string;
}

export interface FriendsList {
  friends: FriendUser[];
  incoming: FriendUser[];
  outgoing: FriendUser[];
}

export interface SearchResult extends FriendUser {
  state: RelationState;
}

export const MIN_SEARCH = 2;

export interface FriendProfile {
  username: string;
  stats: Stats;
}

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
