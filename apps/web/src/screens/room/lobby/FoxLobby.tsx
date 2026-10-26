import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { closeRoom, leaveRoom, type RoomSnapshot } from '@/lib/rooms';
import { InvitePanel } from './InvitePanel';
import { LobbyShell } from './LobbyShell';
import { MembersPanel } from './MembersPanel';

/** O lobby da sala do Fox Cap! antes de haver jogo (spec 049): reúne a galera e espera o líder escolher o jogo. */
export function FoxLobby({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const [closing, setClosing] = useState(false);
  const leader = snapshot.hostId === me;
  return (
    <LobbyShell
      snapshot={snapshot}
      me={me}
      members={(goInvite) => (
        <MembersPanel snapshot={snapshot} me={me} canKick={leader} onInvite={goInvite} />
      )}
      rules={null}
      invite={<InvitePanel snapshot={snapshot} />}
      footer={
        <>
          <div className="lb3-leave">
            <button type="button" className="lb-textbtn" data-sfx="back" onClick={leaveRoom}>
              Sair
            </button>
            {leader && (
              <button
                type="button"
                className="lb-textbtn danger"
                data-sfx="remove"
                onClick={() => setClosing(true)}
              >
                Encerrar
              </button>
            )}
          </div>
          <button type="button" className="btn alt lb3-main" disabled>
            Começar
          </button>
          <p className="mono lb3-why">
            {leader ? 'Escolha o jogo na aba Regras' : 'Aguardando o líder escolher o jogo'}
          </p>
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
