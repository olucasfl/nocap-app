import type { CSSProperties } from 'react';
import type { GradeId } from '@/lib/grade';
import './grade.css';

const CONFETTI = [
  'var(--yellow)',
  'var(--orange)',
  'var(--blue)',
  'var(--green)',
  'var(--pink)',
  'var(--white)',
];

/**
 * Efeitos de tela de cada faixa da nota: CRAVOU (clarão dourado e confete), quase perfeito
 * (faíscas), e para as notas muito ruins (clarão escuro e rachaduras). Só opacity/transform.
 */
export function GradeFx({ id }: { id: GradeId }) {
  if (id === 'perfect') {
    return (
      <div className="gfx" aria-hidden="true">
        <div className="gfx-flash gold" />
        {Array.from({ length: 24 }, (_, i) => (
          <i
            key={i}
            className="gfx-confetti"
            style={
              {
                '--a': `${(i * 360) / 24}deg`,
                '--d': `${120 + (i % 4) * 45}px`,
                '--c': CONFETTI[i % CONFETTI.length],
                '--r': `${(i % 5) * 70}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    );
  }
  if (id === 'near') {
    return (
      <div className="gfx" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i
            key={i}
            className="gfx-spark"
            style={
              { '--a': `${(i * 360) / 10}deg`, '--d': `${90 + (i % 3) * 35}px` } as CSSProperties
            }
          />
        ))}
      </div>
    );
  }
  if (id === 'awful' || id === 'zero') {
    return (
      <div className="gfx" aria-hidden="true">
        <div className="gfx-flash dark" />
        <div className="gfx-crack" />
      </div>
    );
  }
  return null;
}
