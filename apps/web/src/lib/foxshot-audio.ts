import { audioKit } from './sfx';

/**
 * Sons do Fox Shot! sintetizados em Web Audio (tiros, recarga, acertos, passos), respeitando o mudo do `sfx`. São um começo:
 * o caminho para soar de verdade é trocar por gravações que combinem com o jogo (spec 056), e aqui só muda a fonte do som.
 */
const phone = (): boolean => {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};

/** Vozes tocando ao mesmo tempo: passando do limite, sons de pouca importância (passos) são descartados para não embolar nem estourar. */
let voices = 0;
const MAX_VOICES = 28;
function track(node: AudioScheduledSourceNode, ...chain: AudioNode[]) {
  voices++;
  node.addEventListener('ended', () => {
    voices = Math.max(0, voices - 1);
    // solta os nós usados (senão sobram milhares ligados e o som vai ficando abafado e falhando)
    try {
      node.disconnect();
      for (const n of chain) n.disconnect();
    } catch {
      /* já solto */
    }
  });
}
function ready(kit: NonNullable<ReturnType<typeof audioKit>>, important: boolean): boolean {
  // o navegador suspende o áudio até haver um gesto: acorda quando o jogo já está rodando
  if (kit.ctx.state === 'suspended') void kit.ctx.resume().catch(() => undefined);
  return important || voices < MAX_VOICES;
}

/** Saída alternativa enquanto um som posicional é gerado (passos de longe: vão por um panner 3D, com volume pela distância). */
let override: { node: AudioNode; scale: number } | null = null;
const outFor = (kit: NonNullable<ReturnType<typeof audioKit>>): AudioNode => override?.node ?? busFor(kit);
const gainOf = (v: number) => v * (override?.scale ?? 1);

let bus: { ctx: AudioContext; node: AudioNode } | null = null;
let noiseBuf: { ctx: AudioContext; buf: AudioBuffer } | null = null;

function busFor(kit: NonNullable<ReturnType<typeof audioKit>>): AudioNode {
  if (!bus || bus.ctx !== kit.ctx) {
    const small = phone();
    const comp = kit.ctx.createDynamicsCompressor();
    comp.threshold.value = small ? -16 : -4;
    comp.knee.value = 24;
    comp.ratio.value = small ? 6 : 3;
    comp.attack.value = 0.006;
    comp.release.value = 0.25;
    if (small) {
      const hp = kit.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 120;
      const lp = kit.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 7000;
      const level = kit.ctx.createGain();
      level.gain.value = 0.6;
      hp.connect(lp).connect(comp).connect(level).connect(kit.out);
      bus = { ctx: kit.ctx, node: hp };
    } else {
      comp.connect(kit.out);
      bus = { ctx: kit.ctx, node: comp };
    }
  }
  return bus.node;
}

/**
 * Passos pré-gerados: 4 variações calculadas uma vez em buffers (pancada grave do calcanhar + raspar leve), tocadas com UM nó
 * cada. Gerar o passo a cada pisada com filtros e osciladores picotava o som quando o jogo oscilava de fps.
 */
let stepBufs: { ctx: AudioContext; list: AudioBuffer[] } | null = null;
function stepBuffers(ctx: AudioContext): AudioBuffer[] {
  if (stepBufs && stepBufs.ctx === ctx) return stepBufs.list;
  const sr = ctx.sampleRate;
  const list: AudioBuffer[] = [];
  for (let v = 0; v < 4; v++) {
    const n = Math.floor(sr * 0.16);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const f0 = 85 + v * 9;
    const a = 0.1 + v * 0.02; // quanto menor, mais abafado o ruído
    let lp = 0;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      lp += a * (Math.random() * 2 - 1 - lp);
      const thump = Math.sin((ph += (2 * Math.PI * (f0 * Math.exp(-t * 6) + 45)) / sr)) * Math.exp(-t * 32) * 0.7;
      const scuff = lp * Math.exp(-t * 36) * 1.6;
      const fade = Math.min(1, i / (sr * 0.003));
      d[i] = (thump + scuff) * fade;
    }
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]!));
    for (let i = 0; i < n; i++) d[i] = (d[i]! / (peak || 1)) * 0.9;
    list.push(buf);
  }
  stepBufs = { ctx, list };
  return list;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuf || noiseBuf.ctx !== ctx) {
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = { ctx, buf };
  }
  return noiseBuf.buf;
}

/** Rajada de ruído filtrada, com ataque rápido e queda exponencial. */
function burst(opts: {
  type: BiquadFilterType;
  freq: number;
  q?: number;
  dur: number;
  peak: number;
  delay?: number;
  freqEnd?: number;
  /** Som que nunca pode ser cortado (tiro, clique de arma vazia). */
  important?: boolean;
}) {
  const kit = audioKit();
  if (!kit || kit.muted() || !ready(kit, opts.important !== false)) return;
  const { ctx } = kit;
  const t = ctx.currentTime + (opts.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = opts.type;
  f.frequency.setValueAtTime(opts.freq, t);
  if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + opts.dur);
  f.Q.value = opts.q ?? 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainOf(opts.peak)), t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.002 + opts.dur);
  src.connect(f).connect(g).connect(outFor(kit));
  track(src, f, g);
  src.start(t, Math.random() * 0.5);
  src.stop(t + opts.dur + 0.05);
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0) {
  const kit = audioKit();
  if (!kit || kit.muted() || !ready(kit, true)) return;
  const { ctx } = kit;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = phone() && (type === 'square' || type === 'sawtooth') ? 'triangle' : type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainOf(peak)), t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.003 + dur);
  o.connect(g).connect(outFor(kit));
  track(o, g);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const jit = (v: number, k = 0.06) => v * (1 + (Math.random() * 2 - 1) * k);

export const fsAudio = {
  /** Tiro de cada arma. */
  shot(id: 'ak' | 'pistol' | 'sniper' | 'knife') {
    if (id === 'knife') {
      burst({ type: 'bandpass', freq: jit(2800), q: 1.2, dur: 0.12, peak: 0.16 });
      return;
    }
    if (id === 'ak') {
      burst({ type: 'bandpass', freq: jit(1900), q: 0.7, dur: 0.11, peak: 0.55 });
      burst({ type: 'highpass', freq: 4500, dur: 0.02, peak: 0.35 });
      tone('sine', jit(135), 42, 0.13, 0.7);
      burst({ type: 'lowpass', freq: 600, dur: 0.22, peak: 0.12, delay: 0.03 });
    } else if (id === 'pistol') {
      // silenciada: seca e abafada, com o clique do ferrolho logo depois
      burst({ type: 'lowpass', freq: jit(1500), q: 0.6, dur: 0.07, peak: 0.32 });
      tone('sine', jit(105), 55, 0.09, 0.3);
      burst({ type: 'bandpass', freq: 2600, q: 2, dur: 0.012, peak: 0.16, delay: 0.045 });
    } else {
      burst({ type: 'bandpass', freq: jit(1100), q: 0.6, dur: 0.2, peak: 0.8 });
      burst({ type: 'highpass', freq: 5000, dur: 0.03, peak: 0.45 });
      tone('sine', 80, 28, 0.45, 0.95);
      burst({ type: 'lowpass', freq: 520, dur: 0.7, peak: 0.2, delay: 0.06 });
    }
  },
  dry() {
    // gatilho puxado sem bala: o "clique" do cão batendo no vazio, bem audível (estalo agudo + pancada metálica + eco curto)
    burst({ type: 'highpass', freq: 1500, dur: 0.022, peak: 0.5 });
    burst({ type: 'bandpass', freq: 650, q: 3, dur: 0.06, peak: 0.45, delay: 0.004 });
    tone('triangle', 2300, 1500, 0.05, 0.12, 0.003);
    burst({ type: 'highpass', freq: 1800, dur: 0.012, peak: 0.2, delay: 0.07 });
  },
  /** Acabou a munição: dois cliques descendo, depois do último tiro. */
  empty() {
    burst({ type: 'bandpass', freq: 3000, q: 3, dur: 0.014, peak: 0.28, delay: 0.14 });
    tone('triangle', 520, 380, 0.05, 0.2, 0.16);
    burst({ type: 'bandpass', freq: 2200, q: 3, dur: 0.014, peak: 0.24, delay: 0.26 });
    tone('triangle', 380, 260, 0.06, 0.18, 0.28);
  },
  /** Fases da recarga: tirar o carregador, colocar, puxar o ferrolho. */
  magOut() {
    burst({ type: 'bandpass', freq: 2200, q: 2, dur: 0.02, peak: 0.2 });
    tone('triangle', 260, 180, 0.05, 0.14, 0.01);
  },
  magIn() {
    tone('triangle', 200, 140, 0.07, 0.22);
    burst({ type: 'bandpass', freq: 1800, q: 2, dur: 0.025, peak: 0.22, delay: 0.015 });
  },
  bolt() {
    burst({ type: 'bandpass', freq: 3400, q: 3, dur: 0.018, peak: 0.2 });
    burst({ type: 'bandpass', freq: 2200, q: 3, dur: 0.02, peak: 0.2, delay: 0.09 });
    tone('triangle', 420, 300, 0.04, 0.1, 0.09);
  },
  draw() {
    burst({ type: 'lowpass', freq: 1400, q: 0.5, dur: 0.07, peak: 0.12 });
  },
  /** Marcador de acerto: corpo, cabeça e abate. */
  hit(kind: 'body' | 'head' | 'kill' | 'armor') {
    if (kind === 'head') {
      tone('sine', 1750, 1750, 0.09, 0.28);
      tone('sine', 2650, 2650, 0.07, 0.14, 0.01);
    } else if (kind === 'kill') {
      tone('sine', 1100, 1100, 0.14, 0.26);
      tone('sine', 1650, 1650, 0.14, 0.18, 0.05);
      tone('sine', 90, 60, 0.18, 0.4);
    } else if (kind === 'armor') {
      tone('square', 520, 480, 0.04, 0.14);
      burst({ type: 'bandpass', freq: 2400, q: 3, dur: 0.02, peak: 0.12 });
    } else {
      tone('square', 880, 800, 0.03, 0.16);
    }
  },
  impact() {
    burst({ type: 'bandpass', freq: 1700, q: 1, dur: 0.05, peak: 0.12 });
  },
  /** Faca acertando alguém. */
  stab() {
    burst({ type: 'bandpass', freq: 900, q: 1.5, dur: 0.06, peak: 0.3 });
    tone('sine', 180, 90, 0.08, 0.3);
  },
  step() {
    const kit = audioKit();
    if (!kit || kit.muted() || !ready(kit, false)) return;
    const { ctx } = kit;
    const list = stepBuffers(ctx);
    const src = ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)]!;
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    const g = ctx.createGain();
    g.gain.value = gainOf(0.22);
    src.connect(g).connect(outFor(kit));
    track(src, g);
    src.start();
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
    p.panningModel = 'equalpower'; // HRTF criado a cada passo pesava e picotava o som
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
    override = { node: p, scale: 3.2 * fade };
    try {
      fsAudio.step();
    } finally {
      override = null;
    }
    window.setTimeout(() => p.disconnect(), 400);
  },
  jump() {
    burst({ type: 'lowpass', freq: 500, dur: 0.06, peak: 0.1 });
  },
};
