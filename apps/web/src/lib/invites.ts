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

/** Texto do aviso: diz quem chamou. */
export function inviteText(invite: RoomInvite): string {
  return `@${invite.from.username} te chamou para uma sala`;
}

/**
 * A fila de avisos: um por sala (várias pessoas chamando para a mesma sala viram um aviso só, o
 * mais novo), sem os que a pessoa já dispensou, do mais antigo para o mais novo. O aviso na tela
 * é sempre o primeiro; os outros esperam a vez.
 */
export function inviteQueue(invites: RoomInvite[], dismissed: Set<string>): RoomInvite[] {
  const byCode = new Map<string, RoomInvite>();
  for (const i of invites) {
    if (dismissed.has(i.id)) continue;
    const seen = byCode.get(i.code);
    if (!seen || i.createdAt > seen.createdAt) byCode.set(i.code, i);
  }
  return [...byCode.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** O aviso que está na tela continua nela enquanto valer; só então entra o próximo da fila. */
export function pickCurrent(queue: RoomInvite[], shownId: string | null): RoomInvite | null {
  return queue.find((i) => i.id === shownId) ?? queue[0] ?? null;
}

/** Erros em que o convite não tem mais como funcionar (sala fechou, lotou, começou). */
export const inviteIsDead = (message: string) =>
  /não achamos|lotada|cheia|já começou/i.test(message);
