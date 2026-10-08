import { useEffect, useRef, useState } from 'react';
import { TAP_MIN_GAP_MS } from '@nocap/games';
import { Countdown } from '@/components/Countdown';
import { toHex } from '@/games/color/hex';
import { PickScreen } from '@/games/color/screens/PickScreen';
import { ShowScreen } from '@/games/color/screens/ShowScreen';
import '@/games/color/color.css';
import { useAuth } from '@/lib/auth';
import { sendRoom, serverNow, toLocal, type PartySnapshot, type RoomSnapshot } from '@/lib/rooms';
import { buzz, sfx } from '@/lib/sfx';
import { Stage } from './Stage';
import './party.css';

const nameOf = (s: RoomSnapshot, id: string) => s.members.find((m) => m.id === id)?.username ?? '?';

/** Onde estamos: rodada, desafio e os meus pontos. Fica fora do palco para não piscar nas trocas. */
function Hud({ p }: { p: PartySnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const perRound = Math.round(p.count / Math.max(1, p.rounds));
  const inRound = (p.index % perRound) + 1;
  return (
    <div className="phud mono" aria-label="Andamento da partida">
      <span>
        RODADA {p.round}/{p.rounds} ·{' '}
        {inRound === perRound ? 'GRANDE' : `DESAFIO ${inRound}/${perRound - 1}`}
      </span>
      <b>{(p.totals[me ?? ''] ?? 0).toLocaleString('pt-BR')} PTS</b>
    </div>
  );
}

function CommandBar({ text }: { text: string }) {
  return (
    <div className="pcmd" role="status">
      <span className="mono">COMANDO</span>
      <b>{text}</b>
    </div>
  );
}

function Intro({ p }: { p: PartySnapshot }) {
  return (
    <div className="pbig">
      <div>
        <h1>NO CAP!</h1>
        <p className="mono">
          {p.rounds} {p.rounds === 1 ? 'RODADA' : 'RODADAS'} · 5 DESAFIOS + 1 MINIJOGO GRANDE
        </p>
        <p className="mono">LEIA O COMANDO COM ATENÇÃO. NEM TUDO É O QUE PARECE.</p>
      </div>
    </div>
  );
}

/** Mesmíssima: preparar, ver o alvo, recriar a cor e travar. Os tempos vêm do relógio do servidor. */
function MicroColor({ snapshot, p }: { snapshot: RoomSnapshot; p: PartySnapshot }) {
  const times = p.times!;
  const challenge = p.challenge!;
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), 100);
    return () => window.clearInterval(id);
  }, []);
  const command = p.command ?? '';
  const connected = snapshot.members.filter((m) => m.connected).length;

  if (now < times.showAt) {
    return (
      <>
        <CommandBar text={command} />
        <div className="pbig">
          <b>PREPARE</b>
        </div>
      </>
    );
  }
  if (now < times.pickAt) {
    return (
      <>
        <CommandBar text={command} />
        <ShowScreen
          color={toHex(challenge.target)}
          ms={challenge.showMs}
          onDone={() => undefined}
        />
      </>
    );
  }
  if (p.mine) {
    return (
      <>
        <CommandBar text={command} />
        <div className="pbig">
          <div>
            <b>TRAVADO</b>
            <p className="mono">
              ESPERANDO OS OUTROS: {p.submitted?.length ?? 0} DE {connected}
            </p>
          </div>
        </div>
      </>
    );
  }
  return (
    <PickScreen
      blind={challenge.blind}
      start={challenge.start}
      banner={<CommandBar text={command} />}
      onLock={(guess) => sendRoom('submit', { color: guess })}
      deadline={{ endsAt: toLocal(times.endsAt), totalMs: times.endsAt - times.pickAt }}
    />
  );
}

/** Pontos de cada um depois do desafio: os 5 primeiros e a minha linha. */
function Ranking({ snapshot, p }: { snapshot: RoomSnapshot; p: PartySnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const sorted = Object.entries(p.totals).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5);
  const mineIndex = sorted.findIndex(([id]) => id === me);
  const rows = mineIndex >= 5 ? [...top, sorted[mineIndex]!] : top;
  const max = Math.max(1, ...sorted.map(([, v]) => Math.abs(v)));
  return (
    <>
      <h2 className="mono" style={{ margin: 0 }}>
        PLACAR
      </h2>
      <ol className="prank">
        {rows.map(([id, total]) => {
          const pos = sorted.findIndex(([x]) => x === id) + 1;
          const delta = p.delta?.[id] ?? 0;
          return (
            <li key={id} className={id === me ? 'me' : ''}>
              <i
                className="prank-bar"
                style={{ transform: `scaleX(${Math.max(0, total) / max})` }}
              />
              <span className="mono prank-pos">{pos}º</span>
              <span className="prank-name">@{nameOf(snapshot, id)}</span>
              <span className="mono prank-pts">
                {total.toLocaleString('pt-BR')}
                <small className={delta >= 0 ? 'up' : 'down'}>
                  {delta >= 0 ? '+' : ''}
                  {delta.toLocaleString('pt-BR')}
                </small>
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** Tutorial do minijogo grande: regras, "pronto" de cada um e início automático. */
function Tutorial({ snapshot, p }: { snapshot: RoomSnapshot; p: PartySnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const isHost = snapshot.hostId === me;
  const connected = snapshot.members.filter((m) => m.connected);
  return (
    <>
      <div className="pbig">
        <div>
          <h1>TOQUE TOQUE</h1>
          <p className="mono">MINIJOGO GRANDE · VALE O DOBRO</p>
        </div>
      </div>
      <CommandBar text={`${p.command ?? ''}. Você tem 10 segundos.`} />
      <p className="mono rm-hint">
        Prontos: {p.ready?.length ?? 0} de {connected.length}. Começa quando todos estiverem prontos
        ou quando o tempo abaixo acabar.
      </p>
      {p.autoStartAt && (
        <Countdown
          endsAt={toLocal(p.autoStartAt)}
          totalMs={20_000}
          warnMs={5000}
          label="PARA COMEÇAR"
        />
      )}
      <div className="stack">
        <button
          type="button"
          className={p.mine ? 'btn ghost' : 'btn alt'}
          data-sfx="toggle"
          disabled={p.mine}
          onClick={() => sendRoom('tready')}
        >
          {p.mine ? 'Você está pronto' : 'Pronto'}
        </button>
        {isHost && (
          <button
            type="button"
            className="btn ghost"
            data-sfx="start"
            onClick={() => sendRoom('begin')}
          >
            Começar agora
          </button>
        )}
      </div>
    </>
  );
}

/** Toque Toque: cada toque conta, e o servidor confere o ritmo. */
function BigTap({ p }: { p: PartySnapshot }) {
  const times = p.times!;
  const [now, setNow] = useState(serverNow());
  const [count, setCount] = useState(0);
  const last = useRef(0);
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), 100);
    return () => window.clearInterval(id);
  }, []);
  const live = now >= times.showAt && now <= times.endsAt;

  const tap = () => {
    const t = Date.now();
    if (!live || t - last.current < TAP_MIN_GAP_MS) return;
    last.current = t;
    setCount((c) => c + 1);
    sendRoom('tap');
    sfx.ecoPad(count % 4, 80);
    buzz(6);
  };

  return (
    <>
      <CommandBar text={p.command ?? ''} />
      {now >= times.showAt && (
        <Countdown
          endsAt={toLocal(times.endsAt)}
          totalMs={times.endsAt - times.showAt}
          warnMs={3000}
          decimals
          label="PARA TERMINAR"
        />
      )}
      <div className="ptap-count" aria-live="off">
        {count}
      </div>
      <button
        type="button"
        className="ptap"
        disabled={!live}
        onPointerDown={(e) => (e.preventDefault(), tap())}
      >
        {now < times.showAt ? 'PREPARE' : live ? 'TOQUE!' : 'FIM'}
      </button>
    </>
  );
}

/** O NoCap! na sala: escolhe a tela pela fase e deixa o palco cuidar das transições. */
export function PartyPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  const p = snapshot.party;
  if (!p) return null;
  const key = `${snapshot.phase}-${p.index}`;
  let screen;
  switch (snapshot.phase) {
    case 'intro':
      screen = <Intro p={p} />;
      break;
    case 'micro':
      screen = <MicroColor snapshot={snapshot} p={p} />;
      break;
    case 'ranking':
      screen = <Ranking snapshot={snapshot} p={p} />;
      break;
    case 'tutorial':
      screen = <Tutorial snapshot={snapshot} p={p} />;
      break;
    case 'big':
      screen = <BigTap p={p} />;
      break;
    default:
      screen = null;
  }
  return (
    <section className="screen party">
      {snapshot.phase !== 'intro' && <Hud p={p} />}
      <Stage stageKey={key}>{screen}</Stage>
    </section>
  );
}
