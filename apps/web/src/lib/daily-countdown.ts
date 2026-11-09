import { useEffect, useState } from 'react';

/** Segundos até a meia-noite de Brasília (UTC-3, sem horário de verão), quando sai a próxima palavra do Daily. */
export function secondsToBrasiliaMidnight(now = Date.now()): number {
  const intoDay = (Math.floor(now / 1000) - 3 * 3600) % 86400;
  return 86400 - (((intoDay % 86400) + 86400) % 86400);
}
export const formatCountdown = (s: number) =>
  [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');

/** Conta regressiva até a próxima palavra; ao zerar, avisa para recarregar o Daily. */
export function useNextWordCountdown(onZero: () => void) {
  const [left, setLeft] = useState(() => secondsToBrasiliaMidnight());
  useEffect(() => {
    const id = setInterval(() => {
      const s = secondsToBrasiliaMidnight();
      setLeft((prev) => {
        if (s > prev) onZero();
        return s;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return left;
}
