import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SinalInput, SinalMode } from '@nocap/games';
import { submitOrQueue } from '../color/submit';
import { SAVE_TEXT, type SaveState } from '../color/useSaveMatch';

export { SAVE_TEXT, type SaveState };

/** A partida que acabou: o que o servidor precisa para refazer a corrida e conferir o tempo. */
export interface SinalRunInfo {
  matchId: string;
  seed: string;
  /** Vazia quando a partida foi só treino (sem conta ou sem internet ao começar). */
  session: string;
}

/**
 * Manda a corrida: os movimentos do analógico. O servidor refaz tudo pela seed (Vigia, poderes,
 * obstáculos, escuridão) e calcula os metros; o ranking, o histórico e os recordes saem daí.
 */
export function useSaveSinal(run: SinalRunInfo, mode: SinalMode, inputs: SinalInput[]): SaveState {
  const [save, setSave] = useState<SaveState>('saving');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!run.session) {
      setSave('offline');
      return;
    }
    let alive = true;
    submitOrQueue({
      game: 'sinal',
      matchId: run.matchId,
      mode,
      kind: 'solo',
      seed: run.seed,
      session: run.session,
      inputs: inputs.map((i) => [i.tick, i.x, i.y] as [number, number, number]),
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
  }, [run, mode, inputs, queryClient]);

  return save;
}
