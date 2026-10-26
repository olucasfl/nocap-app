import { leaveRoom, sendRoom, type RoomSnapshot, at } from '@/lib/rooms';
import { InvitePanel } from './InvitePanel';
import { LobbyShell } from './LobbyShell';
import { MembersPanel } from './MembersPanel';
import { RulesReadOnly } from './RulesPanel';

/** A tela de quem não é o líder: vê quem está na sala e as regras (só para ler) e marca quando estiver pronto. */
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
      me={me}
      members={(goInvite) => (
        <MembersPanel snapshot={snapshot} me={me} canKick={false} onInvite={goInvite} />
      )}
      rules={<RulesReadOnly snapshot={snapshot} leaderName={leaderName} />}
      invite={<InvitePanel snapshot={snapshot} />}
      footer={
        <>
          <div className="lb3-leave">
            <button type="button" className="lb-textbtn" data-sfx="back" onClick={leaveRoom}>
              Sair
            </button>
          </div>
          {mine?.committed ? (
            <p className="mono lb3-why ok lb3-committed">
              Você topou jogar de novo. Aguardando o líder...
            </p>
          ) : (
            <>
              <button
                type="button"
                className={`btn lb3-main ${mine?.ready ? 'ghost' : 'alt'}`}
                data-sfx="toggle"
                aria-pressed={!!mine?.ready}
                onClick={() => sendRoom('ready', { ready: !mine?.ready })}
              >
                {mine?.ready ? 'Cancelar' : 'Estou pronto'}
              </button>
              <p className={`mono lb3-why${mine?.ready ? ' ok' : ''}`}>
                {mine?.ready
                  ? `Aguardando ${at(leaderName)} começar`
                  : 'Marque quando quiser jogar'}
              </p>
            </>
          )}
        </>
      }
    />
  );
}
