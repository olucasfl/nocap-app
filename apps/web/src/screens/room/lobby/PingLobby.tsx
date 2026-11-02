import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { closeRoom, leaveRoom, sendRoom, at, type RoomSnapshot } from '@/lib/rooms';
import { InvitePanel } from './InvitePanel';
import { LobbyShell } from './LobbyShell';

const SIDES = [
  { name: 'Laranja', color: '#ff7d26' },
  { name: 'Roxo', color: '#9a6bff' },
] as const;
const LEVELS = [
  { id: 'facil', label: 'Fácil' },
  { id: 'medio', label: 'Médio' },
  { id: 'dificil', label: 'Difícil' },
] as const;

/** O que falta para o Ping Fox! começar: os dois lados ocupados (pessoa ou bot) e quem joga pronto. */
function pingHint(snapshot: RoomSnapshot): { text: string; ok: boolean } {
  const l = snapshot.pingpong?.lobby;
  if (!l) return { text: '', ok: false };
  for (const k of [0, 1] as const) {
    if (!l.slots[k] && l.bot?.slot !== k)
      return { text: `Falta alguém (ou um bot) no time ${SIDES[k].name}`, ok: false };
  }
  const waiting = l.slots.filter((id) => {
    const m = snapshot.members.find((x) => x.id === id);
    return !!m && m.connected && !m.isHost && !m.ready && !m.committed;
  }).length;
  if (waiting > 0) return { text: 'Falta o outro marcar "pronto"', ok: false };
  return { text: 'Tudo pronto', ok: true };
}

/** Dois times de uma vaga (como o Fut Fox): a pessoa entra, o líder põe um bot no lado vazio. */
function SidesPanel({
  snapshot,
  me,
  level,
  setLevel,
}: {
  snapshot: RoomSnapshot;
  me: string | undefined;
  level: string;
  setLevel: (l: string) => void;
}) {
  const lobby = snapshot.pingpong?.lobby;
  const isHost = snapshot.hostId === me;
  const slots = lobby?.slots ?? [null, null];
  const mySlot = me ? slots.indexOf(me) : -1;
  const watching = snapshot.members.filter((m) => !slots.includes(m.id));
  return (
    <div className="bola-lobby-teams">
      <div className="bola-lobby-grid">
        {([0, 1] as const).map((k) => {
          const id = slots[k];
          const m = id ? snapshot.members.find((x) => x.id === id) : undefined;
          const hasBot = lobby?.bot?.slot === k;
          return (
            <section
              key={k}
              className="bola-lobby-team"
              style={{ ['--tc' as string]: SIDES[k].color }}
              data-testid={`ping-side-${k}`}
            >
              <h3>
                Time {SIDES[k].name}
                <small>{m || hasBot ? '1/1' : '0/1'}</small>
              </h3>
              <ul>
                {m && (
                  <li className={m.id === me ? 'is-me' : ''}>
                    <span>
                      {m.id === me ? 'Você' : at(m.username)}
                      {m.isHost && <small>líder</small>}
                    </span>
                    <em className={m.ready || m.isHost ? 'ok' : ''}>
                      {m.isHost ? '' : m.ready ? 'pronto' : 'esperando'}
                    </em>
                  </li>
                )}
                {hasBot && (
                  <li className="is-bot">
                    <span>
                      {lobby?.botName ?? 'Bot'}
                      <small>bot</small>
                    </span>
                    <span className="bola-acts">
                      {mySlot < 0 && (
                        <button
                          type="button"
                          className="bola-mini on"
                          onClick={() => sendRoom('pteam', { slot: k })}
                          data-testid={`ping-join-${k}`}
                        >
                          Entrar no lugar
                        </button>
                      )}
                      {isHost && (
                        <button
                          type="button"
                          className="bola-mini"
                          onClick={() => sendRoom('pbot', { slot: null })}
                          data-testid="ping-bot-remove"
                        >
                          Tirar
                        </button>
                      )}
                    </span>
                  </li>
                )}
                {!m && !hasBot && (
                  <li className="is-free">
                    <span>Vaga livre</span>
                    <span className="bola-acts">
                      {mySlot !== k && (
                        <button
                          type="button"
                          className="bola-mini on"
                          onClick={() => sendRoom('pteam', { slot: k })}
                          data-testid={`ping-join-${k}`}
                        >
                          Entrar
                        </button>
                      )}
                      {isHost && (
                        <button
                          type="button"
                          className="bola-mini"
                          onClick={() => sendRoom('pbot', { slot: k, level })}
                          data-testid={`ping-bot-add-${k}`}
                        >
                          + Bot
                        </button>
                      )}
                    </span>
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
      {isHost && (
        <div className="bola-format">
          <div className="mono rm-label">NÍVEL DO BOT</div>
          <div className="rm-seg" role="radiogroup" aria-label="Nível do bot">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={(lobby?.bot?.level ?? level) === l.id}
                onClick={() => {
                  setLevel(l.id);
                  const b = lobby?.bot;
                  if (b) sendRoom('pbot', { slot: b.slot, level: l.id });
                }}
                data-testid={`ping-level-${l.id}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <section className="bola-lobby-spec">
        <h3>
          Espectadores<small>{watching.length}</small>
        </h3>
        {watching.length === 0 ? (
          <p className="mono">Ninguém assistindo.</p>
        ) : (
          <ul>
            {watching.map((m) => (
              <li key={m.id}>{m.id === me ? 'Você' : at(m.username)}</li>
            ))}
          </ul>
        )}
        {mySlot >= 0 && (
          <button
            type="button"
            className="bola-mini"
            onClick={() => sendRoom('pteam', { slot: -1 })}
          >
            Virar espectador
          </button>
        )}
      </section>
    </div>
  );
}

/** O lobby do Ping Fox! em sala: os dois times lado a lado, bot opcional, como no Fut Fox. */
export function PingLobby({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const [closing, setClosing] = useState(false);
  const [level, setLevel] = useState('medio');
  const isHost = snapshot.hostId === me;
  const mine = snapshot.members.find((m) => m.id === me);
  const hint = pingHint(snapshot);
  const onSide =
    me !== undefined && (snapshot.pingpong?.lobby?.slots ?? ([] as (string | null)[])).includes(me);
  const leader = snapshot.members.find((m) => m.id === snapshot.hostId);
  return (
    <LobbyShell
      snapshot={snapshot}
      me={me}
      members={() => <SidesPanel snapshot={snapshot} me={me} level={level} setLevel={setLevel} />}
      rules={null}
      invite={<InvitePanel snapshot={snapshot} />}
      footer={
        <>
          <div className="lb3-leave">
            <button type="button" className="lb-textbtn" data-sfx="back" onClick={leaveRoom}>
              Sair
            </button>
            {isHost && (
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
          {isHost ? (
            <button
              type="button"
              className="btn alt lb3-main"
              data-sfx="start"
              disabled={!hint.ok}
              onClick={() => sendRoom('start')}
              data-testid="ping-start-room"
            >
              Começar
            </button>
          ) : onSide && !mine?.committed ? (
            <button
              type="button"
              className={`btn lb3-main ${mine?.ready ? 'ghost' : 'alt'}`}
              data-sfx="toggle"
              aria-pressed={!!mine?.ready}
              onClick={() => sendRoom('ready', { ready: !mine?.ready })}
            >
              {mine?.ready ? 'Cancelar' : 'Estou pronto'}
            </button>
          ) : null}
          <p className={`mono lb3-why${hint.ok ? ' ok' : ''}`}>
            {!isHost && !onSide
              ? `Você está assistindo. Entre numa vaga para jogar. Aguardando ${at(leader?.username)}.`
              : hint.text}
          </p>
          {isHost && (
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
          )}
        </>
      }
    />
  );
}
