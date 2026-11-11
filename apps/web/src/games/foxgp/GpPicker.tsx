import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { GpPhysicsMode } from '@nocap/games';
import { GpGarage } from './GpGarage';
import { loadBest, loadPhysics, savePhysics } from './gp-best';
import { lapClock } from './format';
import './theme.css';
import './foxgp.css';

/**
 * Antes de correr (spec 081, Fase 1):
 * Escolha do modo (Arcade/Kart vs Realista/F1), adversários (1 a 11), pista automática,
 * atalho para a garagem e largada.
 */
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
  const [physics, setPhysics] = useState<GpPhysicsMode>(() => loadPhysics());

  const selectPhysics = (m: GpPhysicsMode) => {
    setPhysics(m);
    savePhysics(m);
  };

  const bestArcade = loadBest('arcade');
  const bestReal = loadBest('real');

  // Máximo 11 bots no grid (para até 12 carros no total)
  const botOptions = [1, 3, 5, 7, 9, 11];

  return createPortal(
    <div className="gp-pick" role="dialog" aria-modal="true" aria-label="Antes de correr">
      <div className="gp-pick-card">
        <span className="gp-kicker">Treino Fox GP</span>
        <h2>Antes de correr</h2>

        <div className="gp-pick-modes" role="radiogroup" aria-label="Modo de corrida">
          <button
            type="button"
            role="radio"
            aria-checked={physics === 'arcade'}
            className={`gp-pick-mode-card${physics === 'arcade' ? ' is-on' : ''}`}
            onClick={() => selectPhysics('arcade')}
            data-testid="gp-physics-arcade"
          >
            <div className="gp-pick-mode-head">
              <span className="gp-pick-mode-title">Arcade · Kart</span>
              <span className="gp-pick-mode-tag">Bala Track</span>
            </div>
            <p className="gp-pick-mode-desc">Drift com turbo, saltinho e sem desgaste de pneu.</p>
            <div className="gp-pick-mode-best">
              Melhor volta: <b>{bestArcade !== null ? lapClock(bestArcade) : 'sem tempo'}</b>
            </div>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={physics === 'real'}
            className={`gp-pick-mode-card${physics === 'real' ? ' is-on' : ''}`}
            onClick={() => selectPhysics('real')}
            data-testid="gp-physics-real"
          >
            <div className="gp-pick-mode-head">
              <span className="gp-pick-mode-title">Realista · F1</span>
              <span className="gp-pick-mode-tag">Marina</span>
            </div>
            <p className="gp-pick-mode-desc">F1 com marchas, DRS, vácuo e parada nos boxes.</p>
            <div className="gp-pick-mode-best">
              Melhor volta: <b>{bestReal !== null ? lapClock(bestReal) : 'sem tempo'}</b>
            </div>
          </button>
        </div>

        <div className="gp-pick-bots-section">
          <span className="gp-kicker">Adversários no grid ({bots} bots · {bots + 1} carros)</span>
          <div className="gp-chips" role="radiogroup" aria-label="Quantidade de adversários">
            {botOptions.map((n) => (
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
        </div>

        <button type="button" className="gp-tbtn is-ghost" onClick={() => setGarage(true)} data-testid="gp-pick-garage">
          Garagem: cor e pintura
        </button>

        <div className="gp-pick-btns">
          <button type="button" className="gp-tbtn is-ghost" onClick={onCancel}>
            Voltar
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
