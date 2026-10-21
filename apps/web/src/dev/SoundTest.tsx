import { useState } from 'react';
import {
  apertaSfx,
  apertaVibrate,
  setVibrationEnabled,
  vibrationEnabled,
  type ApertaSfxName,
} from '@/lib/aperta-audio';
import { toggleMute, useMuted } from '@/lib/sfx';

const NAMES = Object.keys(apertaSfx).filter((n) => n !== 'clack') as ApertaSfxName[];

/** Página de teste manual dos sons do Aperta!; só existe em `pnpm dev`, em /dev/sons. */
export function SoundTest() {
  const muted = useMuted();
  const [combo, setCombo] = useState(0);
  const [vibrate, setVibrate] = useState(vibrationEnabled());

  return (
    <main style={{ padding: 24, display: 'grid', gap: 12, maxWidth: 420 }}>
      <h1>Sons do Aperta!</h1>
      <button className="btn" onClick={toggleMute}>
        {muted ? 'Som desligado (tocar para ligar)' : 'Som ligado (tocar para mudar)'}
      </button>
      <label>
        Combo: {combo}
        <input
          type="range"
          min={0}
          max={12}
          value={combo}
          onChange={(e) => setCombo(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </label>
      <button className="btn" onClick={() => apertaSfx.clack(combo)}>
        clack
      </button>
      <button
        className="btn"
        onClick={() => {
          for (let i = 0; i <= 9; i++) setTimeout(() => apertaSfx.clack(i), i * 110);
        }}
      >
        clack (escada 0 a 9)
      </button>
      {NAMES.map((n) => (
        <button key={n} className="btn" onClick={() => apertaSfx[n]()}>
          {n}
        </button>
      ))}
      <label>
        <input
          type="checkbox"
          checked={vibrate}
          onChange={(e) => {
            setVibrationEnabled(e.target.checked);
            setVibrate(e.target.checked);
          }}
        />{' '}
        Vibração
      </label>
      <button className="btn" onClick={() => apertaVibrate(40)}>
        vibrar
      </button>
    </main>
  );
}
