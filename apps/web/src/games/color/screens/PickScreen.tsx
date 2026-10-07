import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Hsb } from '@nocap/games';
import { sfx } from '@/lib/sfx';
import { toHex } from '../hex';

type Channel = 'h' | 's' | 'b';

const CHANNELS: { id: Channel; label: string; max: number; tickEvery: number }[] = [
  { id: 'h', label: 'MATIZ', max: 360, tickEvery: 12 },
  { id: 's', label: 'SATURAÇÃO', max: 100, tickEvery: 4 },
  { id: 'b', label: 'BRILHO', max: 100, tickEvery: 4 },
];

const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360];

/** Faixa de cada slider mostra o que acontece ao arrastar (as outras duas variáveis fixas). */
function track(id: Channel, g: Hsb): string {
  if (id === 'h') {
    return `linear-gradient(90deg,${HUE_STOPS.map((h) => toHex({ ...g, h })).join(',')})`;
  }
  if (id === 's') {
    return `linear-gradient(90deg,${toHex({ ...g, s: 0 })},${toHex({ ...g, s: 100 })})`;
  }
  return `linear-gradient(90deg,#000,${toHex({ ...g, b: 100 })})`;
}

interface Props {
  onLock: (guess: Hsb) => void;
  /** Às cegas: a prévia da cor que você monta fica escondida. */
  blind?: boolean;
  /** Cor em que os controles começam (nunca perto do alvo; ver `generateColorStart`). */
  start: Hsb;
}

export function PickScreen({ onLock, blind = false, start }: Props) {
  const [guess, setGuess] = useState<Hsb>(start);
  const lastBucket = useRef<Partial<Record<Channel, number>>>({});
  const latest = useRef(guess);
  latest.current = guess;

  const set = (id: Channel, value: number, tickEvery: number) => {
    const bucket = Math.floor(value / tickEvery);
    if (lastBucket.current[id] !== bucket) {
      lastBucket.current[id] = bucket;
      sfx.slide();
    }
    setGuess((g) => ({ ...g, [id]: value }));
  };

  // Enter crava (se o foco já estiver num botão, o próprio botão cuida).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        onLock(latest.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLock]);

  return (
    <section className="screen">
      {blind ? (
        <div className="cg-preview cg-blind" aria-label="Às cegas: a prévia está escondida">
          <div className="tag">ÀS CEGAS</div>
        </div>
      ) : (
        <div className="cg-preview" style={{ background: toHex(guess) }}>
          <div className="tag">SUA COR</div>
        </div>
      )}
      <div className="cg-sliders">
        {CHANNELS.map(({ id, label, max, tickEvery }) => (
          <div className="cg-sl" key={id}>
            <label htmlFor={`cg-${id}`}>
              <span>{label}</span>
              <span>{id === 'h' ? `${guess.h}°` : guess[id]}</span>
            </label>
            <input
              id={`cg-${id}`}
              type="range"
              min={0}
              max={max}
              value={guess[id]}
              style={{ '--track': track(id, guess) } as CSSProperties}
              onChange={(e) => set(id, Number(e.target.value), tickEvery)}
            />
          </div>
        ))}
      </div>
      <button type="button" className="btn alt" onClick={() => onLock(guess)}>
        Cravar
      </button>
    </section>
  );
}
