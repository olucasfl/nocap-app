import { audioKit } from './sfx';

/**
 * Sons do Fox GP, sintetizados em Web Audio (sem arquivos) e respeitando o mudo do `sfx`: o motor do próprio carro é uma
 * voz contínua que sobe com a velocidade; o resto são toques curtos (luzes, turbo, batida, volta, box).
 */
let bus: { ctx: AudioContext; node: AudioNode } | null = null;
function busFor(kit: NonNullable<ReturnType<typeof audioKit>>): AudioNode {
  if (!bus || bus.ctx !== kit.ctx) {
    const comp = kit.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 6;
    comp.release.value = 0.15;
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
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.004 + dur);
  o.connect(g).connect(busFor(kit));
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(f0: number, f1: number, q: number, dur: number, peak: number, delay = 0) {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  const { ctx, noise: buf } = kit;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  const fl = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = buf;
  fl.type = 'bandpass';
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.004 + dur);
  src.connect(fl).connect(g).connect(busFor(kit));
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** O ronco do motor: duas ondas desafinadas num filtro, seguindo a rotação. */
class Engine {
  private nodes: { ctx: AudioContext; a: OscillatorNode; b: OscillatorNode; f: BiquadFilterNode; g: GainNode } | null =
    null;

  start() {
    const kit = audioKit();
    if (!kit || this.nodes) return;
    const { ctx } = kit;
    const a = ctx.createOscillator();
    const b = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    a.type = 'sawtooth';
    b.type = 'square';
    a.frequency.value = 55;
    b.frequency.value = 56.5;
    f.type = 'lowpass';
    f.frequency.value = 500;
    f.Q.value = 2;
    g.gain.value = 0.0001;
    a.connect(f);
    b.connect(f);
    f.connect(g).connect(busFor(kit));
    a.start();
    b.start();
    this.nodes = { ctx, a, b, f, g };
  }

  /** `rpm` de 0 a 1 (a marcha faz o serrote: sobe e cai a cada troca), `load` de 0 a 1 (acelerando). */
  update(rpm: number, load: number, turbo: boolean) {
    const kit = audioKit();
    const n = this.nodes;
    if (!n) return;
    const t = n.ctx.currentTime;
    const freq = 55 + rpm * 150 + (turbo ? 25 : 0);
    n.a.frequency.setTargetAtTime(freq, t, 0.04);
    n.b.frequency.setTargetAtTime(freq * 1.012, t, 0.04);
    n.f.frequency.setTargetAtTime(380 + rpm * 1500 + load * 500, t, 0.05);
    const vol = kit && !kit.muted() ? 0.03 + load * 0.035 + rpm * 0.02 : 0.0001;
    n.g.gain.setTargetAtTime(vol, t, 0.06);
  }

  stop() {
    const n = this.nodes;
    if (!n) return;
    this.nodes = null;
    const t = n.ctx.currentTime;
    n.g.gain.setTargetAtTime(0.0001, t, 0.05);
    n.a.stop(t + 0.3);
    n.b.stop(t + 0.3);
  }
}

let lastBump = 0;
let lastWall = 0;

export const gpSfx = {
  engine: new Engine(),
  /** uma luz do semáforo acendeu */
  light() {
    tone('square', 440, 440, 0.16, 0.12);
  },
  /** as luzes apagaram: valendo */
  go() {
    tone('square', 880, 880, 0.4, 0.16);
  },
  count(n: number) {
    tone('triangle', n === 0 ? 880 : 520, n === 0 ? 880 : 520, n === 0 ? 0.3 : 0.12, 0.18);
  },
  /** a barra do turbo encheu */
  ready() {
    tone('triangle', 660, 990, 0.12, 0.14);
    tone('triangle', 990, 1320, 0.12, 0.12, 0.09);
  },
  /** turbo da cauda solto */
  turbo() {
    noise(400, 3200, 1.4, 0.5, 0.3);
    tone('sawtooth', 120, 260, 0.45, 0.08);
  },
  bump(you: boolean) {
    const now = performance.now();
    if (now - lastBump < 160) return;
    lastBump = now;
    noise(300, 110, 1.1, 0.12, you ? 0.4 : 0.15);
  },
  wall() {
    const now = performance.now();
    if (now - lastWall < 300) return;
    lastWall = now;
    noise(200, 70, 0.8, 0.25, 0.45);
    tone('triangle', 140, 60, 0.2, 0.25);
  },
  /** volta completa */
  lap(best: boolean) {
    tone('triangle', 784, 784, 0.1, 0.16);
    tone('triangle', best ? 1175 : 988, best ? 1175 : 988, 0.16, 0.16, 0.1);
  },
  /** cortou caminho: volta ao último ponto */
  cut() {
    tone('square', 220, 160, 0.3, 0.14);
  },
  pitIn() {
    tone('triangle', 520, 520, 0.08, 0.14);
    noise(2600, 1200, 2, 0.4, 0.12, 0.1);
  },
  pitOut() {
    tone('triangle', 660, 990, 0.2, 0.16);
  },
  pass() {
    tone('triangle', 880, 1320, 0.14, 0.12);
  },
  /** cruzou a linha de chegada */
  finish(place: number) {
    const notes = place === 1 ? [523, 659, 784, 1047, 1319] : place <= 3 ? [523, 659, 784] : [440, 523];
    notes.forEach((f, i) => tone('triangle', f, f, 0.2, 0.2, 0.1 * i));
  },
};
