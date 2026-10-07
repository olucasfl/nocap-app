import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { buzz, sfx } from '@/lib/sfx';
import { saveBest } from '@/lib/records';
import { formatDiff, formatSeconds, verdictWord } from '../format';
import type { RoundResult, Run } from '../types';
import { SAVE_TEXT, useSaveTime } from '../useSaveTime';

interface Props {
  result: RoundResult;
  run: Run;
  isLast: boolean;
  onNext: () => void;
  onAgain: () => void;
}

/** Fim do jogo rápido: salva a partida e oferece outra rodada. Recorde próprio. */
function QuickFooter({
  run,
  result,
  onAgain,
}: {
  run: Run;
  result: RoundResult;
  onAgain: () => void;
}) {
  const save = useSaveTime(run, [result]);
  useEffect(() => {
    saveBest('time-quick', result.score);
  }, [result.score]);
  return (
    <>
      <p className="tm-save" role="status">
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

export function ResultScreen({ result, run, isLast, onNext, onAgain }: Props) {
  const { target, answer, score } = result;
  const diff = answer - target;
  const overshot = run.settings.noOvershoot && answer > target;

  useEffect(() => {
    // Só agora, com a contagem encerrada, há som e vibração.
    sfx.thunk();
    if (score >= 9.5) sfx.win();
    else if (score < 5) sfx.boing();
    buzz(30);
  }, [score]);

  return (
    <section className="screen">
      <div className="tm-duo">
        <div className="tm-time">
          <div className="mono tm-label">ALVO</div>
          <b>{formatSeconds(target)}</b>
        </div>
        <div className={`tm-time you${overshot ? ' over' : ''}`}>
          <div className="mono tm-label">{overshot ? 'VOCÊ · ESTOUROU' : 'VOCÊ'}</div>
          <b>{formatSeconds(answer)}</b>
          <span className="mono tm-diff">{formatDiff(diff)}</span>
        </div>
      </div>
      <div className="tm-stamp" role="status">
        <b>{score.toFixed(1)}</b>
        <span>{verdictWord(score)}</span>
      </div>
      {run.mode === 'quick' ? (
        <QuickFooter run={run} result={result} onAgain={onAgain} />
      ) : (
        <div className="stack">
          <button type="button" className="btn" onClick={onNext}>
            {isLast ? 'Ver resultado' : 'Próxima'}
          </button>
        </div>
      )}
    </section>
  );
}
