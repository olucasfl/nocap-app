import { createPortal } from 'react-dom';
import { GP_FURS } from './GpPlay';
import { css } from './format';
import './foxgp.css';

/** Treino do Fox GP: contra quantas raposas correr e a cor do seu pelo (a pintura do carro segue). */
export function GpPicker({
  bots,
  color,
  onBots,
  onColor,
  onStart,
  onCancel,
}: {
  bots: number;
  color: number;
  onBots: (n: number) => void;
  onColor: (c: number) => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div className="gp-pick" role="dialog" aria-modal="true" aria-label="Treino do Fox GP">
      <div className="gp-pick-card">
        <h2>Treino do Fox GP</h2>
        <h3>Contra quantas raposas?</h3>
        <div className="gp-chips" role="radiogroup" aria-label="Quantidade de adversários">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={bots === n}
              className={`gp-chip${bots === n ? ' is-on' : ''}`}
              onClick={() => onBots(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <h3>Garagem: a cor da sua raposa</h3>
        <div className="gp-colors" role="radiogroup" aria-label="Cor do pelo e do carro">
          {GP_FURS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Cor ${css(c)}`}
              className={`gp-color${color === c ? ' is-on' : ''}`}
              style={{ background: css(c) }}
              onClick={() => onColor(c)}
            />
          ))}
        </div>
        <p className="mono">
          Classificação de 1 volta, depois corrida de 3 voltas. A cor é só visual: todos os carros são iguais.
        </p>
        <div className="gp-pick-btns">
          <button type="button" className="gp-btn" onClick={onStart} data-testid="gp-start">
            Correr
          </button>
          <button type="button" className="gp-btn is-ghost" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
