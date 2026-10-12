import type { SinalEvent } from '@nocap/games';
import { audioKit } from './sfx';

/**
 * O som do Sinal Vermelho, todo sintetizado (Web Audio): o zumbido que sobe de tom no aviso do
 * Vigia (o mesmo no falso aviso, para ninguém saber), a pancada quando ele olha, o sininho dos
 * poderes, o estalo do esconderijo e o ronco da escuridão, que fica mais forte quanto mais perto.
 */
export interface SinalAudio {
  event(e: SinalEvent): void;
  /** Distância (m) até a escuridão: o ronco cresce quando ela se aproxima. */
  darkness(gapM: number): void;
  rustle(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

export function createSinalAudio(): SinalAudio | null {
  const kit = audioKit();
  if (!kit) return null;
  const { ctx, out, noise } = kit;
  const quiet = () => kit.muted();
  let hum: { osc: OscillatorNode; gain: GainNode } | null = null;

  function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, when = ctx.currentTime, attack = 0.01) {
    if (quiet()) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + dur + 0.05);
  }
  function hiss(filter: BiquadFilterType, f0: number, f1: number, dur: number, peak: number, when = ctx.currentTime) {
    if (quiet()) return;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noise;
    f.type = filter;
    f.frequency.setValueAtTime(f0, when);
    f.frequency.exponentialRampToValueAtTime(f1, when + dur);
    f.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(out);
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  // O ronco da escuridão: um grave contínuo, mais alto quanto mais perto.
  let drone: { osc: OscillatorNode; gain: GainNode } | null = null;
  const startDrone = () => {
    if (drone || quiet()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 52;
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(out);
    osc.start();
    drone = { osc, gain };
  };

  function stopHum() {
    if (!hum) return;
    const t = ctx.currentTime;
    hum.gain.gain.cancelScheduledValues(t);
    hum.gain.gain.setValueAtTime(Math.max(0.0001, hum.gain.gain.value), t);
    hum.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    hum.osc.stop(t + 0.08);
    hum = null;
  }

  return {
    event(e) {
      const t = ctx.currentTime;
      if (e.kind === 'aviso') {
        // zumbido grave que sobe de tom
        stopHum();
        if (quiet()) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        // Cada jeito de olhar tem o seu zumbido: o rápido é um estalo curto e agudo, o duplo
        // sobe depressa, a olhadinha é seca. O normal e o longo sobem devagar.
        const quick = e.variant === 'rapido' || e.variant === 'espia';
        const dur = quick ? 0.32 : e.variant === 'duplo' ? 0.55 : 0.9;
        osc.frequency.setValueAtTime(quick ? 140 : 70, t);
        osc.frequency.exponentialRampToValueAtTime(quick ? 420 : 260, t + dur);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(quick ? 0.2 : 0.14, t + Math.min(0.25, dur * 0.4));
        osc.connect(gain).connect(out);
        osc.start(t);
        hum = { osc, gain };
      } else if (e.kind === 'olhando') {
        stopHum();
        tone('sine', 140, 40, 0.35, 0.7);
        hiss('lowpass', 900, 200, 0.3, 0.3);
      } else if (e.kind === 'voltando') {
        stopHum();
        tone('triangle', 330, 200, 0.12, 0.12);
      } else if (e.kind === 'poder-aviso') {
        // sininho de duas notas: diferente do zumbido do olhar
        tone('triangle', 1318, 1318, 0.16, 0.2, t);
        tone('triangle', 1568, 1568, 0.2, 0.2, t + 0.12);
      } else if (e.kind === 'poder') {
        if (e.power === 'buzina') {
          tone('square', 220, 220, 0.5, 0.3);
          tone('square', 277, 277, 0.5, 0.25);
        } else if (e.power === 'farois') {
          tone('sawtooth', 2400, 600, 0.35, 0.22);
          hiss('highpass', 5000, 9000, 0.3, 0.3);
        } else if (e.power === 'corvos') {
          for (let i = 0; i < 4; i++) tone('sawtooth', 420 - i * 30, 180, 0.22, 0.2, t + i * 0.12);
        } else if (e.power === 'espelho') {
          tone('triangle', 660, 330, 0.18, 0.2, t);
          tone('triangle', 330, 660, 0.18, 0.2, t + 0.16);
        } else if (e.power === 'bebado') {
          for (let i = 0; i < 4; i++) tone('triangle', i % 2 ? 300 : 360, i % 2 ? 360 : 300, 0.2, 0.18, t + i * 0.18);
        } else if (e.power === 'soluco') {
          tone('square', 520, 260, 0.1, 0.22);
        } else if (e.power === 'turbo') {
          tone('sawtooth', 160, 900, 0.5, 0.2);
        } else if (e.power === 'patins') {
          hiss('highpass', 4000, 8000, 0.4, 0.22);
          tone('sine', 1400, 1800, 0.25, 0.12);
        } else if (e.power === 'bolhas') {
          for (let i = 0; i < 4; i++) tone('sine', 700 + i * 220, 1200 + i * 200, 0.12, 0.2, t + i * 0.1);
        } else if (e.power === 'pixelado') {
          [262, 330, 392, 523].forEach((f, i) => tone('square', f, f, 0.08, 0.15, t + i * 0.07));
        } else if (e.power === 'negativo') {
          tone('sawtooth', 880, 110, 0.5, 0.2);
        } else if (e.power === 'lupa') {
          tone('sine', 200, 1000, 0.45, 0.22);
        } else {
          hiss('bandpass', 400, 2400, 0.5, 0.35);
        }
      } else if (e.kind === 'choque') {
        // a pancada: grave seco, mais forte quanto maior o obstáculo
        tone('sine', 150 - 40 * e.size, 45, 0.18 + 0.12 * e.size, 0.35 + 0.35 * e.size);
        hiss('lowpass', 1200, 200, 0.12, 0.2 * e.size);
      } else if (e.kind === 'soluco') {
        tone('square', 520, 260, 0.1, 0.22);
      } else if (e.kind === 'poder-evitado') {
        hiss('highpass', 3000, 6000, 0.12, 0.12);
        tone('sine', 880, 1175, 0.14, 0.14);
      } else if (e.kind === 'quebrou') {
        hiss('bandpass', 2400, 600, 0.22, 0.4);
        tone('square', 220, 90, 0.16, 0.2);
      } else if (e.kind === 'fase') {
        [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.22, 0.25, t + i * 0.09));
      } else if (e.kind === 'fim') {
        stopHum();
        tone('sawtooth', 330, 55, 0.9, 0.3);
        tone('triangle', 165, 40, 1.1, 0.35);
        hiss('lowpass', 900, 150, 0.5, 0.2);
      }
    },
    darkness(gap) {
      startDrone();
      if (!drone) return;
      const near = Math.max(0, Math.min(1, (28 - gap) / 28));
      const t = ctx.currentTime;
      drone.gain.gain.setTargetAtTime(near * near * 0.32 + 0.0001, t, 0.15);
      drone.osc.frequency.setTargetAtTime(52 + near * 26, t, 0.2);
    },
    rustle() {
      hiss('bandpass', 1800, 3600, 0.25, 0.22);
    },
    pause() {
      stopHum();
      void ctx.suspend();
    },
    resume() {
      void ctx.resume();
    },
    stop() {
      stopHum();
      if (drone) {
        const t = ctx.currentTime;
        drone.gain.gain.cancelScheduledValues(t);
        drone.gain.gain.setValueAtTime(Math.max(0.0001, drone.gain.gain.value), t);
        drone.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        drone.osc.stop(t + 0.12);
        drone = null;
      }
      void ctx.resume();
    },
  };
}
