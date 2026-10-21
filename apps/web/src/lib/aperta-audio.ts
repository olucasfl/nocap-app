import { audioKit, isMuted } from './sfx';

/**
 * Sons do Aperta!, todos sintetizados em Web Audio (sem arquivos) e respeitando o botão de mudo
 * do módulo `sfx`. Sem música (spec 038, decisão 14). O `clack` é tocado milhares de vezes, então
 * é curto, baixo e sobe por uma escala pentatônica (nunca soa desafinado) em vez de mudar de timbre.
 */

/** Pentatônica maior de dó, duas oitavas: qualquer sequência sobe sem dissonância. */
const PENTA = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880];

/** Frequência do `clack` para o nível do combo (0 = sem combo); trava na nota mais aguda. */
export function clackFrequency(combo: number): number {
  const i = Number.isFinite(combo) ? Math.floor(combo) : 0;
  return PENTA[Math.min(PENTA.length - 1, Math.max(0, i))]!;
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0) {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  const { ctx, out } = kit;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.004 + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(f0: number, f1: number, q: number, dur: number, peak: number, delay = 0) {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  const { ctx, out, noise: buf } = kit;
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
  g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.003 + dur);
  src.connect(fl).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

export const apertaSfx = {
  /** toque no astro; `combo` sobe o tom pela pentatônica */
  clack(combo = 0) {
    const f = clackFrequency(combo);
    tone('triangle', f, f, 0.05, 0.16);
    noise(2400, 2400, 1.2, 0.02, 0.12);
  },
  /** objeto aparecendo na tela */
  whoosh() {
    noise(400, 3200, 0.8, 0.22, 0.18);
  },
  /** capturou o objeto */
  ding() {
    tone('sine', 1319, 1319, 0.22, 0.2);
    tone('sine', 1760, 1760, 0.3, 0.1, 0.06);
  },
  /** abrir ou virar um grimório */
  flip() {
    noise(500, 3500, 0.8, 0.2, 0.2);
    tone('triangle', 330, 520, 0.08, 0.06);
  },
  /** confirmar escolha ou comprar */
  thunk() {
    tone('sine', 170, 42, 0.2, 0.7);
    noise(900, 300, 0.7, 0.06, 0.35);
  },
  /** colapso ou conquista */
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.16, 0.22, 0.09 * i));
  },
  /** erro ou bloqueado (sem saldo) */
  boing() {
    tone('sine', 420, 140, 0.3, 0.3);
    tone('sine', 300, 110, 0.28, 0.1, 0.05);
  },
};

export type ApertaSfxName = keyof typeof apertaSfx;

const VIBRATE_KEY = 'nocap-aperta-vibrate';

/** Vibração ligada por padrão; a escolha fica no aparelho. */
export function vibrationEnabled(): boolean {
  try {
    return localStorage.getItem(VIBRATE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setVibrationEnabled(on: boolean) {
  try {
    localStorage.setItem(VIBRATE_KEY, on ? '1' : '0');
  } catch {
    /* storage indisponível: vale só até recarregar */
  }
}

/** Vibra só onde existe (Android; iOS não suporta), se a pessoa não desligou e fora do mudo. */
export function apertaVibrate(pattern: number | number[] = 8): boolean {
  if (!vibrationEnabled() || isMuted()) return false;
  try {
    return typeof navigator.vibrate === 'function' && navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
