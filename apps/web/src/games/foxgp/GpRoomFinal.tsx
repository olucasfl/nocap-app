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
import { GpFinal, type GpFinalRow } from './GpFinal';
import { hexNum, lapClock } from './format';
import { paintFromRoom } from './garage';
import { PHYSICS_NAME, gpMarkBack } from './gp-best';
import './foxgp.css';

const nameOf = (id: string, username: string) =>
  id.startsWith('guest:') ? username : at(username);

/** O pódio do Fox GP em sala: a ordem final da sala com a votação de revanche. */
export function GpRoomFinal({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useMeId();
  const message = useRoom((s) => s.message);
  const navigate = useNavigate();
  const info = snapshot.foxgp;
  const colorOf = (id: string) => info?.colors[id] ?? '#ff7d26';

  const { rows, fastest } = useMemo(() => {
    const final = [...(snapshot.final ?? [])].sort((a, b) => a.placement - b.placement);
    const names = new Map(final.map((r) => [r.userId, nameOf(r.userId, r.username)]));
    const out: GpFinalRow[] = final.map((r) => ({
      id: r.userId,
      name: nameOf(r.userId, r.username),
      color: info?.colors[r.userId] ?? '#ff7d26',
      fur: hexNum(info?.colors[r.userId]),
      paint: paintFromRoom(info?.paints?.[r.userId]),
      you: r.userId === me,
      ms: info?.finish[r.userId] ?? null,
      best: info?.best[r.userId] ?? null,
      dnf: info?.finish[r.userId] === undefined,
    }));
    const f = info?.fastest;
    return {
      rows: out,
      fastest: f ? `${names.get(f.id) ?? ''} · ${lapClock(f.ms)}` : '—',
    };
  }, [snapshot.final, info, me]);

  const mine = snapshot.members.find((m) => m.id === me);
  const leave = () => {
    gpMarkBack();
    void navigate({ to: '/fox-cap', search: { jogo: 'foxgp' } }).then(() => leaveRoom());
  };
  return (
    <GpFinal
      rows={rows}
      fastest={fastest}
      physics={PHYSICS_NAME[info?.physics ?? 'arcade']}
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
