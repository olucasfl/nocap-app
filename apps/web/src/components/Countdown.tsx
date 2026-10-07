import { useEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/sfx';
import './countdown.css';

interface Props {
  /** O instante em que o tempo acaba (relógio do `Date.now()`). */
  endsAt: number;
  /** A duração total, para a barra. */
  totalMs: number;
  /** Abaixo disto o contador vira alerta: laranja e pulsando. */
  warnMs?: number;
  /** Mostra os décimos (para tempos curtos). */
  decimals?: boolean;
  /** Frase ao lado do número ("PARA CRAVAR", "PARA TOCAR"). */
  label?: string;
  /** Tique a cada segundo que passa na zona de alerta. */
  beep?: boolean;
  /** Só o número (sem barra), para caber em telas que já têm a sua barra. */
  compact?: boolean;
}

/**
 * O tempo que falta, bem à vista: número grande, barra e, nos últimos segundos, o cartão fica
 * laranja e pulsa (e pode dar tique). Só `transform` e `opacity` se mexem. Nunca usar no Já Deu?
 * (Tempo): lá o jogador não pode ver o tempo correndo.
 */
export function Countdown({
  endsAt,
  totalMs,
  warnMs = 3000,
  decimals = false,
  label,
  beep = false,
  compact = false,
}: Props) {
  const [left, setLeft] = useState(() => Math.max(0, endsAt - Date.now()));
  const lastBeep = useRef(-1);

  useEffect(() => {
    lastBeep.current = -1;
    const tick = () => setLeft(Math.max(0, endsAt - Date.now()));
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const secs = Math.ceil(left / 1000);
  const warn = left > 0 && left <= warnMs;

  useEffect(() => {
    if (!beep || !warn || lastBeep.current === secs) return;
    lastBeep.current = secs;
    // Quanto mais perto do fim, mais agudo.
    sfx.tick(Math.max(0, 6 - secs));
  }, [beep, warn, secs]);

  return (
    <div
      className={`ctd${warn ? ' warn' : ''}${compact ? ' compact' : ''}`}
      role="timer"
      aria-label={`Faltam ${secs} segundos`}
    >
      <span className="ctd-num" aria-hidden="true">
        {decimals ? (left / 1000).toFixed(1) : secs}
        <small>s</small>
      </span>
      {!compact && (
        <span className="ctd-bar" aria-hidden="true">
          <i style={{ transform: `scaleX(${Math.min(1, left / totalMs)})` }} />
        </span>
      )}
      {label && (
        <span className="mono ctd-label" aria-hidden="true">
          {label}
        </span>
      )}
    </div>
  );
}
