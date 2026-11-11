import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { GpPlayerInfo } from '@nocap/games';
import { at, leaveRoom, type RoomSnapshot } from '@/lib/rooms';
import { GpPlay, type GpOnline, type GpRoomLive } from './GpPlay';
import { hexNum } from './format';
import { paintFromRoom } from './garage';
import './foxgp.css';

const nameOf = (id: string, username: string | undefined) =>
  id.startsWith('guest:') ? (username ?? '') : at(username);

/** A corrida do Fox GP em sala (specs 078 a 080): a mesma tela do treino; quem simula é o líder, no modo da sala. */
export function GpRoomPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  const info = snapshot.foxgp;
  const navigate = useNavigate();
  const seed = snapshot.round?.seed ?? '';
  const meId = info?.me ?? '';
  const hostId = info?.host ?? snapshot.hostId ?? '';
  const members = snapshot.members;
  const slotKey = info ? JSON.stringify(info.slots) : '';
  const online = useMemo<GpOnline | null>(() => {
    if (!info || !seed || Object.keys(info.slots).length === 0) return null;
    const list: GpPlayerInfo[] = Object.entries(info.slots)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => ({
        id,
        name: nameOf(id, members.find((m) => m.id === id)?.username),
        color: hexNum(info.colors[id]),
        paint: paintFromRoom(info.paints?.[id]) ?? undefined,
      }));
    // quem entrou com a corrida andando não está nas vagas: só assiste
    return {
      seed,
      meId: info.slots[meId] !== undefined ? meId : '',
      hostId,
      infos: list,
      physics: info.physics ?? 'arcade',
    };
    // a lista só muda se mudarem as vagas: nomes novos no meio da partida não recriam a cena
  }, [seed, meId, hostId, slotKey, info?.physics]);
  const live: GpRoomLive | undefined = info
    ? {
        stage: info.stage,
        qualiAt: info.qualiAt,
        raceAt: info.raceAt,
        holdMs: info.holdMs ?? null,
        grid: info.grid,
        quali: info.quali,
        finish: info.finish,
        gone: info.gone,
        firstFinishAt: info.firstFinishAt,
      }
    : undefined;
  if (!online) return null;
  return (
    <div className="gp-screen">
      <GpPlay
        online={online}
        live={live}
        onExit={() => {
          void leaveRoom().then(() => navigate({ to: '/fox-cap', search: { jogo: 'foxgp' } }));
        }}
      />
    </div>
  );
}
