import { useState } from 'react';
import { BOL_TEAM_COLORS, BOL_TEAM_NAMES } from '@nocap/games';

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Configurações da partida: continuar, estatísticas, câmera, trocar de time ou espectar e sair. */
export function BolaMenu({
  teams,
  myTeam,
  ballCam,
  onClose,
  onStats,
  onCam,
  onSwitch,
  onExit,
}: {
  teams: number;
  /** Time de quem joga; -1 = espectador. */
  myTeam: number;
  ballCam: boolean;
  onClose: () => void;
  onStats: () => void;
  onCam: () => void;
  /** Devolve a mensagem de erro (ex.: "Time cheio"), ou null se deu certo. */
  onSwitch: (team: number) => string | null;
  onExit: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const pick = (t: number) => setError(onSwitch(t));
  const spectating = myTeam < 0;
  return (
    <div
      className="dsm-pick bola-menu-wrap"
      role="dialog"
      aria-modal="true"
      aria-label="Configurações"
      data-testid="bola-menu"
    >
      <div className="dsm-pick-card bola-menu">
        <h2>Configurações</h2>
        <button
          type="button"
          className="dsm-btn"
          onClick={onClose}
          data-testid="bola-menu-continue"
        >
          Continuar jogando
        </button>
        <button type="button" className="bola-item" onClick={onStats} data-testid="bola-menu-stats">
          <span>Estatísticas</span>
          <kbd className="bola-key">Tab</kbd>
        </button>
        <button type="button" className="bola-item" onClick={onCam} disabled={spectating}>
          <span>Câmera: {spectating || !ballCam ? 'livre' : 'na bola'}</span>
          <kbd className="bola-key">E</kbd>
        </button>
        <h3>{spectating ? 'Você está espectando' : 'Seu time'}</h3>
        <div className="bola-chips" role="radiogroup" aria-label="Time">
          {Array.from({ length: teams }, (_, t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={myTeam === t}
              className={`dsm-chip bola-team-chip${myTeam === t ? ' is-on' : ''}`}
              style={{ ['--tc' as string]: css(BOL_TEAM_COLORS[t] as number) }}
              onClick={() => pick(t)}
              data-testid={`bola-team-${t}`}
            >
              <i aria-hidden="true" />
              {BOL_TEAM_NAMES[t]}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={spectating}
            className={`dsm-chip bola-team-chip${spectating ? ' is-on' : ''}`}
            onClick={() => pick(-1)}
            data-testid="bola-team-spec"
          >
            Espectador
          </button>
        </div>
        {error && (
          <p className="bola-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className={`dsm-btn is-ghost bola-leave${sure ? ' is-sure' : ''}`}
          onClick={() => (sure ? onExit() : setSure(true))}
          onBlur={() => setSure(false)}
          data-testid="bola-menu-exit"
        >
          {sure ? 'Toque de novo para sair' : 'Sair da partida'}
        </button>
      </div>
    </div>
  );
}
