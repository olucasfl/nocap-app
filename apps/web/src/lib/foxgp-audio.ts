import { audioKit } from './sfx';

/**
 * Sons do Fox GP, sintetizados em Web Audio (sem arquivos) e respeitando o mudo do `sfx`: o motor do próprio carro é uma
 * voz contínua que sobe com a rotação; o resto são toques curtos (luzes, DRS, batida, volta, box).
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

/**
 * O ronco do motor (spec 080, voz do repositório de referência, MIT): uma dente de serra a 1,5× e uma quadrada a 0,75× da
 * rotação, num passa-baixa e num ganho, ligados ao `audioKit` (o mesmo `AudioContext`, que já cuida do mudo e de só tocar
 * depois de um toque). A rotação vem da marcha e do giro do motor (`GpCar.gear`, `GpCar.rpm`): sobe em cada marcha e cai
 * na troca; parado, o acelerador só sobe o giro.
 */
class Engine {
  private nodes: {
    ctx: AudioContext;
    a: OscillatorNode;
    b: OscillatorNode;
    f: BiquadFilterNode;
    g: GainNode;
  } | null = null;

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
    f.type = 'lowpass';
    f.frequency.value = 1500;
    f.Q.value = 1.5;
    g.gain.value = 0.0001;
    a.connect(f);
    b.connect(f);
    f.connect(g).connect(busFor(kit));
    a.start();
    b.start();
    this.nodes = { ctx, a, b, f, g };
  }

  /** Rotação do motor em RPM (como no conta-giros): `rpm` de 0 a 1 dentro da marcha; parado, o acelerador sobe o giro. */
  static rpmOf(rpm: number, throttle: number, idle: boolean): number {
    return idle ? 4000 + throttle * 6000 : 5500 + 6500 * Math.max(0, Math.min(1, rpm));
  }

  /**
   * `rpm` de 0 a 1 (dentro da marcha), `throttle` de 0 a 1, `silent` (menu, pausa, fim) e `idle` (parado: o acelerador só
   * sobe o giro).
   */
  update(rpm: number, throttle: number, silent = false, idle = false) {
    const kit = audioKit();
    const n = this.nodes;
    if (!n) return;
    const t = n.ctx.currentTime;
    const r = Engine.rpmOf(rpm, throttle, idle);
    n.a.frequency.setTargetAtTime((r / 60) * 1.5, t, 0.03);
    n.b.frequency.setTargetAtTime((r / 60) * 0.75, t, 0.03);
    const isQuiet = idle && throttle < 0.02;
    const vol = kit && !kit.muted() && !silent && !isQuiet ? 0.025 + throttle * 0.035 : 0.0001;
    n.g.gain.setTargetAtTime(vol, t, 0.03);
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

export { Engine as GpEngineVoice };

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
  /** o DRS ficou disponível: bipe curto */
  drs() {
    tone('triangle', 1320, 1320, 0.07, 0.12);
    tone('triangle', 1760, 1760, 0.07, 0.1, 0.08);
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
  /** cruzou a linha de chegada */
  finish(place: number) {
    const notes =
      place === 1 ? [523, 659, 784, 1047, 1319] : place <= 3 ? [523, 659, 784] : [440, 523];
    notes.forEach((f, i) => tone('triangle', f, f, 0.2, 0.2, 0.1 * i));
  },
};
