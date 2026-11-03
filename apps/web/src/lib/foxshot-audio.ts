import { audioKit } from './sfx';

/**
 * Sons do Fox Shot! sintetizados em Web Audio (tiros, recarga, acertos, passos), respeitando o mudo do `sfx`. São um começo:
 * o caminho para soar de verdade é trocar por gravações que combinem com o jogo (spec 056), e aqui só muda a fonte do som.
 */
const phone = (): boolean => {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};

let bus: { ctx: AudioContext; node: AudioNode } | null = null;
let noiseBuf: { ctx: AudioContext; buf: AudioBuffer } | null = null;

function busFor(kit: NonNullable<ReturnType<typeof audioKit>>): AudioNode {
  if (!bus || bus.ctx !== kit.ctx) {
    const small = phone();
    const comp = kit.ctx.createDynamicsCompressor();
    comp.threshold.value = small ? -22 : -12;
    comp.knee.value = 20;
    comp.ratio.value = small ? 10 : 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.15;
    if (small) {
      const hp = kit.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 120;
      const lp = kit.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 7000;
      const level = kit.ctx.createGain();
      level.gain.value = 0.6;
      hp.connect(lp).connect(comp).connect(level).connect(kit.out);
      bus = { ctx: kit.ctx, node: hp };
    } else {
      comp.connect(kit.out);
      bus = { ctx: kit.ctx, node: comp };
    }
  }
  return bus.node;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuf || noiseBuf.ctx !== ctx) {
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = { ctx, buf };
  }
  return noiseBuf.buf;
}

/** Rajada de ruído filtrada, com ataque rápido e queda exponencial. */
function burst(opts: {
  type: BiquadFilterType;
  freq: number;
  q?: number;
  dur: number;
  peak: number;
  delay?: number;
  freqEnd?: number;
}) {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  const { ctx } = kit;
  const t = ctx.currentTime + (opts.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = opts.type;
  f.frequency.setValueAtTime(opts.freq, t);
  if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + opts.dur);
  f.Q.value = opts.q ?? 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.002 + opts.dur);
  src.connect(f).connect(g).connect(busFor(kit));
  src.start(t, Math.random() * 0.5);
  src.stop(t + opts.dur + 0.05);
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0) {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  const { ctx } = kit;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = phone() && (type === 'square' || type === 'sawtooth') ? 'triangle' : type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.003 + dur);
  o.connect(g).connect(busFor(kit));
  o.start(t);
  o.stop(t + dur + 0.05);
}

const jit = (v: number, k = 0.06) => v * (1 + (Math.random() * 2 - 1) * k);

export const fsAudio = {
  /** Tiro de cada arma. */
  shot(id: 'ak' | 'pistol' | 'sniper' | 'knife') {
    if (id === 'knife') {
      burst({ type: 'bandpass', freq: jit(2800), q: 1.2, dur: 0.12, peak: 0.16 });
      return;
    }
    if (id === 'ak') {
      burst({ type: 'bandpass', freq: jit(1900), q: 0.7, dur: 0.11, peak: 0.55 });
      burst({ type: 'highpass', freq: 4500, dur: 0.02, peak: 0.35 });
      tone('sine', jit(135), 42, 0.13, 0.7);
      burst({ type: 'lowpass', freq: 600, dur: 0.22, peak: 0.12, delay: 0.03 });
    } else if (id === 'pistol') {
      // silenciada: seca e abafada, com o clique do ferrolho logo depois
      burst({ type: 'lowpass', freq: jit(1500), q: 0.6, dur: 0.07, peak: 0.32 });
      tone('sine', jit(105), 55, 0.09, 0.3);
      burst({ type: 'bandpass', freq: 2600, q: 2, dur: 0.012, peak: 0.16, delay: 0.045 });
    } else {
      burst({ type: 'bandpass', freq: jit(1100), q: 0.6, dur: 0.2, peak: 0.8 });
      burst({ type: 'highpass', freq: 5000, dur: 0.03, peak: 0.45 });
      tone('sine', 80, 28, 0.45, 0.95);
      burst({ type: 'lowpass', freq: 520, dur: 0.7, peak: 0.2, delay: 0.06 });
    }
  },
  dry() {
    // gatilho vazio: clique seco e audível
    burst({ type: 'bandpass', freq: 2600, q: 2.5, dur: 0.018, peak: 0.4 });
    tone('square', 320, 220, 0.03, 0.12, 0.004);
  },
  /** Acabou a munição: dois cliques descendo, depois do último tiro. */
  empty() {
    burst({ type: 'bandpass', freq: 3000, q: 3, dur: 0.014, peak: 0.28, delay: 0.14 });
    tone('triangle', 520, 380, 0.05, 0.2, 0.16);
    burst({ type: 'bandpass', freq: 2200, q: 3, dur: 0.014, peak: 0.24, delay: 0.26 });
    tone('triangle', 380, 260, 0.06, 0.18, 0.28);
  },
  /** Fases da recarga: tirar o carregador, colocar, puxar o ferrolho. */
  magOut() {
    burst({ type: 'bandpass', freq: 2200, q: 2, dur: 0.02, peak: 0.2 });
    tone('triangle', 260, 180, 0.05, 0.14, 0.01);
  },
  magIn() {
    tone('triangle', 200, 140, 0.07, 0.22);
    burst({ type: 'bandpass', freq: 1800, q: 2, dur: 0.025, peak: 0.22, delay: 0.015 });
  },
  bolt() {
    burst({ type: 'bandpass', freq: 3400, q: 3, dur: 0.018, peak: 0.2 });
    burst({ type: 'bandpass', freq: 2200, q: 3, dur: 0.02, peak: 0.2, delay: 0.09 });
    tone('triangle', 420, 300, 0.04, 0.1, 0.09);
  },
  draw() {
    burst({ type: 'lowpass', freq: 1400, q: 0.5, dur: 0.07, peak: 0.12 });
  },
  /** Marcador de acerto: corpo, cabeça e abate. */
  hit(kind: 'body' | 'head' | 'kill' | 'armor') {
    if (kind === 'head') {
      tone('sine', 1750, 1750, 0.09, 0.28);
      tone('sine', 2650, 2650, 0.07, 0.14, 0.01);
    } else if (kind === 'kill') {
      tone('sine', 1100, 1100, 0.14, 0.26);
      tone('sine', 1650, 1650, 0.14, 0.18, 0.05);
      tone('sine', 90, 60, 0.18, 0.4);
    } else if (kind === 'armor') {
      tone('square', 520, 480, 0.04, 0.14);
      burst({ type: 'bandpass', freq: 2400, q: 3, dur: 0.02, peak: 0.12 });
    } else {
      tone('square', 880, 800, 0.03, 0.16);
    }
  },
  impact() {
    burst({ type: 'bandpass', freq: 1700, q: 1, dur: 0.05, peak: 0.12 });
  },
  /** Faca acertando alguém. */
  stab() {
    burst({ type: 'bandpass', freq: 900, q: 1.5, dur: 0.06, peak: 0.3 });
    tone('sine', 180, 90, 0.08, 0.3);
  },
  step() {
    burst({ type: 'lowpass', freq: jit(420, 0.15), q: 0.8, dur: 0.045, peak: 0.07 });
  },
  jump() {
    burst({ type: 'lowpass', freq: 500, dur: 0.06, peak: 0.1 });
  },
};
