import { createRng } from '../core/rng';
import {
  BEAT_EASY,
  BEAT_HARD,
  COME_BACK_S,
  HOLD_MAX,
  HOLD_MIN,
  LEAD_IN_S,
  RUSH_BEAT_FACTOR,
  RUSH_MIN_BEAT,
  VERSE_BREATH,
  lerp,
} from './constants';

/**
 * O ciclo do Vigia é uma cantiga (spec 026): ele canta "SI-NAL-VER-ME-LHO" de costas, em 1 a 3
 * versos, e no último o LHO é esticado (o aviso). Quando a nota acaba ele vira e olha: mexeu,
 * perdeu. Depois volta. Todos os tempos saem da seed, nunca de onde a pessoa está, então a corrida
 * é a mesma para quem jogar a mesma seed. O acaso é só o do brinquedo (quantos versos, e um de
 * três jeitos de cantar); o aviso nunca dura menos que `HOLD_MIN`.
 */

/** Os três jeitos de cantar o último verso: firme, acelera (as sílabas encurtam) e arrasta (alongam). */
export type Tempo = 'firme' | 'acelera' | 'arrasta';

export interface Note {
  t0: number;
  t1: number;
  /** A sílaba (0 a 4: SI, NAL, VER, ME, LHO). */
  syl: number;
  /** O último LHO, esticado: o aviso. */
  hold: boolean;
}

export interface Cycle {
  start: number;
  tempo: Tempo;
  verses: number;
  /** O compasso deste ciclo (s). */
  beat: number;
  /** O Vigia veio apressado: este ciclo é cantado bem mais depressa (o aviso continua legível). */
  rush: boolean;
  notes: Note[];
  /** O LHO esticado começa aqui (o Vigia ainda está de costas, e ainda se pode andar). */
  avisoStart: number;
  lookStart: number;
  lookEnd: number;
  end: number;
}

export interface TimelineParams {
  /** Dificuldade (0 a 1) no instante t. */
  dAt(t: number): number;
}

const clampHold = (beat: number) => Math.max(HOLD_MIN, Math.min(HOLD_MAX, 2 * beat));

/** Quantos versos o ciclo tem (1 a 3): no começo mais versos, e com a dificuldade, menos. */
function pickVerses(d: number, r: number): number {
  const w1 = lerp(0.2, 0.5, d);
  const w2 = lerp(0.4, 0.35, d);
  const w3 = lerp(0.4, 0.15, d);
  let x = r * (w1 + w2 + w3);
  if ((x -= w1) < 0) return 1;
  if ((x -= w2) < 0) return 2;
  return 3;
}

function pickTempo(d: number, r: number): Tempo {
  const wf = 1;
  const wa = 0.2 + 0.5 * d;
  const wr = 0.15 + 0.35 * d;
  let x = r * (wf + wa + wr);
  if ((x -= wf) < 0) return 'firme';
  if ((x -= wa) < 0) return 'acelera';
  return 'arrasta';
}

export class VigiaTimeline {
  readonly cycles: Cycle[] = [];
  private readonly rng: () => number;

  constructor(
    readonly params: TimelineParams,
    seedKey: string,
  ) {
    this.rng = createRng(seedKey);
  }

  private generate() {
    const last = this.cycles[this.cycles.length - 1];
    const start = last ? last.end : LEAD_IN_S;
    // Sempre os mesmos sorteios por ciclo, qualquer que seja o resultado: a corrida não "desanda".
    const [beatJ, verseR, tempoR, lookJ, rushR] = [this.rng(), this.rng(), this.rng(), this.rng(), this.rng()];
    const d = this.params.dAt(start);
    const first = !last;
    // De vez em quando o Vigia vem apressado (nunca no começo): o compasso encolhe.
    const rush = !first && start >= 20 && rushR! < lerp(0.12, 0.32, d);
    let beat = lerp(BEAT_EASY, BEAT_HARD, d) * (0.92 + 0.16 * beatJ!);
    if (rush) beat = Math.max(RUSH_MIN_BEAT, beat * RUSH_BEAT_FACTOR);
    const verses = first ? 2 : pickVerses(d, verseR!);
    const tempo: Tempo = first ? 'firme' : pickTempo(d, tempoR!);

    const notes: Note[] = [];
    let t = start;
    for (let v = 0; v < verses; v++) {
      const finalVerse = v === verses - 1;
      for (let syl = 0; syl < 4; syl++) {
        let dur = beat;
        if (finalVerse && tempo === 'acelera') dur = beat * (1 - 0.18 * syl);
        else if (finalVerse && tempo === 'arrasta') dur = beat * (syl === 2 ? 1.15 : syl === 3 ? 1.4 : 1);
        notes.push({ t0: t, t1: t + dur, syl, hold: false });
        t += dur;
      }
      if (finalVerse) {
        const hold = clampHold(beat);
        notes.push({ t0: t, t1: t + hold, syl: 4, hold: true });
        t += hold;
      } else {
        notes.push({ t0: t, t1: t + beat, syl: 4, hold: false });
        t += beat + VERSE_BREATH;
      }
    }
    const holdNote = notes[notes.length - 1]!;
    const look = lerp(1.3, 2.4, d) * (0.92 + 0.16 * lookJ!);
    const lookStart = holdNote.t1;
    const lookEnd = lookStart + look;
    this.cycles.push({
      start,
      tempo,
      verses,
      beat,
      rush,
      notes,
      avisoStart: holdNote.t0,
      lookStart,
      lookEnd,
      end: lookEnd + COME_BACK_S,
    });
  }

  /** O ciclo que está valendo no instante `t` (segundos). */
  cycleAt(t: number): Cycle {
    while (this.cycles.length === 0 || this.cycles[this.cycles.length - 1]!.end <= t) {
      this.generate();
      if (this.cycles.length > 100_000) break;
    }
    let lo = 0;
    let hi = this.cycles.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cycles[mid]!.end <= t) lo = mid + 1;
      else hi = mid;
    }
    return this.cycles[lo]!;
  }

  /** Os ciclos até o instante `t` (para quem quer inspecionar a linha do tempo). */
  upTo(t: number): Cycle[] {
    this.cycleAt(t);
    return this.cycles.filter((c) => c.start <= t);
  }
}

export type VigiaState = 'costas' | 'aviso' | 'olhando' | 'voltando';

export function stateAt(cycle: Cycle, t: number): VigiaState {
  if (t < cycle.avisoStart) return 'costas';
  if (t < cycle.lookStart) return 'aviso';
  if (t < cycle.lookEnd) return 'olhando';
  return 'voltando';
}

/** O olhar que está valendo agora. */
export function activeLook(cycle: Cycle, t: number): { start: number; end: number } | null {
  if (t >= cycle.lookStart && t < cycle.lookEnd) return { start: cycle.lookStart, end: cycle.lookEnd };
  return null;
}

/** A sílaba que está sendo cantada em `t` (ou `null` na pausa entre versos e depois da nota final). */
export function noteAt(cycle: Cycle, t: number): Note | null {
  for (const n of cycle.notes) {
    if (t >= n.t0 && t < n.t1) return n;
  }
  return null;
}
