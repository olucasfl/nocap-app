import { useState } from 'react';
import { generateTimeRound } from '@nocap/games';
import { useAuth } from '@/lib/auth';
import { sendRoom, type RoomSnapshot } from '@/lib/rooms';
import { formatDiff, formatSeconds } from '@/games/time/format';
import { RoundScreen } from '@/games/time/screens/RoundScreen';
import '@/games/time/time.css';

function Waiting({ snapshot }: { snapshot: RoomSnapshot }) {
  const connected = snapshot.members.filter((m) => m.connected);
  const done = connected.filter((m) => m.locked).length;
  return (
    <section className="screen rm">
      <h1>Parou</h1>
      <p className="lead">
        Esperando os outros: {done} de {connected.length}.
      </p>
      <ul className="fr-list">
        {snapshot.members.map((m) => (
          <li key={m.id} className="fr-row">
            <span className="fr-name">@{m.username}</span>
            <span className={`mono rm-ready${m.locked ? ' on' : ''}`}>
              {!m.connected ? 'SEM CONEXÃO' : m.locked ? 'PAROU' : 'CONTANDO'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Reveal({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const round = snapshot.round!;
  const isHost = snapshot.hostId === me;
  const last = round.index + 1 >= round.total;
  const target = generateTimeRound(round.seed, snapshot.settings, round.index);
  const results = [...(round.results ?? [])].sort((a, b) => b.score - a.score);
  const name = (id: string) => snapshot.members.find((m) => m.id === id)?.username ?? '?';

  return (
    <section className="screen rm">
      <div className="rm-target time">
        <div className="tag">ALVO</div>
        <b>{formatSeconds(target)}</b>
      </div>
      <ul className="rm-results">
        {results.map((r) => (
          <li key={r.id} className={`rm-result t${r.id === me ? ' me' : ''}`}>
            <span className="mono rm-time">
              {typeof r.answer === 'number'
                ? `${formatSeconds(r.answer)} · ${formatDiff(r.answer - target)}`
                : 'SEM RESPOSTA'}
            </span>
            <span className="rm-result-name">@{name(r.id)}</span>
            <span className="rm-result-score">{r.score.toFixed(1)}</span>
          </li>
        ))}
      </ul>
      <div className="stack">
        {isHost ? (
          <button type="button" className="btn" onClick={() => sendRoom('next')}>
            {last ? 'Ver pódio' : 'Próxima'}
          </button>
        ) : (
          <p className="mono rm-hint">Esperando o host avançar...</p>
        )}
      </div>
    </section>
  );
}

/**
 * Rodada do Tempo na sala: cada pessoa começa e para o próprio relógio (a contagem é em
 * silêncio, igual ao modo solo) e o servidor é quem mede.
 */
export function TimePlay({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const round = snapshot.round!;
  const mine = snapshot.members.find((m) => m.id === me);
  const [counting, setCounting] = useState(false);

  if (snapshot.phase === 'reveal') {
    return <Reveal key={`reveal-${round.index}`} snapshot={snapshot} />;
  }
  if (mine?.locked) return <Waiting snapshot={snapshot} />;

  return (
    <RoundScreen
      key={`play-${round.index}`}
      target={generateTimeRound(round.seed, snapshot.settings, round.index)}
      noOvershoot={snapshot.settings.noOvershoot}
      counting={counting}
      onBegin={() => {
        setCounting(true);
        sendRoom('begin');
      }}
      onStop={() => {
        setCounting(false);
        sendRoom('stop');
      }}
    />
  );
}
