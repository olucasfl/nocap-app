import type { Hsb } from '@nocap/games';
import { getGuestId } from '@/lib/guest';
import { apiClient } from '@/lib/api-client';
import { createOfflineQueue, indexedDbStore } from '@/lib/offline-queue';

export interface SubmitPayload {
  matchId: string;
  mode: string;
  kind: 'solo' | 'daily';
  seed: string;
  answers: Hsb[];
}

interface SubmitResponse {
  matchId: string;
  rounds: { score: number }[];
  total: number;
}

/**
 * Manda só as respostas: a nota é recalculada no servidor. O `matchId` torna o reenvio
 * idempotente, o que permite a fila offline reenviar sem duplicar a partida.
 */
function submitMatch(payload: SubmitPayload) {
  return apiClient.post<SubmitResponse>('/matches', {
    ...payload,
    game: 'color',
    guestId: getGuestId(),
  });
}

const queue = createOfflineQueue(indexedDbStore<SubmitPayload>(), submitMatch);

/** Envia agora; sem conexão, a partida fica na fila local e sai quando a rede voltar. */
export const submitOrQueue = queue.submit;
export const flushQueuedMatches = queue.flush;
