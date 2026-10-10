import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { EndActions } from '@/components/EndActions';
import type { GameTab } from '@/components/GameTabs';
import { MatchSummary } from '@/components/MatchSummary';
import type { Board } from '@/lib/ranking';
import { saveBest } from '@/lib/records';
import type { RoundResult, Run } from '../types';
import { SAVE_TEXT, useSaveMatch } from '../useSaveMatch';

interface Props {
  run: Run;
  result: RoundResult;
  /** Recorde do Rápido antes desta partida (décimos). */
  previousBest?: number;
  onMenu: (tab: GameTab, board?: Board) => void;
  onAgain: () => void;
}

/** Fim do jogo rápido: salva a partida e oferece outra rodada. Recorde próprio (nunca mistura com o Clássico). */
export function QuickActions({ run, result, previousBest, onMenu, onAgain }: Props) {
  const save = useSaveMatch(run, [result]);

  useEffect(() => {
    saveBest('color-quick', result.score);
  }, [result.score]);

  const now = Math.round(result.score * 10);
  return (
    <>
      <MatchSummary
        game="color"
        mode="quick"
        scoreTenths={now}
        previousBest={previousBest}
        saved={save === 'saved'}
        onRanking={() => onMenu('ranking', 'quick')}
      />
      <p className="cg-save" role="status">
        {SAVE_TEXT[save]}
      </p>
      <div className="stack">
        <button type="button" className="btn alt" onClick={onAgain}>
          Outra rodada
        </button>
        <EndActions board="quick" onMenu={onMenu} />
        <Link to="/" className="btn ghost">
          Voltar aos jogos
        </Link>
      </div>
    </>
  );
}
