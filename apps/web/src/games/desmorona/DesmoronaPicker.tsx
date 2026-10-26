import { createPortal } from 'react-dom';
import './desmorona.css';

/** A escolha de quantas raposas jogam contra você no treino do Desmorona! (página do jogo e Fox Cap!). */
export function DesmoronaPicker({
  bots,
  onChange,
  onStart,
  onCancel,
}: {
  bots: number;
  onChange: (n: number) => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div
      className="dsm-pick"
      role="dialog"
      aria-modal="true"
      aria-label="Quantas raposas no treino"
    >
      <div className="dsm-pick-card">
        <h2>Contra quantas raposas?</h2>
        <p className="mono">VOCÊ + {bots}</p>
        <div className="dsm-chips" role="radiogroup" aria-label="Quantidade de adversários">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={bots === n}
              className={`dsm-chip${bots === n ? ' is-on' : ''}`}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="dsm-over-btns">
          <button type="button" className="dsm-btn" onClick={onStart} data-testid="dsm-start">
            Começar
          </button>
          <button type="button" className="dsm-btn is-ghost" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
