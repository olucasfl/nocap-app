import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { gradeOf, playGrade } from '@/lib/grade';
import { sfx } from '@/lib/sfx';
import { useReveal } from '@/lib/useReveal';
import { DailyPanel } from '@/components/DailyPanel';
import { EndActions } from '@/components/EndActions';
import type { GameTab } from '@/components/GameTabs';
import { NewRecord } from '@/components/NewRecord';
import type { Board } from '@/lib/ranking';
import { saveBest } from '@/lib/records';
import { formatBest, isNewRecord } from '@/lib/stats';
import type { RoundResult, Run } from '../types';
import { TimeRoundsTable } from './TimeRoundsTable';
import { SAVE_TEXT, useSaveTime } from '../useSaveTime';

interface Props {
  run: Run;
  results: RoundResult[];
  /** Recorde do modo antes desta partida (décimos); `undefined` = sem estatísticas. */
  previousBest?: number;
  onMenu: (tab: GameTab, board?: Board) => void;
  onRematch: () => void;
}

export function FinalScreen({ run, results, previousBest, onMenu, onRematch }: Props) {
  const total = Math.round(results.reduce((a, r) => a + r.score * 10, 0)) / 10;
  const save = useSaveTime(run, results);

  useEffect(() => {
    saveBest('time', total);
  }, [total]);

  // Nota por nota: cada rodada aparece com o seu tique; o total sobe junto e, no fim, vem o som da faixa.
  const { shown, done } = useReveal(results.length, (i) => sfx.tick(Math.round(results[i]!.score)));
  const running = Math.round(results.slice(0, shown).reduce((a, r) => a + r.score * 10, 0)) / 10;
  useEffect(() => {
    if (done) playGrade(gradeOf(total / results.length).id);
  }, [done, total, results.length]);

  return (
    <section className="screen">
      <div className="tm-total">
        <div>
          <div className="mono tm-label">TOTAL</div>
          <b>{running.toFixed(1)}</b>
        </div>
        <div className="tm-total-max">/ {results.length * 10}</div>
      </div>
      <TimeRoundsTable rows={results} shown={shown} />
      {done && run.kind !== 'daily' && isNewRecord(previousBest, Math.round(total * 10)) && (
        <NewRecord
          now={formatBest('time', run.preset, Math.round(total * 10))}
          before={formatBest('time', run.preset, previousBest!)}
        />
      )}
      <p className="tm-save" role="status">
        {SAVE_TEXT[save]}
      </p>
      {done && run.kind === 'daily' && <DailyPanel game="time" />}
      <div className="stack">
        <button type="button" className="btn alt" onClick={onRematch}>
          Revanche
        </button>
        <EndActions board={run.kind === 'daily' ? 'daily' : run.preset} onMenu={onMenu} />
        <Link to="/" className="btn ghost">
          Voltar aos jogos
        </Link>
      </div>
    </section>
  );
}
