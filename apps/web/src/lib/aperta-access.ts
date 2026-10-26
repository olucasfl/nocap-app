import { useEffect } from 'react';
import { create } from 'zustand';
import { apiClient } from './api-client';
import { useAuth } from './auth';

/**
 * O Aperta! está em teste e só aparece para as contas liberadas. Quem decide é o servidor (`GET /me/aperta/access`):
 * o e-mail liberado nunca vai no código do navegador. O último "sim" fica guardado por conta para o cartão do Hub não
 * piscar nem sumir sem rede; um "não" do servidor apaga esse registro.
 */
const KEY = 'nocap-aperta-ok';

interface AccessState {
  /** De quem é o valor abaixo (o id da conta). */
  forUser: string | null;
  /** `null`: ainda não se sabe. */
  allowed: boolean | null;
}

function cached(userId: string): boolean | null {
  try {
    return localStorage.getItem(KEY) === userId ? true : null;
  } catch {
    return null;
  }
}

function remember(userId: string, allowed: boolean) {
  try {
    if (allowed) localStorage.setItem(KEY, userId);
    else localStorage.removeItem(KEY);
  } catch {
    /* sem storage: só não fica guardado */
  }
}

export const useApertaAccess = create<AccessState>(() => ({ forUser: null, allowed: null }));

/** Pergunta ao servidor e guarda a resposta. Falha de rede mantém o que já se sabia (o servidor ainda barra de verdade). */
export async function refreshApertaAccess(userId: string): Promise<void> {
  try {
    const r = await apiClient.get<{ allowed: boolean }>('/me/aperta/access');
    remember(userId, r.allowed);
    useApertaAccess.setState({ forUser: userId, allowed: r.allowed });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401 || status === 403) {
      remember(userId, false);
      useApertaAccess.setState({ forUser: userId, allowed: false });
    } else if (useApertaAccess.getState().forUser !== userId) {
      useApertaAccess.setState({ forUser: userId, allowed: cached(userId) });
    }
  }
}

/** `true` só para conta liberada; `null` enquanto confere; `false` para todos os outros (inclui visitante). */
export function useApertaAllowed(): boolean | null {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const state = useApertaAccess();
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    if (useApertaAccess.getState().forUser !== userId)
      useApertaAccess.setState({ forUser: userId, allowed: cached(userId) });
    void refreshApertaAccess(userId);
  }, [userId]);
  if (status === 'loading') return null;
  if (!userId) return false;
  return state.forUser === userId ? state.allowed : cached(userId);
}
