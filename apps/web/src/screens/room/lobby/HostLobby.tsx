import { Check } from '@/components/icons';
import { leaveRoom, sendRoom, type RoomSnapshot } from '@/lib/rooms';
import { InvitePanel } from './InvitePanel';
import { LobbyShell } from './LobbyShell';
import { MembersPanel } from './MembersPanel';
import { RulesEditor } from './RulesPanel';
import { MIN_PLAYERS } from './rules';

/**
 * A tela do líder da sala: edita as regras, expulsa e começa a partida. Abre direto nas regras,
 * que é a primeira coisa que o líder precisa acertar.
 */
export function HostLobby({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const others = snapshot.members.filter((m) => m.connected && !m.isHost);
  const connected = snapshot.members.filter((m) => m.connected).length;
  const needed = MIN_PLAYERS[snapshot.game];
  const readyCount = others.filter((m) => m.ready).length;
  const enough = connected >= needed;
  const allReady = others.every((m) => m.ready);
  const canStart = enough && allReady;
  const rematch = canStart && others.length > 0 && others.every((m) => m.committed);

  return (
    <LobbyShell
      snapshot={snapshot}
      role="leader"
      initialTab="rules"
      panels={{
        members: <MembersPanel snapshot={snapshot} me={me} canKick />,
        rules: <RulesEditor snapshot={snapshot} />,
        invite: <InvitePanel snapshot={snapshot} />,
      }}
      footer={
        <>
          <ul className="lb-check" aria-label="Para começar">
            <li className={enough ? 'ok' : ''}>
              <Check size={16} />
              <span>
                Pelo menos {needed} pessoas{' '}
                <b className="mono">
                  {Math.min(connected, needed)}/{needed}
                </b>
              </span>
            </li>
            <li className={allReady && others.length > 0 ? 'ok' : ''}>
              <Check size={16} />
              <span>
                Todo mundo pronto{' '}
                <b className="mono">
                  {readyCount}/{others.length}
                </b>
              </span>
            </li>
          </ul>
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
          <button type="button" className="btn ghost" data-sfx="back" onClick={leaveRoom}>
            Sair da sala
          </button>
        </>
      }
    />
  );
}
