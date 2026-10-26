import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { leaveRoom, sendRoom, type RoomSnapshot } from '@/lib/rooms';
import { BolaPlay, type BolaSetup } from './BolaPlay';
import '../desmorona/desmorona.css';
import './bola.css';

/** A partida do Bola Maluca! em sala (spec 046): o servidor simula; esta tela desenha, manda a entrada e mostra o HUD. */
export function BolaRoomPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  const b = snapshot.bola;
  const navigate = useNavigate();
  const teams = b?.format.teams ?? 2;
  const perTeam = b?.format.perTeam ?? 1;
  const minutes = b?.format.minutes ?? 30;
  const setup = useMemo<BolaSetup>(() => ({ teams, perTeam, minutes }), [teams, perTeam, minutes]);
  if (!b) return null;
  const isHost = snapshot.hostId === b.me;
  return (
    <div className="dsm-screen bola-screen">
      <BolaPlay
        setup={setup}
        online={{ meId: b.me ?? '', roster: b.roster }}
        onEnd={isHost ? () => sendRoom('bend') : undefined}
        onExit={() => {
          void leaveRoom().then(() => navigate({ to: '/fox-cap/bola' }));
        }}
      />
    </div>
  );
}
