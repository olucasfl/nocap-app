import { audioKit } from './sfx';

/**
 * Sons do Bola Maluca!, sintetizados em Web Audio como os do Desmorona! (sem arquivos), respeitando o mudo do `sfx`.
 * Um compressor no meio evita estouro quando muita coisa soa junta (gol com torcida, fogos e apito).
 */
let bus: { ctx: AudioContext; node: AudioNode } | null = null;
function busFor(kit: NonNullable<ReturnType<typeof audioKit>>): AudioNode {
  if (!bus || bus.ctx !== kit.ctx) {
    const comp = kit.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 6;
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

function noise(
  f0: number,
  f1: number,
  q: number,
  dur: number,
  peak: number,
  delay = 0,
  type: BiquadFilterType = 'bandpass',
  attack = 0.006,
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
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  src.connect(fl).connect(g).connect(busFor(kit));
  src.start(t);
  src.stop(t + attack + dur + 0.05);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** O quanto um som "de longe" soa: 1 perto, 0.25 no fundo do campo. */
export const bolaGain = (dist: number) => clamp(1 - dist / 55, 0.25, 1);

let lastTouch = 0;
let lastBounce = 0;
let lastWall = 0;

export const bolaSfx = {
  /** contagem: 3, 2, 1 */
  count(n: number) {
    tone('triangle', 440 + (3 - n) * 90, 440 + (3 - n) * 90, 0.14, 0.22);
  },
  /** apito de início e de retomada */
  whistle(long = false) {
    const d = long ? 0.7 : 0.38;
    tone('sine', 2850, 2950, d, 0.16);
    noise(3300, 3300, 9, d, 0.12);
    tone('sine', 2850, 2850, d * 0.8, 0.0001);
  },
  /** apito triplo do fim de jogo */
  fullTime() {
    for (let i = 0; i < 3; i++) {
      tone('sine', 2850, 2950, 0.3, 0.17, i * 0.42);
      noise(3300, 3300, 9, 0.3, 0.1, i * 0.42);
    }
  },
  /** a sua raposa pulou */
  jump(g = 1) {
    noise(500, 1300, 0.9, 0.1, 0.13 * g);
    tone('sine', 320, 560, 0.09, 0.12 * g);
  },
  /** pulo duplo; com `flip`, o mortal (um assobio mais longo) */
  airjump(flip: boolean, g = 1) {
    if (flip) {
      noise(400, 2200, 1.1, 0.26, 0.2 * g);
      tone('sawtooth', 220, 620, 0.2, 0.08 * g);
    } else {
      noise(700, 1500, 0.9, 0.12, 0.13 * g);
      tone('sine', 420, 760, 0.1, 0.1 * g);
    }
  },
  /** toque na bola (só fortes: o corpo encostando de leve é quase silêncio) */
  touch(power: number, g = 1) {
    const now = performance.now();
    if (now - lastTouch < 60) return;
    lastTouch = now;
    const k = clamp(power / 12, 0.25, 1) * g;
    tone('sine', 190, 75, 0.1, 0.42 * k);
    noise(1400, 500, 0.8, 0.04, 0.2 * k);
  },
  /** chute (mortal que pegou na bola): pancada forte com estalo */
  kick(g = 1) {
    tone('sine', 150, 48, 0.2, 0.7 * g);
    tone('triangle', 520, 120, 0.12, 0.3 * g);
    noise(2200, 600, 0.7, 0.08, 0.38 * g);
  },
  /** a bola quicou no chão */
  bounce(power: number, g = 1) {
    const now = performance.now();
    if (now - lastBounce < 80) return;
    lastBounce = now;
    const k = clamp(power / 14, 0.2, 1) * g;
    tone('sine', 230, 90, 0.1, 0.4 * k);
    noise(900, 300, 0.7, 0.05, 0.16 * k);
  },
  /** a bola bateu na parede, na trave ou no travessão */
  wall(power: number, g = 1) {
    const now = performance.now();
    if (now - lastWall < 80) return;
    lastWall = now;
    const k = clamp(power / 18, 0.25, 1) * g;
    tone('triangle', 140, 70, 0.14, 0.4 * k);
    noise(700, 250, 0.6, 0.07, 0.22 * k);
  },
  /** gol: buzina, fanfarra e a torcida explodindo; gol contra soa triste */
  goal(own = false) {
    if (own) {
      tone('triangle', 392, 392, 0.22, 0.26);
      tone('triangle', 330, 330, 0.22, 0.26, 0.24);
      tone('triangle', 262, 196, 0.5, 0.28, 0.48);
      noise(500, 300, 0.4, 1.4, 0.16, 0, 'bandpass', 0.3);
      return;
    }
    tone('sawtooth', 330, 330, 0.9, 0.16);
    tone('sawtooth', 331, 331, 0.9, 0.12);
    [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.2, 0.22, 0.1 + i * 0.12));
    noise(500, 1400, 0.45, 2.6, 0.42, 0, 'bandpass', 0.5);
    noise(2500, 1800, 0.8, 1.4, 0.12, 0.3, 'bandpass', 0.2);
  },
  /** ninguém pontuou */
  noGoal() {
    tone('square', 160, 110, 0.3, 0.14);
  },
  /** faltam 5 min / 1 min */
  warn() {
    tone('square', 880, 880, 0.1, 0.12);
    tone('square', 880, 880, 0.1, 0.12, 0.18);
  },
  /** começou o gol de ouro */
  golden() {
    [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.16, 0.22, i * 0.1));
    noise(600, 1500, 0.5, 1.2, 0.3, 0, 'bandpass', 0.4);
  },
  /** a bola parada voltou ao centro */
  reset() {
    tone('sine', 300, 600, 0.18, 0.2);
  },
};

/** Torcida de fundo: um ruído filtrado bem baixo que cresce e some devagar. Para quando a tela sai. */
let crowd: { stop: () => void; swell: (amount: number) => void } | null = null;
export function crowdStart() {
  const kit = audioKit();
  if (!kit || crowd) return;
  const { ctx, noise: buf, out } = kit;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const fl = ctx.createBiquadFilter();
  fl.type = 'bandpass';
  fl.frequency.value = 650;
  fl.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  src.connect(fl).connect(g).connect(out);
  src.start();
  const base = 0.035;
  g.gain.setTargetAtTime(base, ctx.currentTime, 0.8);
  // a torcida "respira": o volume oscila devagar
  const timer = window.setInterval(() => {
    g.gain.setTargetAtTime(base * (0.7 + Math.random() * 0.7), ctx.currentTime, 1.2);
  }, 2500);
  crowd = {
    swell(amount: number) {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(base + amount, t, 0.15);
      g.gain.setTargetAtTime(base, t + 1.8, 1.4);
    },
    stop() {
      window.clearInterval(timer);
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
      window.setTimeout(() => {
        try {
          src.stop();
        } catch {
          /* já parou */
        }
      }, 700);
      crowd = null;
    },
  };
}
export const crowdSwell = (amount: number) => crowd?.swell(amount);
export function crowdStop() {
  crowd?.stop();
}
