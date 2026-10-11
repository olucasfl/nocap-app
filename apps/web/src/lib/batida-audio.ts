import {
  LEAD_IN_BARS,
  STEPS_PER_BAR,
  barMs,
  barStart,
  chordAt,
  sectionAt,
  semitoneOf,
  type Song,
  type SongId,
} from '@nocap/games';
import { audioKit } from './sfx';

/**
 * A música do Eco Hero, toda sintetizada (zero arquivos) e agendada à frente pelo relógio do
 * áudio. Por baixo roda uma base que cresce com o combo (bumbo, caixa e chimbal; depois baixo;
 * depois acorde; depois arpejo), no jeito de cada música (`groove`). Por cima, cada acerto toca a
 * nota da pista na escala e no acorde da hora, no timbre da música (`lead`): o que a pessoa toca
 * vira a melodia. Errar faz a música tropeçar.
 */

/** Quanto antes do instante o som é agendado (segundos). */
const LOOKAHEAD_S = 0.25;
const TICK_MS = 25;
/** Nota de referência: o dó central. */
const C4 = 261.63;
const C2 = 65.41;

const hz = (base: number, semitones: number) => base * 2 ** (semitones / 12);

/** Passos (colcheias 0 a 7) em que a bateria toca, por groove. */
const GROOVES = {
  // Bumbo nos tempos 1 e 3, caixa nos 2 e 4.
  basic: { kick: [0, 4], snare: [2, 6], hat: 'all' },
  // Balanço: bumbo deslocado.
  funk: { kick: [0, 3, 6], snare: [2, 6], hat: 'all' },
  // Pesado: bumbo em todos os tempos.
  drive: { kick: [0, 2, 4, 6], snare: [2, 6], hat: 'odd' },
} as const;

/** Um passo do baixo: [semitons acima da raiz, duração em colcheias, força, onda]. */
type BassStep = readonly [number, number, number, OscillatorType];

/**
 * O acompanhamento de cada música: o baixo (um padrão por colcheia), a harmonia (instrumento e
 * em quais colcheias toca) e o enfeite de cima. Nada se repete entre as três.
 */
const SOUNDS: Record<
  SongId,
  {
    bass: Partial<Record<number, BassStep>>;
    pad: { kind: 'piano' | 'epiano' | 'power'; steps: number[] };
    spark: { kind: 'bell' | 'scratch' | 'chug'; steps: number[] };
  }
> = {
  // Doce: baixo longo nos tempos, piano de acorde quebrado e sininhos.
  passo: {
    bass: { 0: [0, 3.4, 0.42, 'triangle'], 4: [0, 3.4, 0.4, 'triangle'] },
    pad: { kind: 'piano', steps: [0, 2, 4, 6] },
    spark: { kind: 'bell', steps: [3, 7] },
  },
  // Funk: baixo sincopado e saltitante, piano elétrico nos contratempos e "palhetada" de guitarra.
  mare: {
    bass: {
      0: [0, 1.2, 0.46, 'triangle'],
      3: [0, 0.8, 0.42, 'triangle'],
      5: [7, 0.8, 0.4, 'triangle'],
      7: [12, 0.7, 0.34, 'triangle'],
    },
    pad: { kind: 'epiano', steps: [3, 6] },
    spark: { kind: 'scratch', steps: [1, 3, 5, 7] },
  },
  // Pesado: baixo martelando em colcheias, guitarra de acorde de força e riff agudo.
  frenesi: {
    bass: Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6, 7].map((s) => [s, [s % 4 === 3 ? 12 : 0, 0.8, 0.26, 'sawtooth']]),
    ) as Partial<Record<number, BassStep>>,
    pad: { kind: 'power', steps: [0, 2, 4, 6] },
    spark: { kind: 'chug', steps: [1, 3, 5, 7] },
  },
};

/** Timbre da melodia por música: onda, força e quanto brilho (oitava acima) entra. */
const LEADS = {
  soft: { type: 'triangle', peak: 0.4, dur: 0.34, shine: 0.12 },
  bright: { type: 'square', peak: 0.17, dur: 0.26, shine: 0.1 },
  sharp: { type: 'sawtooth', peak: 0.2, dur: 0.22, shine: 0.1 },
} as const;

export interface BatidaAudio {
  /** Começa a música. Daqui em diante `now()` conta os ms da partida. */
  start(): void;
  /** Ms desde o início da partida, pelo relógio do áudio (a contagem é o compasso 0). */
  now(): number;
  /** Ms da partida no horário `perf` (`performance.now()`/`event.timeStamp`) de um toque. */
  at(perf: number): number;
  /** Nível da música (1 a 4), vindo do multiplicador. */
  setLevel(level: number): void;
  /** Acertou: toca a nota da pista (Perfeito brilha mais). */
  hit(lane: number, bar: number, perfect: boolean): void;
  /** Toque sem nota: soa errado e a base tropeça. */
  wrong(): void;
  /** Uma nota passou sem toque. */
  missed(): void;
  /** Nota longa: o som segue enquanto a pessoa segura (`holdEnd` solta). */
  holdStart(lane: number, bar: number): void;
  holdEnd(lane: number): void;
  /** Congela o relógio e o som (pausa). */
  pause(): void;
  /** Retoma exatamente de onde parou. */
  resume(): void;
  /** Energia acabou: a música desacelera e para. */
  over(): void;
  stop(): void;
}

/** Cria o motor da música `song`. `null` se o aparelho não tem Web Audio (o jogo roda mudo). */
export function createBatidaAudio(song: Song): BatidaAudio | null {
  const kit = audioKit();
  if (!kit) return null;
  const { ctx, out, noise } = kit;
  const groove = GROOVES[song.groove];
  const lead = LEADS[song.lead];
  const sound = SOUNDS[song.id];
  /** Instante (no relógio do áudio) em que a partida começa: um respiro depois do toque. */
  let t0 = 0;
  let timer = 0;
  let nextBar = 0;
  let level = 1;
  /** A base de baixo, acorde e arpejo fica muda até este instante (depois de um erro). */
  let stumbleUntil = 0;
  let over = false;
  /** Notas longas soando agora, por pista. */
  const sustained = new Map<number, { osc: OscillatorNode; gain: GainNode }>();

  const at = (ms: number) => t0 + ms / 1000;
  let lastHeard = -Infinity;

  /**
   * Ms da partida no instante que se ouve (e se vê) agora. `currentTime` anda aos saltos e adianta o
   * som (o aparelho ainda leva um tempo para tocar); `getOutputTimestamp` diz qual ponto do áudio
   * está saindo no alto-falante, e somar o relógio de alta precisão suaviza os saltos.
   */
  function heardNow(): number {
    const raw = (ctx.currentTime - t0) * 1000;
    let ms = raw;
    if (ctx.state === 'running' && typeof ctx.getOutputTimestamp === 'function') {
      const ts = ctx.getOutputTimestamp();
      if (ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
        const smooth = (ts.contextTime - t0) * 1000 + (performance.now() - ts.performanceTime);
        // Só vale se for coerente (nunca mais de meio segundo atrás nem à frente do relógio simples).
        if (smooth <= raw + 20 && smooth >= raw - 500) ms = smooth;
      }
    }
    // Nunca volta no tempo (a tela e o julgamento dependem disso).
    ms = Math.max(ms, lastHeard);
    lastHeard = ms;
    return ms;
  }
  const quiet = () => kit.muted();

  function tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    when: number,
    dur: number,
    peak: number,
    attack = 0.006,
  ) {
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

  function hiss(
    filter: BiquadFilterType,
    freq: number,
    when: number,
    dur: number,
    peak: number,
    q = 0.9,
  ) {
    if (quiet()) return;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noise;
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(out);
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  const kick = (when: number, peak = 0.9) => tone('sine', 150, 42, when, 0.14, peak, 0.003);
  const snare = (when: number, peak = 1) => {
    hiss('bandpass', 1900, when, 0.11, 0.38 * peak);
    tone('triangle', 210, 150, when, 0.07, 0.2 * peak, 0.002);
  };
  const hat = (when: number, peak: number, open = false) =>
    hiss('highpass', 7200, when, open ? 0.16 : 0.035, peak, 0.5);
  const crash = (when: number) => hiss('highpass', 5200, when, 0.8, 0.22, 0.4);
  /** Piano: o som e dois harmônicos que somem depressa, com um toque de martelo. */
  const piano = (f: number, when: number, dur: number, peak: number) => {
    tone('triangle', f, f, when, dur, peak, 0.004);
    tone('sine', f * 2, f * 2, when, dur * 0.5, peak * 0.4, 0.003);
    tone('sine', f * 3, f * 3, when, 0.12, peak * 0.15, 0.002);
  };
  /** Piano elétrico: macio e com um sininho no ataque (o jeito do funk). */
  const epiano = (f: number, when: number, dur: number, peak: number) => {
    tone('sine', f, f, when, dur, peak, 0.004);
    tone('sine', f * 4, f * 4, when, 0.07, peak * 0.3, 0.002);
  };
  /** Guitarra pesada: dois dentes de serra (raiz e quinta) que morrem rápido. */
  const power = (f: number, when: number, dur: number, peak: number) => {
    tone('sawtooth', f, f, when, dur, peak, 0.004);
    tone('sawtooth', f * 1.5, f * 1.5, when, dur, peak * 0.8, 0.004);
    tone('sawtooth', f * 2, f * 2, when, dur, peak * 0.5, 0.004);
  };

  /** Agenda a base de um compasso inteiro: bateria, baixo, harmonia e a virada do trecho. */
  function scheduleBar(bar: number) {
    const len = barMs(song, bar);
    const base = barStart(song, bar);
    const countIn = bar < LEAD_IN_BARS;
    const stepS = len / STEPS_PER_BAR / 1000;
    const sec = sectionAt(song, bar);
    const chord = chordAt(song, bar);
    const verse = sec.name === 'verso';
    // O verso é mais leve; o refrão e a ponte entram com tudo.
    const body = verse || countIn ? 0.75 : 1;
    const third = chord.minor ? 3 : 4;
    const tones = [0, third, 7];
    const root = song.tonic + chord.root;
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      const when = at(base + (step * len) / STEPS_PER_BAR);
      const stumbling = when < stumbleUntil;
      const fill = sec.last && !countIn && step >= 5;
      // Nível 1 (sempre): bateria no jeito da música, com virada no fim de cada trecho.
      if ((groove.kick as readonly number[]).includes(step) && !(fill && step >= 6))
        kick(when, stumbling ? 0.35 : 0.9 * body);
      if (!countIn && ((groove.snare as readonly number[]).includes(step) || fill))
        snare(when, fill ? 0.8 : body);
      if (step === 0 && sec.first && !countIn && !verse) crash(when);
      if (groove.hat === 'all') hat(when, (step % 2 === 0 ? 0.2 : 0.1) * body);
      else if (step % 2 === 1) hat(when, 0.22 * body, !verse && step === 7);
      if (countIn || stumbling) continue;
      // Nível 2: baixo no padrão da música (cada uma tem o seu).
      if (level >= 2 && sound.bass[step] !== undefined) {
        const [semi, hold, peak, type] = sound.bass[step]!;
        const f = hz(C2, root + semi);
        tone(type, f, f, when, stepS * hold, peak, 0.01);
      }
      // Nível 3: a harmonia, no instrumento e no ritmo da música.
      if (level >= 3 && sound.pad.steps.includes(step)) {
        const n = sound.pad.steps.indexOf(step);
        if (sound.pad.kind === 'piano') {
          // Acorde quebrado: sobe e desce pelas notas do acorde.
          const semi = tones[[0, 1, 2, 1][n % 4]!]!;
          piano(hz(C4 / 2, root + semi), when, stepS * 3.2, 0.2);
        } else if (sound.pad.kind === 'epiano') {
          for (const semi of tones) epiano(hz(C4, root + semi), when, stepS * 0.8, 0.075);
        } else {
          power(hz(C2 * 2, root), when, stepS * 1.4, 0.075);
        }
      }
      // Nível 4: o enfeite de cima.
      if (level >= 4 && sound.spark.steps.includes(step)) {
        if (sound.spark.kind === 'bell') {
          const semi = tones[(step >> 1) % 3]!;
          const f = hz(C4 * 2, root + semi);
          tone('sine', f, f, when, 0.5, 0.09, 0.004);
          tone('sine', f * 2, f * 2, when, 0.2, 0.03, 0.003);
        } else if (sound.spark.kind === 'scratch') {
          hiss('highpass', 4800, when, 0.04, 0.12, 0.8);
          epiano(hz(C4 * 2, root + tones[2]!), when, stepS * 0.5, 0.05);
        } else {
          power(hz(C4, root), when, stepS * 0.6, 0.05);
        }
      }
    }
  }

  function tick() {
    if (over) return;
    const horizonMs = (ctx.currentTime + LOOKAHEAD_S - t0) * 1000;
    while (barStart(song, nextBar) <= horizonMs) scheduleBar(nextBar++);
  }

  return {
    start() {
      t0 = ctx.currentTime + 0.2;
      nextBar = 0;
      over = false;
      stumbleUntil = 0;
      level = 1;
      lastHeard = -Infinity;
      tick();
      timer = window.setInterval(tick, TICK_MS);
    },
    now: heardNow,
    at(perf) {
      // O horário do toque vem do navegador (`event.timeStamp`), não de quando o código rodou.
      const p = performance.now();
      const stamp = perf > 0 && perf <= p + 5 && perf >= p - 400 ? perf : p;
      return heardNow() + (stamp - p);
    },
    setLevel(l) {
      level = Math.max(1, Math.min(4, l));
    },
    hit(lane, bar, perfect) {
      const f = hz(C4, song.tonic + semitoneOf(song, lane, bar));
      const when = ctx.currentTime;
      tone(
        lead.type,
        f,
        f,
        when,
        perfect ? lead.dur : lead.dur * 0.7,
        perfect ? lead.peak : lead.peak * 0.75,
        0.004,
      );
      tone('sine', f * 2, f * 2, when, 0.12, perfect ? lead.shine : lead.shine * 0.4, 0.003);
      if (perfect) tone('sine', f * 3, f * 3, when, 0.09, 0.05, 0.003);
    },
    wrong() {
      const when = ctx.currentTime;
      // Nota desafinada e seca, e a música perde o baixo e o acorde por um instante.
      tone('sawtooth', 190, 95, when, 0.3, 0.26, 0.003);
      hiss('lowpass', 600, when, 0.2, 0.3, 0.7);
      stumbleUntil = when + 1.6;
    },
    missed() {
      const when = ctx.currentTime;
      tone('sine', 130, 70, when, 0.14, 0.22, 0.003);
      stumbleUntil = Math.max(stumbleUntil, when + 0.8);
    },
    holdStart(lane, bar) {
      if (quiet()) return;
      const f = hz(C4, song.tonic + semitoneOf(song, lane, bar));
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = lead.type;
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(lead.peak * 0.45, ctx.currentTime + 0.03);
      osc.connect(gain).connect(out);
      osc.start();
      sustained.get(lane)?.osc.stop();
      sustained.set(lane, { osc, gain });
    },
    holdEnd(lane) {
      const note = sustained.get(lane);
      if (!note) return;
      sustained.delete(lane);
      const t = ctx.currentTime;
      note.gain.gain.cancelScheduledValues(t);
      note.gain.gain.setValueAtTime(Math.max(0.0001, note.gain.gain.value), t);
      note.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      note.osc.stop(t + 0.1);
    },
    pause() {
      for (const lane of [...sustained.keys()]) this.holdEnd(lane);
      void ctx.suspend();
    },
    resume() {
      // Ao voltar o carimbo de saída pode estar velho: o relógio recomeça de onde parou.
      void ctx.resume();
    },
    over() {
      if (over) return;
      over = true;
      for (const lane of [...sustained.keys()]) this.holdEnd(lane);
      window.clearInterval(timer);
      const when = ctx.currentTime;
      // A música "desliga": a nota desce e perde a força.
      tone('sawtooth', 330, 55, when, 0.9, 0.3, 0.01);
      tone('triangle', 165, 40, when, 1.1, 0.35, 0.01);
      hiss('lowpass', 900, when, 0.5, 0.2, 0.7);
    },
    stop() {
      over = true;
      for (const lane of [...sustained.keys()]) this.holdEnd(lane);
      window.clearInterval(timer);
      // Saiu pausado: devolve o áudio ao app.
      void ctx.resume();
    },
  };
}
