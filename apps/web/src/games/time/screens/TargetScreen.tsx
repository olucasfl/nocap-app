import { useEffect } from 'react';
import { sfx } from '@/lib/sfx';
import { formatSeconds } from '../format';

interface Props {
  target: number;
  noOvershoot: boolean;
  onBegin: () => void;
}

/** O alvo da rodada. O toque que inicia a contagem é medido aqui (`pointerdown`, sem esperar o clique). */
export function TargetScreen({ target, noOvershoot, onBegin }: Props) {
  useEffect(() => {
    sfx.flip();
  }, []);

  return (
    <section className="screen tm-target">
      <div className="mono tm-label">ALVO</div>
      <div className="tm-target-time" aria-label={`Alvo: ${formatSeconds(target)}`}>
        {formatSeconds(target)}
      </div>
      <p className="lead">
        Toque para começar e toque de novo quando achar que chegou lá. Sem relógio, sem som.
        {noOvershoot && ' Passou do alvo, vale zero.'}
      </p>
      <div className="stack">
        <button
          type="button"
          className="btn alt"
          onPointerDown={onBegin}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onBegin();
            }
          }}
        >
          Tocar para começar
        </button>
      </div>
    </section>
  );
}
