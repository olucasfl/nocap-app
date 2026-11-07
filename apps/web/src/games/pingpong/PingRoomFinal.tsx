import { useNavigate } from '@tanstack/react-router';
import {
  at,
  closeRoom,
  leaveRoom,
  sendRoom,
  useMeId,
  useRoom,
  type RoomSnapshot,
} from '@/lib/rooms';
import { PingFinal } from './PingFinal';
import { PING_COLORS } from './PingRoomPlay';

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** O fim do Ping Fox! em sala: placar, números da partida e a votação de revanche. */
export function PingRoomFinal({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useMeId() ?? snapshot.me ?? '';
  const message = useRoom((s) => s.message);
  const navigate = useNavigate();
  const info = snapshot.pingpong;
  const players = info?.players ?? null;
  const nameOf = (id: string) =>
    id === 'bot'
      ? (snapshot.pingpong?.lobby?.botName ?? 'Raposa')
      : at(snapshot.members.find((m) => m.id === id)?.username);
  const score = info?.score ?? [0, 0];
  // quem saiu no meio perdeu; senão vence o maior placar
  const forfeitIdx = info?.forfeit && players ? players.indexOf(info.forfeit) : -1;
  const winner = forfeitIdx >= 0 ? 1 - forfeitIdx : score[0] > score[1] ? 0 : 1;
  const stats = info?.stats;
  const mine = snapshot.members.find((m) => m.id === me);
  const colorOf = (id: string) => {
    const i = players ? players.indexOf(id) : -1;
    return i >= 0 ? css(PING_COLORS[i] ?? 0x9a97b5) : '#9a97b5';
  };
  const myIdx = players ? players.indexOf(me) : -1;
  return (
    <PingFinal
      winner={winner}
      score={[score[0] ?? 0, score[1] ?? 0]}
      names={[players ? nameOf(players[0]) : '', players ? nameOf(players[1]) : '']}
      you={myIdx}
      stats={{
        seconds: stats?.seconds ?? 0,
        longest: stats?.longest ?? 0,
        fastest: stats?.fastest ?? 0,
        smashes: stats ? (stats.smashes[myIdx >= 0 ? myIdx : 0] ?? 0) : 0,
        points: [score[0] ?? 0, score[1] ?? 0],
        hits: stats ? [stats.hits[0] ?? 0, stats.hits[1] ?? 0] : [0, 0],
      }}
      mode={{
        kind: 'room',
        room: {
          meId: me,
          voted: !!mine?.rematch,
          isHost: !!mine?.isHost,
          message,
          members: snapshot.members.map((m) => ({
            id: m.id,
            name: nameOf(m.id),
            color: colorOf(m.id),
            connected: m.connected,
            rematch: m.rematch,
            host: m.isHost,
          })),
          onVote: (again) => sendRoom('vote', { again }),
          onLeave: () => {
            void leaveRoom().then(() => navigate({ to: '/fox-cap', search: { jogo: 'pingpong' } }));
          },
          onClose: () => closeRoom(),
        },
      }}
    />
  );
}
