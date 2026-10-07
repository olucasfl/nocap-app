import { useEffect, useRef, useState } from 'react';

/**
 * Revela `count` itens um por um (nota por nota), sem demorar demais: o passo encolhe quando há
 * muitos itens (cabe em ~2,6 s). `onStep(i)` toca o som de cada item. Com movimento reduzido
 * mostra tudo de uma vez.
 */
export function useReveal(count: number, onStep?: (index: number) => void) {
  const reduced = useRef(
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  ).current;
  const [shown, setShown] = useState(reduced ? count : 0);
  const step = useRef(onStep);
  step.current = onStep;

  useEffect(() => {
    if (reduced) return;
    const gap = Math.min(450, Math.max(160, 2600 / Math.max(1, count)));
    let i = 0;
    let timer = 0;
    const next = () => {
      i += 1;
      setShown(i);
      step.current?.(i - 1);
      if (i < count) timer = window.setTimeout(next, gap);
    };
    timer = window.setTimeout(next, 500);
    return () => window.clearTimeout(timer);
  }, [count, reduced]);

  return { shown, done: shown >= count };
}
