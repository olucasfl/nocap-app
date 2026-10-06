import { useSyncExternalStore } from 'react';

/**
 * Sons gerados por Web Audio (zero arquivos). Receitas portadas de
 * docs/reference/prototipo-cor.html. Jogo do Tempo: nenhum som durante a contagem.
 */

const MUTE_KEY = 'nocap-mute';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function audio(): AudioContext | null {
  if (!ctx) {
    const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext ?? w.webkitAudioContext;
    if (!AC) return null;
    // Som ambiente: não interrompe a música do aparelho (iOS).
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function env(g: GainNode, t: number, a: number, d: number, peak: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0) {
  const c = audio();
  if (!c || !master || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, 0.004, dur, peak);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(
  filterType: BiquadFilterType,
  f0: number,
  f1: number,
  q: number,
  dur: number,
  peak: number,
  delay = 0,
) {
  const c = audio();
  if (!c || !master || !noiseBuf || muted) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  const fl = c.createBiquadFilter();
  const g = c.createGain();
  src.buffer = noiseBuf;
  fl.type = filterType;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, 0.003, dur, peak);
  src.connect(fl).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

export const sfx = {
  /** toque em botão */
  clack() {
    noise('bandpass', 2600, 2600, 1.2, 0.035, 0.5);
    tone('square', 190, 120, 0.03, 0.08);
  },
  /** a cor aparece */
  flip() {
    noise('bandpass', 500, 3500, 0.8, 0.28, 0.22);
  },
  /** contagem da nota, subindo de tom */
  tick(i: number) {
    tone('triangle', 520 + i * 70, 520 + i * 70, 0.035, 0.14);
  },
  /** tique do slider */
  slide() {
    tone('sine', 1100, 1100, 0.012, 0.05);
  },
  /** carimbo da nota */
  thunk() {
    tone('sine', 170, 42, 0.22, 0.9);
    noise('lowpass', 900, 300, 0.7, 0.07, 0.5);
  },
  /** nota ≥ 9.5 */
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.14, 0.22, 0.09 * i));
  },
  /** nota < 5 */
  boing() {
    tone('sine', 420, 140, 0.32, 0.35);
    tone('sine', 300, 110, 0.3, 0.12, 0.05);
  },
  /** a cor some */
  vanish() {
    tone('sine', 880, 330, 0.16, 0.18);
  },
};

/** Vibração só onde existe (Android; iOS não suporta). */
export function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* sem suporte */
  }
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* storage indisponível: vale só nesta sessão */
  }
  if (master) master.gain.value = muted ? 0 : 0.9;
  listeners.forEach((l) => l());
  sfx.clack();
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => muted,
  );
}

/** Desbloqueia o áudio no primeiro toque e dá o "clack" em todo `.btn`. */
export function installGlobalSounds() {
  document.addEventListener(
    'pointerdown',
    (e) => {
      audio();
      if (e.target instanceof Element && e.target.closest('.btn')) {
        sfx.clack();
        buzz(8);
      }
    },
    { passive: true },
  );
}
