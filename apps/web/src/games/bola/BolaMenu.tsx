import { useState } from 'react';
import { BOL_TEAM_NAMES } from '@nocap/games';

/** Configurações da partida: continuar, estatísticas, câmera, trocar de time ou espectar e sair. */
export function BolaMenu({
  myTeam,
  ballCam,
  onClose,
  onStats,
  onCam,
  onTeams,
  onEnd,
  onExit,
}: {
  /** Time de quem joga; -1 = espectador. */
  myTeam: number;
  ballCam: boolean;
  onClose: () => void;
  onStats: () => void;
  onCam: () => void;
  onTeams: () => void;
  /** Só o líder da sala: encerra a partida com o placar de agora. */
  onEnd?: () => void;
  onExit: () => void;
}) {
  const [sure, setSure] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
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
          <kbd className="bola-key">F</kbd>
        </button>
        <button type="button" className="bola-item" onClick={onTeams} data-testid="bola-menu-teams">
          <span>Trocar de time</span>
          <span className="bola-cur">
            {spectating ? 'Espectando' : `Time ${BOL_TEAM_NAMES[myTeam] ?? ''}`}
          </span>
        </button>
        {onEnd && (
          <button
            type="button"
            className="bola-item"
            onClick={() => (confirmEnd ? onEnd() : setConfirmEnd(true))}
            onBlur={() => setConfirmEnd(false)}
            data-testid="bola-menu-end"
          >
            <span>{confirmEnd ? 'Toque de novo para encerrar' : 'Encerrar a partida'}</span>
          </button>
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
