import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { closeRoom, leaveRoom, sendRoom, type RoomSnapshot } from '@/lib/rooms';
import { InvitePanel } from './InvitePanel';
import { LobbyShell, startHint } from './LobbyShell';
import { MembersPanel } from './MembersPanel';
import { RulesEditor } from './RulesPanel';
import { MIN_PLAYERS } from './rules';

/** A tela do líder: edita as regras, convida, expulsa e começa a partida. */
export function HostLobby({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const [closing, setClosing] = useState(false);
  const others = snapshot.members.filter((m) => m.connected && !m.isHost);
  const connected = snapshot.members.filter((m) => m.connected).length;
  const needed = MIN_PLAYERS[snapshot.game];
  const canStart = connected >= needed && others.every((m) => m.ready);
  const rematch = canStart && others.length > 0 && others.every((m) => m.committed);
  const hint = startHint(snapshot);

  return (
    <LobbyShell
      snapshot={snapshot}
      me={me}
      members={(goInvite) => (
        <MembersPanel snapshot={snapshot} me={me} canKick onInvite={goInvite} />
      )}
      rules={<RulesEditor snapshot={snapshot} />}
      invite={<InvitePanel snapshot={snapshot} />}
      footer={
        <>
          <button
            type="button"
            className="btn alt lb3-main"
            data-sfx="start"
            disabled={!canStart}
            onClick={() => sendRoom('start')}
          >
            Começar partida
          </button>
          <p className={`mono lb3-why${canStart ? ' ok' : ''}`}>
            {rematch ? 'Todo mundo topou jogar de novo. Ajuste as regras, se quiser.' : hint.text}
          </p>
          <div className="lb3-leave">
            <button type="button" className="lb-textbtn" data-sfx="back" onClick={leaveRoom}>
              Sair da sala
            </button>
            <button
              type="button"
              className="lb-textbtn danger"
              data-sfx="remove"
              onClick={() => setClosing(true)}
            >
              Encerrar sala
            </button>
          </div>
          <ConfirmDialog
            open={closing}
            title="Encerrar a sala?"
            text="Todo mundo que está na sala será removido e a sala deixa de existir. Para jogar de novo, é preciso criar outra."
            confirmLabel="Encerrar"
            confirmSfx="remove"
            onConfirm={() => {
              setClosing(false);
              closeRoom();
            }}
            onCancel={() => setClosing(false)}
          />
        </>
      }
    />
  );
}
