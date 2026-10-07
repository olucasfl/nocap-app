import { leaveRoom, sendRoom, type RoomSnapshot } from '@/lib/rooms';
import { InvitePanel } from './InvitePanel';
import { LobbyShell } from './LobbyShell';
import { MembersPanel } from './MembersPanel';
import { RulesReadOnly } from './RulesPanel';

/**
 * A tela de quem não é o líder: vê quem está na sala e as regras (só para ler) e marca quando
 * estiver pronto. Não há nada aqui que mude a sala; o líder decide.
 */
export function MemberLobby({
  snapshot,
  me,
  leaderName,
}: {
  snapshot: RoomSnapshot;
  me: string | undefined;
  leaderName: string;
}) {
  const mine = snapshot.members.find((m) => m.id === me);

  return (
    <LobbyShell
      snapshot={snapshot}
      role="member"
      leaderName={leaderName}
      initialTab="members"
      panels={{
        members: <MembersPanel snapshot={snapshot} me={me} canKick={false} />,
        rules: <RulesReadOnly snapshot={snapshot} leaderName={leaderName} />,
        invite: <InvitePanel snapshot={snapshot} />,
      }}
      footer={
        <>
          {mine?.committed ? (
            <p className="mono rm-hint">Você topou jogar de novo. Aguardando o líder iniciar...</p>
          ) : (
            <>
              <button
                type="button"
                className={mine?.ready ? 'btn ghost' : 'btn alt'}
                data-sfx="toggle"
                aria-pressed={!!mine?.ready}
                onClick={() => sendRoom('ready', { ready: !mine?.ready })}
              >
                {mine?.ready ? 'Não estou pronto' : 'Estou pronto'}
              </button>
              <p className="mono rm-hint">
                {mine?.ready
                  ? `Você está pronto. Aguardando @${leaderName} começar.`
                  : 'Marque "pronto" quando quiser jogar. O líder começa a partida.'}
              </p>
            </>
          )}
          <button type="button" className="btn ghost" data-sfx="back" onClick={leaveRoom}>
            Sair da sala
          </button>
        </>
      }
    />
  );
}
