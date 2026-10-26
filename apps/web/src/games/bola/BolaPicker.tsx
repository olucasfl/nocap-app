import { createPortal } from 'react-dom';
import { BOL_TEAM_NAMES, bolFormatLabel, bolFormats } from '@nocap/games';
import type { BolaSetup } from './BolaPlay';
import './bola.css';

/** A escolha do formato e da duração do treino do Fut Fox (usada na página do jogo e no Fox Cap!). */
export function BolaPicker({
  setup,
  onChange,
  onStart,
  onCancel,
}: {
  setup: BolaSetup;
  onChange: (next: BolaSetup) => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  const formats = bolFormats();
  return createPortal(
    <div className="dsm-pick" role="dialog" aria-modal="true" aria-label="Formato do treino">
      <div className="dsm-pick-card bola-pick">
        <h2>Formato</h2>
        <p className="mono">
          {bolFormatLabel(setup)} · você no time {BOL_TEAM_NAMES[0]}, o resto são bots
        </p>
        <div className="bola-chips" role="radiogroup" aria-label="Formato">
          {formats.map((f) => {
            const on = setup.teams === f.teams && setup.perTeam === f.perTeam;
            return (
              <button
                key={bolFormatLabel(f)}
                type="button"
                role="radio"
                aria-checked={on}
                className={`dsm-chip${on ? ' is-on' : ''}`}
                onClick={() => onChange({ ...setup, teams: f.teams, perTeam: f.perTeam })}
                data-testid={`bola-fmt-${bolFormatLabel(f)}`}
              >
                {bolFormatLabel(f)}
              </button>
            );
          })}
        </div>
        <h3>Duração</h3>
        <div className="bola-chips" role="radiogroup" aria-label="Duração">
          {[1, 2, 3, 5, 8, 10, 15, 30].map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={setup.minutes === m}
              className={`dsm-chip${setup.minutes === m ? ' is-on' : ''}`}
              onClick={() => onChange({ ...setup, minutes: m })}
            >
              {m} min
            </button>
          ))}
        </div>
        <div className="dsm-over-btns">
          <button type="button" className="dsm-btn" onClick={onStart} data-testid="bola-start">
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
