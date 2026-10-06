import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { saveBest } from '@/lib/records';
import type { RoundResult, Run } from '../types';
import { SAVE_TEXT, useSaveMatch } from '../useSaveMatch';

interface Props {
  run: Run;
  result: RoundResult;
  onAgain: () => void;
}

/** Fim do jogo rápido: salva a partida e oferece outra rodada. Recorde próprio (nunca mistura com o Clássico). */
export function QuickActions({ run, result, onAgain }: Props) {
  const save = useSaveMatch(run, [result]);

  useEffect(() => {
    saveBest('color-quick', result.score);
  }, [result.score]);

  return (
    <>
      <p className="cg-save" role="status">
        {SAVE_TEXT[save]}
      </p>
      <div className="stack">
        <button type="button" className="btn alt" onClick={onAgain}>
          Outra rodada
        </button>
        <Link to="/" className="btn ghost">
          Voltar aos jogos
        </Link>
      </div>
    </>
  );
}
