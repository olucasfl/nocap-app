import type { Hsb } from '@nocap/games';
import { getGuestId } from '@/lib/guest';
import { apiClient } from '@/lib/api-client';

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
 * idempotente (a fila offline da Etapa 1, passo 4, reaproveita isto).
 */
export function submitMatch(payload: SubmitPayload) {
  return apiClient.post<SubmitResponse>('/matches', {
    ...payload,
    game: 'color',
    guestId: getGuestId(),
  });
}
