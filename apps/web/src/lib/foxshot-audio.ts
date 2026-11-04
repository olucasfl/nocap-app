import { FS_HEAR_RANGE, type FsWeaponId } from '@nocap/games';
import { audioKit } from './sfx';

/**
 * Sons do Counter Fox sintetizados em Web Audio, respeitando o mudo do `sfx`. São um começo: o caminho para soar de verdade é
 * trocar por gravações que combinem com o jogo (spec 056), e aqui só muda a fonte do som.
 *
 * Como funciona (feito para não picotar, abafar nem estourar):
 *  - cada som é SINTETIZADO UMA VEZ (em um OfflineAudioContext) e guardado em um buffer; tocar é só um nó de reprodução + um
 *    ganho, bem leve mesmo a 600 tiros por minuto. Antes cada tiro montava vários filtros e osciladores na hora, e o áudio
 *    falhava quando o jogo oscilava de fps;
 *  - tudo passa por um limitador (compressor rápido de pico) antes da saída, então a soma de vários sons não estoura;
 *  - nós usados são soltos no fim, e há um teto de vozes simultâneas (sons de pouca importância, como passos, cedem a vez).
 */
const phone = (): boolean => {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};

type Kit = NonNullable<ReturnType<typeof audioKit>>;

// ------------------------------------------------------------------ receitas (sintetizadas offline)
interface Synth {
  burst(o: { type: BiquadFilterType; freq: number; q?: number; dur: number; peak: number; delay?: number; freqEnd?: number }): void;
  tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay?: number): void;
}

const jit = (v: number, k = 0.06) => v * (1 + (Math.random() * 2 - 1) * k);

function makeSynth(ctx: BaseAudioContext, dest: AudioNode, small: boolean): Synth {
  const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return {
    burst(o) {
      const t = o.delay ?? 0;
      const src = ctx.createBufferSource();
      src.buffer = nb;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = o.type;
      f.frequency.setValueAtTime(o.freq, t);
      if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.dur);
      f.Q.value = o.q ?? 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.peak), t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.002 + o.dur);
      src.connect(f).connect(g).connect(dest);
      src.start(t, Math.random() * 0.3);
      src.stop(t + o.dur + 0.05);
    },
    tone(type, f0, f1, dur, peak, delay = 0) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = small && (type === 'square' || type === 'sawtooth') ? 'triangle' : type;
      o.frequency.setValueAtTime(f0, delay);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), delay + dur);
      g.gain.setValueAtTime(0.0001, delay);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), delay + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, delay + 0.003 + dur);
      o.connect(g).connect(dest);
      o.start(delay);
      o.stop(delay + dur + 0.05);
    },
  };
}

interface Recipe {
  /** Duração do buffer (s) e quantas variações sintetizar (com pequenas diferenças). */
  len: number;
  variants: number;
  make: (s: Synth) => void;
}

const RECIPES: Record<string, Recipe> = {
  'shot-ak': {
    len: 0.45,
    variants: 3,
    make: (s) => {
      s.burst({ type: 'bandpass', freq: jit(1900), q: 0.7, dur: 0.11, peak: 0.5 });
      s.burst({ type: 'highpass', freq: 4500, dur: 0.02, peak: 0.28 });
      s.tone('sine', jit(135), 42, 0.13, 0.6);
      s.burst({ type: 'lowpass', freq: 600, dur: 0.22, peak: 0.1, delay: 0.03 });
    },
  },
  'shot-pistol': {
    len: 0.2,
    variants: 3,
    make: (s) => {
      // silenciada: seca e abafada, com o clique do ferrolho logo depois
      s.burst({ type: 'lowpass', freq: jit(1500), q: 0.6, dur: 0.07, peak: 0.3 });
      s.tone('sine', jit(105), 55, 0.09, 0.28);
      s.burst({ type: 'bandpass', freq: 2600, q: 2, dur: 0.012, peak: 0.14, delay: 0.045 });
    },
  },
  'shot-sniper': {
    len: 1.0,
    variants: 2,
    make: (s) => {
      s.burst({ type: 'bandpass', freq: jit(1100), q: 0.6, dur: 0.2, peak: 0.7 });
      s.burst({ type: 'highpass', freq: 5000, dur: 0.03, peak: 0.4 });
      s.tone('sine', 80, 28, 0.45, 0.8);
      s.burst({ type: 'lowpass', freq: 520, dur: 0.7, peak: 0.16, delay: 0.06 });
    },
  },
  // submetralhadora: estalo curto e seco, mais agudo e mais leve que o do fuzil
  'shot-smg': {
    len: 0.3,
    variants: 3,
    make: (s) => {
      s.burst({ type: 'bandpass', freq: jit(2300), q: 0.8, dur: 0.07, peak: 0.36 });
      s.burst({ type: 'highpass', freq: 5000, dur: 0.015, peak: 0.2 });
      s.tone('sine', jit(165), 70, 0.08, 0.38);
      s.burst({ type: 'lowpass', freq: 800, dur: 0.12, peak: 0.07, delay: 0.02 });
    },
  },
  // escopeta: estrondo grave e largo, com estalo agudo na frente e um eco longo
  'shot-shotgun': {
    len: 1.3,
    variants: 2,
    make: (s) => {
      s.tone('sine', 72, 24, 0.55, 0.95);
      s.tone('sine', jit(150), 48, 0.2, 0.6);
      s.burst({ type: 'bandpass', freq: jit(700), q: 0.5, dur: 0.28, peak: 0.85 });
      s.burst({ type: 'highpass', freq: 3500, dur: 0.05, peak: 0.5 });
      s.burst({ type: 'lowpass', freq: 380, dur: 0.9, peak: 0.22, delay: 0.05 });
      s.burst({ type: 'bandpass', freq: 500, q: 0.6, dur: 0.4, peak: 0.1, delay: 0.14 });
    },
  },
  // fuzil leve: estalo mais agudo e seco que o do outro fuzil
  'shot-m4': {
    len: 0.4,
    variants: 3,
    make: (s) => {
      s.burst({ type: 'bandpass', freq: jit(2700), q: 0.8, dur: 0.09, peak: 0.46 });
      s.burst({ type: 'highpass', freq: 5500, dur: 0.02, peak: 0.28 });
      s.tone('sine', jit(150), 52, 0.11, 0.52);
      s.burst({ type: 'lowpass', freq: 700, dur: 0.18, peak: 0.1, delay: 0.03 });
    },
  },
  // pistola silenciada de precisão: só um "pft" abafado e o clique do ferrolho; quase nada de estampido
  'shot-usp': {
    len: 0.18,
    variants: 2,
    make: (s) => {
      s.burst({ type: 'lowpass', freq: jit(850), q: 0.5, dur: 0.05, peak: 0.15 });
      s.tone('sine', jit(115), 68, 0.05, 0.1);
      s.burst({ type: 'bandpass', freq: jit(3200), q: 3, dur: 0.008, peak: 0.05, delay: 0.035 });
    },
  },
  // granadas: pino, arremesso, quique e as duas explosões
  'nade-pin': {
    len: 0.25,
    variants: 1,
    make: (s) => {
      s.tone('triangle', 2600, 1800, 0.05, 0.2);
      s.burst({ type: 'bandpass', freq: 3000, q: 4, dur: 0.012, peak: 0.25, delay: 0.06 });
      s.tone('triangle', 1500, 1100, 0.04, 0.12, 0.1);
    },
  },
  'nade-throw': { len: 0.4, variants: 1, make: (s) => s.burst({ type: 'bandpass', freq: 500, freqEnd: 1800, q: 0.7, dur: 0.28, peak: 0.16 }) },
  'nade-bounce': {
    len: 0.3,
    variants: 2,
    make: (s) => {
      s.tone('triangle', jit(1900), 1300, 0.07, 0.22);
      s.burst({ type: 'bandpass', freq: jit(2400), q: 2, dur: 0.03, peak: 0.2 });
      s.tone('sine', 140, 80, 0.06, 0.2);
    },
  },
  // explosão: estrondo grave longo, estalo, crepitar e a cauda de eco
  'boom-frag': {
    len: 2.2,
    variants: 1,
    make: (s) => {
      s.tone('sine', 62, 20, 0.9, 1.0);
      s.tone('sine', 120, 40, 0.35, 0.7);
      s.burst({ type: 'lowpass', freq: 320, q: 0.5, dur: 1.2, peak: 0.55 });
      s.burst({ type: 'bandpass', freq: 900, q: 0.5, dur: 0.35, peak: 0.8 });
      s.burst({ type: 'highpass', freq: 3000, dur: 0.12, peak: 0.55 });
      s.burst({ type: 'bandpass', freq: 1400, q: 0.8, dur: 0.5, peak: 0.18, delay: 0.12 });
      s.burst({ type: 'lowpass', freq: 260, dur: 1.0, peak: 0.2, delay: 0.3 });
    },
  },
  // granada de luz: estalo agudo muito alto, chiado e zumbido curto
  'boom-flash': {
    len: 1.2,
    variants: 1,
    make: (s) => {
      s.burst({ type: 'highpass', freq: 2200, dur: 0.14, peak: 0.95 });
      s.burst({ type: 'bandpass', freq: 2600, q: 0.6, dur: 0.3, peak: 0.7 });
      s.tone('sine', 1200, 600, 0.12, 0.5);
      s.burst({ type: 'highpass', freq: 4000, dur: 0.6, peak: 0.18, delay: 0.1 });
    },
  },
  'shot-knife': {
    len: 0.2,
    variants: 2,
    make: (s) => s.burst({ type: 'bandpass', freq: jit(2800), q: 1.2, dur: 0.12, peak: 0.14 }),
  },
  dry: {
    // gatilho puxado sem bala: o "clique" do cão batendo no vazio (estalo agudo + pancada metálica + eco curto)
    len: 0.2,
    variants: 1,
    make: (s) => {
      s.burst({ type: 'highpass', freq: 1500, dur: 0.022, peak: 0.5 });
      s.burst({ type: 'bandpass', freq: 650, q: 3, dur: 0.06, peak: 0.45, delay: 0.004 });
      s.tone('triangle', 2300, 1500, 0.05, 0.12, 0.003);
      s.burst({ type: 'highpass', freq: 1800, dur: 0.012, peak: 0.2, delay: 0.07 });
    },
  },
  magOut: {
    len: 0.15,
    variants: 1,
    make: (s) => {
      s.burst({ type: 'bandpass', freq: 2200, q: 2, dur: 0.02, peak: 0.2 });
      s.tone('triangle', 260, 180, 0.05, 0.14, 0.01);
    },
  },
  magIn: {
    len: 0.18,
    variants: 1,
    make: (s) => {
      s.tone('triangle', 200, 140, 0.07, 0.22);
      s.burst({ type: 'bandpass', freq: 1800, q: 2, dur: 0.025, peak: 0.22, delay: 0.015 });
    },
  },
  bolt: {
    len: 0.25,
    variants: 1,
    make: (s) => {
      s.burst({ type: 'bandpass', freq: 3400, q: 3, dur: 0.018, peak: 0.2 });
      s.burst({ type: 'bandpass', freq: 2200, q: 3, dur: 0.02, peak: 0.2, delay: 0.09 });
      s.tone('triangle', 420, 300, 0.04, 0.1, 0.09);
    },
  },
  draw: { len: 0.14, variants: 1, make: (s) => s.burst({ type: 'lowpass', freq: 1400, q: 0.5, dur: 0.07, peak: 0.12 }) },
  'hit-head': {
    len: 0.2,
    variants: 1,
    make: (s) => {
      s.tone('sine', 1750, 1750, 0.09, 0.26);
      s.tone('sine', 2650, 2650, 0.07, 0.13, 0.01);
    },
  },
  'hit-kill': {
    len: 0.3,
    variants: 1,
    make: (s) => {
      s.tone('sine', 1100, 1100, 0.14, 0.24);
      s.tone('sine', 1650, 1650, 0.14, 0.16, 0.05);
      s.tone('sine', 90, 60, 0.18, 0.36);
    },
  },
  'hit-armor': {
    len: 0.12,
    variants: 1,
    make: (s) => {
      s.tone('square', 520, 480, 0.04, 0.13);
      s.burst({ type: 'bandpass', freq: 2400, q: 3, dur: 0.02, peak: 0.11 });
    },
  },
  'hit-body': { len: 0.1, variants: 1, make: (s) => s.tone('square', 880, 800, 0.03, 0.15) },
  impact: {
    len: 0.12,
    variants: 2,
    make: (s) => s.burst({ type: 'bandpass', freq: jit(1700), q: 1, dur: 0.05, peak: 0.12 }),
  },
  stab: {
    len: 0.18,
    variants: 1,
    make: (s) => {
      s.burst({ type: 'bandpass', freq: 900, q: 1.5, dur: 0.06, peak: 0.3 });
      s.tone('sine', 180, 90, 0.08, 0.28);
    },
  },
  jump: { len: 0.12, variants: 1, make: (s) => s.burst({ type: 'lowpass', freq: 500, dur: 0.06, peak: 0.1 }) },
  hurt: {
    // levar tiro: pancada no corpo (grave) + estalo curto
    len: 0.25,
    variants: 1,
    make: (s) => {
      s.tone('sine', 140, 55, 0.14, 0.5);
      s.burst({ type: 'bandpass', freq: 1200, q: 1, dur: 0.05, peak: 0.3 });
      s.burst({ type: 'lowpass', freq: 500, dur: 0.15, peak: 0.2, delay: 0.02 });
    },
  },
};

/**
 * Passo bem suave (sapato macio em piso firme): é o "chf" curto do solado, não uma pancada.
 *  1. corpo: ruído filtrado em faixa média (~500 a 1800 Hz), entrada lenta (~10 ms) e queda rápida: o roçar/apoio da sola;
 *  2. calcanhar: só um sopro grave (~130 Hz) por baixo, bem fraco, para dar peso sem virar "tum";
 *  3. ponta do pé: um segundo "chf" menor, um instante depois (o pé rola e assenta).
 * 5 variações com tempos e filtros sorteados; fim com descida suave (sem corte seco).
 */
function stepBuffer(ctx: BaseAudioContext, v: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.2);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const pole = (fc: number) => 1 - Math.exp((-2 * Math.PI * fc) / sr);
  const aHi = pole(1500 + v * 140);
  const aLo = pole(480 + v * 40);
  const aHeel = pole(120 + v * 12);
  let hi = 0;
  let lo = 0;
  let heel = 0;
  const toeAt = 0.05 + v * 0.004;
  const smooth = (x: number) => x * x * (3 - 2 * x);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const w = Math.random() * 2 - 1;
    hi += aHi * (w - hi);
    lo += aLo * (w - lo);
    heel += aHeel * (w - heel);
    const band = hi - lo; // faixa média
    const e1 = smooth(Math.min(1, t / 0.01)) * Math.exp(-t * 46);
    const tt = Math.max(0, t - toeAt);
    const e2 = t >= toeAt ? smooth(Math.min(1, tt / 0.01)) * Math.exp(-tt * 60) : 0;
    d[i] = band * 4.2 * (e1 + 0.45 * e2) + heel * 2.4 * e1 * 0.35;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]!));
  for (let i = 0; i < n; i++) d[i] = (d[i]! / (peak || 1)) * 0.8;
  const fadeN = Math.floor(sr * 0.025);
  for (let i = 0; i < fadeN; i++) d[n - 1 - i] = d[n - 1 - i]! * (i / fadeN);
  return buf;
}

// ------------------------------------------------------------------ banco de sons e saída
let bank: { ctx: AudioContext; bufs: Map<string, AudioBuffer[]>; building: boolean } | null = null;
let bus: { ctx: AudioContext; input: AudioNode; muffle: BiquadFilterNode } | null = null;
let voices = 0;
const MAX_VOICES = 24;

/** Entrada do jogo: ganho + limitador de pico (a soma de vários sons nunca passa de 0 dB: nada de estourar). */
function busFor(kit: Kit): AudioNode {
  if (!bus || bus.ctx !== kit.ctx) {
    const input = kit.ctx.createGain();
    input.gain.value = phone() ? 0.55 : 0.8;
    const lim = kit.ctx.createDynamicsCompressor();
    lim.threshold.value = -8;
    lim.knee.value = 4;
    lim.ratio.value = 14;
    lim.attack.value = 0.001;
    lim.release.value = 0.08;
    // filtro que "abafa" tudo quando a granada de luz estoura (zumbido nos ouvidos)
    const muffle = kit.ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 20000;
    input.connect(muffle).connect(lim).connect(kit.out);
    bus = { ctx: kit.ctx, input, muffle };
  }
  return bus.input;
}

function bankFor(kit: Kit) {
  if (!bank || bank.ctx !== kit.ctx) bank = { ctx: kit.ctx, bufs: new Map(), building: false };
  return bank;
}

/** Sintetiza todos os sons de uma vez (rápido: são sons curtos). Os primeiros instantes do jogo tocam depois que isto termina. */
function build(kit: Kit) {
  const b = bankFor(kit);
  if (b.building || b.bufs.size > 0) return;
  b.building = true;
  const sr = kit.ctx.sampleRate;
  const small = phone();
  const tasks: Promise<void>[] = [];
  for (const [name, r] of Object.entries(RECIPES)) {
    const list: AudioBuffer[] = [];
    b.bufs.set(name, list);
    for (let v = 0; v < r.variants; v++) {
      try {
        const oc = new OfflineAudioContext(1, Math.ceil(sr * r.len), sr);
        r.make(makeSynth(oc, oc.destination, small));
        tasks.push(
          oc
            .startRendering()
            .then((buf) => {
              list.push(buf);
            })
            .catch(() => undefined),
        );
      } catch {
        /* sem OfflineAudioContext: esse som fica mudo */
      }
    }
  }
  b.bufs.set('step', Array.from({ length: 5 }, (_, v) => stepBuffer(kit.ctx, v)));
  void Promise.all(tasks).then(() => {
    b.building = false;
  });
}

interface PlayOpts {
  gain?: number;
  rate?: number;
  /** Sons de pouca importância (passos) são descartados quando há vozes demais. */
  minor?: boolean;
  /** Nó de destino alternativo (som 3D). */
  dest?: AudioNode;
}

function play(name: string, o: PlayOpts = {}) {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  if (kit.ctx.state === 'suspended') void kit.ctx.resume().catch(() => undefined);
  const b = bankFor(kit);
  if (b.bufs.size === 0) {
    build(kit);
    return;
  }
  const list = b.bufs.get(name);
  if (!list || list.length === 0) return;
  if (o.minor && voices >= MAX_VOICES) return;
  const src = kit.ctx.createBufferSource();
  src.buffer = list[Math.floor(Math.random() * list.length)]!;
  src.playbackRate.value = (o.rate ?? 1) * (name.startsWith('shot') || name === 'step' ? 0.96 + Math.random() * 0.08 : 1);
  const g = kit.ctx.createGain();
  g.gain.value = o.gain ?? 1;
  src.connect(g).connect(o.dest ?? busFor(kit));
  voices++;
  src.addEventListener('ended', () => {
    voices = Math.max(0, voices - 1);
    try {
      src.disconnect();
      g.disconnect();
    } catch {
      /* já solto */
    }
  });
  src.start();
}

export const fsAudio = {
  /** Prepara os sons (chame quando o jogo abrir, depois de um clique). */
  init() {
    const kit = audioKit();
    if (kit) build(kit);
  },
  /** Tiro de cada arma. */
  shot(id: FsWeaponId) {
    play(`shot-${id}`);
  },
  /** Gatilho puxado sem bala. */
  dry() {
    play('dry');
  },
  /** Fases da recarga: tirar o carregador, colocar, puxar o ferrolho. */
  magOut() {
    play('magOut');
  },
  magIn() {
    play('magIn');
  },
  bolt() {
    play('bolt');
  },
  draw() {
    play('draw');
  },
  /** Marcador de acerto: corpo, cabeça e abate. */
  hit(kind: 'body' | 'head' | 'kill' | 'armor') {
    play(`hit-${kind}`);
  },
  impact() {
    play('impact', { minor: true });
  },
  /** Faca acertando alguém. */
  stab() {
    play('stab');
  },
  /** Você levou um tiro. */
  hurt() {
    play('hurt');
  },
  /**
   * Tiro de outro jogador em (x, y, z): vem da direção dele (som 3D), mais baixo e mais "abafado" com a distância e some além
   * do alcance da arma (pistola 22 m, fuzil 40 m, sniper 80 m).
   */
  shotAt(id: FsWeaponId, x: number, y: number, z: number, listenerX: number, listenerZ: number) {
    const kit = audioKit();
    if (!kit || kit.muted() || id === 'knife') return;
    const range = FS_HEAR_RANGE[id];
    const d = Math.hypot(x - listenerX, z - listenerZ);
    if (d > range) return;
    const k = d / range; // 0 perto, 1 no limite
    const fade = k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
    // o ar come os agudos: de longe o tiro fica mais grave e surdo
    const air = kit.ctx.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = 12000 - 10500 * Math.min(1, k * 1.1);
    const p = kit.ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = 5;
    p.rolloffFactor = 1.1;
    p.maxDistance = range;
    try {
      if (p.positionX) {
        p.positionX.value = x;
        p.positionY.value = y;
        p.positionZ.value = z;
      } else p.setPosition(x, y, z);
    } catch {
      /* sem posição: toca no centro */
    }
    air.connect(p).connect(busFor(kit));
    const loud = ({ sniper: 1.1, ak: 0.9, m4: 0.85, smg: 0.75, shotgun: 1.25, pistol: 0.6, usp: 0.28, knife: 0 } as Record<FsWeaponId, number>)[id];
    play(`shot-${id}`, { gain: loud * fade * 1.4, dest: air });
    window.setTimeout(() => {
      air.disconnect();
      p.disconnect();
    }, 1400);
  },
  /** Sons das granadas que você joga (sem direção). */
  nade(name: 'pin' | 'throw') {
    play(`nade-${name}`);
  },
  /** Quique e explosões no mundo: som 3D, mais baixo e abafado com a distância, e some além do alcance. */
  nadeAt(name: 'bounce' | 'boom-frag' | 'boom-flash', x: number, y: number, z: number, listenerX: number, listenerZ: number) {
    const kit = audioKit();
    if (!kit || kit.muted()) return;
    const range = name === 'bounce' ? 20 : name === 'boom-frag' ? 75 : 60;
    const d = Math.hypot(x - listenerX, z - listenerZ);
    if (d > range) return;
    const k = d / range;
    const fade = k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
    const air = kit.ctx.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = 12000 - 10000 * Math.min(1, k * 1.1);
    const p = kit.ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = name === 'bounce' ? 2 : 6;
    p.rolloffFactor = 1.1;
    p.maxDistance = range;
    try {
      if (p.positionX) {
        p.positionX.value = x;
        p.positionY.value = y;
        p.positionZ.value = z;
      } else p.setPosition(x, y, z);
    } catch {
      /* sem posição */
    }
    air.connect(p).connect(busFor(kit));
    play(`nade-${name === 'bounce' ? 'bounce' : name}`.replace('nade-boom', 'boom'), { gain: (name === 'bounce' ? 0.7 : 1.3) * fade, dest: air });
    window.setTimeout(() => {
      air.disconnect();
      p.disconnect();
    }, 2600);
  },
  /** Granada de luz: zumbido nos ouvidos e tudo abafado, que vai passando aos poucos (`seconds`). */
  deafen(seconds: number) {
    const kit = audioKit();
    if (!kit || kit.muted() || seconds <= 0.05) return;
    const b = busFor(kit) && bus;
    if (!b) return;
    const t = kit.ctx.currentTime;
    b.muffle.frequency.cancelScheduledValues(t);
    b.muffle.frequency.setValueAtTime(500, t);
    b.muffle.frequency.setValueAtTime(500, t + seconds * 0.35);
    b.muffle.frequency.exponentialRampToValueAtTime(20000, t + seconds);
    const o = kit.ctx.createOscillator();
    const g = kit.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 3150;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.15);
    g.gain.setValueAtTime(0.06, t + seconds * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    o.connect(g).connect(kit.out);
    o.start(t);
    o.stop(t + seconds + 0.1);
    o.addEventListener('ended', () => {
      try {
        o.disconnect();
        g.disconnect();
      } catch {
        /* já solto */
      }
    });
  },
  /** Seu passo (fica na orelha, baixo). */
  step() {
    play('step', { gain: 0.07, minor: true });
  },
  jump() {
    play('jump', { minor: true });
  },
  /** Onde está o ouvinte (a câmera) e para onde olha: usado para o som dos passos dos outros vir da direção certa. */
  listener(x: number, y: number, z: number, fwd: [number, number, number]) {
    const kit = audioKit();
    if (!kit) return;
    const l = kit.ctx.listener;
    try {
      if (l.positionX) {
        l.positionX.value = x;
        l.positionY.value = y;
        l.positionZ.value = z;
        l.forwardX.value = fwd[0];
        l.forwardY.value = fwd[1];
        l.forwardZ.value = fwd[2];
        l.upX.value = 0;
        l.upY.value = 1;
        l.upZ.value = 0;
      } else {
        l.setPosition(x, y, z);
        l.setOrientation(fwd[0], fwd[1], fwd[2], 0, 1, 0);
      }
    } catch {
      /* sem áudio posicional neste navegador */
    }
  },
  /**
   * Passo de outro jogador em (x, y, z): vem da direção dele (som 3D), mais alto de perto e mais baixo de longe; passa de
   * ~18 m não se escuta. Quem anda devagar (Shift) ou agachado não chama isto (fica em silêncio).
   */
  stepAt(x: number, y: number, z: number, listenerX: number, listenerZ: number) {
    const kit = audioKit();
    if (!kit || kit.muted()) return;
    const d = Math.hypot(x - listenerX, z - listenerZ);
    if (d > 18) return;
    const fade = d > 12 ? Math.max(0, (18 - d) / 6) : 1;
    const p = kit.ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = 1.5;
    p.rolloffFactor = 1.6;
    p.maxDistance = 40;
    try {
      if (p.positionX) {
        p.positionX.value = x;
        p.positionY.value = y + 0.1;
        p.positionZ.value = z;
      } else p.setPosition(x, y + 0.1, z);
    } catch {
      /* sem posição: toca no centro */
    }
    p.connect(busFor(kit));
    // o passo dos outros é mais forte que o seu (que fica na orelha), para dar para ouvir de longe
    play('step', { gain: 0.28 * fade, minor: true, dest: p });
    window.setTimeout(() => p.disconnect(), 400);
  },
};
