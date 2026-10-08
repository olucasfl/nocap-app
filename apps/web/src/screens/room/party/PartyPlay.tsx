import { toHex } from '@/games/color/hex';
import { useAuth } from '@/lib/auth';
import { sendRoom, type PartySnapshot, type RoomSnapshot } from '@/lib/rooms';
import { BigShapes, BigX1 } from './Big';
import { MicroColor, MicroEco, MicroTime, MicroTyping } from './Micro';
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

/** 12345 ms vira "12,3s". */
const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')}s`;

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
      {p.reveal && (
        <div className="preveal" aria-label="A cor alvo">
          <i style={{ background: toHex(p.reveal.target) }} />
          <span className="mono">ALVO {toHex(p.reveal.target)}</span>
        </div>
      )}
      {p.typingReveal && (
        <div className="preveal ptype" aria-label="O texto certo">
          <span className="mono">
            {p.typingReveal.expected === null
              ? 'ERA A MÃO BOBA: O CERTO ERA NÃO DIGITAR NADA'
              : `${p.typingReveal.kind === 'frase' ? 'FRASE' : 'PALAVRA'}: ${p.typingReveal.word.toUpperCase()}`}
          </span>
          {p.typingReveal.expected !== null && <b>CERTO: {p.typingReveal.expected || '—'}</b>}
        </div>
      )}
      {p.timeReveal && (
        <div className="preveal ptime" aria-label="O tempo certo">
          <span className="mono">
            TEMPO CERTO <b>{seconds(p.timeReveal.expectedMs)}</b>
            {p.timeReveal.targetMs !== p.timeReveal.expectedMs &&
              ` · ALVO MOSTRADO ${seconds(p.timeReveal.targetMs)}`}
          </span>
        </div>
      )}
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
              {p.reveal && (
                <i
                  className="prank-swatch"
                  style={{
                    background: p.reveal.answers[id] ? toHex(p.reveal.answers[id]) : undefined,
                  }}
                  title={p.reveal.answers[id] ? toHex(p.reveal.answers[id]) : 'não travou'}
                />
              )}
              <span className="prank-name">@{nameOf(snapshot, id)}</span>
              {p.typingReveal && (
                <span className="mono prank-typed">
                  {p.typingReveal.answers[id] === undefined
                    ? '—'
                    : p.typingReveal.answers[id] || '(vazio)'}
                </span>
              )}
              {p.timeReveal && (
                <span className="mono prank-time">
                  {p.timeReveal.answers[id] === undefined ? '—' : seconds(p.timeReveal.answers[id])}
                </span>
              )}
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
          <h1>{p.info?.title ?? 'MINIJOGO GRANDE'}</h1>
          <p className="mono">MINIJOGO GRANDE · VALE O DOBRO</p>
        </div>
      </div>
      <ul className="ptut">
        {(p.info?.lines ?? []).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <ul className="pready" aria-label="Quem já está pronto">
        {connected.map((m) => (
          <li key={m.id} className={p.ready?.includes(m.id) ? 'on' : ''}>
            <span>@{m.username}</span>
            <span className="mono">{p.ready?.includes(m.id) ? 'PRONTO' : 'LENDO...'}</span>
          </li>
        ))}
      </ul>
      <p className="mono rm-hint">
        Leia com calma. O minijogo começa sozinho assim que todos derem OK ({p.ready?.length ?? 0}{' '}
        de {connected.length}).
      </p>
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
      screen =
        p.game === 'time' ? (
          <MicroTime snapshot={snapshot} p={p} />
        ) : p.game === 'eco' ? (
          <MicroEco snapshot={snapshot} p={p} />
        ) : p.game === 'typing' ? (
          <MicroTyping snapshot={snapshot} p={p} />
        ) : (
          <MicroColor snapshot={snapshot} p={p} />
        );
      break;
    case 'ranking':
      screen = <Ranking snapshot={snapshot} p={p} />;
      break;
    case 'tutorial':
      screen = <Tutorial snapshot={snapshot} p={p} />;
      break;
    case 'big':
      screen =
        p.game === 'x1' ? (
          <BigX1 snapshot={snapshot} p={p} />
        ) : (
          <BigShapes snapshot={snapshot} p={p} />
        );
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
