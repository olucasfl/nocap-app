import { useEffect, useRef } from 'react';
import { sfx } from '@/lib/sfx';

interface Props {
  color: string;
  ms: number;
  onDone: () => void;
}

/**
 * A barra é guiada por requestAnimationFrame (não por CSS) para o tempo de exibição
 * continuar valendo mesmo com `prefers-reduced-motion`.
 */
export function ShowScreen({ color, ms, onDone }: Props) {
  const bar = useRef<HTMLElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    sfx.flip();
    const t0 = performance.now();
    let raf = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      sfx.vanish();
      done.current();
    };
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      if (bar.current) bar.current.style.transform = `scaleX(${1 - p})`;
      if (p < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
    // Se os quadros de animação pararem (aba em segundo plano), a cor some no tempo certo mesmo assim.
    const failsafe = window.setTimeout(finish, ms + 300);
    return () => {
      window.clearTimeout(failsafe);
      cancelAnimationFrame(raf);
    };
  }, [ms]);

  return (
    <section className="screen">
      <div className="cg-card-wrap">
        <div className="cg-card" style={{ background: color }}>
          <div className="tag">DECORE</div>
        </div>
      </div>
      <div className="cg-bar">
        <i ref={bar} />
      </div>
      <div className="cg-hint">A COR SOME QUANDO A BARRA ACABAR</div>
    </section>
  );
}
