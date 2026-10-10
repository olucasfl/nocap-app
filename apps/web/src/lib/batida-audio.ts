import {
  LEAD_IN_BARS,
  STEPS_PER_BAR,
  barMs,
  barStart,
  rootAt,
  semitoneOf,
  type Song,
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

/** Passos (colcheias 0 a 7) em que cada peça toca, por groove. */
const GROOVES = {
  // Bumbo nos tempos 1 e 3, caixa nos 2 e 4.
  basic: { kick: [0, 4], snare: [2, 6], bass: [0, 4], hat: 'all' },
  // Balanço: bumbo deslocado, baixo sincopado.
  funk: { kick: [0, 3, 6], snare: [2, 6], bass: [0, 3, 5, 7], hat: 'all' },
  // Pesado: bumbo em todos os tempos, baixo pulsando.
  drive: { kick: [0, 2, 4, 6], snare: [2, 6], bass: [0, 1, 2, 3, 4, 5, 6, 7], hat: 'odd' },
} as const;

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
  const snare = (when: number) => {
    hiss('bandpass', 1900, when, 0.11, 0.38);
    tone('triangle', 210, 150, when, 0.07, 0.2, 0.002);
  };
  const hat = (when: number, peak: number) => hiss('highpass', 7200, when, 0.035, peak, 0.5);

  /** Agenda a base de um compasso inteiro (a música das colcheias). */
  function scheduleBar(bar: number) {
    const len = barMs(song, bar);
    const base = barStart(song, bar);
    const countIn = bar < LEAD_IN_BARS;
    const stepS = len / STEPS_PER_BAR / 1000;
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      const when = at(base + (step * len) / STEPS_PER_BAR);
      const stumbling = when < stumbleUntil;
      // Nível 1 (sempre): bumbo, caixa e chimbal no jeito da música.
      if ((groove.kick as readonly number[]).includes(step)) kick(when, stumbling ? 0.35 : 0.9);
      if (!countIn && (groove.snare as readonly number[]).includes(step)) snare(when);
      if (groove.hat === 'all') hat(when, step % 2 === 0 ? 0.2 : 0.1);
      else if (step % 2 === 1) hat(when, 0.22);
      if (countIn || stumbling) continue;
      const root = rootAt(song, bar);
      // Nível 2: baixo no padrão da música.
      if (level >= 2 && (groove.bass as readonly number[]).includes(step)) {
        const dense = groove.bass.length > 4;
        tone(
          'triangle',
          hz(C2, root),
          hz(C2, root),
          when,
          stepS * (dense ? 0.9 : 1.7),
          dense ? 0.3 : 0.42,
          0.01,
        );
      }
      // Nível 3: acorde aberto no início de cada metade do compasso.
      if (level >= 3 && (step === 0 || step === 4)) {
        const dur = (len / 2 / 1000) * 0.95;
        [0, 4, 7].forEach((interval) =>
          tone(
            'triangle',
            hz(C4 / 2, root + interval),
            hz(C4 / 2, root + interval),
            when,
            dur,
            0.1,
            0.03,
          ),
        );
      }
      // Nível 4: arpejo brilhante subindo pela escala da música.
      if (level >= 4 && step % 2 === 1) {
        const note = song.scale[(step >> 1) % song.scale.length]!;
        tone('sine', hz(C4 * 2, root + note), hz(C4 * 2, root + note), when, 0.12, 0.08, 0.004);
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
      tick();
      timer = window.setInterval(tick, TICK_MS);
    },
    now: () => (ctx.currentTime - t0) * 1000,
    setLevel(l) {
      level = Math.max(1, Math.min(4, l));
    },
    hit(lane, bar, perfect) {
      const f = hz(C4, semitoneOf(song, lane, bar));
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
      const f = hz(C4, semitoneOf(song, lane, bar));
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
