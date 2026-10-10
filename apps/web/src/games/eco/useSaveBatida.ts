import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { batidaMode, type BatidaTap } from '@nocap/games';
import { submitOrQueue } from '../color/submit';
import { SAVE_TEXT, type SaveState } from '../color/useSaveMatch';
import type { BatidaRunInfo } from './types';

export { SAVE_TEXT, type SaveState };

/** Manda a partida do Batida: os instantes dos toques. O servidor refaz a nota pela seed. */
export function useSaveBatida(run: BatidaRunInfo, taps: BatidaTap[]): SaveState {
  const [save, setSave] = useState<SaveState>('saving');
  const queryClient = useQueryClient();

  useEffect(() => {
    // Jogada offline (sem sessão do servidor): vale como treino, não há o que salvar.
    if (!run.session) {
      setSave('offline');
      return;
    }
    let alive = true;
    submitOrQueue({
      game: 'eco',
      matchId: run.matchId,
      mode: batidaMode(run.song),
      kind: 'solo',
      seed: run.seed,
      session: run.session,
      taps: [],
      beats: taps.map((t) => [t.lane, t.t] as [number, number]),
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
  }, [run, taps, queryClient]);

  return save;
}
