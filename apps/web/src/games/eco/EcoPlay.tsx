import { useEffect, useRef, useState } from 'react';
import {
  ECO_PAUSE_MS,
  ECO_TAP_TIMEOUT_MS,
  expectedTaps,
  lengthAt,
  maxRounds,
  padsAt,
  sequenceFor,
  stepMsAt,
} from '@nocap/games';
import { Countdown } from '@/components/Countdown';
import { buzz, sfx } from '@/lib/sfx';
import { EcoBoard } from './EcoBoard';
import type { EndReason, Run } from './types';

type Status = 'observe' | 'input' | 'right' | 'wrong' | 'timeout';

const LABEL: Record<Status, string> = {
  observe: 'OBSERVE',
  input: 'SUA VEZ',
  right: 'ISSO!',
  wrong: 'ERROU',
  timeout: 'SEM TEMPO',
};

/** Quanto do ritmo de cada passo o botão fica aceso (aceso 450 + pausa 250 em 700 ms). */
const LIT_SHARE = 0.64;
/** Pausa depois de fechar uma rodada, antes da próxima reprodução. */
const BETWEEN_MS = 700;

interface Props {
  run: Run;
  /** A partida acabou: os toques feitos (inclusive o errado) e o motivo. */
  onEnd: (taps: number[], reason: EndReason) => void;
  /** Uma rodada nova começou (o cabeçalho mostra o tamanho da sequência). */
  onRound: (round: number) => void;
}

/**
 * O laço da partida do Eco: mostra a sequência (OBSERVE), espera os toques (SUA VEZ), confere cada
 * toque e passa para a rodada seguinte. O servidor repassa os mesmos toques contra a seed, então o
 * que vale é a lista de toques que sai daqui.
 */
export function EcoPlay({ run, onEnd, onRound }: Props) {
  const s = run.settings;
  const [round, setRound] = useState(1);
  const [status, setStatus] = useState<Status>('observe');
  const [lit, setLit] = useState<number | null>(null);
  const [done, setDone] = useState(0);
  const [bad, setBad] = useState<number | null>(null);
  /** Quando acaba o tempo parado (renova a cada toque); `null` fora da sua vez. */
  const [deadline, setDeadline] = useState<number | null>(null);

  const taps = useRef<number[]>([]);
  const pos = useRef(0);
  const roundRef = useRef(1);
  const statusRef = useRef<Status>('observe');
  const expected = useRef<number[]>([]);
  const timers = useRef<number[]>([]);
  const idle = useRef(0);
  const ended = useRef(false);
  const cb = useRef({ onEnd, onRound });
  cb.current = { onEnd, onRound };

  const setSt = (v: Status) => {
    statusRef.current = v;
    setStatus(v);
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    clearTimeout(idle.current);
  };
  const finish = (reason: EndReason) => {
    if (ended.current) return;
    ended.current = true;
    clearAll();
    cb.current.onEnd([...taps.current], reason);
  };
  const armIdle = () => {
    clearTimeout(idle.current);
    setDeadline(Date.now() + ECO_TAP_TIMEOUT_MS);
    idle.current = window.setTimeout(() => {
      if (statusRef.current !== 'input') return;
      setDeadline(null);
      setSt('timeout');
      sfx.ecoWrong();
      later(() => finish('timeout'), 900);
    }, ECO_TAP_TIMEOUT_MS);
  };

  const startRound = (r: number) => {
    roundRef.current = r;
    setRound(r);
    setDone(0);
    setBad(null);
    pos.current = 0;
    expected.current = expectedTaps(run.seed, s, r);
    setSt('observe');
    setDeadline(null);
    cb.current.onRound(r);

    const seq = sequenceFor(run.seed, s, r);
    const step = stepMsAt(s, r);
    const on = Math.round(step * LIT_SHARE);
    seq.forEach((pad, k) => {
      const at = ECO_PAUSE_MS + k * step;
      later(() => {
        setLit(pad);
        sfx.ecoPad(pad, on);
      }, at);
      later(() => setLit(null), at + on);
    });
    later(
      () => {
        setSt('input');
        armIdle();
      },
      ECO_PAUSE_MS + seq.length * step,
    );
  };

  const tap = (pad: number) => {
    if (statusRef.current !== 'input' || ended.current) return;
    clearTimeout(idle.current);
    setDeadline(null);
    taps.current.push(pad);
    const want = expected.current[pos.current]!;

    if (pad !== want) {
      setSt('wrong');
      setBad(pad);
      setLit(pad);
      sfx.ecoWrong();
      buzz(80);
      // Mostra o botão certo para a pessoa aprender onde errou.
      later(() => setLit(want), 450);
      later(() => finish('wrong'), 1700);
      return;
    }

    sfx.ecoPad(pad, 160);
    buzz(8);
    setLit(pad);
    later(() => setLit(null), 140);
    pos.current += 1;
    setDone(pos.current);

    if (pos.current < expected.current.length) {
      armIdle();
      return;
    }
    // Fechou a rodada.
    const r = roundRef.current;
    setSt('right');
    later(() => sfx.ecoRound(), 180);
    if (r >= maxRounds(s)) later(() => finish('perfect'), 900);
    else later(() => startRound(r + 1), BETWEEN_MS);
  };
  const tapRef = useRef(tap);
  tapRef.current = tap;

  useEffect(() => {
    ended.current = false;
    taps.current = [];
    startRound(1);
    return clearAll;
    // A partida começa uma vez por montagem (a Revanche monta uma tela nova).
  }, []);

  // Teclas 1 a 9 tocam os botões (computador).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= padsAt(s, roundRef.current)) {
        e.preventDefault();
        tapRef.current(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s]);

  const length = lengthAt(s, round);
  const pads = padsAt(s, round);
  const fresh = round > 1 && pads > padsAt(s, round - 1) ? pads - 1 : null;
  const sub =
    status === 'observe'
      ? `${length} ${length === 1 ? 'PASSO' : 'PASSOS'}`
      : s.reverse
        ? `DE TRÁS PARA FRENTE · ${done}/${length}`
        : `${done}/${length}`;

  return (
    <section className="screen eco-play">
      <div className="eco-hud">
        <div className={`eco-status ${status}`} aria-live="polite">
          {LABEL[status]}
        </div>
        <div className="mono eco-sub">{sub}</div>
      </div>
      {/* Parado por muito tempo a partida acaba: o contador mostra quanto falta (renova a cada toque). */}
      <div className="eco-timer">
        {status === 'input' && deadline !== null && (
          <Countdown
            key={deadline}
            endsAt={deadline}
            totalMs={ECO_TAP_TIMEOUT_MS}
            warnMs={3000}
            beep
            label="PARA TOCAR"
          />
        )}
      </div>
      <EcoBoard
        pads={pads}
        lit={lit}
        bad={bad}
        fresh={status === 'observe' ? fresh : null}
        interactive={status === 'input'}
        onTap={(p) => tapRef.current(p)}
      />
      <div className="eco-dots" aria-hidden="true">
        {Array.from({ length }, (_, i) => (
          <i key={i} className={i < done ? 'on' : ''} />
        ))}
      </div>
    </section>
  );
}
