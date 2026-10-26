import type { BadSpell, GoodSpell } from '@nocap/games';
import { audioKit } from './sfx';

/**
 * O som do Block Towers, todo sintetizado (Web Audio): o tique de mover, o clique de girar, a
 * batida da peça (mais forte quanto mais rápido bateu), o sininho de assentar (sobe a escala
 * conforme a torre cresce), o assobio da peça que cai, o coração que racha, o estrondo de "caiu
 * tudo" e um som próprio para cada magia, boa ou ruim.
 */
export interface TowersAudio {
  spawn(): void;
  move(): void;
  rotate(): void;
  blocked(): void;
  land(speed: number): void;
  release(): void;
  settle(stacked: number): void;
  fall(): void;
  lifeLost(): void;
  lifeUp(): void;
  collapse(): void;
  spell(good: boolean): void;
  cast(name: GoodSpell | BadSpell): void;
  over(): void;
  win(): void;
  /** Contagem de preparação: 3, 2, 1 e, no 0, o "vai". */
  count(n: number): void;
}

/** Escala pentatônica de dó maior em duas oitavas: assentar cada peça é uma nota que sobe. */
const SCALE = [
  261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66,
  1318.51,
];

export function createTowersAudio(): TowersAudio | null {
  const kit = audioKit();
  if (!kit) return null;
  const { ctx, out, noise, muted } = kit;

  function tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    peak: number,
    delay = 0,
  ) {
    if (muted()) return;
    const when = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  function hiss(
    filter: BiquadFilterType,
    f0: number,
    f1: number,
    dur: number,
    peak: number,
    delay = 0,
    q = 1,
  ) {
    if (muted()) return;
    const when = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noise;
    f.type = filter;
    f.frequency.setValueAtTime(f0, when);
    f.frequency.exponentialRampToValueAtTime(f1, when + dur);
    f.Q.value = q;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(out);
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  return {
    spawn() {
      tone('sine', 380, 520, 0.08, 0.05);
    },
    move() {
      tone('triangle', 330, 300, 0.035, 0.03);
    },
    rotate() {
      tone('triangle', 520, 700, 0.06, 0.07);
      tone('triangle', 700, 880, 0.05, 0.05, 0.04);
    },
    blocked() {
      tone('square', 150, 110, 0.09, 0.05);
    },
    land(speed) {
      const p = Math.min(0.3, 0.05 + speed * 0.028);
      const base = Math.max(70, 190 - speed * 8);
      tone('sine', base * 1.7, base, 0.14, p);
      tone('triangle', base * 3.1, base * 2, 0.07, p * 0.4);
      hiss('bandpass', 1400, 320, 0.09 + Math.min(speed, 10) * 0.012, p * 0.45, 0, 1.4);
      if (speed > 7) tone('square', 90, 45, 0.22, p * 0.5);
    },
    release() {
      tone('sine', 220, 180, 0.07, 0.07);
    },
    settle(stacked) {
      // O sininho sobe a escala e dá a volta em oitava: a torre crescendo soa como uma melodia.
      const f = SCALE[(stacked - 1) % SCALE.length]!;
      tone('triangle', f, f, 0.28, 0.14);
      tone('sine', f * 2, f * 2, 0.22, 0.05, 0.02);
      tone('sine', f * 3, f * 3, 0.14, 0.025, 0.04);
    },
    fall() {
      tone('sine', 760, 140, 0.7, 0.1);
      tone('triangle', 520, 110, 0.55, 0.05, 0.05);
      hiss('highpass', 4000, 900, 0.5, 0.025);
    },
    lifeLost() {
      // O coração racha (estalo), cai (notas descendo) e bate no chão (baque).
      hiss('highpass', 5000, 2000, 0.07, 0.12);
      tone('sawtooth', 330, 262, 0.2, 0.07, 0.04);
      tone('sawtooth', 262, 196, 0.32, 0.07, 0.22);
      tone('sine', 120, 55, 0.3, 0.2, 0.5);
    },
    lifeUp() {
      tone('sine', 140, 140, 0.1, 0.16);
      tone('sine', 140, 140, 0.1, 0.16, 0.14);
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone('triangle', f, f, 0.3, 0.1, 0.3 + i * 0.07),
      );
    },
    collapse() {
      hiss('lowpass', 500, 70, 1.3, 0.3, 0, 0.8);
      tone('sawtooth', 110, 38, 1.1, 0.15);
      [0.1, 0.28, 0.5, 0.78].forEach((d, i) => tone('sine', 150 - i * 20, 60, 0.18, 0.16, d));
    },
    spell(good) {
      if (good) {
        [1046.5, 1318.51, 1567.98, 2093].forEach((f, i) =>
          tone('triangle', f, f, 0.2, 0.08, i * 0.06),
        );
        hiss('highpass', 6000, 9000, 0.35, 0.03, 0, 0.7);
      } else {
        tone('sawtooth', 233, 110, 0.55, 0.09);
        tone('sawtooth', 247, 117, 0.55, 0.07);
        tone('square', 70, 46, 0.5, 0.06, 0.1);
      }
    },
    cast(name) {
      switch (name) {
        case 'vinha':
          hiss('highpass', 3000, 7000, 0.28, 0.07, 0, 0.9);
          tone('sine', 440, 880, 0.25, 0.07);
          break;
        case 'cimento':
          hiss('lowpass', 900, 200, 0.2, 0.12);
          tone('square', 100, 60, 0.22, 0.09);
          tone('triangle', 1800, 1800, 0.04, 0.05, 0.02);
          break;
        case 'desfazer':
          hiss('bandpass', 400, 3500, 0.4, 0.09, 0, 1.6);
          tone('sine', 300, 900, 0.35, 0.08);
          break;
        case 'vida':
          break;
        default:
          break;
      }
    },
    over() {
      [392, 349.23, 311.13, 261.63, 196].forEach((f, i) =>
        tone('triangle', f, f * 0.97, 0.34, 0.13, i * 0.2),
      );
      tone('sawtooth', 98, 49, 0.9, 0.08, 0.6);
    },
    count(n) {
      if (n > 0) {
        const f = n === 3 ? 392 : n === 2 ? 440 : 494;
        tone('triangle', f, f, 0.18, 0.14);
        tone('sine', f * 2, f * 2, 0.12, 0.04);
      } else {
        [523.25, 659.25, 783.99].forEach((f) => tone('triangle', f, f, 0.45, 0.13));
        hiss('highpass', 5000, 9000, 0.25, 0.04);
      }
    },
    win() {
      [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) =>
        tone('triangle', f, f, 0.4, 0.12, i * 0.09),
      );
    },
  };
}
