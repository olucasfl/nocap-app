import { audioKit } from './sfx';

/**
 * Sons do Mini Golf (spec 082), sintetizados em Web Audio (sem arquivos e sem música), respeitando o mudo do `sfx`.
 * O buraco tem uma sequência própria: aro (batidas curtas), queda (tom que desce e some) e plop oco no fundo.
 */
let bus: { ctx: AudioContext; node: AudioNode } | null = null;
function busFor(kit: NonNullable<ReturnType<typeof audioKit>>): AudioNode {
  if (!bus || bus.ctx !== kit.ctx) {
    const comp = kit.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    comp.release.value = 0.2;
    comp.connect(kit.out);
    bus = { ctx: kit.ctx, node: comp };
  }
  return bus.node;
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0) {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  const { ctx } = kit;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.006 + dur);
  o.connect(g).connect(busFor(kit));
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(f0: number, f1: number, q: number, dur: number, peak: number, delay = 0, type: BiquadFilterType = 'bandpass') {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  const { ctx, noise: buf } = kit;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  const fl = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = buf;
  fl.type = type;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.004 + dur);
  src.connect(fl).connect(g).connect(busFor(kit));
  src.start(t);
  src.stop(t + dur + 0.06);
}

export const golfSfx = {
  /** Tacada: um toc seco; mais força, mais grave e mais forte. */
  hit(power: number) {
    const p = Math.max(0, Math.min(1, power));
    tone('triangle', 260 - 90 * p, 90, 0.09, 0.28 + 0.3 * p);
    noise(1800, 700, 1.2, 0.05, 0.18 + 0.2 * p);
  },
  /** Quique no chão ou na parede; `impulse` é a força do impacto. */
  bounce(impulse: number) {
    const k = Math.max(0, Math.min(1, impulse / 8));
    tone('sine', 200 + 80 * (1 - k), 90, 0.07, 0.05 + 0.18 * k);
    noise(1200, 500, 0.9, 0.04, 0.03 + 0.1 * k);
  },
  /** Bola batendo na borda do copo. */
  rim() {
    tone('square', 1500, 1250, 0.03, 0.05);
    tone('sine', 900, 700, 0.05, 0.08);
  },
  /** A bola cai no buraco: tom que desce e some. */
  drop() {
    tone('sine', 520, 120, 0.4, 0.2);
    noise(900, 200, 0.7, 0.3, 0.05, 0.02, 'lowpass');
  },
  /** Fundo do copo: plop oco e um quique miúdo. */
  plop() {
    tone('sine', 190, 70, 0.12, 0.34);
    tone('sine', 260, 110, 0.05, 0.12, 0.14);
    noise(500, 200, 0.8, 0.06, 0.06, 0, 'lowpass');
  },
  splash() {
    noise(2400, 400, 0.6, 0.45, 0.2, 0, 'bandpass');
    tone('sine', 300, 120, 0.2, 0.08);
  },
  /** Letreiro: ACE e Albatross soam mais; Bogey e pior soam tristes. */
  score(name: string) {
    const up = (notes: number[], step = 0.09, peak = 0.16) =>
      notes.forEach((f, i) => {
        tone('triangle', f, f, 0.22, peak, i * step);
        tone('sine', f * 2, f * 2, 0.16, peak * 0.4, i * step);
      });
    if (name === 'ace') up([523, 659, 784, 1047, 1319], 0.08, 0.2);
    else if (name === 'albatross') up([392, 523, 659, 784, 1047], 0.09, 0.18);
    else if (name === 'eagle') up([392, 494, 659, 784], 0.09);
    else if (name === 'birdie') up([440, 554, 659], 0.09);
    else if (name === 'par') up([392, 494], 0.1, 0.12);
    else {
      tone('sawtooth', 220, 150, 0.35, 0.09);
      tone('sawtooth', 165, 110, 0.4, 0.08, 0.18);
    }
  },
  tick() {
    tone('sine', 880, 880, 0.04, 0.05);
  },
};
