import { useState } from 'react';
import { BOL_TEAM_NAMES } from '@nocap/games';
import { IcCamera, IcEye, IcFlag, IcExit, IcNet, IcPlay, IcTable, IcTeams, Key } from './BolaIcons';

/** Configurações da partida: continuar, estatísticas, câmera, trocar de time ou espectar e sair. */
export function BolaMenu({
  myTeam,
  ballCam,
  onClose,
  onStats,
  onCam,
  netPanel,
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
  /** Só online: liga e desliga o painel de rede (ping e estados por segundo). */
  netPanel?: { on: boolean; toggle: () => void };
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
          <IcPlay size={18} />
          Continuar jogando
        </button>
        <button type="button" className="bola-item" onClick={onStats} data-testid="bola-menu-stats">
          <span className="bola-item-main">
            <IcTable size={20} />
            Tabela de estatísticas
          </span>
          <Key k="Tab" className="bola-hide-touch" />
        </button>
        <button type="button" className="bola-item" onClick={onCam} disabled={spectating}>
          <span className="bola-item-main">
            <IcCamera size={20} />
            Câmera: {spectating || !ballCam ? 'livre' : 'na bola'}
          </span>
          <Key k="F" className="bola-hide-touch" />
        </button>
        {netPanel && (
          <button
            type="button"
            className="bola-item"
            onClick={netPanel.toggle}
            aria-pressed={netPanel.on}
            data-testid="bola-menu-net"
          >
            <span className="bola-item-main">
              <IcNet size={20} />
              Painel de rede
            </span>
            <span className="bola-cur">{netPanel.on ? 'Ligado' : 'Desligado'}</span>
          </button>
        )}
        <button type="button" className="bola-item" onClick={onTeams} data-testid="bola-menu-teams">
          <span className="bola-item-main">
            {spectating ? <IcEye size={20} /> : <IcTeams size={20} />}
            {spectating ? 'Entrar em um time' : 'Time ou espectar'}
          </span>
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
            <span className="bola-item-main">
              <IcFlag size={20} />
              {confirmEnd ? 'Toque de novo para encerrar' : 'Encerrar a partida'}
            </span>
          </button>
        )}
        <button
          type="button"
          className={`dsm-btn is-ghost bola-leave${sure ? ' is-sure' : ''}`}
          onClick={() => (sure ? onExit() : setSure(true))}
          onBlur={() => setSure(false)}
          data-testid="bola-menu-exit"
        >
          <IcExit size={18} />
          {sure ? 'Toque de novo para sair' : 'Sair da partida'}
        </button>
      </div>
    </div>
  );
}
