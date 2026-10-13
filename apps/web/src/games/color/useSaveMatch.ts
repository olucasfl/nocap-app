import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useIsGuest } from '@/lib/auth';
import { submitOrQueue } from './submit';
import type { RoundResult, Run } from './types';

export type SaveState = 'saving' | 'saved' | 'queued' | 'offline' | 'error' | 'guest';

export const SAVE_TEXT: Record<SaveState, string> = {
  saving: 'SALVANDO...',
  saved: 'SALVO NO HISTÓRICO',
  queued: 'SEM CONEXÃO: ENVIO QUANDO VOLTAR',
  offline: 'OFFLINE: ESTA PARTIDA NÃO FOI SALVA',
  error: 'NÃO FOI POSSÍVEL SALVAR A PARTIDA',
  guest: 'ESTA PARTIDA NÃO FOI SALVA: VOCÊ NÃO TEM CONTA',
};

/** O servidor recalcula as notas pela seed; o matchId deixa o reenvio idempotente. */
export function useSaveMatch(run: Run, results: RoundResult[]): SaveState {
  const [save, setSave] = useState<SaveState>('saving');
  const queryClient = useQueryClient();
  const guest = useIsGuest();

  useEffect(() => {
    // Sem conta nada é enviado (nem entra na fila): o servidor só aceita partida de conta.
    if (guest) {
      setSave('guest');
      return;
    }
    let alive = true;
    submitOrQueue({
      matchId: run.matchId,
      mode: run.preset,
      kind: run.kind,
      seed: run.seed,
      answers: results.map((r) => r.guess),
    })
      .then((r) => {
        if (r === 'sent') {
          // A partida já conta: recordes, histórico e rankings pedem dados novos.
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
  }, [run, results, guest]);

  return save;
}
