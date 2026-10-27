import { useRoom } from '@/lib/rooms';
import { InvitePanel } from '@/screens/room/lobby/InvitePanel';
import '@/screens/room/lobby/lobby.css';
import '@/components/chat.css';
import '@/components/friends-panel.css';
import './game-menu.css';

/**
 * Convidar no meio da partida: o código da sala, enviar ou copiar o link e chamar amigos (ou procurar por @usuário).
 * Em partida offline não há sala: explica e leva para "Com amigos", onde se cria uma.
 */
export function InviteDialog({
  onClose,
  onOffline,
}: {
  onClose: () => void;
  /** Partida offline: abre a criação de sala (quem chama decide para onde ir). */
  onOffline?: () => void;
}) {
  const snapshot = useRoom((s) => s.snapshot);
  return (
    <div
      className="gm-wrap is-top"
      role="dialog"
      aria-modal="true"
      aria-label="Convidar"
      data-testid="invite-dialog"
    >
      <div className="gm-card is-wide">
        <h2>Convidar</h2>
        {snapshot ? (
          <InvitePanel snapshot={snapshot} />
        ) : (
          <>
            <p className="gm-note">
              Esta partida é offline, então ainda não tem sala. Crie uma sala em “Com amigos” e
              chame quem quiser pelo link, pelo código ou pelo @usuário.
            </p>
            {onOffline && (
              <button
                type="button"
                className="gm-main"
                onClick={onOffline}
                data-testid="invite-offline-go"
              >
                Ir para Com amigos
              </button>
            )}
          </>
        )}
        <button type="button" className="gm-item" onClick={onClose} data-testid="invite-close">
          <span className="gm-item-main">Fechar</span>
        </button>
      </div>
    </div>
  );
}
