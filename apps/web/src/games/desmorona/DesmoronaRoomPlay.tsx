import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { DsmPlayerInfo } from '@nocap/games';
import { at, leaveRoom, type RoomSnapshot } from '@/lib/rooms';
import { DesmoronaPlay, type DsmOnline } from './DesmoronaPlay';
import './desmorona.css';

/** A partida do Desmorona! em sala (spec 044): a mesma cena do treino, com o relógio e os outros vindos da sala. */
export function DesmoronaRoomPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  const info = snapshot.desmorona;
  const navigate = useNavigate();
  const seed = snapshot.round?.seed ?? '';
  const startAt = info?.startAt ?? null;
  const meId = info?.me ?? '';
  const members = snapshot.members;
  const slotKey = info ? JSON.stringify(info.slots) : '';
  const online = useMemo<DsmOnline | null>(() => {
    if (!info || startAt === null || !seed) return null;
    const list: DsmPlayerInfo[] = Object.entries(info.slots)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => ({ id, name: at(members.find((m) => m.id === id)?.username), color: info.colors[id] ?? 0xff7d26 }));
    return { seed, startAt, meId, infos: list };
    // a lista só muda se mudarem as vagas: nomes novos no meio da partida não recriam a cena
  }, [seed, startAt, meId, slotKey]);
  if (!online) return null;
  return (
    <div className="dsm-screen">
      <DesmoronaPlay
        online={online}
        dead={Object.keys(info?.dead ?? {})}
        onExit={() => {
          void leaveRoom().then(() => navigate({ to: '/fox-cap/desmorona' }));
        }}
      />
    </div>
  );
}
