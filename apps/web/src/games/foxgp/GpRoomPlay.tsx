import { gpMarkBack } from './gp-best';
import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { GpPlayerInfo } from '@nocap/games';
import { at, leaveRoom, type RoomSnapshot } from '@/lib/rooms';
import { GpPlay, type GpOnline, type GpRoomLive } from './GpPlay';
import { hexNum } from './format';
import { carFromRoom } from './garage';
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
        // bots da sala (12.4): o nome vem da sala; quem simula é o líder
        bot: id.startsWith('bot:'),
        name: id.startsWith('bot:')
          ? (info.bots?.find((b) => b.id === id)?.name ?? 'Bot')
          : nameOf(id, members.find((m) => m.id === id)?.username),
        color: carFromRoom(info.paints?.[id])?.fur ?? hexNum(info.colors[id]),
        paint: carFromRoom(info.paints?.[id])?.f1,
        kart: carFromRoom(info.paints?.[id])?.kart,
      }));
    // quem entrou com a corrida andando não está nas vagas: só assiste
    return {
      seed,
      meId: info.slots[meId] !== undefined ? meId : '',
      hostId,
      infos: list,
      physics: info.physics ?? 'arcade',
      botLevel: info.botLevel ?? 'medio',
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
          // a tela do Fox GP primeiro, a saída da sala depois: sair antes fecha a sala na hora e a tela da sala aparece no
          // meio (spec 081, Fase 1.5)
          gpMarkBack();
          void navigate({ to: '/fox-cap', search: { jogo: 'foxgp' } }).then(() => leaveRoom());
        }}
      />
    </div>
  );
}
