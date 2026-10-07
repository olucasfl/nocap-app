import { useEffect, useRef, useState } from 'react';
import { Refresh } from './icons';
import './pull-to-refresh.css';

const THRESHOLD = 72;
const MAX_PULL = 120;

/**
 * Puxar para recarregar, como nos apps grandes: com a página no topo, puxar para baixo desce um
 * ícone; soltando depois do limite ele gira e a página recarrega. Só toque; não existe no meio
 * de uma partida (use apenas em telas de menu).
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const current = useRef(0);

  useEffect(() => {
    const atTop = () => window.scrollY <= 0 && document.documentElement.scrollTop <= 0;

    const onStart = (e: TouchEvent) => {
      if (refreshing || !atTop() || e.touches.length !== 1) return;
      start.current = e.touches[0]!.clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0]!.clientY - start.current;
      if (dy <= 0 || !atTop()) {
        current.current = 0;
        setPull(0);
        return;
      }
      // Resistência: quanto mais puxa, mais pesado.
      current.current = Math.min(MAX_PULL, dy * 0.5);
      setPull(current.current);
      if (e.cancelable) e.preventDefault();
    };
    const onEnd = () => {
      if (start.current === null) return;
      start.current = null;
      if (current.current >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD * 0.8);
        // Dá tempo de ver o ícone girar antes de recarregar.
        window.setTimeout(() => window.location.reload(), 650);
      } else {
        setPull(0);
      }
      current.current = 0;
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [refreshing]);

  if (pull <= 0 && !refreshing) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div
      className={`ptr${refreshing ? ' spin' : ''}${ready ? ' ready' : ''}`}
      style={{ transform: `translateY(${pull - 56}px)` }}
      role="status"
      aria-label={refreshing ? 'Recarregando' : 'Puxe para recarregar'}
    >
      <span style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}>
        <Refresh size={24} />
      </span>
    </div>
  );
}
