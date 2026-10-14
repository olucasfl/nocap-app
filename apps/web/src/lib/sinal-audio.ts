import type { SinalEvent, SinalMapId } from '@nocap/games';
import { audioKit } from './sfx';

/**
 * O som do Sinal Vermelho 2 (spec 026), todo sintetizado em Web Audio. A cantiga do Vigia é a
 * trilha: "SI-NAL-VER-ME-LHO" numa melodia própria de cada mapa (caixinha de música na horta, piano
 * elétrico de néon na rua, kalimba no deserto), com reverberação gerada; o último LHO é esticado,
 * sobe de tom e vibra (o aviso). Por baixo, uma cama de ambiente por mapa, passos, pancadas com
 * corpo e o ronco com batimento da escuridão. Tudo passa por um compressor, sem zumbido repetitivo.
 */
export interface SinalAudio {
  event(e: SinalEvent): void;
  /** Liga o ambiente e a melodia do mapa da partida. */
  setMap(map: SinalMapId): void;
  /** Distância (m) até a escuridão: o ronco e o batimento crescem quando ela se aproxima. */
  darkness(gapM: number): void;
  /** O boneco está andando agora (passos). */
  moving(on: boolean): void;
  rustle(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

/** Os graus de cada sílaba (SI NAL VER ME LHO): sobe e desce como uma cantiga, e o LHO resolve embaixo. */
const DEGREES = [4, 2, 4, 2, 0];

interface Voice {
  /** Frequência da tônica (Hz) e a escala em semitons. */
  root: number;
  scale: number[];
  /** Os parciais do timbre: [razão, volume, duração relativa]. */
  partials: [number, number, number][];
  wave: OscillatorType;
  decay: number;
}

const VOICES: Record<SinalMapId, Voice> = {
  horta: {
    root: 523.25,
    scale: [0, 2, 4, 7, 9, 12],
    partials: [[1, 1, 1], [4, 0.22, 0.4], [10.3, 0.1, 0.15]],
    wave: 'sine',
    decay: 0.5,
  },
  neon: {
    root: 440,
    scale: [0, 3, 5, 7, 10, 12],
    partials: [[1, 1, 1], [2, 0.4, 0.7], [3.5, 0.28, 0.35]],
    wave: 'triangle',
    decay: 0.62,
  },
  deserto: {
    root: 329.63,
    scale: [0, 1, 4, 5, 7, 8],
    partials: [[1, 1, 1], [2.01, 0.5, 0.6], [5.2, 0.12, 0.2]],
    wave: 'triangle',
    decay: 0.42,
  },
};

const semi = (root: number, n: number) => root * Math.pow(2, n / 12);

export function createSinalAudio(): SinalAudio | null {
  const kit = audioKit();
  if (!kit) return null;
  const { ctx, out, noise } = kit;
  const quiet = () => kit.muted();

  // O barramento: tudo passa por um compressor (mixagem firme) e por uma reverberação gerada.
  const bus = ctx.createGain();
  bus.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.22;
  bus.connect(comp).connect(out);
  const verb = ctx.createConvolver();
  const verbGain = ctx.createGain();
  verbGain.gain.value = 0.32;
  {
    const len = Math.floor(ctx.sampleRate * 1.7);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    verb.buffer = buf;
  }
  verb.connect(verbGain).connect(comp);

  let map: SinalMapId = 'horta';
  const created: AudioScheduledSourceNode[] = [];
  const track = <T extends AudioScheduledSourceNode>(n: T) => {
    created.push(n);
    return n;
  };

  /** Uma nota de timbre próprio: parciais com envelopes, mandada também para a reverberação. */
  function pluck(freq: number, when: number, peak: number, dur: number, wet = 0.5) {
    if (quiet()) return;
    const v = VOICES[map];
    for (const [ratio, vol, dm] of v.partials) {
      const o = track(ctx.createOscillator());
      const g = ctx.createGain();
      o.type = ratio === 1 ? v.wave : 'sine';
      o.frequency.value = freq * ratio;
      const d = dur * dm;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(peak * vol, when + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, when + d);
      o.connect(g);
      g.connect(bus);
      const send = ctx.createGain();
      send.gain.value = wet;
      g.connect(send).connect(verb);
      o.start(when);
      o.stop(when + d + 0.05);
    }
  }

  function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, when = ctx.currentTime, wet = 0) {
    if (quiet()) return;
    const o = track(ctx.createOscillator());
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(bus);
    if (wet > 0) {
      const send = ctx.createGain();
      send.gain.value = wet;
      g.connect(send).connect(verb);
    }
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  function hiss(filter: BiquadFilterType, f0: number, f1: number, dur: number, peak: number, when = ctx.currentTime, q = 0.9) {
    if (quiet()) return;
    const src = track(ctx.createBufferSource());
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noise;
    f.type = filter;
    f.frequency.setValueAtTime(f0, when);
    f.frequency.exponentialRampToValueAtTime(f1, when + dur);
    f.Q.value = q;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + Math.min(0.03, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  // ---- a nota esticada (o aviso): sobe de tom e vibra até o Vigia virar
  let held: { stop: (t: number) => void } | null = null;
  function stopHeld(fade = 0.05) {
    if (!held) return;
    held.stop(ctx.currentTime + fade);
    held = null;
  }
  function startHeld(root: number) {
    stopHeld(0.02);
    if (quiet()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    o.type = 'triangle';
    o2.type = 'sawtooth';
    o.frequency.setValueAtTime(root, t);
    o2.frequency.setValueAtTime(root * 1.004, t);
    // sobe uma quarta no tempo da nota, ficando cada vez mais tenso
    o.frequency.exponentialRampToValueAtTime(root * 1.335, t + 1.2);
    o2.frequency.exponentialRampToValueAtTime(root * 1.335 * 1.004, t + 1.2);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + 1.2);
    lfo.frequency.setValueAtTime(4.5, t);
    lfo.frequency.linearRampToValueAtTime(11, t + 1.2);
    lfoG.gain.value = 0.05;
    lfo.connect(lfoG).connect(g.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(bus);
    const send = ctx.createGain();
    send.gain.value = 0.4;
    g.connect(send).connect(verb);
    o.start(t);
    o2.start(t);
    lfo.start(t);
    held = {
      stop(at) {
        g.gain.cancelScheduledValues(at - 0.05);
        g.gain.setTargetAtTime(0.0001, at, 0.02);
        for (const n of [o, o2, lfo]) n.stop(at + 0.2);
      },
    };
  }

  // ---- ambiente: ruído filtrado que respira devagar, e grilos ou zumbido de acordo com o mapa
  let amb: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  let ambTimer = 0;
  function startAmbience() {
    if (amb || quiet()) return;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    src.buffer = noise;
    src.loop = true;
    f.type = map === 'neon' ? 'lowpass' : 'bandpass';
    f.frequency.value = map === 'neon' ? 360 : map === 'horta' ? 2600 : 700;
    f.Q.value = map === 'deserto' ? 0.7 : 0.5;
    g.gain.value = map === 'neon' ? 0.05 : 0.035;
    lfo.frequency.value = map === 'deserto' ? 0.13 : 0.2;
    lfoG.gain.value = f.frequency.value * 0.35;
    lfo.connect(lfoG).connect(f.frequency);
    src.connect(f).connect(g).connect(bus);
    src.start();
    lfo.start();
    created.push(src, lfo);
    amb = { src, g };
    // bichos e buzinas distantes, de vez em quando
    const tick = () => {
      if (!amb) return;
      const t = ctx.currentTime;
      if (!quiet()) {
        if (map === 'horta') {
          const base = 3800 + Math.random() * 500;
          for (let i = 0; i < 3; i++) tone('sine', base, base * 1.02, 0.05, 0.012, t + i * 0.08);
        } else if (map === 'neon') {
          if (Math.random() < 0.5) hiss('bandpass', 300, 900, 1.2, 0.02, t, 1.5);
          else tone('sine', 880, 880, 0.2, 0.01, t, 0.3);
        } else {
          hiss('bandpass', 500, 1500, 1.6, 0.03, t, 1.2);
        }
      }
      ambTimer = window.setTimeout(tick, 1500 + Math.random() * 3500);
    };
    ambTimer = window.setTimeout(tick, 1200);
  }
  function stopAmbience() {
    window.clearTimeout(ambTimer);
    if (!amb) return;
    const t = ctx.currentTime;
    amb.g.gain.setTargetAtTime(0.0001, t, 0.05);
    amb.src.stop(t + 0.3);
    amb = null;
  }

  // ---- o ronco da escuridão, com batimento quando ela está perto
  let drone: { osc: OscillatorNode; sub: OscillatorNode; gain: GainNode } | null = null;
  let nextBeat = 0;
  const startDrone = () => {
    if (drone || quiet()) return;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    sub.type = 'sine';
    sub.frequency.value = 38;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    gain.gain.value = 0.0001;
    osc.connect(lp);
    sub.connect(lp);
    lp.connect(gain).connect(bus);
    osc.start();
    sub.start();
    created.push(osc, sub);
    drone = { osc, sub, gain };
  };

  // ---- passos
  let stepping = false;
  let nextStep = 0;
  let stepFoot = 0;

  const syllable = (syl: number) => {
    const v = VOICES[map];
    const deg = DEGREES[syl % 5]!;
    return semi(v.root, v.scale[deg]! + (syl === 4 ? -12 : 0));
  };

  return {
    setMap(m) {
      map = m;
      stopAmbience();
      startAmbience();
    },
    event(e) {
      const t = ctx.currentTime;
      if (e.kind === 'nota') {
        const v = VOICES[map];
        if (e.hold) {
          // o último LHO: nota esticada que sobe e vibra
          startHeld(semi(v.root, v.scale[0]! - 5));
          hiss('highpass', 3000, 9000, 0.5, 0.05, t);
        } else {
          pluck(syllable(e.syl), t, 0.2, v.decay);
          // um "tum" de baixo na primeira sílaba marca o compasso
          if (e.syl === 0) tone('sine', semi(v.root, -24), semi(v.root, -24) * 0.97, 0.18, 0.12, t);
        }
      } else if (e.kind === 'aviso') {
        // (o som da nota esticada já toca junto; aqui só um reforço suave de ar)
      } else if (e.kind === 'olhando') {
        stopHeld(0.02);
        tone('sine', 150, 38, 0.4, 0.55, t, 0.15);
        hiss('lowpass', 1100, 160, 0.3, 0.22, t);
        tone('triangle', 70, 52, 0.5, 0.2, t + 0.02);
      } else if (e.kind === 'voltando') {
        stopHeld(0.05);
        const v = VOICES[map];
        pluck(semi(v.root, v.scale[2]!), t, 0.12, 0.3, 0.6);
        pluck(semi(v.root, v.scale[4]!), t + 0.09, 0.1, 0.3, 0.6);
      } else if (e.kind === 'choque') {
        // a pancada: grave com corpo, um estalo e duas estrelinhas tilintando
        tone('sine', 160 - 50 * e.size, 42, 0.2 + 0.14 * e.size, 0.4 + 0.35 * e.size, t, 0.1);
        hiss('bandpass', 1400, 300, 0.1, 0.22 * e.size + 0.05, t, 1.4);
        tone('triangle', 1568, 1568, 0.22, 0.08, t + 0.06, 0.5);
        tone('triangle', 2093, 2093, 0.2, 0.06, t + 0.13, 0.5);
      } else if (e.kind === 'folego') {
        hiss('bandpass', 600, 3200, 0.3, 0.12, t, 1.2);
        tone('triangle', 520, 880, 0.2, 0.1, t, 0.3);
      } else if (e.kind === 'quebrou') {
        hiss('bandpass', 2400, 500, 0.3, 0.35, t, 1);
        hiss('highpass', 3000, 6000, 0.2, 0.15, t + 0.05);
        tone('square', 200, 80, 0.15, 0.12, t);
      } else if (e.kind === 'empurrou') {
        hiss('bandpass', 400, 2400, 0.18, 0.3, t, 1);
        tone('sine', 220, 90, 0.14, 0.3, t);
      } else if (e.kind === 'chegou' || e.kind === 'fase') {
        stopHeld(0.02);
        const v = VOICES[map];
        const notes = e.kind === 'chegou' ? [0, 2, 4, 5, 7] : [0, 2, 4];
        notes.forEach((n, i) => pluck(semi(v.root, n * 1 + 12), t + i * 0.09, 0.22, 0.6, 0.7));
      } else if (e.kind === 'fim') {
        stopHeld(0.02);
        if (e.reason === 'vigia') {
          // te viu: um acorde dissonante e uma pancada seca
          for (const f of [220, 233, 311]) tone('sawtooth', f, f * 0.7, 0.7, 0.1, t, 0.3);
          tone('sine', 120, 34, 0.6, 0.6, t);
          hiss('highpass', 2500, 800, 0.4, 0.2, t);
        } else {
          // a escuridão engoliu: um som que desce e vai sumindo
          tone('sawtooth', 220, 40, 1.4, 0.18, t, 0.4);
          tone('sine', 90, 30, 1.6, 0.4, t);
          hiss('lowpass', 1200, 90, 1.2, 0.3, t);
        }
      }
    },
    darkness(gap) {
      startDrone();
      if (!drone) return;
      const near = Math.max(0, Math.min(1, (30 - gap) / 30));
      const t = ctx.currentTime;
      drone.gain.gain.setTargetAtTime(near * near * 0.34 + 0.0001, t, 0.2);
      drone.osc.frequency.setTargetAtTime(55 + near * 22, t, 0.3);
      drone.sub.frequency.setTargetAtTime(38 + near * 14, t, 0.3);
      // batimento: dois "tum" cada vez mais rápidos quando ela está perto
      if (near > 0.5 && t >= nextBeat && !quiet()) {
        const gain = (near - 0.5) * 0.9;
        tone('sine', 62, 40, 0.14, 0.45 * gain, t);
        tone('sine', 58, 38, 0.16, 0.32 * gain, t + 0.17);
        nextBeat = t + 1.1 - 0.6 * near;
      }
    },
    moving(on) {
      stepping = on;
      if (!on) return;
      const t = ctx.currentTime;
      if (t < nextStep || quiet()) return;
      nextStep = t + 0.26;
      stepFoot ^= 1;
      const hard = map === 'neon' ? 1400 : map === 'deserto' ? 900 : 700;
      hiss('lowpass', hard * (stepFoot ? 1 : 0.85), 160, 0.07, 0.07, t);
      tone('sine', stepFoot ? 95 : 82, 55, 0.07, 0.07, t);
      void stepping;
    },
    rustle() {
      hiss('bandpass', 1800, 3800, 0.35, 0.22);
      hiss('highpass', 4000, 7000, 0.2, 0.08);
    },
    pause() {
      stopHeld(0.02);
      void ctx.suspend();
    },
    resume() {
      void ctx.resume();
    },
    stop() {
      stopHeld(0.05);
      stopAmbience();
      if (drone) {
        const t = ctx.currentTime;
        drone.gain.gain.cancelScheduledValues(t);
        drone.gain.gain.setValueAtTime(Math.max(0.0001, drone.gain.gain.value), t);
        drone.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        drone.osc.stop(t + 0.12);
        drone.sub.stop(t + 0.12);
        drone = null;
      }
      void ctx.resume();
    },
  };
}
