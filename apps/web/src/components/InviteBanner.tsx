import { useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { useAuth } from '@/lib/auth';
import { sfx } from '@/lib/sfx';
import {
  INVITES_POLL_MS,
  declineInvite,
  fetchInvites,
  inviteIsDead,
  inviteQueue,
  inviteText,
  pickCurrent,
} from '@/lib/invites';
import { useMyRoom, useRoomEntry } from '@/lib/my-room';
import './invite-banner.css';

/**
 * Aviso de convite para sala, em qualquer tela (menos dentro da própria sala). Mostra um por vez:
 * quando a pessoa aceita ou recusa, entra o próximo da fila, com o som de novo. Quem já está em
 * outra sala pode aceitar também: o app pergunta se quer sair da atual. O app consulta o servidor
 * a cada poucos segundos (não há push ainda).
 */
export function InviteBanner() {
  const user = useAuth((s) => s.user);
  const onRoomPage = useRouterState({ select: (s) => s.location.pathname.startsWith('/sala') });
  const mine = useMyRoom();
  const queryClient = useQueryClient();
  const entry = useRoomEntry();
  // "Recusar" e "Entrar" somem só neste aparelho; o convite continua até a sala fechar.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [shownId, setShownId] = useState<string | null>(null);

  const invites = useQuery({
    queryKey: ['invites'],
    queryFn: fetchInvites,
    enabled: !!user && !onRoomPage,
    refetchInterval: INVITES_POLL_MS,
    // Aba em segundo plano também recebe (o navegador só espaça os intervalos).
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const decline = useMutation({
    mutationFn: (id: string) => declineInvite(id),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['invites'] }),
  });

  // O convite para a sala em que a pessoa já está não faz sentido.
  const queue = inviteQueue(invites.data ?? [], dismissed).filter((i) => i.code !== mine?.code);
  const current = user && !onRoomPage ? pickCurrent(queue, shownId) : null;
  const currentId = current?.id ?? null;

  useEffect(() => {
    setShownId(currentId);
    if (currentId) sfx.notify();
  }, [currentId]);

  const conflict = (
    <RoomConflictDialog
      open={!!entry.conflict}
      code={entry.conflict?.code ?? null}
      onBack={entry.backToCurrent}
      onLeave={() => void entry.leaveAndContinue()}
      onCancel={entry.dismissConflict}
    />
  );
  if (!current) return conflict;

  const waiting = queue.length - 1;
  const gone = (id: string) => setDismissed((d) => new Set(d).add(id));

  const accept = async () => {
    // Se não entrar, o convite fica (com o motivo escrito nele) para tentar de novo.
    if (await entry.join(current.code)) gone(current.id);
  };
  const refuse = () => {
    gone(current.id);
    entry.clearError();
    decline.mutate(current.id);
  };

  // Sala que fechou, lotou ou começou: não tem como entrar, então só resta fechar o aviso.
  const dead = inviteIsDead(entry.error);

  return (
    <>
      <div className="invite" role="alert">
        <span className="invite-text">{entry.error || inviteText(current)}</span>
        {waiting > 0 && !entry.error && (
          <span className="mono invite-more">
            + {waiting} {waiting === 1 ? 'CONVITE ESPERANDO' : 'CONVITES ESPERANDO'}
          </span>
        )}
        <div className="invite-actions">
          {dead ? (
            <button type="button" className="invite-btn" data-sfx="back" onClick={refuse}>
              Fechar
            </button>
          ) : (
            <>
              <button
                type="button"
                className="invite-btn"
                data-sfx="roomJoin"
                disabled={entry.busy}
                onClick={() => void accept()}
              >
                {entry.busy ? 'Entrando...' : entry.error ? 'Tentar de novo' : 'Entrar'}
              </button>
              <button
                type="button"
                className="invite-btn ghost"
                data-sfx="cancel"
                disabled={entry.busy}
                onClick={refuse}
              >
                Recusar
              </button>
            </>
          )}
        </div>
      </div>
      {conflict}
    </>
  );
}
