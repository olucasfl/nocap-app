import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GradeFx } from '@/components/GradeFx';
import { gradeLine, gradeOf, playGrade } from '@/lib/grade';
import { buzz, sfx } from '@/lib/sfx';
import { toHex } from '../hex';
import type { RoundResult } from '../types';

const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);

interface Props {
  result: RoundResult;
  isLast: boolean;
  onNext: () => void;
  /** Substitui o botão padrão (o jogo rápido termina aqui, sem tela de total). */
  footer?: ReactNode;
  /** Sobrevivência: aviso de passou/perdeu vida, entre o resultado e o botão. */
  extra?: ReactNode;
}

export function ResultScreen({ result, isLast, onNext, footer, extra }: Props) {
  const { target, guess, score } = result;
  const grade = gradeOf(score);
  // Uma frase por resultado (sorteada uma vez, não a cada renderização).
  const [line] = useState(() => gradeLine(grade.id, 'color'));
  const num = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState(false);

  // Contagem com tiques subindo de tom, depois carimbo, tremor e som final.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : 650 + score * 40;
    const t0 = performance.now() + (reduce ? 0 : 380);
    const timers: number[] = [];
    let raf = 0;
    let lastTick = -1;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (num.current) num.current.textContent = score.toFixed(1);
      setDone(true);
      timers.push(
        window.setTimeout(() => {
          sfx.thunk();
          buzz(30);
          setShake(true);
        }, 260),
        window.setTimeout(() => playGrade(grade.id), 420),
      );
    };

    const step = (now: number) => {
      const p = dur === 0 ? 1 : Math.max(0, Math.min(1, (now - t0) / dur));
      const v = score * (1 - (1 - p) ** 3);
      if (p > 0) {
        setStarted(true);
        if (num.current) num.current.textContent = v.toFixed(1);
        const tk = Math.floor(v);
        if (tk !== lastTick) {
          lastTick = tk;
          sfx.tick(tk);
        }
      }
      if (p < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
    // Rede de segurança: se os quadros de animação pararem (aba em segundo plano), termina assim mesmo.
    const failsafe = window.setTimeout(finish, (reduce ? 0 : 380) + dur + 500);

    return () => {
      window.clearTimeout(failsafe);
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [score]);

  let hd = guess.h - target.h;
  if (hd > 180) hd -= 360;
  if (hd < -180) hd += 360;
  const diffs = [
    { name: 'MATIZ', a: target.h / 360, b: guess.h / 360, v: `${sign(hd)}°` },
    { name: 'SATUR.', a: target.s / 100, b: guess.s / 100, v: sign(guess.s - target.s) },
    { name: 'BRILHO', a: target.b / 100, b: guess.b / 100, v: sign(guess.b - target.b) },
  ];

  return (
    <section className={`screen${shake ? ' cg-shake' : ''}`}>
      {done && <GradeFx id={grade.id} />}
      <div className="cg-duo">
        <div className="cg-sw a" style={{ background: toHex(target) }}>
          <div className="tag">ALVO</div>
          <small>{toHex(target)}</small>
        </div>
        <div className="cg-sw b" style={{ background: toHex(guess) }}>
          <div className="tag">VOCÊ</div>
          <small>{toHex(guess)}</small>
        </div>
        <div
          className={`cg-stamp${done ? ` hit g-${grade.id}` : ''}`}
          style={{ visibility: started ? 'visible' : 'hidden' }}
        >
          <b ref={num}>0.0</b>
          <span>{done ? grade.word : '...'}</span>
        </div>
      </div>
      <p className="cg-verdict" aria-live="polite">
        {done ? line : ''}
      </p>
      <div className="cg-diffs">
        {diffs.map((d) => (
          <div className="cg-diff" key={d.name}>
            <span>{d.name}</span>
            <div className="t">
              <i style={{ left: `${d.a * 100}%`, background: 'var(--ink)' }} />
              <i style={{ left: `${d.b * 100}%`, background: 'var(--orange)' }} />
            </div>
            <span className="v">{d.v}</span>
          </div>
        ))}
      </div>
      {done && extra}
      {footer ?? (
        <div className="stack">
          <button type="button" className="btn" onClick={onNext}>
            {isLast ? 'Ver resultado' : 'Próxima'}
          </button>
        </div>
      )}
    </section>
  );
}
