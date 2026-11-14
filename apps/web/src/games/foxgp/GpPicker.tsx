import { useState } from 'react';
import { createPortal } from 'react-dom';
import { GP_MAX_PLAYERS, type GpPhysicsMode } from '@nocap/games';
import { GpGarage } from './GpGarage';
import { loadBest, loadPhysics, loadTrack, savePhysics, saveTrack } from './gp-best';
import { lapClock } from './format';
import { GP_TRACK_CHOICES, gpTrackName, gpVehicleFor } from './vehicles';
import './theme.css';
import './foxgp.css';

/** Quantos bots dá para escolher (você mais 11 bots: o grid de 12 cheio). */
const BOT_OPTIONS = [1, 3, 5, 7, 9, GP_MAX_PLAYERS - 1];

/**
 * Antes de correr (spec 081, Fase 1.3): a física (dois cartões, com a melhor volta de cada modo), a quantidade de
 * adversários, a pista que segue o modo, o atalho para a garagem e a largada. O nome do veículo e da pista de cada modo
 * vem do registro (`vehicles.ts`): o kart e a Bala Track só aparecem quando existirem.
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
  const [track, setTrack] = useState(() => loadTrack());
  const pickTrack = (id: string) => {
    setTrack(id);
    saveTrack(id);
  };
  const trackOf = (m: GpPhysicsMode) => (m === 'arcade' ? 'bala' : GP_TRACK_CHOICES.real.find((t) => t.id === track)?.id ?? 'marina');
  const select = (m: GpPhysicsMode) => {
    setPhysics(m);
    savePhysics(m);
  };
  return createPortal(
    <div className="gp-pick" role="dialog" aria-modal="true" aria-label="Antes de correr">
      <div className="gp-pick-card">
        <span className="gp-kicker">Treino Fox GP</span>
        <h2>Antes de correr</h2>

        <div className="gp-pick-modes" role="radiogroup" aria-label="Física">
          {(['real', 'arcade'] as const).map((m) => {
            const v = gpVehicleFor(m);
            const best = loadBest(trackOf(m));
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={physics === m}
                className={`gp-pick-mode-card${physics === m ? ' is-on' : ''}`}
                onClick={() => select(m)}
                data-testid={`gp-physics-${m}`}
              >
                <div className="gp-pick-mode-head">
                  <span className="gp-pick-mode-title">
                    {v.modeName} · {v.vehicleName}
                  </span>
                  <span className="gp-pick-mode-tag">{gpTrackName(m, trackOf(m))}</span>
                </div>
                <p className="gp-pick-mode-desc">{v.desc}</p>
                <div className="gp-pick-mode-best" data-testid={`gp-pick-best-${m}`}>
                  Melhor volta: <b>{best !== null ? lapClock(best) : 'ainda sem tempo'}</b>
                </div>
              </button>
            );
          })}
        </div>

        {physics === 'real' && (
          <div className="gp-pick-bots-section gp-pick-track">
            <span className="gp-kicker">Pista</span>
            <div className="gp-chips" role="radiogroup" aria-label="Pista">
              {GP_TRACK_CHOICES.real.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={track === t.id}
                  className={`gp-chip${track === t.id ? ' is-on' : ''}`}
                  onClick={() => pickTrack(t.id)}
                  data-testid={`gp-track-${t.id}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="gp-pick-bots-section">
          <span className="gp-kicker">
            Adversários ({bots} bots · {bots + 1} carros)
          </span>
          <div className="gp-chips" role="radiogroup" aria-label="Quantidade de adversários">
            {BOT_OPTIONS.map((n) => (
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
      {garage && (
        <GpGarage vehicle={gpVehicleFor(physics).vehicle} onClose={() => setGarage(false)} primary="Salvar" />
      )}
    </div>,
    document.body,
  );
}
