import { useEffect } from 'react';
import { sendRoom, useMeId, type RoomSnapshot } from '@/lib/rooms';
import { HostLobby } from './lobby/HostLobby';
import { BolaLobby } from './lobby/BolaLobby';
import { PingLobby } from './lobby/PingLobby';
import { FoxLobby } from './lobby/FoxLobby';
import { MemberLobby } from './lobby/MemberLobby';

/**
 * O lobby tem duas telas: a do líder (edita as regras, expulsa, começa) e a dos demais membros
 * (só leem as regras e marcam "pronto"). Quem manda é `hostId`; se o líder cai e outra pessoa
 * assume, a tela troca sozinha.
 */
export function Lobby({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useMeId();
  const leader = snapshot.members.find((m) => m.id === snapshot.hostId);

  // sala criada pelo menu do Counter Fox: já nasce com o jogo dele escolhido
  useEffect(() => {
    if (snapshot.game !== 'foxcap' || snapshot.hostId !== me) return;
    try {
      const want = sessionStorage.getItem('cfx-new-room');
      if (!want) return;
      sessionStorage.removeItem('cfx-new-room');
      // '1' vem do Counter Fox; os outros jogos guardam o próprio id
      const game = want === '1' ? 'foxshot' : want;
      if (!['foxshot', 'bola', 'pingpong', 'atravessa', 'desmorona'].includes(game)) return;
      sendRoom('pickgame', { game });
    } catch {
      /* sem armazenamento: o líder escolhe o jogo na sala */
    }
  }, [snapshot.game, snapshot.hostId, me]);

  if (snapshot.game === 'foxcap') return <FoxLobby snapshot={snapshot} me={me} />;
  if (snapshot.game === 'bola') return <BolaLobby snapshot={snapshot} me={me} />;
  if (snapshot.game === 'pingpong') return <PingLobby snapshot={snapshot} me={me} />;
  if (snapshot.hostId === me) return <HostLobby snapshot={snapshot} me={me} />;
  return <MemberLobby snapshot={snapshot} me={me} leaderName={leader?.username ?? 'líder'} />;
}
