import { audioKit } from './sfx';

/**
 * Sons do Desmorona!, sintetizados em Web Audio como os do Aperta! (sem arquivos), respeitando o mudo do `sfx`. Um
 * compressor no meio evita estouro quando muitos ladrilhos quebram juntos.
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
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.004 + dur);
  src.connect(fl).connect(g).connect(busFor(kit));
  src.start(t);
  src.stop(t + dur + 0.05);
}

let lastStep = 0;
let lastBreak = 0;

export const dsmSfx = {
  /** contagem: 3, 2, 1 */
  count(n: number) {
    tone('triangle', n === 0 ? 880 : 520, n === 0 ? 880 : 520, n === 0 ? 0.32 : 0.12, 0.2);
  },
  /** pulo da sua raposa */
  jump() {
    tone('sine', 300, 620, 0.12, 0.2);
  },
  /** pousou */
  land(strong = false) {
    tone('sine', 150, 60, 0.12, strong ? 0.5 : 0.3);
    noise(900, 300, 0.7, 0.05, strong ? 0.25 : 0.14);
  },
  /** seu passo num ladrilho novo (bem baixo, para não cansar) */
  step() {
    const now = performance.now();
    if (now - lastStep < 90) return;
    lastStep = now;
    tone('triangle', 420, 300, 0.05, 0.05);
  },
  /** um ladrilho perto de você quebrou */
  crumble(near: number) {
    const now = performance.now();
    // calmo: um farfalhar grave e curto, bem baixo, no máximo de tempos em tempos (muitos ladrilhos juntos não viram ruído)
    if (now - lastBreak < 140) return;
    lastBreak = now;
    const v = 0.012 + 0.05 * near;
    noise(650, 180, 0.5, 0.2, v, 0, 'lowpass');
    tone('sine', 95, 60, 0.16, v * 0.9);
  },
  /** você caiu para a camada de baixo */
  airJump(you = true) {
    tone('sine', 420, 1100, 0.16, you ? 0.36 : 0.16);
    tone('triangle', 640, 1500, 0.12, you ? 0.22 : 0.1, 0.05);
    noise(3200, 7000, 2, 0.09, you ? 0.12 : 0.05, 0.02, 'highpass');
  },
  bump(strong = true) {
    noise(260, 90, 1.2, 0.12, strong ? 0.5 : 0.28);
    tone('triangle', strong ? 190 : 260, 80, 0.14, strong ? 0.4 : 0.22);
  },
  fall() {
    noise(1800, 220, 0.7, 0.42, 0.2);
  },
  /** onda chegando: estrondo */
  wave() {
    noise(120, 700, 0.6, 0.6, 0.3);
    tone('sawtooth', 70, 110, 0.5, 0.08);
  },
  /** alguém foi eliminado */
  dead(you: boolean) {
    if (you) {
      tone('sine', 360, 70, 0.7, 0.45);
      noise(600, 90, 0.6, 0.5, 0.25);
    } else {
      tone('triangle', 520, 260, 0.2, 0.12);
    }
  },
  /** fim da partida */
  win(you: boolean) {
    const notes = you ? [523, 659, 784, 1047, 1319] : [392, 330, 262];
    notes.forEach((f, i) => tone('triangle', f, f, 0.2, 0.22, 0.1 * i));
  },
};
