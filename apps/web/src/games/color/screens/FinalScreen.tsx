import { useEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { buzz, sfx } from '@/lib/sfx';
import { saveBest } from '@/lib/records';
import { toHex } from '../hex';
import type { RoundResult, Run } from '../types';
import { SAVE_TEXT, useSaveMatch } from '../useSaveMatch';

interface Props {
  run: Run;
  results: RoundResult[];
  onRematch: () => void;
}

export function FinalScreen({ run, results, onRematch }: Props) {
  const total = Math.round(results.reduce((a, r) => a + r.score * 10, 0)) / 10;
  const num = useRef<HTMLElement>(null);
  const save = useSaveMatch(run, results);

  useEffect(() => {
    saveBest('color', total);
  }, [total]);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let raf = 0;
    let lastTick = -1;
    const step = (now: number) => {
      const p = reduce ? 1 : Math.min(1, (now - t0) / 900);
      const v = total * (1 - (1 - p) ** 3);
      if (num.current) num.current.textContent = v.toFixed(1);
      const k = Math.floor(v / 5);
      if (k !== lastTick) {
        lastTick = k;
        sfx.tick(k);
      }
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        sfx.thunk();
        if (total >= 40) sfx.win();
        buzz(30);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  return (
    <section className="screen">
      <div className="cg-total">
        <div>
          <div className="mono" style={{ fontWeight: 700, fontSize: 12 }}>
            TOTAL
          </div>
          <b ref={num}>0.0</b>
        </div>
        <div style={{ font: '900 22px var(--font-display)' }}>/ {results.length * 10}</div>
      </div>
      <div className="cg-rows">
        {results.map((r, i) => (
          <div className="cg-row" key={i} style={{ animationDelay: `${i * 0.05}s` }}>
            <span>{i + 1}</span>
            <i style={{ background: toHex(r.target) }} />
            <i style={{ background: toHex(r.guess) }} />
            <span className="m">ΔE {r.deltaE.toFixed(1)}</span>
            <span className="s">{r.score.toFixed(1)}</span>
          </div>
        ))}
      </div>
      <p className="cg-save" role="status">
        {SAVE_TEXT[save]}
      </p>
      <div className="stack">
        <button type="button" className="btn alt" onClick={onRematch}>
          Revanche
        </button>
        <Link to="/cor" search={{ aba: 'ranking' }} className="btn ghost">
          Ver ranking
        </Link>
        <Link to="/cor" className="btn ghost">
          Modos do jogo
        </Link>
        <Link to="/" className="btn ghost">
          Voltar aos jogos
        </Link>
      </div>
    </section>
  );
}
