import { useEffect, useState } from 'react';
import { submitOrQueue } from './submit';
import type { RoundResult, Run } from './types';

export type SaveState = 'saving' | 'saved' | 'queued' | 'error';

export const SAVE_TEXT: Record<SaveState, string> = {
  saving: 'SALVANDO...',
  saved: 'SALVO NO HISTÓRICO',
  queued: 'SEM CONEXÃO: ENVIO QUANDO VOLTAR',
  error: 'NÃO FOI POSSÍVEL SALVAR A PARTIDA',
};

/** O servidor recalcula as notas pela seed; o matchId deixa o reenvio idempotente. */
export function useSaveMatch(run: Run, results: RoundResult[]): SaveState {
  const [save, setSave] = useState<SaveState>('saving');

  useEffect(() => {
    let alive = true;
    submitOrQueue({
      matchId: run.matchId,
      mode: run.preset,
      kind: run.kind,
      seed: run.seed,
      answers: results.map((r) => r.guess),
    })
      .then((r) => alive && setSave(r === 'sent' ? 'saved' : r === 'queued' ? 'queued' : 'error'))
      .catch(() => alive && setSave('error'));
    return () => {
      alive = false;
    };
  }, [run, results]);

  return save;
}
