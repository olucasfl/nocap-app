import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { at, leaveRoom, useMeId, type RoomSnapshot } from '@/lib/rooms';
import { PingPlay, type PingOnline } from './PingPlay';
import './ping.css';

/** A cor de cada vaga (a vaga 0 é laranja como a raposa de quem joga; a 1, roxa). */
export const PING_COLORS: [number, number] = [0xff7d26, 0x9a6bff];

/** A partida do Ping Fox! em sala: a mesma cena do treino, com as batidas vindo da sala (spec 055, fase 3). */
export function PingRoomPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  const info = snapshot.pingpong;
  const me = useMeId() ?? snapshot.me ?? '';
  const navigate = useNavigate();
  const players = info?.players ?? null;
  const startAt = info?.startAt ?? null;
  const firstServer = info?.firstServer ?? 0;
  const key = players ? players.join('|') : '';
  const online = useMemo<PingOnline | null>(() => {
    if (!players || startAt === null) return null;
    const nameOf = (id: string) =>
      id === 'bot'
        ? (snapshot.pingpong?.lobby?.botName ?? 'Raposa')
        : at(snapshot.members.find((m) => m.id === id)?.username);
    return {
      me: players.indexOf(me),
      firstServer,
      startAt,
      names: [nameOf(players[0]), nameOf(players[1])],
      colors: PING_COLORS,
      ids: [players[0], players[1]],
    };
    // os nomes só mudam se mudarem as pessoas: o placar do snapshot não recria a cena
  }, [key, startAt, firstServer, me]);
  if (!online) return null;
  return (
    <div className="png-screen">
      <PingPlay
        online={online}
        onExit={() => {
          void leaveRoom().then(() => navigate({ to: '/fox-cap' }));
        }}
      />
    </div>
  );
}
