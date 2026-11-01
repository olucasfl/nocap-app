import { audioKit } from './sfx';

/**
 * Sons do Ping Fox!, sintetizados em Web Audio como os do Desmorona! (sem arquivos), respeitando o mudo do `sfx`.
 * A batida da raquete e o quique são os sons que mais se repetem: curtos, secos e com o tom subindo com a velocidade.
 */
let bus: { ctx: AudioContext; node: AudioNode } | null = null;
function busFor(kit: NonNullable<ReturnType<typeof audioKit>>): AudioNode {
  if (!bus || bus.ctx !== kit.ctx) {
    const comp = kit.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    comp.release.value = 0.12;
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
  g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.003 + dur);
  o.connect(g).connect(busFor(kit));
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(
  f0: number,
  f1: number,
  q: number,
  dur: number,
  peak: number,
  delay = 0,
  type: BiquadFilterType = 'bandpass',
) {
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
  g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.003 + dur);
  src.connect(fl).connect(g).connect(busFor(kit));
  src.start(t);
  src.stop(t + dur + 0.05);
}

export const pingSfx = {
  /** contagem do começo */
  count(n: number) {
    tone('triangle', n === 0 ? 880 : 520, n === 0 ? 880 : 520, n === 0 ? 0.3 : 0.12, 0.2);
  },
  /** a bola sobe na mão de quem saca */
  toss() {
    tone('sine', 380, 760, 0.1, 0.12);
  },
  /** a raquete bate na bola: `power` de 0 (fraca) a 1 (forte); `mine` = sua batida (mais cheia) */
  hit(power: number, smash: boolean, mine: boolean) {
    const p = Math.max(0, Math.min(1, power));
    const base = 820 + p * 520;
    tone('square', base, base * 0.55, 0.045, (mine ? 0.2 : 0.14) + p * 0.08);
    noise(2600, 1500, 0.9, 0.04, 0.16 + p * 0.1);
    if (smash) {
      tone('sawtooth', 240, 70, 0.14, 0.26);
      noise(900, 220, 0.6, 0.16, 0.22, 0.01, 'lowpass');
    }
  },
  /** a bola quica no tampo */
  bounce(impact: number) {
    const v = Math.max(0.05, Math.min(0.3, impact * 0.05));
    tone('sine', 520, 340, 0.05, v);
    noise(1800, 900, 1.2, 0.025, v * 0.8);
  },
  /** a bola bate na rede */
  net() {
    noise(380, 180, 0.8, 0.12, 0.2, 0, 'lowpass');
    tone('triangle', 200, 120, 0.1, 0.1);
  },
  /** falta de saque */
  fault() {
    tone('square', 220, 150, 0.16, 0.14);
    tone('square', 180, 120, 0.18, 0.14, 0.12);
  },
  /** ponto (para você ou para o outro) */
  point(won: boolean) {
    if (won) {
      tone('triangle', 520, 520, 0.09, 0.18);
      tone('triangle', 780, 780, 0.16, 0.2, 0.09);
    } else {
      tone('triangle', 320, 240, 0.22, 0.16);
    }
  },
  /** fim da partida */
  win(won: boolean) {
    const notes = won ? [523, 659, 784, 1046] : [392, 330, 262];
    notes.forEach((f, i) => tone('triangle', f, f, 0.22, 0.2, i * 0.13));
  },
};
