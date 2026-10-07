import { useEffect, useState } from 'react';
import { submitOrQueue } from '../color/submit';
import { SAVE_TEXT, type SaveState } from '../color/useSaveMatch';
import type { RoundResult, Run } from './types';

export { SAVE_TEXT, type SaveState };

/** Manda a partida do Tempo (ms + sessão). O servidor recalcula a nota e confere o tempo decorrido. */
export function useSaveTime(run: Run, results: RoundResult[]): SaveState {
  const [save, setSave] = useState<SaveState>('saving');

  useEffect(() => {
    let alive = true;
    submitOrQueue({
      game: 'time',
      matchId: run.matchId,
      mode: run.preset,
      kind: run.kind,
      seed: run.seed,
      session: run.session,
      answers: results.map((r) => r.answer),
    })
      .then((r) => alive && setSave(r === 'sent' ? 'saved' : r === 'queued' ? 'queued' : 'error'))
      .catch(() => alive && setSave('error'));
    return () => {
      alive = false;
    };
  }, [run, results]);

  return save;
}
