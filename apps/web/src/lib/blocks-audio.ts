import { audioKit } from './sfx';

/**
 * O som do Block's, todo sintetizado (Web Audio, sem arquivos): pegar a peça, encaixar (o tom
 * sobe com o tamanho da peça), errar, limpar linhas (o tom sobe com as linhas e com a sequência),
 * o joinha, o PERFECT, a dica e o fim da partida.
 */
export interface BlocksAudio {
  pick(): void;
  drop(size: number): void;
  bad(): void;
  clear(lines: number, streak: number): void;
  thumb(): void;
  perfect(): void;
  hint(): void;
  over(): void;
}

/** Escala de dó maior pentatônica: as limpezas soam como uma melodia que sobe, não como barulho. */
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export function createBlocksAudio(): BlocksAudio | null {
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

  function hiss(f0: number, f1: number, dur: number, peak: number, delay = 0) {
    if (muted()) return;
    const when = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noise;
    f.type = 'bandpass';
    f.frequency.setValueAtTime(f0, when);
    f.frequency.exponentialRampToValueAtTime(f1, when + dur);
    f.Q.value = 1.2;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(out);
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  return {
    pick() {
      tone('triangle', 520, 700, 0.07, 0.07);
    },
    drop(size) {
      // Peça maior, "thunk" mais grave e mais cheio.
      const base = 210 - Math.min(size, 9) * 9;
      tone('sine', base * 1.6, base, 0.12, 0.2);
      tone('triangle', base * 3, base * 2, 0.06, 0.06);
      hiss(900, 300, 0.07, 0.05);
    },
    bad() {
      tone('square', 190, 120, 0.16, 0.07);
      tone('square', 150, 95, 0.18, 0.06, 0.07);
    },
    clear(lines, streak) {
      const n = Math.max(1, Math.min(lines, 6));
      const start = Math.min(streak, 4);
      // Uma subida de notas, uma por linha limpa; a sequência empurra a melodia para cima.
      for (let i = 0; i < n + 2; i++) {
        const f = SCALE[Math.min(SCALE.length - 1, start + i)]!;
        tone('triangle', f, f, 0.2, 0.16, i * 0.065);
        tone('sine', f * 2, f * 2, 0.16, 0.05, i * 0.065);
      }
      hiss(2400, 500, 0.3 + n * 0.04, 0.09 + n * 0.012);
      if (n >= 3) tone('sawtooth', 120, 60, 0.35, 0.09);
    },
    thumb() {
      tone('triangle', 659.25, 659.25, 0.1, 0.13);
      tone('triangle', 987.77, 987.77, 0.2, 0.13, 0.09);
    },
    perfect() {
      const chord = [523.25, 659.25, 783.99, 1046.5];
      chord.forEach((f, i) => tone('triangle', f, f, 0.55, 0.12, i * 0.07));
      tone('sine', 1567.98, 1567.98, 0.6, 0.07, 0.3);
      hiss(3200, 800, 0.4, 0.06, 0.05);
    },
    hint() {
      tone('sine', 880, 880, 0.1, 0.09);
      tone('sine', 1174.66, 1174.66, 0.16, 0.09, 0.1);
    },
    over() {
      [392, 329.63, 261.63, 196].forEach((f, i) =>
        tone('triangle', f, f * 0.96, 0.28, 0.13, i * 0.16),
      );
      tone('sawtooth', 110, 55, 0.7, 0.07, 0.4);
    },
  };
}
