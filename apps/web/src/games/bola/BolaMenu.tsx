import { BOL_TEAM_NAMES } from '@nocap/games';
import { GameMenu, Keycap } from '@/components/GameMenu';
import { bolaTipRows, BOLA_TIPS_KEY } from './BolaTips';
import { IcCamera, IcEye, IcFlag, IcTable, IcTeams } from './BolaIcons';

/** Menu da partida (Esc): o comum dos jogos mais o que é do Fut Fox: tabela, câmera, time ou espectar e encerrar. */
export function BolaMenu({
  myTeam,
  ballCam,
  online,
  touch,
  onClose,
  onStats,
  onCam,
  netPanel,
  onTeams,
  onEnd,
  onExit,
  onOfflineInvite,
}: {
  /** Time de quem joga; -1 = espectador. */
  myTeam: number;
  ballCam: boolean;
  /** Partida em sala (convidar mostra o código e os amigos). */
  online: boolean;
  touch: boolean;
  onClose: () => void;
  onStats: () => void;
  onCam: () => void;
  /** Só online: liga e desliga o painel de rede (ping e estados por segundo). */
  netPanel?: { on: boolean; toggle: () => void };
  onTeams: () => void;
  /** Só o líder da sala: encerra a partida com o placar de agora. */
  onEnd?: () => void;
  onExit: () => void;
  onOfflineInvite?: () => void;
}) {
  const spectating = myTeam < 0;
  return (
    <GameMenu
      title="Menu"
      testPrefix="bola-menu"
      tipsKey={BOLA_TIPS_KEY}
      tips={bolaTipRows(touch)}
      net={netPanel}
      online={online}
      onClose={onClose}
      onExit={onExit}
      onOfflineInvite={onOfflineInvite}
      actions={[
        {
          id: 'stats',
          icon: <IcTable size={20} />,
          label: 'Tabela de estatísticas',
          hint: <Keycap k="Tab" />,
          onClick: onStats,
          testId: 'bola-menu-stats',
        },
        {
          id: 'cam',
          icon: <IcCamera size={20} />,
          label: ballCam && !spectating ? 'Soltar a câmera' : 'Prender a câmera na bola',
          hint: <Keycap k="F" />,
          onClick: onCam,
          disabled: spectating,
          testId: 'bola-menu-cam',
        },
        {
          id: 'teams',
          icon: spectating ? <IcEye size={20} /> : <IcTeams size={20} />,
          label: spectating ? 'Entrar em um time' : 'Time ou espectar',
          hint: (
            <span className="gm-cur">
              {spectating ? 'Espectando' : `Time ${BOL_TEAM_NAMES[myTeam] ?? ''}`}
            </span>
          ),
          onClick: onTeams,
          testId: 'bola-menu-teams',
        },
        ...(onEnd
          ? [
              {
                id: 'end',
                icon: <IcFlag size={20} />,
                label: 'Encerrar a partida',
                armed: 'Toque de novo para encerrar',
                onClick: onEnd,
                testId: 'bola-menu-end',
              },
            ]
          : []),
      ]}
    />
  );
}
