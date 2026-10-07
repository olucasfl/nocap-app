import { useState, type CSSProperties } from 'react';
import { Countdown } from '@/components/Countdown';
import type { Hsb } from '@nocap/games';
import { useAuth } from '@/lib/auth';
import { sendRoom, type ImpostorState, type RoomSnapshot } from '@/lib/rooms';
import { toHex } from '@/games/color/hex';
import { PickScreen } from '@/games/color/screens/PickScreen';
import { ShowScreen } from '@/games/color/screens/ShowScreen';
import '@/games/color/color.css';
import './impostor.css';

const NO_STATE: ImpostorState = { count: 1 };

function RoleBadge({ role, count }: { role: ImpostorState['role']; count: number }) {
  if (!role) return null;
  const impostor = role === 'impostor';
  return (
    <div className={`ip-role ${impostor ? 'imp' : 'crew'}`} role="status">
      <b>{impostor ? 'VOCÊ É O INTRUSO' : 'VOCÊ É DA TRIPULAÇÃO'}</b>
      <span className="mono">
        {impostor
          ? 'Você não viu a cor. Use a dica e disfarce.'
          : `Tem ${count} ${count === 1 ? 'intruso' : 'intrusos'} entre vocês.`}
      </span>
    </div>
  );
}

function Hint({ text, label = 'DICA' }: { text: string; label?: string }) {
  return (
    <figure className="ip-hint">
      <figcaption className="mono">{label}</figcaption>
      <blockquote>{text}</blockquote>
    </figure>
  );
}

/** Intruso na fase de decorar: no lugar da cor, a dica, com a mesma barra de tempo. */
function HintShow({ hint, ms }: { hint: string; ms: number }) {
  const [endsAt] = useState(() => Date.now() + ms);
  return (
    <section className="screen rm">
      <RoleBadge role="impostor" count={0} />
      <Hint text={hint} />
      <Countdown
        endsAt={endsAt}
        totalMs={ms}
        warnMs={1000}
        decimals
        compact
        label="A DICA SOME EM"
      />
      <div className="cg-bar" aria-hidden="true">
        <i className="ip-bar" style={{ animationDuration: `${ms}ms` } as CSSProperties} />
      </div>
      <div className="cg-hint">A COR NÃO APARECE PARA VOCÊ. LEIA A DICA.</div>
    </section>
  );
}

function Waiting({ snapshot, imp }: { snapshot: RoomSnapshot; imp: ImpostorState }) {
  const connected = snapshot.members.filter((m) => m.connected);
  const done = connected.filter((m) => m.locked).length;
  return (
    <section className="screen rm">
      <RoleBadge role={imp.role} count={imp.count} />
      {imp.hint && <Hint text={imp.hint} />}
      <h1>Travado</h1>
      <p className="lead">
        Esperando os outros: {done} de {connected.length}.
      </p>
      {snapshot.round?.endsAt && (
        <Countdown
          endsAt={snapshot.round.endsAt}
          totalMs={snapshot.settings.pickMs}
          warnMs={5000}
          label="PARA ACABAR"
        />
      )}
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

function swatchOf(answer: unknown) {
  return answer && typeof answer === 'object' ? toHex(answer as Hsb) : undefined;
}

function Vote({ snapshot, imp }: { snapshot: RoomSnapshot; imp: ImpostorState }) {
  const me = useAuth((s) => s.user?.id);
  const round = snapshot.round!;
  const results = new Map((round.results ?? []).map((r) => [r.id, r]));
  const voted = new Set(imp.voted ?? []);
  const mine = imp.myVote ?? null;
  const players = snapshot.members.filter((m) => imp.participants?.includes(m.id));
  const inRound = !!me && !!imp.participants?.includes(me);

  return (
    <section className="screen rm">
      <RoleBadge role={imp.role} count={imp.count} />
      {imp.hint && <Hint text={imp.hint} />}
      <h1>Quem é o intruso?</h1>
      <p className="lead">
        {imp.count === 1 ? 'Tem 1 intruso' : `Tem ${imp.count} intrusos`} entre vocês. Compare as
        cores e vote. Intrusos também votam.
      </p>
      {round.endsAt && (
        <Countdown
          endsAt={round.endsAt}
          totalMs={snapshot.settings.voteMs}
          warnMs={5000}
          beep
          label="PARA VOTAR"
        />
      )}
      <ul className="rm-results">
        {players.map((m) => {
          const r = results.get(m.id);
          const hex = swatchOf(r?.answer);
          const self = m.id === me;
          const picked = mine === m.id;
          return (
            <li key={m.id} className={`ip-cand${picked ? ' picked' : ''}${self ? ' me' : ''}`}>
              <span
                className="rm-swatch"
                style={hex ? { background: hex } : undefined}
                aria-label={hex ?? 'Sem resposta'}
              />
              <span className="rm-result-name">
                @{m.username}
                {self && <span className="mono rm-badge you">VOCÊ</span>}
              </span>
              <span className="ip-cand-side">
                <span className={`mono rm-ready${voted.has(m.id) ? ' on' : ''}`}>
                  {voted.has(m.id) ? 'VOTOU' : 'PENSANDO'}
                </span>
                {inRound && !self && (
                  <button
                    type="button"
                    className={`fr-btn${picked ? '' : ' ghost'}`}
                    data-sfx="select"
                    aria-pressed={picked}
                    onClick={() => sendRoom('suspect', { id: picked ? null : m.id })}
                  >
                    {picked ? 'Seu voto' : 'Votar'}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {inRound && (
        <div className="stack">
          <button
            type="button"
            className="btn ghost"
            data-sfx="toggle"
            onClick={() => sendRoom('suspect', { id: null })}
          >
            {voted.has(me!) && !mine ? 'Você se absteve' : 'Não sei: abster'}
          </button>
        </div>
      )}
      <p className="mono rm-hint">
        {snapshot.settings.anonymous
          ? 'Voto anônimo: ninguém vê em quem você votou.'
          : 'No fim todo mundo vê o voto de cada pessoa.'}
      </p>
    </section>
  );
}

function Reveal({ snapshot, imp }: { snapshot: RoomSnapshot; imp: ImpostorState }) {
  const me = useAuth((s) => s.user?.id);
  const round = snapshot.round!;
  const reveal = imp.reveal;
  const isHost = snapshot.hostId === me;
  const last = round.index + 1 >= round.total;
  const name = (id: string) => snapshot.members.find((m) => m.id === id)?.username ?? '?';
  const results = new Map((round.results ?? []).map((r) => [r.id, r]));
  const players = (imp.participants ?? [])
    .filter((id) => snapshot.members.some((m) => m.id === id))
    .sort((a, b) => (reveal?.points[b] ?? 0) - (reveal?.points[a] ?? 0));
  const votesBy = (id: string) => reveal?.votes?.find((v) => v.voter === id)?.target;
  const caughtAll = (reveal?.impostors ?? []).every((id) => reveal?.caught.includes(id));
  const nobody = (reveal?.caught.length ?? 0) === 0;

  return (
    <section className="screen rm">
      {imp.color && (
        <div className="rm-target" style={{ background: toHex(imp.color) }}>
          <div className="tag">{imp.colorName?.toUpperCase() ?? 'ALVO'}</div>
          <small className="mono">{toHex(imp.color)}</small>
        </div>
      )}
      {imp.hint && <Hint text={imp.hint} label="A DICA ERA" />}
      <p className={`ip-verdict ${caughtAll ? 'win' : nobody ? 'lose' : 'mix'}`} role="status">
        {caughtAll
          ? 'A turma pegou todos os intrusos!'
          : nobody
            ? 'Os intrusos escaparam!'
            : 'Pegaram só parte dos intrusos.'}
      </p>
      <ul className="rm-results">
        {players.map((id) => {
          const r = results.get(id);
          const hex = swatchOf(r?.answer);
          const impostor = reveal?.impostors.includes(id);
          const caught = reveal?.caught.includes(id);
          const received = reveal?.counts[id] ?? 0;
          const target = votesBy(id);
          return (
            <li key={id} className={`ip-row${id === me ? ' me' : ''}${impostor ? ' imp' : ''}`}>
              <span className="rm-swatch" style={hex ? { background: hex } : undefined} />
              <span className="ip-row-main">
                <span className="rm-result-name">@{name(id)}</span>
                <span className="mono ip-row-sub">
                  <b className={impostor ? 'imp' : 'crew'}>{impostor ? 'INTRUSO' : 'TRIPULAÇÃO'}</b>
                  {impostor && (
                    <b className={caught ? 'caught' : 'free'}>{caught ? 'PEGO' : 'ESCAPOU'}</b>
                  )}
                  <span>
                    {received} {received === 1 ? 'voto' : 'votos'}
                  </span>
                  {reveal?.votes && (
                    <span>{target ? `votou em @${name(target)}` : 'não votou'}</span>
                  )}
                </span>
              </span>
              <span className="rm-result-score">
                {(reveal?.points[id] ?? 0).toFixed(1)}
                <small className="mono">pts</small>
              </span>
            </li>
          );
        })}
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

/** Decorar (cor ou dica), recriar, votar e revelar. O servidor decide o que cada um vê. */
export function ImpostorPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const round = snapshot.round!;
  const imp = snapshot.impostor ?? NO_STATE;
  const mine = snapshot.members.find((m) => m.id === me);

  return (
    <>
      {snapshot.phase === 'show' &&
        (imp.role === 'impostor' ? (
          <HintShow
            key={`show-${round.index}`}
            hint={imp.hint ?? ''}
            ms={snapshot.settings.showMs}
          />
        ) : (
          imp.color && (
            <ShowScreen
              key={`show-${round.index}`}
              color={toHex(imp.color)}
              ms={snapshot.settings.showMs}
              onDone={() => undefined}
            />
          )
        ))}
      {snapshot.phase === 'pick' &&
        (mine?.locked ? (
          <Waiting snapshot={snapshot} imp={imp} />
        ) : (
          imp.start && (
            <PickScreen
              key={`pick-${round.index}`}
              start={imp.start}
              onLock={(guess) => sendRoom('lock', guess)}
              deadline={
                round.endsAt ? { endsAt: round.endsAt, totalMs: snapshot.settings.pickMs } : null
              }
              banner={
                <>
                  <RoleBadge role={imp.role} count={imp.count} />
                  {imp.hint && <Hint text={imp.hint} />}
                </>
              }
            />
          )
        ))}
      {snapshot.phase === 'vote' && (
        <Vote key={`vote-${round.index}`} snapshot={snapshot} imp={imp} />
      )}
      {snapshot.phase === 'reveal' && (
        <Reveal key={`reveal-${round.index}`} snapshot={snapshot} imp={imp} />
      )}
    </>
  );
}
