import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAuth } from '@/lib/auth';
import { useLeaveRoom, useMyRoom, type RoomPresence } from '@/lib/my-room';
import { useRoom, type Phase, type RoomGame } from '@/lib/rooms';
import './room-banner.css';

const GAME_NAME: Record<RoomGame, string> = {
  color: 'Mesmíssima',
  time: 'Já Deu?',
  impostor: 'Intruso',
  eco: 'Ecooo',
  party: 'NoCap!',
};

const phaseText = (phase: Phase) =>
  phase === 'lobby' ? 'No lobby' : phase === 'final' ? 'Pódio' : 'Partida em andamento';

/** Linha de resumo: jogo, momento da sala e quantas pessoas. */
export function roomSummary(room: RoomPresence): string {
  const people =
    room.members !== null && room.maxPlayers !== null
      ? ` · ${room.members}/${room.maxPlayers} pessoas`
      : '';
  return `${GAME_NAME[room.game]} · ${phaseText(room.phase)}${people}`;
}

/**
 * "Você está na sala ABCD": aparece em cima do início sempre que a conta está numa sala, mesmo
 * que a pessoa tenha saído da tela dela. Dá o caminho de volta e o de sair de vez.
 */
export function RoomBanner() {
  const room = useMyRoom();
  const unread = useRoom((s) => s.unread);
  const navigate = useNavigate();
  const leave = useLeaveRoom();
  const user = useAuth((s) => s.user);
  const [asking, setAsking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  if (!user || !room) return null;

  const back = () =>
    void navigate(room.live ? { to: '/sala' } : { to: '/sala/$code', params: { code: room.code } });
  const exit = async () => {
    setAsking(false);
    setLeaving(true);
    try {
      await leave();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <section className="rb" aria-label="Sua sala atual">
      <div className="rb-head">
        <span className="mono rb-tag">
          {room.reconnecting
            ? 'RECONECTANDO À SUA SALA...'
            : room.live
              ? 'VOCÊ ESTÁ EM UMA SALA'
              : 'SUA SALA CONTINUA ABERTA'}
        </span>
        {unread > 0 && <span className="mono rb-badge">{unread} NO CHAT</span>}
      </div>
      <div className="rb-main">
        <b className="rb-code">{room.code}</b>
        <span className="mono rb-info">{roomSummary(room)}</span>
      </div>
      <div className="rb-actions">
        <button type="button" className="rb-btn" data-sfx="roomJoin" onClick={back}>
          Voltar para a sala
        </button>
        <button
          type="button"
          className="rb-btn ghost"
          data-sfx="back"
          disabled={leaving}
          onClick={() => setAsking(true)}
        >
          {leaving ? 'Saindo...' : 'Sair'}
        </button>
      </div>
      <ConfirmDialog
        open={asking}
        title="Sair da sala?"
        text={
          room.phase === 'lobby' || room.phase === 'final'
            ? `Você deixa a sala ${room.code}. Para voltar, vai precisar do código.`
            : `Você deixa a partida em andamento na sala ${room.code}. Não dá para voltar a ela.`
        }
        confirmLabel="Sair da sala"
        confirmSfx="remove"
        onConfirm={() => void exit()}
        onCancel={() => setAsking(false)}
      />
    </section>
  );
}
