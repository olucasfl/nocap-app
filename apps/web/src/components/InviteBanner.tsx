import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { sfx } from '@/lib/sfx';
import {
  INVITES_POLL_MS,
  declineInvite,
  fetchInvites,
  inviteText,
  nextInvite,
  type RoomInvite,
} from '@/lib/invites';
import { useRoom } from '@/lib/rooms';
import './invite-banner.css';

/**
 * Aviso de convite para sala, em qualquer tela. Só com conta; quem já está numa sala não é
 * incomodado. O app consulta o servidor a cada poucos segundos (não há push ainda).
 */
export function InviteBanner() {
  const user = useAuth((s) => s.user);
  const inRoom = useRoom((s) => s.snapshot !== null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // "Agora não" some só neste aparelho; o convite continua valendo até a sala fechar.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const invites = useQuery({
    queryKey: ['invites'],
    queryFn: fetchInvites,
    enabled: !!user && !inRoom,
    refetchInterval: INVITES_POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const decline = useMutation({
    mutationFn: (id: string) => declineInvite(id),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['invites'] }),
  });

  const current: RoomInvite | null =
    user && !inRoom ? nextInvite(invites.data ?? [], dismissed) : null;
  const currentId = current?.id;
  useEffect(() => {
    if (currentId) sfx.notify();
  }, [currentId]);
  if (!current) return null;

  const accept = () => {
    setDismissed((d) => new Set(d).add(current.id));
    void navigate({ to: '/sala/$code', params: { code: current.code } });
  };
  const refuse = () => {
    setDismissed((d) => new Set(d).add(current.id));
    decline.mutate(current.id);
  };

  return (
    <div className="invite" role="alert">
      <span className="invite-text">{inviteText(current)}</span>
      <div className="invite-actions">
        <button type="button" className="invite-btn" data-sfx="roomJoin" onClick={accept}>
          Entrar
        </button>
        <button type="button" className="invite-btn ghost" data-sfx="cancel" onClick={refuse}>
          Recusar
        </button>
      </div>
    </div>
  );
}
