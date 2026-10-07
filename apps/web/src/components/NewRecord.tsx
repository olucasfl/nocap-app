import { useEffect, type CSSProperties } from 'react';
import { buzz, sfx } from '@/lib/sfx';
import './new-record.css';

/**
 * "Novo recorde!" no fim da partida: cartão que estoura na tela, estrelas saindo, e um som
 * próprio (fanfarra). Só opacidade e transform; movimento reduzido mostra o cartão parado.
 */
export function NewRecord({ now, before }: { now: string; before: string }) {
  useEffect(() => {
    sfx.record();
    buzz(60);
  }, []);
  return (
    <section className="nr" role="status" aria-label="Novo recorde">
      <span className="nr-stars" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i
            key={i}
            style={{ '--a': `${i * 30}deg`, '--d': `${i % 2 ? 150 : 110}px` } as CSSProperties}
          />
        ))}
      </span>
      <div className="mono nr-kicker">NOVO RECORDE!</div>
      <div className="nr-now">{now}</div>
      <div className="mono nr-before">ANTES: {before}</div>
    </section>
  );
}
