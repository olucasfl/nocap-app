import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ATR_ROOM_COLORS } from '@nocap/games';
import { acceptRequest, fetchFriends, sendRequest, type RelationState } from '@/lib/friends';
import { Check, Crown } from '@/components/icons';
import { FoxAvatar } from '@/components/HubArt';
import { useAuth } from '@/lib/auth';
import { sendRoom, type RoomMember, type RoomSnapshot, at } from '@/lib/rooms';

/** Como eu me relaciono com quem está na sala: amigo, pedido enviado/recebido ou ninguém. */
function useRelation(username: string, skip: boolean): RelationState | 'me' {
  const signedIn = useAuth((s) => s.user !== null);
  const list = useQuery({ queryKey: ['friends'], queryFn: fetchFriends, enabled: signedIn });
  if (skip) return 'me';
  const d = list.data;
  if (d?.friends.some((f) => f.username === username)) return 'friends';
  if (d?.incoming.some((f) => f.username === username)) return 'incoming';
  if (d?.outgoing.some((f) => f.username === username)) return 'outgoing';
  return 'none';
}

/** Cores de pelo para quem ainda não escolheu (nos jogos sem cor da raposa, só enfeite): estável por posição. */
const FALLBACK_FUR = [
  '#ff7d26',
  '#4d8dff',
  '#33c27f',
  '#ff9ecf',
  '#ffd23f',
  '#9a5cff',
  '#2fd6d0',
  '#e5303a',
];

/** Opções de uma pessoa (menu "..."): pedir amizade e, para o líder, expulsar. Só aparece quando há o que fazer. */
function PlayerMenu({
  m,
  relation,
  canKick,
}: {
  m: RoomMember;
  relation: RelationState;
  canKick: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sure, setSure] = useState(false);
  const queryClient = useQueryClient();
  const friend = useMutation({
    mutationFn: () =>
      relation === 'incoming' ? acceptRequest(m.username) : sendRequest(m.username),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
      void queryClient.invalidateQueries({ queryKey: ['ranking'] });
      setOpen(false);
    },
  });
  const canFriend = relation === 'none' || relation === 'incoming';
  if (!canFriend && !canKick) return null;
  return (
    <div className="lb3-menu">
      <button
        type="button"
        className="lb3-more"
        aria-label={`Opções de ${m.username}`}
        aria-expanded={open}
        data-sfx="tab"
        onClick={() => {
          setOpen((o) => !o);
          setSure(false);
        }}
      >
        <span aria-hidden="true">•••</span>
      </button>
      {open && (
        <div className="lb3-pop" role="menu">
          {canFriend && (
            <button
              type="button"
              role="menuitem"
              disabled={friend.isPending}
              onClick={() => friend.mutate()}
            >
              {relation === 'incoming' ? 'Aceitar amizade' : 'Pedir amizade'}
            </button>
          )}
          {canKick &&
            (sure ? (
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => sendRoom('kick', { id: m.id })}
              >
                Confirmar: expulsar
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => setSure(true)}
              >
                Expulsar da sala
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/** Uma vaga ocupada: a raposa, o nome e UM estado (líder, pronto ou esperando). */
function PlayerTile({
  m,
  index,
  me,
  fur,
  canKick,
}: {
  m: RoomMember;
  index: number;
  me: string | undefined;
  fur: string | undefined;
  canKick: boolean;
}) {
  const isMe = m.id === me;
  const viewerIsGuest = useAuth((s) => s.user === null);
  const relation = useRelation(m.username, isMe || !!m.guest || viewerIsGuest);
  const state = !m.connected ? 'off' : m.isHost ? 'host' : m.ready ? 'ready' : 'wait';
  return (
    <li className={`lb3-tile ${state}${isMe ? ' me' : ''}`}>
      <div className="lb3-fox">
        <FoxAvatar fur={fur ?? FALLBACK_FUR[index % FALLBACK_FUR.length]!} />
        {state === 'ready' && (
          <span className="lb3-badge ok" aria-hidden="true">
            <Check size={14} />
          </span>
        )}
        {state === 'host' && (
          <span className="lb3-badge crown" aria-hidden="true">
            <Crown size={14} />
          </span>
        )}
      </div>
      <b className="lb3-name">{m.guest ? m.username : at(m.username)}</b>
      <span className="mono lb3-state">
        {state === 'off'
          ? 'Sem conexão'
          : state === 'host'
            ? 'Líder'
            : state === 'ready'
              ? 'Pronto'
              : 'Esperando'}
        {isMe && ' · você'}
      </span>
      {!isMe && (
        <PlayerMenu m={m} relation={relation === 'me' ? 'friends' : relation} canKick={canKick} />
      )}
    </li>
  );
}

/** Escolher a cor da raposa (Atravessa! e Desmorona!): só bolinhas; as já escolhidas por outros ficam apagadas. */
function ColorPicker({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const colors =
    (snapshot.game === 'desmorona' ? snapshot.desmorona?.colors : snapshot.atravessa?.colors) ?? {};
  const owner = (hex: string) => Object.entries(colors).find(([, h]) => h === hex)?.[0];
  const nameOf = (id?: string) => snapshot.members.find((m) => m.id === id)?.username;
  const mine = me ? colors[me] : undefined;
  return (
    <section className="lb3-colors" aria-label="Cor da sua raposa">
      <div className="lb3-colors-head">
        <h3>Sua cor</h3>
        {!mine && <span className="mono warn">Escolha uma para ficar pronto</span>}
      </div>
      <div className="lb3-dots" role="radiogroup" aria-label="Cor da raposa">
        {ATR_ROOM_COLORS.map((c) => {
          const by = owner(c.hex);
          const isMine = by === me;
          return (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={isMine}
              aria-label={`${c.name}${by && !isMine ? ` (de ${at(nameOf(by))})` : ''}`}
              title={by && !isMine ? `Já é de ${at(nameOf(by))}` : c.name}
              className={`lb3-dot${isMine ? ' on' : ''}${by && !isMine ? ' taken' : ''}`}
              style={{ background: c.hex }}
              disabled={!!by && !isMine}
              data-sfx="select"
              onClick={() => sendRoom('color', { hex: c.hex })}
            >
              {isMine && <Check size={16} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * A aba "Jogadores" (spec 045): as vagas da sala como cartões de raposa, cada um com um estado só. Os detalhes (pedir
 * amizade, expulsar) ficam num menu "..." de cada cartão. Nas vagas livres, um atalho para convidar.
 */
export function MembersPanel({
  snapshot,
  me,
  canKick,
  onInvite,
}: {
  snapshot: RoomSnapshot;
  me: string | undefined;
  canKick: boolean;
  onInvite: () => void;
}) {
  const colored = snapshot.game === 'atravessa' || snapshot.game === 'desmorona';
  const colors =
    (snapshot.game === 'desmorona' ? snapshot.desmorona?.colors : snapshot.atravessa?.colors) ?? {};
  const free = snapshot.maxPlayers - snapshot.members.length;
  // poucas vagas livres à vista: nada de uma fileira de 10 quadrados vazios
  const emptyShown = Math.min(free, snapshot.members.length < 4 ? 4 - snapshot.members.length : 1);
  return (
    <div className="lb3-players">
      <ul className="lb3-grid">
        {snapshot.members.map((m, i) => (
          <PlayerTile
            key={m.id}
            m={m}
            index={i}
            me={me}
            fur={colored ? colors[m.id] : undefined}
            canKick={canKick}
          />
        ))}
        {Array.from({ length: emptyShown }, (_, i) => (
          <li key={`empty-${i}`} className="lb3-tile empty">
            <button type="button" onClick={onInvite} data-sfx="tab">
              <span className="lb3-plus" aria-hidden="true">
                +
              </span>
              <span className="mono">Convidar</span>
            </button>
          </li>
        ))}
      </ul>
      {free > emptyShown && (
        <p className="mono lb3-more-slots">+{free - emptyShown} vagas livres</p>
      )}
      {colored && <ColorPicker snapshot={snapshot} me={me} />}
    </div>
  );
}
