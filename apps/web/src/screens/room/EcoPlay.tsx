import { useEffect, useRef, useState } from 'react';
import { ECO_PAUSE_MS, ECO_TAP_TIMEOUT_MS } from '@nocap/games';
import { Countdown } from '@/components/Countdown';
import { EcoBoard } from '@/games/eco/EcoBoard';
import '@/games/eco/eco.css';
import { useAuth } from '@/lib/auth';
import { sendRoom, type RoomSnapshot } from '@/lib/rooms';
import { buzz, sfx } from '@/lib/sfx';
import { EcoLeaderCreate } from './EcoLeaderCreate';

/** Quanto do ritmo de cada passo o botão fica aceso (igual ao modo solo). */
const LIT_SHARE = 0.64;

type Status = 'observe' | 'input' | 'waiting' | 'out' | 'wrong' | 'leader' | 'wait';

const LABEL: Record<Status, string> = {
  observe: 'OBSERVE',
  input: 'SUA VEZ',
  waiting: 'ISSO! ESPERE',
  out: 'VOCÊ CAIU',
  wrong: 'ERROU',
  leader: 'VOCÊ CRIOU',
  wait: 'AGUARDE SUA VEZ',
};

/** Corrida por vez: como foi a vez e de quem é a próxima. */
function turnResult(snapshot: RoomSnapshot, name: (id: string) => string): string {
  const eco = snapshot.eco!;
  const who = eco.turn!;
  const passed = eco.alive.includes(who);
  const next = (eco.queue ?? []).find((id) => id !== who);
  return [
    passed ? `@${name(who)} acertou.` : `@${name(who)} errou e saiu.`,
    eco.alive.length <= 1 ? '' : next ? `Próxima vez: @${name(next)}.` : '',
  ]
    .join(' ')
    .trim();
}

function Reveal({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const eco = snapshot.eco!;
  const results = snapshot.round?.results ?? [];
  const name = (id: string) => snapshot.members.find((m) => m.id === id)?.username ?? '?';
  const played = results.filter((r) => eco.participants.includes(r.id) || r.id === eco.leader);
  return (
    <section className="screen rm">
      <h1>Rodada {eco.round}</h1>
      <p className="lead">
        {eco.turn
          ? `${turnResult(snapshot, name)}`
          : eco.leader
            ? `@${name(eco.leader)} criou a sequência.`
            : eco.alive.length === 1
              ? `Sobrou @${name(eco.alive[0]!)}.`
              : eco.alive.length === 0
                ? 'Todo mundo caiu junto.'
                : `${eco.alive.length} seguem na disputa.`}
      </p>
      <ul className="rm-results">
        {played.map((r) => {
          const isLeader = r.id === eco.leader;
          const passed = isLeader || (eco.leader ? Number(r.answer) >= eco.length : r.score === 1);
          return (
            <li key={r.id} className={`rm-result${r.id === me ? ' me' : ''}`}>
              <span className="mono rm-time">
                {isLeader
                  ? eco.timedOut
                    ? 'CRIOU (SEM TEMPO)'
                    : 'CRIOU'
                  : eco.leader
                    ? `${r.answer}/${eco.length}`
                    : passed
                      ? 'PASSOU'
                      : `CAIU NO ${Number(r.answer ?? 0) + 1}º TOQUE`}
              </span>
              <span className="rm-result-name">@{name(r.id)}</span>
              <span className="rm-result-score">
                {eco.leader ? r.score.toFixed(1) : passed ? eco.length : '-'}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mono rm-hint">A próxima rodada começa sozinha.</p>
    </section>
  );
}

/**
 * Corrida do Ecooo na sala. O servidor manda a sequência da rodada e confere cada toque; aqui só
 * se desenha: a reprodução (OBSERVE), os toques (SUA VEZ) e quem ainda está na disputa. Quem cai
 * continua vendo as rodadas como plateia.
 */
export function EcoRoomPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const eco = snapshot.eco!;
  const mine = snapshot.members.find((m) => m.id === me);
  const playing = !!me && eco.participants.includes(me) && eco.alive.includes(me);
  const [lit, setLit] = useState<number | null>(null);
  const [bad, setBad] = useState<number | null>(null);
  const [done, setDone] = useState(0);
  const timers = useRef<number[]>([]);
  const wrongRef = useRef(false);
  /** "VEZ DE FULANO" na tela de todos antes da sequência tocar. */
  const [announce, setAnnounce] = useState(false);

  // Cada rodada toca a sequência uma vez, a partir do instante em que o aviso chega.
  const sequence = eco.sequence;
  useEffect(() => {
    setDone(0);
    setBad(null);
    wrongRef.current = false;
    if (snapshot.phase !== 'show' || !sequence) return;
    const wait = eco.announceMs ?? 0;
    if (wait > 0) {
      setAnnounce(true);
      timers.current.push(window.setTimeout(() => setAnnounce(false), wait));
    }
    const on = Math.round(eco.stepMs * LIT_SHARE);
    sequence.forEach((pad, k) => {
      const at = wait + ECO_PAUSE_MS + k * eco.stepMs;
      timers.current.push(
        window.setTimeout(() => {
          setLit(pad);
          sfx.ecoPad(pad, on);
        }, at),
        window.setTimeout(() => setLit(null), at + on),
      );
    });
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setLit(null);
      setAnnounce(false);
    };
    // Uma vez por rodada (o `round` muda a cada rodada nova).
  }, [eco.round, snapshot.phase === 'show']);

  const tap = (pad: number) => {
    if (snapshot.phase !== 'play' || !playing || wrongRef.current || mine?.locked) return;
    const seq = sequence ?? [];
    const want = (eco.reverse ? [...seq].reverse() : seq)[done];
    sendRoom('tap', { pad });
    setLit(pad);
    if (pad !== want) {
      wrongRef.current = true;
      setBad(pad);
      sfx.ecoWrong();
      buzz(80);
      return;
    }
    sfx.ecoPad(pad, 160);
    buzz(8);
    window.setTimeout(() => setLit(null), 140);
    setDone(done + 1);
    if (done + 1 === eco.length) window.setTimeout(() => sfx.ecoRound(), 180);
  };
  const tapRef = useRef(tap);
  tapRef.current = tap;

  // Teclas 1 a 9 (computador).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= eco.pads) {
        e.preventDefault();
        tapRef.current(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [eco.pads]);

  if (snapshot.phase === 'create') return <EcoLeaderCreate snapshot={snapshot} />;
  if (snapshot.phase === 'reveal') return <Reveal key={`r-${eco.round}`} snapshot={snapshot} />;

  const nameOf = (id?: string | null) => snapshot.members.find((m) => m.id === id)?.username ?? '?';
  const status: Status =
    snapshot.phase === 'show'
      ? 'observe'
      : eco.leader === me
        ? 'leader'
        : !playing
          ? eco.turn && eco.alive.includes(me ?? '')
            ? 'wait'
            : 'out'
          : wrongRef.current
            ? 'wrong'
            : mine?.locked
              ? 'waiting'
              : 'input';
  const sub =
    status === 'leader'
      ? 'OS OUTROS ESTÃO REPETINDO'
      : status === 'wait'
        ? `VEZ DE @${nameOf(eco.turn)} · FILA: ${(eco.queue ?? []).map((id) => '@' + nameOf(id)).join(' > ')}`
        : status === 'out'
          ? `PLATEIA · ${eco.alive.length} NA DISPUTA`
          : status === 'observe'
            ? `${eco.length} ${eco.length === 1 ? 'PASSO' : 'PASSOS'} · ${eco.alive.length} NA DISPUTA`
            : eco.reverse
              ? `DE TRÁS PARA FRENTE · ${done}/${eco.length}`
              : `${done}/${eco.length}`;

  return (
    <section className="screen eco-play">
      <div className="eco-hud">
        <div className={`eco-status ${status === 'waiting' ? 'right' : status}`} aria-live="polite">
          {LABEL[status]}
        </div>
        <div className="mono eco-sub">{sub}</div>
      </div>
      <div className="eco-timer">
        {status === 'input' && eco.tapDeadline && (
          <Countdown
            key={eco.tapDeadline}
            endsAt={eco.tapDeadline}
            totalMs={ECO_TAP_TIMEOUT_MS}
            warnMs={3000}
            beep
            label="PARA TOCAR"
          />
        )}
      </div>
      {eco.turn && (
        <div className={`eco-turn${announce ? ' big' : ''}`} aria-live="assertive">
          {eco.turn === me ? 'É A SUA VEZ' : `VEZ DE @${nameOf(eco.turn)}`}
          {announce && (
            <small className="mono">
              {eco.turn === me
                ? 'A SEQUÊNCIA VAI TOCAR; DEPOIS REPITA TUDO'
                : 'TODO MUNDO JOGA A MESMA SEQUÊNCIA, UM DE CADA VEZ'}
            </small>
          )}
        </div>
      )}
      <EcoBoard
        pads={eco.pads}
        lit={lit}
        bad={bad}
        fresh={null}
        interactive={status === 'input'}
        onTap={(p) => tapRef.current(p)}
      />
      <div className="eco-dots" aria-hidden="true">
        {Array.from({ length: eco.length }, (_, i) => (
          <i key={i} className={i < done ? 'on' : ''} />
        ))}
      </div>
    </section>
  );
}
