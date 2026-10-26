import { BOL_TEAM_NAMES } from '@nocap/games';
import type { RoomSnapshot } from '@/lib/rooms';

/** O que falta para o Bola Maluca! começar (o mesmo cálculo da sala: time vazio, gente sem marcar pronto). */
export function bolaHint(snapshot: RoomSnapshot): { text: string; ok: boolean } {
  const b = snapshot.bola;
  if (!b) return { text: '', ok: false };
  const connected = new Set(snapshot.members.filter((m) => m.connected).map((m) => m.id));
  for (let t = 0; t < b.format.teams; t++) {
    const humans = Object.entries(b.teamOf).filter(
      ([id, team]) => team === t && connected.has(id),
    ).length;
    if (humans + (b.bots[t] ?? 0) === 0)
      return { text: `Falta jogador no time ${BOL_TEAM_NAMES[t]}`, ok: false };
  }
  const waiting = snapshot.members.filter(
    (m) => m.connected && !m.isHost && b.teamOf[m.id] !== undefined && !m.ready && !m.committed,
  ).length;
  if (waiting > 0)
    return { text: `Falta${waiting > 1 ? 'm' : ''} ${waiting} marcar "pronto"`, ok: false };
  return { text: 'Tudo pronto', ok: true };
}
