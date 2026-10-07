import { useState } from 'react';
import { Crown } from '@/components/icons';
import { sendRoom, type RoomMember, type RoomSnapshot } from '@/lib/rooms';
import { MIN_PLAYERS } from './rules';

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
              <span className="lb-avatar">{m.username.slice(0, 1).toUpperCase()}</span>
              <span className="lb-who">
                <b>
                  @{m.username}
                  {m.id === me && <span className="mono rm-badge you">VOCÊ</span>}
                </b>
              </span>
              <span className="lb-side">
                <Status m={m} />
                {canKick && <Kick m={m} />}
              </span>
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
