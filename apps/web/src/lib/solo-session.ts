import { apiClient, ApiError } from './api-client';
import { useAuth } from './auth';
import { isNetworkError } from './network';

/** Um sorteio local (treino): sem conta ou sem servidor a partida solo roda no aparelho. */
const localSeed = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/**
 * A seed e a sessão assinada de uma partida solo. Só quem tem conta recebe sessão do servidor (é
 * ela que faz a partida valer no ranking). Sem conta, sem internet ou com a sessão vencida (401),
 * a partida roda como treino: seed local e `session` vazia, e nada é salvo.
 */
export async function soloSession(
  path: string,
  body: object = { kind: 'solo' },
): Promise<{ seed: string; session: string }> {
  if (!useAuth.getState().user) return { seed: localSeed(), session: '' };
  try {
    return await apiClient.post<{ seed: string; session: string }>(path, body);
  } catch (e) {
    if (isNetworkError(e) || (e instanceof ApiError && e.status === 401)) {
      return { seed: localSeed(), session: '' };
    }
    throw e;
  }
}
