import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { acceptRequest, fetchFriends, sendRequest, type RelationState } from '@/lib/friends';
import { Crown } from '@/components/icons';
import { sendRoom, type RoomMember, type RoomSnapshot } from '@/lib/rooms';
import { MIN_PLAYERS } from './rules';

/** Como eu me relaciono com quem está na sala: amigo, pedido enviado/recebido ou ninguém. */
function useRelation(username: string, isMe: boolean): RelationState | 'me' {
  const list = useQuery({ queryKey: ['friends'], queryFn: fetchFriends });
  if (isMe) return 'me';
  const d = list.data;
  if (d?.friends.some((f) => f.username === username)) return 'friends';
  if (d?.incoming.some((f) => f.username === username)) return 'incoming';
  if (d?.outgoing.some((f) => f.username === username)) return 'outgoing';
  return 'none';
}

/** Pedir amizade (ou aceitar) a quem está na sala e ainda não é amigo. */
function FriendAction({ username, relation }: { username: string; relation: RelationState }) {
  const queryClient = useQueryClient();
  const act = useMutation({
    mutationFn: () => (relation === 'incoming' ? acceptRequest(username) : sendRequest(username)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
      void queryClient.invalidateQueries({ queryKey: ['ranking'] });
    },
  });
  if (relation === 'friends') return <span className="mono lb-pill friend">AMIGO</span>;
  if (relation === 'outgoing') return <span className="mono lb-pill">PEDIDO ENVIADO</span>;
  return (
    <button
      type="button"
      className="fr-btn"
      data-sfx={relation === 'incoming' ? 'success' : 'send'}
      disabled={act.isPending}
      onClick={() => act.mutate()}
    >
      {act.isPending
        ? 'Enviando...'
        : relation === 'incoming'
          ? 'Aceitar amizade'
          : 'Pedir amizade'}
    </button>
  );
}

function Person({
  m,
  me,
  children,
}: {
  m: RoomMember;
  me: string | undefined;
  children?: React.ReactNode;
}) {
  const relation = useRelation(m.username, m.id === me);
  return (
    <>
      <span
        className={`lb-avatar${relation === 'friends' ? ' friend' : relation === 'me' ? '' : ' stranger'}`}
      >
        {m.username.slice(0, 1).toUpperCase()}
      </span>
      <span className="lb-who">
        <b>
          @{m.username}
          {m.id === me && <span className="mono rm-badge you">VOCÊ</span>}
        </b>
        {relation !== 'me' && relation !== 'friends' && (
          <small className="mono">Ainda não é seu amigo</small>
        )}
      </span>
      <span className="lb-side">
        {children}
        {relation !== 'me' && <FriendAction username={m.username} relation={relation} />}
      </span>
    </>
  );
}

function LeaderFriend({ username, isMe }: { username: string; isMe: boolean }) {
  const relation = useRelation(username, isMe);
  return relation === 'me' ? null : <FriendAction username={username} relation={relation} />;
}

function Status({ m }: { m: RoomMember }) {
  if (!m.connected) return <span className="mono lb-pill off">SEM CONEXÃO</span>;
  return (
    <span className={`mono lb-pill${m.ready ? ' on' : ''}`}>
      {m.ready ? 'PRONTO' : 'ESPERANDO'}
    </span>
  );
}

function Kick({ m }: { m: RoomMember }) {
  const [sure, setSure] = useState(false);
  return sure ? (
    <span className="lb-kick">
      <button
        type="button"
        className="fr-btn"
        data-sfx="remove"
        onClick={() => sendRoom('kick', { id: m.id })}
      >
        Confirmar
      </button>
      <button type="button" className="fr-btn ghost" onClick={() => setSure(false)}>
        Não
      </button>
    </span>
  ) : (
    <button type="button" className="fr-btn ghost" onClick={() => setSure(true)}>
      Expulsar
    </button>
  );
}

/**
 * Quem está na sala: o líder em destaque no topo e, abaixo, os jogadores com o estado de cada
 * um. Só o líder vê o botão de expulsar (`canKick`).
 */
export function MembersPanel({
  snapshot,
  me,
  canKick,
}: {
  snapshot: RoomSnapshot;
  me: string | undefined;
  canKick: boolean;
}) {
  const leader = snapshot.members.find((m) => m.isHost);
  const players = snapshot.members.filter((m) => !m.isHost);
  const connected = snapshot.members.filter((m) => m.connected).length;
  const readyCount = players.filter((m) => m.connected && m.ready).length;
  const waiting = players.filter((m) => m.connected).length;
  const needed = MIN_PLAYERS[snapshot.game];

  return (
    <div className="lb-members">
      {leader && (
        <div>
          <div className="mono rm-label">LÍDER</div>
          <div className="lb-leader">
            <span className="lb-avatar">
              <Crown size={22} />
            </span>
            <span className="lb-who">
              <b>
                @{leader.username}
                {leader.id === me && <span className="mono rm-badge you">VOCÊ</span>}
              </b>
              <small className="mono">Define as regras e começa a partida</small>
            </span>
            <LeaderFriend username={leader.username} isMe={leader.id === me} />
            <span className={`mono lb-pill${leader.connected ? ' on' : ' off'}`}>
              {leader.connected ? 'NA SALA' : 'SEM CONEXÃO'}
            </span>
          </div>
        </div>
      )}

      <div>
        <div className="lb-sec-head">
          <div className="mono rm-label">JOGADORES · {players.length}</div>
          {waiting > 0 && (
            <div className="mono lb-count">
              {readyCount} DE {waiting} PRONTOS
            </div>
          )}
        </div>
        {waiting > 0 && (
          <div
            className="lb-bar"
            role="progressbar"
            aria-label="Jogadores prontos"
            aria-valuemin={0}
            aria-valuemax={waiting}
            aria-valuenow={readyCount}
          >
            <i style={{ transform: `scaleX(${readyCount / waiting})` }} />
          </div>
        )}
        <ul className="lb-list">
          {players.map((m) => (
            <li key={m.id} className={`lb-row${m.id === me ? ' me' : ''}`}>
              <Person m={m} me={me}>
                <Status m={m} />
                {canKick && <Kick m={m} />}
              </Person>
            </li>
          ))}
          {connected < needed && (
            <li className="lb-empty mono">
              Falta{needed - connected === 1 ? '' : 'm'} {needed - connected}{' '}
              {needed - connected === 1 ? 'pessoa' : 'pessoas'} para poder começar. Use a aba
              Convidar.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
