import type { CSSProperties } from 'react';
import type { CollapseView } from './game-logic';
import './collapse.css';

interface Props {
  view: CollapseView;
  /** Versão miúda, sob o botão "Estrela pronta": barras mais finas e letra menor. */
  compact?: boolean;
}

/**
 * As barras dos três requisitos do colapso (spec 040, seção 2): poeira da vida, escolhas e o marco da vida.
 * A barra anda só em `transform`; o texto diz o que falta, então a cor não é o único sinal.
 */
export function RequirementBars({ view, compact = false }: Props) {
  return (
    <ul className={`ap-reqs${compact ? ' is-compact' : ''}`} aria-label={`Requisitos do colapso ${view.next}`}>
      {view.requirements.map((r) => (
        <li key={r.id} className={r.done ? 'is-done' : ''} data-req={r.id}>
          <div className="ap-req-head">
            <span className="ap-req-label">{r.label}</span>
            <span className="ap-req-text">
              {r.text}
              {r.done && <span className="ap-req-ok">, cumprido</span>}
            </span>
          </div>
          <div
            className="ap-cbar"
            role="progressbar"
            aria-label={r.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(r.fill * 100)}
            aria-valuetext={r.text}
          >
            <i style={{ transform: `scaleX(${r.fill})` } as CSSProperties} />
          </div>
        </li>
      ))}
    </ul>
  );
}
