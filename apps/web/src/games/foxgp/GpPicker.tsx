import { useState } from 'react';
import { createPortal } from 'react-dom';
import { GP_LAP_OPTIONS, GP_MAX_PLAYERS, type GpPhysicsMode } from '@nocap/games';
import { GpGarage } from './GpGarage';
import { GpItemIcon, type GpIconKind } from './GpItemIcon';
import {
  loadBest,
  loadLaps,
  loadPhysics,
  loadPowers,
  loadTrack,
  saveLaps,
  savePhysics,
  savePowers,
  saveTrack,
} from './gp-best';
import { lapClock } from './format';
import { GP_TRACK_CHOICES, gpTrackName, gpVehicleFor } from './vehicles';
import './theme.css';
import './foxgp.css';

/** Os poderes do modo Poderes, na ordem em que aparecem no cartão. */
const POWER_KINDS: GpIconKind[] = [
  'peel',
  'ball',
  'seeker',
  'bomb',
  'nitro',
  'star',
  'bolt',
  'shield',
  'ice',
  'shock',
  'mud',
  'swap',
];

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
  const [powers, setPowers] = useState(() => loadPowers());
  const pickPowers = (on: boolean) => {
    setPowers(on);
    savePowers(on);
  };
  const [laps, setLaps] = useState(() => loadLaps());
  const pickLaps = (n: number) => {
    setLaps(n);
    saveLaps(n);
  };
  const pickTrack = (id: string) => {
    setTrack(id);
    saveTrack(id);
  };
  const trackOf = (m: GpPhysicsMode) =>
    m === 'arcade' ? 'bala' : (GP_TRACK_CHOICES.real.find((t) => t.id === track)?.id ?? 'marina');
  const select = (m: GpPhysicsMode) => {
    setPhysics(m);
    savePhysics(m);
  };
  const track0 = trackOf(physics);
  const summary = [
    physics === 'arcade' ? 'Arcade' : 'Realista',
    physics === 'arcade' ? (powers ? 'com poderes' : 'corrida pura') : gpTrackName(physics, track0),
    `${laps} ${laps === 1 ? 'volta' : 'voltas'}`,
    `${bots + 1} carros`,
  ];
  return createPortal(
    <div className="gp-pick" role="dialog" aria-modal="true" aria-label="Antes de correr">
      <div className="gp-pick-card">
        <header className="gp-pick-head">
          <span className="gp-kicker">Treino Fox GP</span>
          <h2>Antes de correr</h2>
        </header>

        <div className="gp-pick-cols">
          <div className="gp-pick-col">
            <section className="gp-pick-sec">
              <h3 className="gp-pick-step">
                <b>1</b> Escolha o estilo
              </h3>
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
                        <span className="gp-pick-mode-title">{v.modeName}</span>
                        <span className="gp-pick-mode-tag">{v.vehicleName}</span>
                      </div>
                      <p className="gp-pick-mode-desc">{v.desc}</p>
                      <div className="gp-pick-mode-best" data-testid={`gp-pick-best-${m}`}>
                        {gpTrackName(m, trackOf(m))} · melhor volta{' '}
                        <b>{best !== null ? lapClock(best) : 'sem tempo'}</b>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {physics === 'arcade' && (
              <section className="gp-pick-sec">
                <h3 className="gp-pick-step">
                  <b>2</b> Modo do Arcade
                </h3>
                <div className="gp-pick-powers" role="radiogroup" aria-label="Modo do Arcade">
                  {([false, true] as const).map((on) => (
                    <button
                      key={String(on)}
                      type="button"
                      role="radio"
                      aria-checked={powers === on}
                      className={`gp-pick-power-card${powers === on ? ' is-on' : ''}`}
                      onClick={() => pickPowers(on)}
                      data-testid={`gp-powers-${on ? 'on' : 'off'}`}
                    >
                      <span className="gp-pick-power-title">{on ? 'Poderes' : 'Corrida pura'}</span>
                      <span className="gp-pick-power-desc">
                        {on
                          ? 'Caixas na pista dão itens para atacar e se defender.'
                          : 'Só pilotagem: drift e turbo, sem itens.'}
                      </span>
                      {on && (
                        <span className="gp-pick-power-icons" aria-hidden="true">
                          {POWER_KINDS.map((k) => (
                            <GpItemIcon key={k} kind={k} size={22} />
                          ))}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {physics === 'real' && (
              <section className="gp-pick-sec gp-pick-track">
                <h3 className="gp-pick-step">
                  <b>2</b> Pista
                </h3>
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
              </section>
            )}
          </div>

          <div className="gp-pick-col">
            <section className="gp-pick-sec">
              <h3 className="gp-pick-step">
                <b>3</b> Ajuste a corrida
              </h3>
              <div className="gp-pick-field">
                <span className="gp-kicker">Voltas</span>
                <div
                  className="gp-chips gp-chips-laps"
                  role="radiogroup"
                  aria-label="Número de voltas"
                >
                  {GP_LAP_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={laps === n}
                      className={`gp-chip${laps === n ? ' is-on' : ''}`}
                      onClick={() => pickLaps(n)}
                      data-testid={`gp-laps-${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="gp-pick-field">
                <span className="gp-kicker">
                  Adversários{' '}
                  <em>
                    ({bots} bots · {bots + 1} carros)
                  </em>
                </span>
                <div
                  className="gp-chips gp-chips-bots"
                  role="radiogroup"
                  aria-label="Quantidade de adversários"
                >
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
              <button
                type="button"
                className="gp-pick-garage"
                onClick={() => setGarage(true)}
                data-testid="gp-pick-garage"
              >
                <span>Garagem</span>
                <small>cor e pintura do seu kart</small>
              </button>
            </section>

            <div className="gp-pick-summary" data-testid="gp-pick-summary">
              {summary.map((t, i) => (
                <span key={i}>{t}</span>
              ))}
            </div>
            <div className="gp-pick-btns">
              <button type="button" className="gp-tbtn is-ghost" onClick={onCancel}>
                Voltar
              </button>
              <button
                type="button"
                className="gp-tbtn is-primary"
                onClick={onStart}
                data-testid="gp-start"
              >
                Ir para a pista
              </button>
            </div>
          </div>
        </div>
      </div>
      {garage && (
        <GpGarage
          vehicle={gpVehicleFor(physics).vehicle}
          onClose={() => setGarage(false)}
          primary="Salvar"
        />
      )}
    </div>,
    document.body,
  );
}
