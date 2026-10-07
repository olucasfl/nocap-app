import { generateColorRound, generateColorStart, type Hsb } from '@nocap/games';
import { useAuth } from '@/lib/auth';
import { sendRoom, type RoomSnapshot } from '@/lib/rooms';
import { toHex } from '@/games/color/hex';
import { PickScreen } from '@/games/color/screens/PickScreen';
import { ShowScreen } from '@/games/color/screens/ShowScreen';
import '@/games/color/color.css';
import { TimePlay } from './TimePlay';

function Waiting({ snapshot }: { snapshot: RoomSnapshot }) {
  const connected = snapshot.members.filter((m) => m.connected);
  const done = connected.filter((m) => m.locked).length;
  return (
    <section className="screen rm">
      <h1>Travado</h1>
      <p className="lead">
        Esperando os outros: {done} de {connected.length}.
      </p>
      <ul className="fr-list">
        {snapshot.members.map((m) => (
          <li key={m.id} className="fr-row">
            <span className="fr-name">@{m.username}</span>
            <span className={`mono rm-ready${m.locked ? ' on' : ''}`}>
              {!m.connected ? 'SEM CONEXÃO' : m.locked ? 'TRAVOU' : 'PENSANDO'}
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
  const target = generateColorRound(round.seed, snapshot.settings, round.index);
  const results = [...(round.results ?? [])].sort((a, b) => b.score - a.score);
  const name = (id: string) => snapshot.members.find((m) => m.id === id)?.username ?? '?';
  const colorOf = (a: unknown) => (a && typeof a === 'object' ? toHex(a as Hsb) : undefined);

  return (
    <section className="screen rm">
      <div className="rm-target" style={{ background: toHex(target) }}>
        <div className="tag">ALVO</div>
        <small className="mono">{toHex(target)}</small>
      </div>
      <ul className="rm-results">
        {results.map((r) => (
          <li key={r.id} className={`rm-result${r.id === me ? ' me' : ''}`}>
            <span
              className="rm-swatch"
              style={colorOf(r.answer) ? { background: colorOf(r.answer) } : undefined}
              aria-label={colorOf(r.answer) ?? 'Sem resposta'}
            />
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

/** Memorizar, recriar e revelação. O servidor manda em todas as fases; aqui só se mostra. */
export function Play({ snapshot }: { snapshot: RoomSnapshot }) {
  if (snapshot.game === 'time') return <TimePlay snapshot={snapshot} />;
  const me = useAuth((s) => s.user?.id);
  const round = snapshot.round!;
  const mine = snapshot.members.find((m) => m.id === me);

  return (
    <>
      {snapshot.phase === 'show' && (
        <ShowScreen
          key={`show-${round.index}`}
          color={toHex(generateColorRound(round.seed, snapshot.settings, round.index))}
          ms={snapshot.settings.showMs}
          onDone={() => undefined}
        />
      )}
      {snapshot.phase === 'pick' &&
        (mine?.locked ? (
          <Waiting snapshot={snapshot} />
        ) : (
          <PickScreen
            key={`pick-${round.index}`}
            blind={snapshot.mode === 'blind'}
            start={generateColorStart(
              round.seed,
              generateColorRound(round.seed, snapshot.settings, round.index),
              round.index,
            )}
            onLock={(guess) => sendRoom('lock', guess)}
          />
        ))}
      {snapshot.phase === 'reveal' && <Reveal key={`reveal-${round.index}`} snapshot={snapshot} />}
    </>
  );
}
