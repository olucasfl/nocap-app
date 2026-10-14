import type { AtravessaBiome, AtravessaEnd, LaneKind } from '@nocap/games';
import { audioKit } from './sfx';

/**
 * O som do Atravessa! (specs 028 e 029), todo sintetizado em Web Audio. O pulo é um "pop" seco e
 * alto, sempre igual (sem nota que sobe). Por baixo, uma cama de ambiente por bioma, pousos que soam
 * diferente em cada chão, o sino do trem, a sirene da ambulância (mais alta quanto mais perto),
 * o aviso das varridas, sons de marco e de recorde, mortes com corpo e um ronco baixo e discreto
 * quando a escuridão chega perto. Tudo passa por um compressor e respeita o botão de mudo.
 */
export interface AtravessaAudio {
  /** Um pulo começou: `forward` diz se é para a frente (os outros soam um pouco mais graves). */
  hop(forward: boolean): void;
  /** O herói pousou em um chão deste tipo. */
  land(kind: LaneKind): void;
  /** Passo recusado (árvore, borda). */
  bump(): void;
  /** O bioma de onde o herói está: troca o timbre e o ambiente. */
  setBiome(b: AtravessaBiome): void;
  /**
   * A cada quadro: quão perto a escuridão está (0 a 1), se algum trem por perto está avisando e o
   * volume da sirene (0 a 1: a ambulância mais próxima, 0 quando não há).
   */
  frame(danger: number, trainWarning: boolean, siren: number): void;
  /**
   * Um veículo passou pela coluna do herói: um "vush" curto. Quanto mais rápido, mais curto e agudo;
   * veículo pesado (comprimento grande) soa grave. `loud` (0 a 1) cai com a distância até a faixa.
   */
  pass(speed: number, len: number, loud: number): void;
  /** Cruzou um marco (a cada 50 linhas, depois a cada 100): um sino suave. */
  milestone(): void;
  /** Passou do recorde: três notas subindo. */
  record(): void;
  /** Um bipe do aviso da varrida (a tela chama mais rápido conforme o perigo se aproxima). */
  sweepWarn(): void;
  /** O perigo da varrida entrou na pista. */
  sweepHit(): void;
  death(end: AtravessaEnd): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

interface Voice {
  root: number;
  /** Semitons da escala (pentatônica) dentro de uma oitava. */
  scale: number[];
  partials: [number, number, number][];
  wave: OscillatorType;
  decay: number;
}

const VOICES: Record<AtravessaBiome, Voice> = {
  horta: {
    root: 392,
    scale: [0, 2, 4, 7, 9],
    partials: [[1, 1, 1], [4, 0.2, 0.35], [10.3, 0.08, 0.15]],
    wave: 'sine',
    decay: 0.45,
  },
  deserto: {
    root: 330,
    scale: [0, 1, 5, 7, 8],
    partials: [[1, 1, 1], [2.01, 0.45, 0.55], [5.2, 0.1, 0.2]],
    wave: 'triangle',
    decay: 0.4,
  },
  neon: {
    root: 440,
    scale: [0, 3, 5, 7, 10],
    partials: [[1, 1, 1], [2, 0.38, 0.65], [3.5, 0.25, 0.3]],
    wave: 'triangle',
    decay: 0.55,
  },
};

const semi = (root: number, n: number) => root * Math.pow(2, n / 12);

export function createAtravessaAudio(): AtravessaAudio | null {
  const kit = audioKit();
  if (!kit) return null;
  const { ctx, out, noise } = kit;
  const quiet = () => kit.muted();

  const bus = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 14;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  bus.connect(comp).connect(out);
  const verb = ctx.createConvolver();
  const verbGain = ctx.createGain();
  verbGain.gain.value = 0.22;
  {
    const len = Math.floor(ctx.sampleRate * 1.3);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
    }
    verb.buffer = buf;
  }
  verb.connect(verbGain).connect(comp);

  let biome: AtravessaBiome = 'horta';
  const created: AudioScheduledSourceNode[] = [];
  const track = <T extends AudioScheduledSourceNode>(n: T) => {
    created.push(n);
    return n;
  };

  function pluck(freq: number, when: number, peak: number) {
    if (quiet()) return;
    const v = VOICES[biome];
    for (const [ratio, vol, dm] of v.partials) {
      const o = track(ctx.createOscillator());
      const g = ctx.createGain();
      o.type = ratio === 1 ? v.wave : 'sine';
      o.frequency.value = freq * ratio;
      const d = v.decay * dm;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(peak * vol, when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, when + d);
      o.connect(g).connect(bus);
      const send = ctx.createGain();
      send.gain.value = 0.35;
      g.connect(send).connect(verb);
      o.start(when);
      o.stop(when + d + 0.05);
    }
  }

  function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, when = ctx.currentTime) {
    if (quiet()) return;
    const o = track(ctx.createOscillator());
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(bus);
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
    f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), when + dur);
    f.Q.value = q;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + Math.min(0.03, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  // ---- ambiente por bioma: ruído filtrado que respira devagar e, de vez em quando, um som do lugar
  let amb: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  let ambTimer = 0;
  function startAmbience() {
    stopAmbience();
    if (quiet()) return;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    src.buffer = noise;
    src.loop = true;
    f.type = biome === 'neon' ? 'lowpass' : 'bandpass';
    f.frequency.value = biome === 'neon' ? 320 : biome === 'horta' ? 2200 : 650;
    f.Q.value = 0.6;
    g.gain.value = biome === 'neon' ? 0.04 : 0.028;
    lfo.frequency.value = biome === 'deserto' ? 0.12 : 0.18;
    lfoG.gain.value = f.frequency.value * 0.3;
    lfo.connect(lfoG).connect(f.frequency);
    src.connect(f).connect(g).connect(bus);
    src.start();
    lfo.start();
    created.push(src, lfo);
    amb = { src, g };
    const tick = () => {
      if (!amb) return;
      const t = ctx.currentTime;
      if (!quiet()) {
        if (biome === 'horta') {
          const base = 3600 + Math.random() * 500;
          for (let i = 0; i < 3; i++) tone('sine', base, base * 1.03, 0.05, 0.009, t + i * 0.09);
        } else if (biome === 'neon') {
          if (Math.random() < 0.5) hiss('bandpass', 300, 900, 1.2, 0.016, t, 1.5);
          else tone('sine', 880, 880, 0.2, 0.008, t);
        } else {
          hiss('bandpass', 500, 1500, 1.6, 0.022, t, 1.2);
        }
      }
      ambTimer = window.setTimeout(tick, 2000 + Math.random() * 4000);
    };
    ambTimer = window.setTimeout(tick, 1500);
  }
  function stopAmbience() {
    window.clearTimeout(ambTimer);
    if (!amb) return;
    const t = ctx.currentTime;
    amb.g.gain.setTargetAtTime(0.0001, t, 0.08);
    amb.src.stop(t + 0.4);
    amb = null;
  }

  // ---- o ronco da escuridão: só se ouve de perto, e baixo
  let drone: { osc: OscillatorNode; sub: OscillatorNode; gain: GainNode } | null = null;
  let nextBeat = 0;
  function startDrone() {
    if (drone || quiet()) return;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.value = 52;
    sub.type = 'sine';
    sub.frequency.value = 36;
    lp.type = 'lowpass';
    lp.frequency.value = 140;
    gain.gain.value = 0.0001;
    osc.connect(lp);
    sub.connect(lp);
    lp.connect(gain).connect(bus);
    osc.start();
    sub.start();
    created.push(osc, sub);
    drone = { osc, sub, gain };
  }

  // ---- o sino do trem: dois tons que se alternam enquanto a luz pisca
  let nextBell = 0;
  let bellFlip = 0;

  let nextPass = 0;

  // ---- a sirene da ambulância: um oscilador que vai e volta de agudo para grave, mais alto de perto
  let siren: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
  const startSiren = () => {
    if (siren || quiet()) return;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.value = 860;
    lfo.type = 'sine';
    lfo.frequency.value = 1.25;
    lfoGain.gain.value = 190;
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    gain.gain.value = 0.0001;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(lp).connect(gain).connect(bus);
    osc.start();
    lfo.start();
    created.push(osc, lfo);
    siren = { osc, lfo, gain };
  };

  return {
    hop(forward) {
      const t = ctx.currentTime;
      // o "pop" do pulo: seco, alto e sempre igual (sem nota que sobe); os outros lados são mais graves
      const k = forward ? 1 : 0.8;
      tone('sine', 240 * k, 640 * k, 0.1, 0.24, t);
      tone('triangle', 520 * k, 900 * k, 0.045, 0.1, t);
      hiss('highpass', 2600, 6000, 0.03, 0.06, t);
    },
    pass(speed, len, loud) {
      if (loud <= 0.02) return;
      const t = ctx.currentTime;
      // no máximo um som a cada 140 ms: com muito tráfego ele não vira barulho
      if (t < nextPass) return;
      nextPass = t + 0.14;
      const fast = Math.max(0, Math.min(1, (speed - 1.3) / 6));
      const dur = 0.62 - 0.38 * fast;
      const peak = 0.055 * loud;
      if (len > 2.4) {
        // caminhão e ônibus: um ronco grave que passa devagar
        hiss('lowpass', 420, 140, dur + 0.15, peak * 1.3, t, 0.7);
        tone('sine', 72, 52, dur, peak * 1.2, t);
      } else if (len < 1.0) {
        // moto e scooter: um zumbido agudo que cai
        hiss('bandpass', 1900 + fast * 900, 800, dur * 0.8, peak * 0.9, t, 1.4);
        tone('sawtooth', 360 + fast * 160, 200 + fast * 70, dur * 0.7, peak * 0.35, t);
      } else {
        // carro: um "vush" que fica mais curto e agudo quanto mais rápido
        hiss('bandpass', 700 + fast * 1100, 280 + fast * 160, dur, peak, t, 0.9);
      }
    },
    milestone() {
      const t = ctx.currentTime;
      // um sino suave de duas notas
      pluck(784, t, 0.12);
      pluck(1175, t + 0.12, 0.1);
    },
    record() {
      const t = ctx.currentTime;
      // três notas subindo, mais brilhantes que o marco, e um brilho de ar no fim
      pluck(659, t, 0.16);
      pluck(880, t + 0.1, 0.16);
      pluck(1319, t + 0.2, 0.18);
      hiss('highpass', 5000, 9000, 0.35, 0.05, t + 0.22);
    },
    sweepWarn() {
      const t = ctx.currentTime;
      tone('square', 1040, 1040, 0.07, 0.05, t);
    },
    sweepHit() {
      const t = ctx.currentTime;
      hiss('bandpass', 500, 2400, 0.5, 0.2, t, 0.7);
      tone('sine', 150, 70, 0.4, 0.14, t);
    },
    land(kind) {
      const t = ctx.currentTime;
      if (kind === 'descanso') {
        tone('sine', 120, 68, 0.08, 0.1, t);
        hiss('lowpass', 900, 200, 0.06, 0.05, t);
      } else if (kind === 'estrada' || kind === 'trilho') {
        tone('triangle', 210, 130, 0.05, 0.08, t);
        hiss('highpass', 3000, 5000, 0.03, 0.035, t);
      } else {
        // tora ou pedra: um toque de madeira ou pedra
        tone('triangle', 190, 95, 0.09, 0.1, t);
        hiss('bandpass', 700, 300, 0.07, 0.05, t, 1.4);
      }
    },
    bump() {
      const t = ctx.currentTime;
      tone('square', 150, 90, 0.07, 0.05, t);
    },
    setBiome(b) {
      if (b === biome && amb) return;
      biome = b;
      startAmbience();
    },
    frame(danger, trainWarning, sirenLevel) {
      const t = ctx.currentTime;
      if (sirenLevel > 0.04) {
        startSiren();
        siren?.gain.gain.setTargetAtTime(sirenLevel * 0.12 + 0.0001, t, 0.08);
      } else if (siren) {
        siren.gain.gain.setTargetAtTime(0.0001, t, 0.12);
      }
      if (danger > 0.05) {
        startDrone();
        if (drone) {
          const d = danger * danger;
          drone.gain.gain.setTargetAtTime(d * 0.2 + 0.0001, t, 0.25);
          drone.osc.frequency.setTargetAtTime(52 + danger * 14, t, 0.3);
          drone.sub.frequency.setTargetAtTime(36 + danger * 10, t, 0.3);
        }
        // batimento só bem de perto: dois "tum" mais espaçados que um coração acelerado
        if (danger > 0.65 && t >= nextBeat && !quiet()) {
          const k = (danger - 0.65) * 2;
          tone('sine', 60, 40, 0.14, 0.26 * k, t);
          tone('sine', 56, 38, 0.16, 0.18 * k, t + 0.17);
          nextBeat = t + 1.3 - 0.5 * danger;
        }
      } else if (drone) {
        drone.gain.gain.setTargetAtTime(0.0001, t, 0.3);
      }
      if (trainWarning && t >= nextBell && !quiet()) {
        const f = bellFlip++ % 2 === 0 ? 1175 : 880;
        tone('sine', f, f, 0.28, 0.07, t);
        tone('sine', f * 2.76, f * 2.76, 0.12, 0.025, t);
        nextBell = t + 0.3;
      }
    },
    death(end) {
      const t = ctx.currentTime;
      if (end === 'veiculo') {
        hiss('lowpass', 2200, 200, 0.25, 0.3, t);
        tone('sine', 140, 38, 0.35, 0.4, t);
        tone('square', 520, 160, 0.12, 0.06, t);
      } else if (end === 'trem') {
        tone('sawtooth', 311, 308, 0.5, 0.12, t);
        tone('sawtooth', 392, 388, 0.5, 0.1, t);
        hiss('lowpass', 1800, 150, 0.3, 0.26, t + 0.05);
        tone('sine', 120, 34, 0.4, 0.4, t + 0.05);
      } else if (end === 'mordido') {
        // o estalo da mandíbula e um "gulp"
        tone('square', 320, 140, 0.06, 0.16, t);
        hiss('bandpass', 1400, 600, 0.12, 0.2, t, 1.6);
        tone('sine', 180, 60, 0.3, 0.22, t + 0.08);
      } else if (end === 'atingido') {
        hiss('bandpass', 900, 250, 0.3, 0.26, t, 0.8);
        tone('sine', 130, 40, 0.4, 0.34, t);
        tone('triangle', 420, 160, 0.2, 0.1, t);
      } else if (end === 'escuridao') {
        tone('sine', 200, 40, 1.1, 0.3, t);
        tone('triangle', 90, 30, 1.3, 0.2, t);
        hiss('lowpass', 900, 80, 1.0, 0.14, t);
      } else {
        // água, tora que levou ou pedra que afundou: um mergulho
        hiss('bandpass', 900, 2600, 0.35, 0.16, t, 0.8);
        hiss('lowpass', 1800, 220, 0.5, 0.18, t + 0.04);
        for (let i = 0; i < 3; i++) tone('sine', 520 + i * 90, 900 + i * 120, 0.07, 0.045, t + 0.18 + i * 0.1);
      }
      if (drone) drone.gain.gain.setTargetAtTime(0.0001, t, 0.1);
      if (siren) siren.gain.gain.setTargetAtTime(0.0001, t, 0.05);
    },
    pause() {
      void ctx.suspend();
    },
    resume() {
      void ctx.resume();
    },
    stop() {
      stopAmbience();
      if (siren) {
        const t = ctx.currentTime;
        siren.gain.gain.cancelScheduledValues(t);
        siren.gain.gain.setValueAtTime(0.0001, t);
        siren.osc.stop(t + 0.05);
        siren.lfo.stop(t + 0.05);
        siren = null;
      }
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
