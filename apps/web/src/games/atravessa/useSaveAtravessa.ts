import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AtravessaInput } from '@nocap/games';
import { useIsGuest } from '@/lib/auth';
import { submitOrQueue } from '../color/submit';
import { SAVE_TEXT, type SaveState } from '../color/useSaveMatch';

export { SAVE_TEXT, type SaveState };

/** A partida que acabou: o que o servidor precisa para refazê-la e conferir o tempo. */
export interface AtravessaRunInfo {
  matchId: string;
  seed: string;
  /** Vazia quando a partida foi só treino (sem conta ou sem internet ao começar). */
  session: string;
}

/**
 * Manda a partida: os passos ([instante, direção]). O servidor refaz tudo pela seed (faixas,
 * veículos, escuridão) e calcula as linhas; ranking, histórico e recordes saem daí.
 */
export function useSaveAtravessa(run: AtravessaRunInfo, steps: AtravessaInput[]): SaveState {
  const [save, setSave] = useState<SaveState>('saving');
  const queryClient = useQueryClient();
  const guest = useIsGuest();

  useEffect(() => {
    if (guest) {
      setSave('guest');
      return;
    }
    if (!run.session) {
      setSave('offline');
      return;
    }
    let alive = true;
    submitOrQueue({
      game: 'atravessa',
      matchId: run.matchId,
      mode: 'infinito',
      kind: 'solo',
      seed: run.seed,
      session: run.session,
      steps: steps.map((s) => [s.t, s.d] as [number, number]),
    })
      .then((r) => {
        if (r === 'sent') {
          void queryClient.invalidateQueries({ queryKey: ['stats'] });
          void queryClient.invalidateQueries({ queryKey: ['history'] });
          void queryClient.invalidateQueries({ queryKey: ['ranking'] });
        }
        if (alive) setSave(r === 'sent' ? 'saved' : r === 'queued' ? 'queued' : 'error');
      })
      .catch(() => alive && setSave('error'));
    return () => {
      alive = false;
    };
  }, [run, steps, queryClient, guest]);

  return save;
}
