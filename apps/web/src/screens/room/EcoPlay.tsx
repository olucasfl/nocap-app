import { useEffect, useRef, useState } from 'react';
import { ECO_PAUSE_MS, ECO_TAP_TIMEOUT_MS, ecoPresets, type EcoMode } from '@nocap/games';
import { Countdown } from '@/components/Countdown';
import { EcoBoard } from '@/games/eco/EcoBoard';
import '@/games/eco/eco.css';
import { useAuth } from '@/lib/auth';
import { sendRoom, type RoomSnapshot } from '@/lib/rooms';
import { buzz, sfx } from '@/lib/sfx';

/** Quanto do ritmo de cada passo o botão fica aceso (igual ao modo solo). */
const LIT_SHARE = 0.64;

type Status = 'observe' | 'input' | 'waiting' | 'out' | 'wrong';

const LABEL: Record<Status, string> = {
  observe: 'OBSERVE',
  input: 'SUA VEZ',
  waiting: 'ISSO! ESPERE',
  out: 'VOCÊ CAIU',
  wrong: 'ERROU',
};

function Reveal({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const eco = snapshot.eco!;
  const results = snapshot.round?.results ?? [];
  const name = (id: string) => snapshot.members.find((m) => m.id === id)?.username ?? '?';
  const played = results.filter((r) => eco.participants.includes(r.id));
  return (
    <section className="screen rm">
      <h1>Rodada {eco.round}</h1>
      <p className="lead">
        {eco.alive.length === 1
          ? `Sobrou @${name(eco.alive[0]!)}.`
          : eco.alive.length === 0
            ? 'Todo mundo caiu junto.'
            : `${eco.alive.length} seguem na disputa.`}
      </p>
      <ul className="rm-results">
        {played.map((r) => {
          const passed = r.score === 1;
          return (
            <li key={r.id} className={`rm-result${r.id === me ? ' me' : ''}`}>
              <span className="mono rm-time">
                {passed ? 'PASSOU' : `CAIU NO ${Number(r.answer ?? 0) + 1}º TOQUE`}
              </span>
              <span className="rm-result-name">@{name(r.id)}</span>
              <span className="rm-result-score">{passed ? eco.length : '-'}</span>
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
  const preset = ecoPresets[snapshot.mode as EcoMode];
  const mine = snapshot.members.find((m) => m.id === me);
  const playing = !!me && eco.participants.includes(me) && eco.alive.includes(me);
  const [lit, setLit] = useState<number | null>(null);
  const [bad, setBad] = useState<number | null>(null);
  const [done, setDone] = useState(0);
  const timers = useRef<number[]>([]);
  const wrongRef = useRef(false);

  // Cada rodada toca a sequência uma vez, a partir do instante em que o aviso chega.
  const sequence = eco.sequence;
  useEffect(() => {
    setDone(0);
    setBad(null);
    wrongRef.current = false;
    if (snapshot.phase !== 'show' || !sequence) return;
    const on = Math.round(eco.stepMs * LIT_SHARE);
    sequence.forEach((pad, k) => {
      const at = ECO_PAUSE_MS + k * eco.stepMs;
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
    };
    // Uma vez por rodada (o `round` muda a cada rodada nova).
  }, [eco.round, snapshot.phase === 'show']);

  const tap = (pad: number) => {
    if (snapshot.phase !== 'play' || !playing || wrongRef.current || mine?.locked) return;
    const seq = sequence ?? [];
    const want = (preset.reverse ? [...seq].reverse() : seq)[done];
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

  if (snapshot.phase === 'reveal') return <Reveal key={`r-${eco.round}`} snapshot={snapshot} />;

  const status: Status =
    snapshot.phase === 'show'
      ? 'observe'
      : !playing
        ? 'out'
        : wrongRef.current
          ? 'wrong'
          : mine?.locked
            ? 'waiting'
            : 'input';
  const sub =
    status === 'out'
      ? `PLATEIA · ${eco.alive.length} NA DISPUTA`
      : status === 'observe'
        ? `${eco.length} ${eco.length === 1 ? 'PASSO' : 'PASSOS'} · ${eco.alive.length} NA DISPUTA`
        : preset.reverse
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
