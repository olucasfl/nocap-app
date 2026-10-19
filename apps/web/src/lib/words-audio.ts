import { audioKit } from './sfx';

/**
 * Sons do Word's, todos sintetizados em Web Audio (sem arquivos) e respeitando o botão de mudo.
 * Cada cor do palpite tem a sua altura: cinza grave, amarelo médio, verde agudo.
 */
function tone(freq: number, at: number, dur: number, type: OscillatorType = 'triangle', vol = 0.18) {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  const { ctx, out } = kit;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const CELL_FREQ = { m: 196, n: 330, h: 523 } as const;

export const wordsAudio = {
  key() {
    tone(660, 0, 0.04, 'square', 0.05);
  },
  /** As cores de um palpite, uma por casa, no ritmo da virada. */
  row(pattern: string) {
    [...pattern].forEach((c, i) => tone(CELL_FREQ[c as keyof typeof CELL_FREQ] ?? 196, i * 0.25 + 0.1, 0.16));
  },
  invalid() {
    tone(150, 0, 0.12, 'sawtooth', 0.1);
    tone(130, 0.1, 0.14, 'sawtooth', 0.1);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 1.4 + i * 0.11, 0.25));
  },
  lose() {
    [392, 330, 262].forEach((f, i) => tone(f, 1.4 + i * 0.18, 0.3, 'sine', 0.16));
  },
};
