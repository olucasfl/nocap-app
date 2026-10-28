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
import { AtravessaRoomFinal, type AtrFinalRow, type AtrFinalStat } from './AtravessaFinal';
import { meters, raceTime } from './AtravessaReveal';

const nameOf = (id: string, username: string) =>
  id.startsWith('guest:') ? username : at(username);

/** O fim do Atravessa! em sala: classificação (metros ou tempos), destaques e votação de revanche. */
export function AtravessaRoomFinalPage({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useMeId();
  const message = useRoom((s) => s.message);
  const navigate = useNavigate();
  const info = snapshot.atravessa;
  const mode = info?.mode === 'checkpoint' ? 'checkpoint' : 'infinito';
  const colorOf = (id: string) => info?.colors[id] ?? '#ff6a2b';

  const { rows, stats } = useMemo(() => {
    const final = [...(snapshot.final ?? [])].sort((a, b) => a.placement - b.placement);
    const res = info?.results ?? {};
    const length = info?.length ?? 0;
    const top = Math.max(1, ...final.map((r) => res[r.userId]?.meters ?? 0));
    const out: AtrFinalRow[] = final.map((r) => {
      const x = res[r.userId];
      const base = {
        id: r.userId,
        name: nameOf(r.userId, r.username),
        color: info?.colors[r.userId] ?? '#ff6a2b',
        you: r.userId === me,
        place: r.placement,
      };
      if (!x) return { ...base, value: '—', fraction: 0 };
      if (mode === 'infinito')
        return { ...base, value: meters(x.meters), fraction: x.meters / top };
      const deaths = x.deaths > 0 ? `${x.deaths} ${x.deaths === 1 ? 'morte' : 'mortes'}` : '';
      return {
        ...base,
        value: x.finished && x.ms !== null ? raceTime(x.ms) : meters(x.meters),
        note: [x.finished ? '' : 'não chegou', deaths].filter(Boolean).join(' · ') || undefined,
        fraction: x.finished ? 1 : length > 0 ? x.meters / length : 0,
      };
    });

    const list: AtrFinalStat[] = [];
    const vals = final.map((r) => res[r.userId]).filter((x): x is NonNullable<typeof x> => !!x);
    if (mode === 'infinito') {
      list.push({
        label: 'Distância do líder',
        value: meters(Math.max(0, ...vals.map((v) => v.meters))),
        detail: 'na rodada mais longa',
      });
      list.push({
        label: 'Soma da sala',
        value: meters(vals.reduce((a, v) => a + v.meters, 0)),
        detail: `${vals.length} ${vals.length === 1 ? 'pessoa' : 'pessoas'}`,
      });
      const deaths = vals.reduce((a, v) => a + v.deaths, 0);
      if (deaths > 0) list.push({ label: 'Quedas', value: String(deaths), detail: 'no total' });
    } else {
      const done = vals.filter((v) => v.finished && v.ms !== null).sort((a, b) => a.ms! - b.ms!);
      list.push({
        label: 'Chegaram',
        value: `${done.length} de ${vals.length}`,
        detail: 'cruzaram a linha',
      });
      if (done.length > 1) {
        list.push({
          label: 'Diferença',
          value: `+${raceTime(done[1]!.ms! - done[0]!.ms!)}`,
          detail: 'do 1º para o 2º',
        });
      }
      const deaths = vals.reduce((a, v) => a + v.deaths, 0);
      list.push({ label: 'Mortes', value: String(deaths), detail: 'somando todos' });
    }
    return { rows: out, stats: list };
  }, [snapshot.final, info, me, mode]);

  const mine = snapshot.members.find((m) => m.id === me);
  return (
    <AtravessaRoomFinal
      mode={mode}
      rows={rows}
      stats={stats}
      room={{
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
        onLeave: () => {
          void leaveRoom().then(() => navigate({ to: '/fox-cap' }));
        },
        onClose: () => closeRoom(),
      }}
    />
  );
}
