import { useState } from 'react';
import { BOL_TEAM_COLORS, BOL_TEAM_NAMES, bolFormatLabel, bolFormats } from '@nocap/games';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { closeRoom, leaveRoom, sendRoom, at, type RoomSnapshot } from '@/lib/rooms';
import { bolaHint } from './bola-hint';
import { InvitePanel } from './InvitePanel';
import { LobbyShell } from './LobbyShell';

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Times, vagas e espectadores: toque numa vaga para entrar; o líder completa com bots. */
function TeamsPanel({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const b = snapshot.bola!;
  const isHost = snapshot.hostId === me;
  const myTeam = me !== undefined ? b.teamOf[me] : undefined;
  const humans = (t: number) => snapshot.members.filter((m) => b.teamOf[m.id] === t);
  const spectators = snapshot.members.filter((m) => b.teamOf[m.id] === undefined);
  return (
    <div className="bola-lobby-teams">
      <div className="bola-lobby-grid">
        {Array.from({ length: b.format.teams }, (_, t) => {
          const list = humans(t);
          const bots = b.bots[t] ?? 0;
          const free = Math.max(0, b.format.perTeam - list.length - bots);
          const full = list.length >= b.format.perTeam;
          return (
            <section
              key={t}
              className="bola-lobby-team"
              style={{ ['--tc' as string]: css(BOL_TEAM_COLORS[t] as number) }}
            >
              <h3>
                Time {BOL_TEAM_NAMES[t]}
                <small>
                  {list.length + bots}/{b.format.perTeam}
                </small>
              </h3>
              <ul>
                {list.map((m) => (
                  <li key={m.id} className={m.id === me ? 'is-me' : ''}>
                    <span>
                      {m.id === me ? 'Você' : at(m.username)}
                      {m.isHost && <small>líder</small>}
                    </span>
                    <em className={m.ready || m.isHost ? 'ok' : ''}>
                      {m.isHost ? '' : m.ready ? 'pronto' : 'esperando'}
                    </em>
                  </li>
                ))}
                {Array.from({ length: bots }, (_, i) => (
                  <li key={`bot${i}`} className="is-bot">
                    <span>
                      Bot<small>bot</small>
                    </span>
                    {isHost && (
                      <button
                        type="button"
                        className="bola-mini"
                        onClick={() => sendRoom('bbots', { team: t, delta: -1 })}
                        aria-label={`Tirar um bot do time ${BOL_TEAM_NAMES[t]}`}
                      >
                        Tirar
                      </button>
                    )}
                  </li>
                ))}
                {Array.from({ length: free }, (_, i) => (
                  <li key={`free${i}`} className="is-free">
                    <span>Vaga livre</span>
                    <span className="bola-acts">
                      {myTeam !== t && !full && (
                        <button
                          type="button"
                          className="bola-mini on"
                          onClick={() => sendRoom('bteam', { team: t })}
                          data-testid={`bola-join-${t}`}
                        >
                          Entrar
                        </button>
                      )}
                      {isHost && (
                        <button
                          type="button"
                          className="bola-mini"
                          onClick={() => sendRoom('bbots', { team: t, delta: 1 })}
                        >
                          + Bot
                        </button>
                      )}
                    </span>
                  </li>
                ))}
                {free === 0 && full && myTeam !== t && (
                  <li className="is-full">
                    <span>Time cheio</span>
                  </li>
                )}
                {free === 0 && !full && myTeam !== t && (
                  <li className="is-free">
                    <span>Só bots</span>
                    <button
                      type="button"
                      className="bola-mini on"
                      onClick={() => sendRoom('bteam', { team: t })}
                    >
                      Entrar no lugar de um bot
                    </button>
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
      <section className="bola-lobby-spec">
        <h3>
          Espectadores<small>{spectators.length}</small>
        </h3>
        {spectators.length === 0 ? (
          <p className="mono">Ninguém assistindo.</p>
        ) : (
          <ul>
            {spectators.map((m) => (
              <li key={m.id}>{m.id === me ? 'Você' : at(m.username)}</li>
            ))}
          </ul>
        )}
        {myTeam !== undefined && (
          <button
            type="button"
            className="bola-mini"
            onClick={() => sendRoom('bteam', { team: -1 })}
            data-testid="bola-spectate"
          >
            Virar espectador
          </button>
        )}
        {snapshot.members.length > 12 && <p className="mono">Só 12 jogam; o resto assiste.</p>}
      </section>
    </div>
  );
}

/** Formato e duração: o líder escolhe; os outros leem. */
function FormatPanel({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const b = snapshot.bola!;
  const isHost = snapshot.hostId === me;
  const sug = b.suggested;
  const label = bolFormatLabel(b.format);
  const same = (f: { teams: number; perTeam: number }) =>
    b.format.teams === f.teams && b.format.perTeam === f.perTeam;
  if (!isHost) {
    return (
      <div className="bola-format">
        <p className="mono">
          Formato <b>{label}</b> · {b.format.minutes} min {b.format.auto ? '· automático' : ''}
        </p>
        <p className="mono">O líder escolhe o formato. Sem ranking.</p>
      </div>
    );
  }
  return (
    <div className="bola-format">
      <div className="mono rm-label">FORMATO</div>
      <div className="rm-seg bola-seg" role="radiogroup" aria-label="Formato">
        <button
          type="button"
          role="radio"
          aria-checked={b.format.auto}
          onClick={() => sendRoom('bformat', { auto: true })}
          data-testid="bola-fmt-auto"
        >
          Automático ({bolFormatLabel(sug)})
        </button>
        {bolFormats().map((f) => (
          <button
            key={bolFormatLabel(f)}
            type="button"
            role="radio"
            aria-checked={!b.format.auto && same(f)}
            onClick={() => sendRoom('bformat', { teams: f.teams, perTeam: f.perTeam })}
            data-testid={`bola-room-fmt-${bolFormatLabel(f)}`}
          >
            {bolFormatLabel(f)}
          </button>
        ))}
      </div>
      <div className="mono rm-label">DURAÇÃO</div>
      <div className="rm-seg" role="radiogroup" aria-label="Duração">
        {[1, 2, 3, 5, 8, 10, 15, 30].map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={b.format.minutes === m}
            onClick={() => sendRoom('bformat', { minutes: m })}
          >
            {m} min
          </button>
        ))}
      </div>
      <p className="mono">
        Quem não cabe no formato vira espectador. Empate no fim vai para o gol de ouro.
      </p>
    </div>
  );
}

/** A sala do Fut Fox: times e vagas no lugar da lista de jogadores, formato e bots no lugar das regras. */
export function BolaLobby({ snapshot, me }: { snapshot: RoomSnapshot; me: string | undefined }) {
  const [closing, setClosing] = useState(false);
  const isHost = snapshot.hostId === me;
  const mine = snapshot.members.find((m) => m.id === me);
  const hint = bolaHint(snapshot);
  const onTeam = me !== undefined && snapshot.bola?.teamOf[me] !== undefined;
  const leader = snapshot.members.find((m) => m.id === snapshot.hostId);
  return (
    <LobbyShell
      snapshot={snapshot}
      me={me}
      members={() => <TeamsPanel snapshot={snapshot} me={me} />}
      rules={<FormatPanel snapshot={snapshot} me={me} />}
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
              data-testid="bola-start-room"
            >
              Começar
            </button>
          ) : onTeam && !mine?.committed ? (
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
          <p
            className={`mono lb3-why${hint.ok ? ' ok' : ''}${!isHost && mine?.committed ? ' lb3-committed' : ''}`}
          >
            {!isHost && !onTeam
              ? `Você está assistindo. Entre numa vaga para jogar. Aguardando ${at(leader?.username)}.`
              : !isHost && mine?.committed
                ? 'Você topou jogar de novo. Aguardando o líder...'
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
