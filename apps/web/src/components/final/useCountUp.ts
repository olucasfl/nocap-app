import { useEffect, useState } from 'react';

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Conta de 0 até `to` (o número "sobe" depois de um atraso); com movimento reduzido já mostra o valor final. */
export function useCountUp(to: number, delayMs = 300, durMs = 900): number {
  const [v, setV] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setV(to);
      return undefined;
    }
    let raf = 0;
    const t0 = performance.now() + delayMs;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / durMs));
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delayMs, durMs]);
  return v;
}
