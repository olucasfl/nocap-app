import { useEffect, useState } from 'react';
import './rotate-hint.css';

const portrait = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(pointer: coarse)').matches &&
  matchMedia('(orientation: portrait)').matches;

/**
 * Aviso discreto no começo da partida: no celular em pé, "vire a tela na horizontal para ter uma imersão melhor".
 * Fica pequeno no alto (sem cobrir o tutorial nem a largada), some sozinho depois de uns segundos e na hora em que a
 * tela é virada. Só anima `transform` e `opacity`.
 */
export function RotateHint({ seconds = 7 }: { seconds?: number }) {
  const [show, setShow] = useState(portrait);
  useEffect(() => {
    if (!show) return undefined;
    const t = window.setTimeout(() => setShow(false), seconds * 1000);
    const mq = matchMedia('(orientation: portrait)');
    const onChange = () => {
      if (!mq.matches) setShow(false);
    };
    mq.addEventListener('change', onChange);
    return () => {
      window.clearTimeout(t);
      mq.removeEventListener('change', onChange);
    };
  }, [show, seconds]);
  if (!show) return null;
  return (
    <div
      className="rh"
      role="status"
      data-testid="rotate-hint"
      style={{ '--rh-s': `${seconds}s` } as React.CSSProperties}
    >
      <svg className="rh-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="7"
          y="2.5"
          width="10"
          height="19"
          rx="2.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <circle cx="12" cy="18.2" r="1.1" fill="currentColor" />
      </svg>
      <span>Vire a tela na horizontal para ter uma imersão melhor</span>
    </div>
  );
}
