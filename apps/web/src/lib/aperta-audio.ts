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

/**
 * Barramento do Aperta!: um compressor entre os sons e a saída. Toques seguidos e sons juntos (captura + clique) nunca
 * estouram nem "travam" o áudio, e o volume fica parelho.
 */
let bus: { ctx: AudioContext; node: AudioNode } | null = null;
function busFor(kit: NonNullable<ReturnType<typeof audioKit>>): AudioNode {
  if (!bus || bus.ctx !== kit.ctx) {
    const comp = kit.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    comp.connect(kit.out);
    bus = { ctx: kit.ctx, node: comp };
  }
  return bus.node;
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0) {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  const { ctx } = kit;
  const out = busFor(kit);
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

function noise(f0: number, f1: number, q: number, dur: number, peak: number, delay = 0, type: BiquadFilterType = 'bandpass') {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  const { ctx, noise: buf } = kit;
  const out = busFor(kit);
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  const fl = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = buf;
  fl.type = type;
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

let recentClicks: number[] = [];

export const apertaSfx = {
  /**
   * Toque no astro: um "tec" seco e firme, sempre o mesmo som (nada de nota que sobe). Três camadas curtas tocadas no
   * instante do toque: estalo de ar, corpo grave que cai rápido e um brilho leve. Só a afinação varia uns 1% de um toque
   * para outro, para não cansar. Com muitos toques em 100 ms (mais de 8), só tocam o estalo e o corpo, para não pesar.
   * O parâmetro `combo` fica por compatibilidade e não muda o som.
   */
  clack(_combo = 0) {
    void _combo;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    recentClicks = recentClicks.filter((t) => now - t < 100);
    recentClicks.push(now);
    const v = 1 + (Math.random() - 0.5) * 0.02;
    noise(4200, 4200, 0.8, 0.012, 0.22, 0, 'highpass');
    tone('sine', 230 * v, 105 * v, 0.06, 0.42);
    if (recentClicks.length <= 8) tone('triangle', 920 * v, 880 * v, 0.05, 0.07);
  },
  /** comprou um item ou gerador: baque de moeda e dois brilhos que sobem (sinal de "ganhei algo") */
  buy() {
    tone('sine', 190, 60, 0.16, 0.55);
    noise(1200, 400, 0.7, 0.05, 0.25);
    tone('triangle', 988, 988, 0.12, 0.16, 0.05);
    tone('triangle', 1319, 1319, 0.2, 0.16, 0.12);
  },
  /** objeto aparecendo na tela; o asteroide passa grave e a sonda deixa um bipe */
  whoosh(kind?: 'asteroid' | 'probe') {
    if (kind === 'asteroid') noise(180, 1400, 0.9, 0.3, 0.22);
    else noise(400, 3200, 0.8, 0.22, 0.18);
    if (kind === 'probe') tone('sine', 1568, 1568, 0.08, 0.07, 0.16);
  },
  /** capturou o objeto */
  ding(kind?: 'asteroid' | 'probe') {
    if (kind === 'asteroid') {
      tone('triangle', 659, 659, 0.2, 0.22);
      tone('sine', 165, 90, 0.16, 0.3);
      return;
    }
    tone('sine', 1319, 1319, 0.22, 0.2);
    tone('sine', 1760, 1760, 0.3, 0.1, 0.06);
    if (kind === 'probe') tone('sine', 2093, 2093, 0.24, 0.07, 0.12);
  },
  /** abrir página (Melhorias, Conquistas, Árvore): sopro curto e baixo, mais manso que o `flip` */
  page() {
    noise(500, 1800, 0.8, 0.12, 0.1);
  },
  /** estrela pronta para colapsar: arpejo que sobe e fica no ar */
  ready() {
    [392, 523, 659, 784].forEach((f, i) => tone('sine', f, f, 0.34, 0.12, 0.1 * i));
  },
  /** colapso confirmado: queda grave, estouro de ruído e o acorde da conquista por cima */
  collapse() {
    tone('sine', 140, 32, 0.7, 0.8);
    noise(2400, 160, 0.6, 0.5, 0.4);
    [392, 523, 659, 988].forEach((f, i) => tone('triangle', f, f, 0.5, 0.16, 0.34 + 0.09 * i));
  },
  /** trocou de região: varrida que abre e fecha */
  warp() {
    noise(300, 2600, 0.7, 0.3, 0.2);
    tone('triangle', 220, 440, 0.3, 0.1);
  },
  /** novidade no espaço (faixa Novo no espaço): dois toques de sino */
  chime() {
    tone('sine', 880, 880, 0.3, 0.15);
    tone('sine', 1319, 1319, 0.4, 0.12, 0.12);
  },
  /** chuva de meteoros começou: riscos agudos em sequência */
  shower() {
    [2093, 1760, 2349, 1568, 2637].forEach((f, i) => {
      tone('sine', f, f * 0.6, 0.12, 0.08, 0.07 * i);
      noise(5000, 2000, 1.5, 0.08, 0.05, 0.07 * i);
    });
  },
  /** tempestade solar começou: estrondo que sobe devagar */
  storm() {
    noise(150, 2200, 0.6, 0.7, 0.28);
    tone('sawtooth', 70, 110, 0.6, 0.1);
  },
  /** missão da estação cumprida */
  mission() {
    tone('triangle', 784, 784, 0.14, 0.2);
    tone('triangle', 988, 988, 0.14, 0.2, 0.1);
    tone('triangle', 1319, 1319, 0.34, 0.22, 0.2);
  },
  /** marcou o favorito */
  star() {
    tone('sine', 1568, 1568, 0.16, 0.14);
    tone('sine', 2349, 2349, 0.3, 0.1, 0.07);
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
  /** erro ou bloqueado (sem saldo): duas notas que descem, curtas e macias, sem susto */
  boing() {
    tone('triangle', 330, 262, 0.1, 0.22);
    tone('triangle', 247, 196, 0.16, 0.22, 0.09);
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
