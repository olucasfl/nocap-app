import { useState } from 'react';
import { createPortal } from 'react-dom';
import { GpGarage } from './GpGarage';
import './theme.css';
import './foxgp.css';

/** Treino do Fox GP: contra quantas raposas correr, com atalho para a garagem (cor e pintura do seu carro). */
export function GpPicker({
  bots,
  onBots,
  onStart,
  onCancel,
}: {
  bots: number;
  onBots: (n: number) => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  const [garage, setGarage] = useState(false);
  return createPortal(
    <div className="gp-pick" role="dialog" aria-modal="true" aria-label="Treino do Fox GP">
      <div className="gp-pick-card">
        <span className="gp-kicker">Treino</span>
        <h2>Contra quantas raposas?</h2>
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
        <p>Classificação individual (você escolhe quando começar a volta), depois 3 voltas no Circuito da Marina.</p>
        <button type="button" className="gp-tbtn is-ghost" onClick={() => setGarage(true)} data-testid="gp-pick-garage">
          Garagem: cor e pintura
        </button>
        <div className="gp-pick-btns">
          <button type="button" className="gp-tbtn is-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="gp-tbtn is-primary" onClick={onStart} data-testid="gp-start">
            Ir para a pista
          </button>
        </div>
      </div>
      {garage && <GpGarage onClose={() => setGarage(false)} primary="Salvar" />}
    </div>,
    document.body,
  );
}
