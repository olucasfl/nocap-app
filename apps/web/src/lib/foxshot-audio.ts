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
};

/**
 * Passo suave (piso de concreto/terra seca, sapato macio): três partes calculadas em amostras, todas com subida suave (sem
 * clique) e sem agudo metálico:
 *  1. calcanhar: ruído filtrado bem grave (~220 Hz), a "batida" abafada;
 *  2. ponta do pé: um pouco depois, mais fraca e mais clara (~800 Hz), o "rolar" do pé no chão;
 *  3. grãozinho: um raspar de areia bem baixinho (~2,5 kHz) para o som não ficar sintético.
 * 5 variações com frequências e tempos sorteados, para os passos seguidos não soarem iguais.
 */
function stepBuffer(ctx: BaseAudioContext, v: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.22);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  // filtro passa-baixa de dois polos (dois filtros de um polo em série) para uma curva macia
  const onePole = (fc: number) => 1 - Math.exp((-2 * Math.PI * fc) / sr);
  const heel = { a: onePole(190 + v * 25), y1: 0, y2: 0 };
  const toe = { a: onePole(700 + v * 90), y1: 0, y2: 0 };
  const grit = { a: onePole(2600 + v * 150), y1: 0, y2: 0, hp: 0 };
  const toeAt = 0.034 + v * 0.004;
  const smooth = (x: number) => x * x * (3 - 2 * x);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const w = Math.random() * 2 - 1;
    heel.y1 += heel.a * (w - heel.y1);
    heel.y2 += heel.a * (heel.y1 - heel.y2);
    toe.y1 += toe.a * (w - toe.y1);
    toe.y2 += toe.a * (toe.y1 - toe.y2);
    grit.y1 += grit.a * (w - grit.y1);
    grit.hp = grit.y1 - (grit.y2 += 0.02 * (grit.y1 - grit.y2)); // tira o grave do grão
    const eHeel = smooth(Math.min(1, t / 0.007)) * Math.exp(-t * 42);
    const tt = Math.max(0, t - toeAt);
    const eToe = smooth(Math.min(1, tt / 0.01)) * Math.exp(-tt * 55) * (t >= toeAt ? 1 : 0);
    const eGrit = smooth(Math.min(1, t / 0.012)) * Math.exp(-t * 30);
    d[i] = heel.y2 * 5.2 * eHeel + toe.y2 * 3.2 * eToe * 0.5 + grit.hp * 0.5 * eGrit * 0.18;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]!));
  for (let i = 0; i < n; i++) d[i] = (d[i]! / (peak || 1)) * 0.85;
  // some no fim em vez de cortar seco
  const fadeN = Math.floor(sr * 0.02);
  for (let i = 0; i < fadeN; i++) d[n - 1 - i] = d[n - 1 - i]! * (i / fadeN);
  return buf;
}

// ------------------------------------------------------------------ banco de sons e saída
let bank: { ctx: AudioContext; bufs: Map<string, AudioBuffer[]>; building: boolean } | null = null;
let bus: { ctx: AudioContext; input: AudioNode } | null = null;
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
    input.connect(lim).connect(kit.out);
    bus = { ctx: kit.ctx, input };
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
  shot(id: 'ak' | 'pistol' | 'sniper' | 'knife') {
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
  /** Seu passo (fica na orelha, baixo). */
  step() {
    play('step', { gain: 0.16, minor: true });
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
    play('step', { gain: 0.5 * fade, minor: true, dest: p });
    window.setTimeout(() => p.disconnect(), 400);
  },
};
