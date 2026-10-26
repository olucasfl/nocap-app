import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { closeRoom, leaveRoom, sendRoom, type RoomSnapshot } from '@/lib/rooms';
import { LobbyShell, startHint } from './LobbyShell';
import { MembersPanel } from './MembersPanel';
import { RulesEditor } from './RulesPanel';
import { MIN_PLAYERS } from './rules';

/**
 * A tela do líder da sala: edita as regras, expulsa e começa a partida. Abre direto nas regras,
 * que é a primeira coisa que o líder precisa acertar.
 */
export function HostLobby({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const [closing, setClosing] = useState(false);
  const others = snapshot.members.filter((m) => m.connected && !m.isHost);
  const connected = snapshot.members.filter((m) => m.connected).length;
  const needed = MIN_PLAYERS[snapshot.game];
  const enough = connected >= needed;
  const allReady = others.every((m) => m.ready);
  const canStart = enough && allReady;
  const rematch = canStart && others.length > 0 && others.every((m) => m.committed);

  return (
    <LobbyShell
      snapshot={snapshot}
      role="leader"
      members={<MembersPanel snapshot={snapshot} me={me} canKick />}
      rules={<RulesEditor snapshot={snapshot} />}
      footer={
        <>
          <button
            type="button"
            className="btn alt"
            data-sfx="start"
            disabled={!canStart}
            onClick={() => sendRoom('start')}
          >
            Começar
          </button>
          {rematch && (
            <p className="mono rm-hint">
              Todo mundo topou jogar de novo. Ajuste as regras, se quiser, e comece.
            </p>
          )}
          {!canStart && <p className="mono rm-hint lb-why">{startHint(snapshot).text}</p>}
          <div className="lb-leave">
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
