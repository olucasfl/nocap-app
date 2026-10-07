import { useAuth } from '@/lib/auth';
import type { RoomSnapshot } from '@/lib/rooms';
import { HostLobby } from './lobby/HostLobby';
import { MemberLobby } from './lobby/MemberLobby';

/**
 * O lobby tem duas telas: a do líder (edita as regras, expulsa, começa) e a dos demais membros
 * (só leem as regras e marcam "pronto"). Quem manda é `hostId`; se o líder cai e outra pessoa
 * assume, a tela troca sozinha.
 */
export function Lobby({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const leader = snapshot.members.find((m) => m.id === snapshot.hostId);

  if (snapshot.hostId === me) return <HostLobby snapshot={snapshot} me={me} />;
  return <MemberLobby snapshot={snapshot} me={me} leaderName={leader?.username ?? 'líder'} />;
}
