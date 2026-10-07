import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { buzz, sfx } from '@/lib/sfx';
import { saveBest } from '@/lib/records';
import { formatDiff, formatSeconds } from '../format';
import type { RoundResult, Run } from '../types';
import { SAVE_TEXT, useSaveTime } from '../useSaveTime';

interface Props {
  run: Run;
  results: RoundResult[];
  onRematch: () => void;
}

export function FinalScreen({ run, results, onRematch }: Props) {
  const total = Math.round(results.reduce((a, r) => a + r.score * 10, 0)) / 10;
  const save = useSaveTime(run, results);

  useEffect(() => {
    saveBest('time', total);
  }, [total]);

  useEffect(() => {
    sfx.thunk();
    if (total >= 40) sfx.win();
    buzz(30);
  }, [total]);

  return (
    <section className="screen">
      <div className="tm-total">
        <div>
          <div className="mono tm-label">TOTAL</div>
          <b>{total.toFixed(1)}</b>
        </div>
        <div className="tm-total-max">/ {results.length * 10}</div>
      </div>
      <div className="tm-rows">
        {results.map((r, i) => (
          <div className="tm-row" key={i}>
            <span>{i + 1}</span>
            <span className="mono tm-row-times">
              {formatSeconds(r.target)} → {formatSeconds(r.answer)}
            </span>
            <span className="mono tm-row-diff">{formatDiff(r.answer - r.target)}</span>
            <span className="tm-row-score">{r.score.toFixed(1)}</span>
          </div>
        ))}
      </div>
      <p className="tm-save" role="status">
        {SAVE_TEXT[save]}
      </p>
      <div className="stack">
        <button type="button" className="btn alt" onClick={onRematch}>
          Revanche
        </button>
        <Link to="/" className="btn ghost">
          Voltar aos jogos
        </Link>
      </div>
    </section>
  );
}
