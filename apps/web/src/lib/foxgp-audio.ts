import { audioKit } from './sfx';

/**
 * Sons do Fox GP (spec 081, Fase 11), sintetizados em Web Audio (sem arquivos, nenhuma licença a conferir) e respeitando
 * o mudo do `sfx`. Dois motores com a mesma interface, um por veículo:
 * - F1 (Realista): V6 em três camadas (grave, médio, agudo) que se misturam pelo giro com potência igual, assobio do
 *   turbo que sobe com a carga, estalo na troca de marcha e estouros ao tirar o pé em giro alto;
 * - kart (Arcade): duas-tempos agudo e "zumbido", sem marchas: o tom sobe e desce contínuo com a velocidade.
 * Mais o vento (sobe com a velocidade), o chiado de pneu no drift e os toques curtos. `pause()` cala tudo na hora (menu
 * offline, aba escondida) e `resume()` traz de volta.
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

let paused = false;

function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0) {
  const kit = audioKit();
  if (!kit || kit.muted() || paused) return;
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
  if (!kit || kit.muted() || paused) return;
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

/** Uma curva de distorção suave (dá "grão" ao motor sem estourar). */
function curve(k: number) {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}

export type GpVehicle = 'f1' | 'kart';

/** O que o motor ouve a cada quadro além do giro e do acelerador. */
export interface GpEngineExtra {
  gear?: number;
  speed?: number;
  /** Kart: derrapando (0 a 1). */
  drift?: number;
  /** Kart: nível do turbo em uso (0 a 3). */
  boost?: number;
}

/**
 * O motor do seu carro (ou de quem você assiste). `update` a cada quadro: `rpm` de 0 a 1, `throttle` de 0 a 1, `silent`
 * (menu offline, fim) e `idle` (parado: o acelerador só sobe o giro; parado e sem acelerador, mudo).
 */
class Engine {
  private n: {
    ctx: AudioContext;
    oscs: OscillatorNode[];
    layers: GainNode[];
    whine: OscillatorNode;
    whineG: GainNode;
    f: BiquadFilterNode;
    g: GainNode;
    lfo: OscillatorNode;
    lfoG: GainNode;
    wind: AudioBufferSourceNode;
    windG: GainNode;
    windF: BiquadFilterNode;
    skid: AudioBufferSourceNode;
    skidG: GainNode;
    skidF: BiquadFilterNode;
  } | null = null;
  vehicle: GpVehicle = 'f1';
  private lastGear = 1;
  private lastThr = 0;
  private lastRpm = 0;
  private dip = 0;

  start(vehicle: GpVehicle = this.vehicle) {
    this.vehicle = vehicle;
    const kit = audioKit();
    if (!kit || this.n) return;
    const { ctx } = kit;
    const out = busFor(kit);
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const shaper = ctx.createWaveShaper();
    shaper.curve = curve(vehicle === 'kart' ? 6 : 3);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = vehicle === 'kart' ? 2.5 : 1.2;
    f.frequency.value = 2200;
    shaper.connect(f).connect(g).connect(out);
    // três camadas (o kart usa as duas primeiras mais o "zumbido" do LFO)
    const types: OscillatorType[] = vehicle === 'kart' ? ['square', 'sawtooth', 'triangle'] : ['sawtooth', 'square', 'sawtooth'];
    const oscs: OscillatorNode[] = [];
    const layers: GainNode[] = [];
    for (const ty of types) {
      const o = ctx.createOscillator();
      o.type = ty;
      const lg = ctx.createGain();
      lg.gain.value = 0;
      o.connect(lg).connect(shaper);
      o.start();
      oscs.push(o);
      layers.push(lg);
    }
    // o "zumbido" do duas-tempos (kart) e o tremor de baixa do V6: um LFO no ganho
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 30;
    lfoG.gain.value = 0;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();
    // assobio do turbo (F1)
    const whine = ctx.createOscillator();
    whine.type = 'sine';
    const whineG = ctx.createGain();
    whineG.gain.value = 0;
    whine.connect(whineG).connect(out);
    whine.start();
    // vento e chiado de pneu: ruído em laço, filtrado
    const loop = (type: BiquadFilterType, fq: number, q: number) => {
      const src = ctx.createBufferSource();
      src.buffer = kit.noise;
      src.loop = true;
      const fl = ctx.createBiquadFilter();
      fl.type = type;
      fl.frequency.value = fq;
      fl.Q.value = q;
      const gg = ctx.createGain();
      gg.gain.value = 0;
      src.connect(fl).connect(gg).connect(out);
      src.start();
      return { src, fl, gg };
    };
    const wind = loop('lowpass', 600, 0.5);
    const skid = loop('bandpass', 2200, 6);
    this.n = {
      ctx,
      oscs,
      layers,
      whine,
      whineG,
      f,
      g,
      lfo,
      lfoG,
      wind: wind.src,
      windG: wind.gg,
      windF: wind.fl,
      skid: skid.src,
      skidG: skid.gg,
      skidF: skid.fl,
    };
  }

  /** Troca o veículo (refaz as vozes). */
  setVehicle(v: GpVehicle) {
    if (v === this.vehicle && this.n) return;
    const was = !!this.n;
    this.stop();
    this.vehicle = v;
    if (was) this.start(v);
  }

  /** Rotação em RPM (como no conta-giros), para o som e os testes. */
  static rpmOf(rpm: number, throttle: number, idle: boolean): number {
    return idle ? 4000 + throttle * 6000 : 5500 + 6500 * Math.max(0, Math.min(1, rpm));
  }

  update(rpm: number, throttle: number, silent = false, idle = false, x: GpEngineExtra = {}) {
    const kit = audioKit();
    const n = this.n;
    if (!n) return;
    const t = n.ctx.currentTime;
    const quiet = idle && throttle < 0.02;
    const on = !!kit && !kit.muted() && !silent && !paused && !quiet;
    const r = Math.max(0, Math.min(1, rpm));
    const speed = Math.abs(x.speed ?? 0);
    if (this.vehicle === 'kart') {
      // duas-tempos: tom contínuo e agudo, mais zumbido com o acelerador
      const hz = idle ? 95 + throttle * 160 : 110 + 360 * r + (x.boost ?? 0) * 25;
      n.oscs[0]!.frequency.setTargetAtTime(hz, t, 0.04);
      n.oscs[1]!.frequency.setTargetAtTime(hz * 2.01, t, 0.04);
      n.oscs[2]!.frequency.setTargetAtTime(hz * 0.5, t, 0.04);
      n.layers[0]!.gain.setTargetAtTime(0.55, t, 0.05);
      n.layers[1]!.gain.setTargetAtTime(0.25 + throttle * 0.25, t, 0.05);
      n.layers[2]!.gain.setTargetAtTime(0.3, t, 0.05);
      n.lfo.frequency.setTargetAtTime(hz / 2, t, 0.05);
      n.lfoG.gain.setTargetAtTime(on ? 0.012 + throttle * 0.01 : 0, t, 0.05);
      n.f.frequency.setTargetAtTime(1400 + 2600 * r, t, 0.05);
      n.whineG.gain.setTargetAtTime(0, t, 0.05);
      n.g.gain.setTargetAtTime(on ? 0.02 + throttle * 0.03 : 0.0001, t, 0.03);
      // chiado de pneu no drift (tom pelo quanto derrapa)
      const d = x.drift ?? 0;
      n.skidF.frequency.setTargetAtTime(1800 + d * 900, t, 0.05);
      n.skidG.gain.setTargetAtTime(on && d > 0 ? 0.05 * d : 0, t, 0.06);
    } else {
      // V6: três camadas pelo giro (potência igual), o médio e o agudo crescem em giro alto
      const base = ((idle ? 4000 + throttle * 6000 : 5500 + 6500 * r) / 60) * 3 * (1 - this.dip * 0.18);
      n.oscs[0]!.frequency.setTargetAtTime(base * 0.5, t, 0.025);
      n.oscs[1]!.frequency.setTargetAtTime(base, t, 0.025);
      n.oscs[2]!.frequency.setTargetAtTime(base * 2, t, 0.025);
      const lo = Math.cos((r * Math.PI) / 2);
      const hi = Math.sin((r * Math.PI) / 2);
      n.layers[0]!.gain.setTargetAtTime(0.6 * lo + 0.15, t, 0.05);
      n.layers[1]!.gain.setTargetAtTime(0.45, t, 0.05);
      n.layers[2]!.gain.setTargetAtTime(0.35 * hi, t, 0.05);
      n.lfo.frequency.setTargetAtTime(base / 6, t, 0.05);
      n.lfoG.gain.setTargetAtTime(on ? 0.004 : 0, t, 0.05);
      n.f.frequency.setTargetAtTime(1600 + 3400 * r * (0.6 + throttle * 0.4), t, 0.05);
      // assobio do turbo / híbrido: sobe com a carga
      n.whine.frequency.setTargetAtTime(2400 + 2600 * r, t, 0.05);
      n.whineG.gain.setTargetAtTime(on ? 0.004 + 0.01 * throttle * r : 0, t, 0.08);
      n.g.gain.setTargetAtTime(on ? 0.022 + throttle * 0.03 : 0.0001, t, 0.03);
      n.skidG.gain.setTargetAtTime(0, t, 0.05);
      // troca de marcha para cima: corte curto do giro e um estalo
      const gear = x.gear ?? this.lastGear;
      if (on && gear > this.lastGear && gear > 1) {
        this.dip = 1;
        noise(1800, 900, 3, 0.05, 0.12);
      }
      this.dip = Math.max(0, this.dip - 0.12);
      // tirou o pé em giro alto: estouros de escapamento
      if (on && this.lastThr > 0.6 && throttle < 0.1 && this.lastRpm > 0.65)
        for (let k = 0; k < 3; k++) noise(260 + Math.random() * 200, 120, 1.2, 0.05, 0.16, 0.04 + k * 0.07 + Math.random() * 0.03);
      this.lastGear = gear;
    }
    // vento: sobe com a velocidade
    n.windF.frequency.setTargetAtTime(300 + speed * 30, t, 0.1);
    n.windG.gain.setTargetAtTime(on ? Math.min(0.05, speed * 0.0012) : 0, t, 0.1);
    this.lastThr = throttle;
    this.lastRpm = r;
  }

  /** Cala na hora (≤ ~150 ms), sem parar as vozes (o menu offline e a aba escondida). */
  mute() {
    const n = this.n;
    if (!n) return;
    const t = n.ctx.currentTime;
    for (const gg of [n.g.gain, n.whineG.gain, n.windG.gain, n.skidG.gain, n.lfoG.gain]) {
      gg.cancelScheduledValues(t);
      gg.setTargetAtTime(0, t, 0.03);
    }
  }

  /** Só nos testes de desenvolvimento: o ganho principal agora. */
  gainNow(): number {
    return this.n ? this.n.g.gain.value : 0;
  }

  stop() {
    const n = this.n;
    if (!n) return;
    this.n = null;
    const t = n.ctx.currentTime;
    n.g.gain.setTargetAtTime(0.0001, t, 0.05);
    for (const gg of [n.whineG.gain, n.windG.gain, n.skidG.gain, n.lfoG.gain]) gg.setTargetAtTime(0, t, 0.05);
    for (const o of [...n.oscs, n.whine, n.lfo]) o.stop(t + 0.3);
    n.wind.stop(t + 0.3);
    n.skid.stop(t + 0.3);
  }
}

export { Engine as GpEngineVoice };

let lastBump = 0;
let lastWall = 0;
const TURBO_NOTES = [0, 988, 1245, 1568];

export const gpSfx = {
  engine: new Engine(),
  /** Menu offline, aba escondida, janela sem foco: cala tudo na hora. */
  pause() {
    paused = true;
    gpSfx.engine.mute();
  },
  resume() {
    paused = false;
  },
  get paused() {
    return paused;
  },
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
  /** Kart: um terço da barra encheu (a nota sobe por nível, com uma faísca). */
  bar(level: number) {
    const f = TURBO_NOTES[Math.max(1, Math.min(3, level))]!;
    tone('triangle', f, f, 0.09, 0.13);
    tone('sine', f * 2, f * 2.5, 0.12, 0.05, 0.05);
  },
  /** Kart: o turbo (whoosh/chama mais longo por nível). */
  turbo(level: number) {
    const dur = [0.5, 0.5, 0.9, 1.4][Math.max(1, Math.min(3, level))]!;
    noise(500, 3200, 0.8, dur, 0.22);
    tone('sawtooth', 120, 60, dur * 0.8, 0.06);
  },
  /** Kart: sem barra para o turbo (toque seco). */
  noTurbo() {
    tone('square', 160, 120, 0.06, 0.12);
  },
  /** Kart: o pulinho do drift. */
  hop() {
    tone('sine', 300, 620, 0.09, 0.1);
  },
  bump(you: boolean) {
    const now = performance.now();
    if (now - lastBump < 160) return;
    lastBump = now;
    noise(300, 110, 1.1, 0.12, you ? 0.4 : 0.15);
  },
  /** Batida na barreira; no kart, pancada de plástico (mais aguda e curta). */
  wall(kart = false) {
    const now = performance.now();
    if (now - lastWall < 300) return;
    lastWall = now;
    if (kart) {
      noise(900, 400, 1.6, 0.12, 0.35);
      tone('triangle', 260, 120, 0.1, 0.2);
      return;
    }
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
    const notes = place === 1 ? [523, 659, 784, 1047, 1319] : place <= 3 ? [523, 659, 784] : [440, 523];
    notes.forEach((f, i) => tone('triangle', f, f, 0.2, 0.2, 0.1 * i));
  },
};
