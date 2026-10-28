import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  closeRoom,
  leaveRoom,
  sendRoom,
  useRoom,
  useMeId,
  at,
  type RoomSnapshot,
} from '@/lib/rooms';
import { DesmoronaFinal, type DsmFinalRow } from './DesmoronaFinal';
import './desmorona.css';

const nameOf = (id: string, username: string) =>
  id.startsWith('guest:') ? username : at(username);

/** O fim do Desmorona! em sala: classificação da sala (fase `final`) com a votação de revanche. */
export function DesmoronaRoomFinal({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useMeId();
  const message = useRoom((s) => s.message);
  const navigate = useNavigate();
  const info = snapshot.desmorona;
  const colorOf = (id: string) => info?.colors[id] ?? '#ff7d26';

  const { rows, seconds } = useMemo(() => {
    const final = [...(snapshot.final ?? [])].sort((a, b) => a.placement - b.placement);
    const dead = info?.dead ?? {};
    const out: DsmFinalRow[] = final.map((r) => ({
      id: r.userId,
      name: nameOf(r.userId, r.username),
      color: info?.colors[r.userId] ?? '#ff7d26',
      you: r.userId === me,
      fellAt: dead[r.userId] !== undefined && r.placement > 1 ? dead[r.userId]! / 1000 : null,
    }));
    const last = Math.max(0, ...Object.values(dead));
    return { rows: out, seconds: last / 1000 };
  }, [snapshot.final, info, me]);

  const mine = snapshot.members.find((m) => m.id === me);
  const leave = () => {
    void leaveRoom().then(() => navigate({ to: '/fox-cap' }));
  };
  return (
    <DesmoronaFinal
      rows={rows}
      seconds={seconds}
      mode={{
        kind: 'room',
        room: {
          meId: me ?? '',
          voted: !!mine?.rematch,
          isHost: !!mine?.isHost,
          message,
          members: snapshot.members.map((m) => ({
            id: m.id,
            name: nameOf(m.id, m.username),
            color: colorOf(m.id),
            connected: m.connected,
            rematch: m.rematch,
            host: m.isHost,
          })),
          onVote: (again) => sendRoom('vote', { again }),
          onLeave: leave,
          onClose: () => closeRoom(),
        },
      }}
    />
  );
}
