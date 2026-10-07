import { apiClient } from './api-client';

export interface RoomInvite {
  id: string;
  code: string;
  from: { username: string };
  createdAt: string;
}

/** O app pergunta ao servidor a cada tanto (sem push): atraso de até este intervalo. */
export const INVITES_POLL_MS = 5_000;

export const fetchInvites = () => apiClient.get<RoomInvite[]>('/me/invites');

export const declineInvite = (id: string) =>
  apiClient.post<{ removed: boolean }>(`/me/invites/${encodeURIComponent(id)}/decline`, {});

/** Texto do aviso: diz quem chamou e para qual jogo. */
export function inviteText(invite: RoomInvite): string {
  return `@${invite.from.username} te chamou para uma sala da Cor`;
}

/** Só o convite mais novo vira aviso; os outros esperam a vez (fila). */
export function nextInvite(invites: RoomInvite[], dismissed: Set<string>): RoomInvite | null {
  return invites.find((i) => !dismissed.has(i.id)) ?? null;
}
