import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BlocksMode } from '@nocap/games';
import { useIsGuest } from '@/lib/auth';
import { flushQueuedMatches, submitOrQueue } from '../color/submit';
import { SAVE_TEXT, type SaveState } from '../color/useSaveMatch';

export { SAVE_TEXT, type SaveState };

/** A partida que acabou: o que o servidor precisa para refazê-la. */
export interface BlocksRunInfo {
  matchId: string;
  seed: string;
  /** Vazia quando a partida foi só treino (sem conta ou sem internet ao começar). */
  session: string;
}

/**
 * Manda a partida: as jogadas em ordem. O servidor refaz tudo pela seed (as peças de cada
 * rodada, cada jogada, os pontos); o ranking, o histórico e os recordes saem daí.
 */
export function useSaveBlocks(
  run: BlocksRunInfo,
  mode: BlocksMode,
  moves: number[],
): [SaveState, () => void] {
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
      game: 'blocks',
      matchId: run.matchId,
      mode,
      kind: 'solo',
      seed: run.seed,
      session: run.session,
      moves,
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
  }, [run, mode, moves, queryClient, guest]);

  /** "Tentar enviar agora": reenvia o que ficou guardado e, se saiu, marca esta partida como salva. */
  const retry = () => {
    setSave('saving');
    flushQueuedMatches()
      .then((sent) => {
        if (sent > 0) {
          void queryClient.invalidateQueries({ queryKey: ['stats'] });
          void queryClient.invalidateQueries({ queryKey: ['history'] });
          void queryClient.invalidateQueries({ queryKey: ['ranking'] });
        }
        setSave(sent > 0 ? 'saved' : 'queued');
      })
      .catch(() => setSave('queued'));
  };

  return [save, retry];
}
