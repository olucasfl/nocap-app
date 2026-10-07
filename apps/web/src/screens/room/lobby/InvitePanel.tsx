import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFriends } from '@/lib/friends';
import { inviteFriend, useRoom, type RoomSnapshot } from '@/lib/rooms';

/** Chamar gente: o link da sala e os amigos que ainda não estão nela. */
export function InvitePanel({ snapshot }: { snapshot: RoomSnapshot }) {
  const invited = useRoom((s) => s.invited);
  const friends = useQuery({ queryKey: ['friends'], queryFn: fetchFriends });
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/sala/${snapshot.code}`;
  const inRoom = new Set(snapshot.members.map((m) => m.username));
  const list = (friends.data?.friends ?? []).filter((f) => !inRoom.has(f.username));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem permissão para copiar: o link continua visível */
    }
  };

  return (
    <div className="lb-invite">
      <div>
        <div className="mono rm-label">LINK DA SALA</div>
        <div className="lb-link">
          <span className="mono">{link.replace(/^https?:\/\//, '')}</span>
          <button
            type="button"
            className="fr-btn ghost"
            data-sfx="send"
            onClick={() => void copy()}
          >
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="mono rm-mode-note">
          Ou passe o código <b>{snapshot.code}</b> para quem quiser entrar.
        </p>
      </div>

      <div>
        <div className="mono rm-label">CHAMAR AMIGOS</div>
        {friends.isPending ? (
          <p className="mono lb-hint">Carregando seus amigos...</p>
        ) : list.length === 0 ? (
          <p className="mono lb-hint">
            {friends.data?.friends.length
              ? 'Todos os seus amigos já estão na sala.'
              : 'Você ainda não tem amigos no NoCap. Use o link ou o código acima.'}
          </p>
        ) : (
          <ul className="fr-list">
            {list.map((f) => (
              <li key={f.username} className="fr-row">
                <span className="fr-name">@{f.username}</span>
                {invited.includes(f.username) ? (
                  <span className="mono fr-state">CONVITE ENVIADO</span>
                ) : (
                  <button type="button" className="fr-btn" onClick={() => inviteFriend(f.username)}>
                    Convidar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
