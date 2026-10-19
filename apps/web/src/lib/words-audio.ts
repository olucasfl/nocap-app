import { audioKit } from './sfx';

/**
 * Sons do Word's, todos sintetizados em Web Audio (sem arquivos) e respeitando o botão de mudo.
 * Classic: cada cor do palpite tem a sua altura. Bee: sons de colmeia (estalo de cera, zumbido, acorde de mel).
 * Connect: um acorde por nível de grupo e um "quebra" quando perde uma vida.
 */
type Wave = OscillatorType;

function tone(freq: number, at: number, dur: number, type: Wave = 'triangle', vol = 0.18, slideTo?: number) {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  const { ctx, out } = kit;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

const CELL_FREQ = { m: 196, n: 330, h: 523 } as const;
/** Escala pentatônica para os toques nas letras do favo (cada letra um tom). */
const PENTA = [392, 440, 523, 587, 659, 784, 880];
const CHORDS: Record<number, number[]> = {
  1: [523, 659, 784],
  2: [440, 554, 659],
  3: [392, 494, 587],
  4: [349, 440, 523, 698],
};

export const wordsAudio = {
  // ----- comum -----
  key() {
    tone(660, 0, 0.04, 'square', 0.05);
  },
  tap() {
    tone(520, 0, 0.05, 'triangle', 0.08);
  },
  invalid() {
    tone(150, 0, 0.12, 'sawtooth', 0.1);
    tone(130, 0.1, 0.14, 'sawtooth', 0.1);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.05 + i * 0.11, 0.25));
  },
  lose() {
    [392, 330, 262].forEach((f, i) => tone(f, 0.05 + i * 0.18, 0.3, 'sine', 0.16));
  },

  // ----- Classic -----
  /** As cores de um palpite, uma por casa, no ritmo da virada. */
  row(pattern: string) {
    [...pattern].forEach((c, i) => tone(CELL_FREQ[c as keyof typeof CELL_FREQ] ?? 196, i * 0.26 + 0.1, 0.16));
  },

  // ----- Bee -----
  /** Toque numa letra do favo: estalo de cera, cada letra num tom da escala. */
  honey(slot: number) {
    tone(PENTA[slot % PENTA.length]!, 0, 0.09, 'sine', 0.14);
    tone(PENTA[slot % PENTA.length]! * 2, 0, 0.04, 'triangle', 0.04);
  },
  /** Palavra aceita: gotinha de mel subindo; quanto mais pontos, mais notas. */
  beeFound(points: number) {
    const n = Math.min(4, 1 + Math.floor(points / 3));
    for (let i = 0; i < n; i++) tone(PENTA[i + 2]!, i * 0.07, 0.16, 'triangle', 0.15);
  },
  /** Zumbido curto (a abelha passando). */
  buzz() {
    tone(180, 0, 0.35, 'sawtooth', 0.05, 260);
    tone(184, 0, 0.35, 'sawtooth', 0.05, 266);
  },
  pangram() {
    wordsAudio.buzz();
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12 + i * 0.09, 0.3, 'triangle', 0.17));
  },
  rankUp() {
    [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.22, 'triangle', 0.16));
    tone(1047, 0.45, 0.4, 'sine', 0.14);
  },
  beeReject() {
    tone(220, 0, 0.09, 'square', 0.07, 160);
  },

  // ----- Connect -----
  select() {
    tone(480, 0, 0.05, 'triangle', 0.1);
  },
  deselect() {
    tone(360, 0, 0.05, 'triangle', 0.07);
  },
  /** Grupo achado: acorde do nível (mais grave e cheio nos difíceis). */
  group(level: number) {
    (CHORDS[level] ?? CHORDS[1]!).forEach((f, i) => tone(f, i * 0.05, 0.4, 'triangle', 0.13));
  },
  oneAway() {
    tone(587, 0, 0.1, 'triangle', 0.12);
    tone(587, 0.13, 0.16, 'triangle', 0.12);
  },
  heartLoss() {
    tone(330, 0, 0.22, 'sawtooth', 0.09, 110);
  },
};
