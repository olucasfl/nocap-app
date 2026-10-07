import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { gradeOf, playGrade } from '@/lib/grade';
import { sfx } from '@/lib/sfx';
import { useReveal } from '@/lib/useReveal';
import { EndActions } from '@/components/EndActions';
import type { GameTab } from '@/components/GameTabs';
import { NewRecord } from '@/components/NewRecord';
import type { Board } from '@/lib/ranking';
import { saveBest } from '@/lib/records';
import { formatBest, isNewRecord } from '@/lib/stats';
import { toHex } from '../hex';
import type { RoundResult, Run } from '../types';
import { SAVE_TEXT, useSaveMatch } from '../useSaveMatch';

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
  const totalTenths = Math.round(total * 10);
  const save = useSaveMatch(run, results);

  useEffect(() => {
    saveBest('color', total);
  }, [total]);

  // Nota por nota: cada rodada aparece com o seu tique; o total sobe junto e, no fim, vem o som da faixa.
  const { shown, done } = useReveal(results.length, (i) => sfx.tick(Math.round(results[i]!.score)));
  const running = Math.round(results.slice(0, shown).reduce((a, r) => a + r.score * 10, 0)) / 10;
  useEffect(() => {
    if (done) playGrade(gradeOf(total / results.length).id);
  }, [done, total, results.length]);

  return (
    <section className="screen">
      <div className="cg-total">
        <div>
          <div className="mono" style={{ fontWeight: 700, fontSize: 12 }}>
            TOTAL
          </div>
          <b>{running.toFixed(1)}</b>
        </div>
        <div style={{ font: '900 22px var(--font-display)' }}>/ {results.length * 10}</div>
      </div>
      <div className="cg-rows">
        {results.map((r, i) => (
          <div className={`cg-row${i < shown ? ' in' : ' pending'}`} key={i}>
            <span>{i + 1}</span>
            <i style={{ background: toHex(r.target) }} />
            <i style={{ background: toHex(r.guess) }} />
            <span className="m">ΔE {r.deltaE.toFixed(1)}</span>
            <span className="s">{r.score.toFixed(1)}</span>
          </div>
        ))}
      </div>
      {done && run.kind !== 'daily' && isNewRecord(previousBest, totalTenths) && (
        <NewRecord
          now={formatBest('color', run.preset, totalTenths)}
          before={formatBest('color', run.preset, previousBest!)}
        />
      )}
      <p className="cg-save" role="status">
        {SAVE_TEXT[save]}
      </p>
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
