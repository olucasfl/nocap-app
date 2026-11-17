import { useMemo } from 'react';
import type { MesaState, RoomSnapshot } from '@/lib/rooms';
import { AVATARS } from '../impostor/assets';

export type Snap = RoomSnapshot & { mesa?: MesaState };

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
};

/** Personagem e cor de cada pessoa da sala: estáveis (pela conta), sem repetir enquanto a mesa couber nos 44. */
export function useLooks(snap: Snap) {
  return useMemo(() => {
    const used = new Set<number>();
    const av = new Map<string, string>();
    for (const m of [...snap.members].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      let k = hash(m.id) % AVATARS.length;
      while (used.has(k)) k = (k + 1) % AVATARS.length;
      used.add(k);
      av.set(m.id, AVATARS[k]!);
    }
    const color = new Map(snap.members.map((m, i) => [m.id, i]));
    return (id: string) => ({ avatar: av.get(id) ?? AVATARS[0]!, color: color.get(id) ?? 0 });
  }, [snap.members]);
}

export const nameOf = (snap: Snap, id: string) => snap.members.find((m) => m.id === id)?.username ?? 'Jogador';

