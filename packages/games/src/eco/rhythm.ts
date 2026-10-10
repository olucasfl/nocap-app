import { createRng, randInt } from '../core/rng';

/**
 * Ecooo Batida (spec 019): modo de ritmo, estilo Guitar Hero. Cinco pistas, notas que descem, e a
 * pessoa toca na hora certa. Lógica pura e determinística: a música (a "partitura") sai da seed, e
 * o servidor refaz acertos, erros, combo e energia a partir dos instantes dos toques. O cliente
 * nunca diz "acertei".
 *
 * Tempo: tudo em milissegundos desde o início da partida (a contagem inicial é o compasso 0).
 */

export const BATIDA_LANES = 5;
/** Compasso 4/4 dividido em colcheias: 8 posições por compasso. */
export const STEPS_PER_BAR = 8;
/** O compasso 0 só tem a contagem (bateria sem notas). */
export const LEAD_IN_BARS = 1;

/** Janelas de acerto, em ms para cada lado da nota (a calibrar jogando). */
export const PERFECT_MS = 50;
export const GOOD_MS = 120;

export const ENERGY_MAX = 100;
export const ENERGY_START = 70;
export const ENERGY_PERFECT = 4;
export const ENERGY_GOOD = 2;
export const ENERGY_MISS = -14;
/** Tocar numa pista sem nota perto. */
export const ENERGY_STRAY = -7;

/** Nota longa: segurar até o fim vale como um Perfeito; soltar cedo gasta energia e zera o combo. */
export const BATIDA_POINTS_HOLD = 10;
export const ENERGY_HOLD = 3;
export const ENERGY_HOLD_BREAK = -6;
/** Segurar até este tanto antes do fim já vale como completo (ninguém solta no milissegundo exato). */
export const HOLD_END_SLACK_MS = 100;
/** Uma nota longa dura 2 ou 4 colcheias. */
export const HOLD_LENGTHS: readonly number[] = [4, 2];

/** Pontos em décimos (10 = 1 ponto): Perfeito vale 1, Bom vale 0,5, vezes o multiplicador. */
export const BATIDA_POINTS_PERFECT = 10;
export const BATIDA_POINTS_GOOD = 5;
/** O servidor guarda a nota num campo de 16 bits: este é o teto (3276 pontos). */
export const BATIDA_MAX_TENTHS = 32767;

/** Combos que sobem o multiplicador: a partir de 8 vale x2, de 16 x3 e de 32 x4. */
export const COMBO_STEPS: readonly number[] = [0, 8, 16, 32];

/** Duas notas na mesma pista com menos que isto entre toques nenhuma pessoa consegue. */
export const BATIDA_MIN_TAP_GAP_MS = 45;
/** Partida mais longa que isto o servidor recusa. */
export const BATIDA_MAX_RUN_MS = 60 * 60_000;
export const BATIDA_MAX_TAPS = 6000;
/** Ninguém segura um dedo mais que isto numa nota só. */
export const BATIDA_MAX_HOLD_MS = 30_000;

/** As três músicas do Batida: cada uma tem andamento, harmonia, groove e dificuldade próprios. */
export type SongId = 'passo' | 'mare' | 'frenesi';

export interface Song {
  id: SongId;
  name: string;
  /** Uma linha que diz a proposta da música (aparece na escolha). */
  tagline: string;
  startBpm: number;
  maxBpm: number;
  /** Quanto o andamento sobe a cada compasso até o máximo. */
  bpmPerBar: number;
  /** A cada quantos compassos a dificuldade sobe um nível. */
  barsPerLevel: number;
  /** Nível de dificuldade em que a música começa e até onde ela chega (0 a 4). */
  levelStart: number;
  levelMax: number;
  /** Acordes (semitones acima da tônica), um a cada 2 compassos. */
  progression: readonly number[];
  /** As 5 notas da escala: a pista escolhe o grau, o acorde a raiz. */
  scale: readonly number[];
  /** Jeito da bateria e do baixo (o som escolhe os padrões). */
  groove: 'basic' | 'funk' | 'drive';
  /** Timbre da melodia que a pessoa toca. */
  lead: 'soft' | 'bright' | 'sharp';
  /**
   * Notas juntas e notas longas. A chance de cada uma começa em `base` no compasso `from` e sobe
   * `grow` a cada compasso depois disso (sem parar, até o teto): a música nunca para de ficar mais
   * difícil. Triplas só valem a partir de `tripleFrom`.
   */
  doubles: { from: number; base: number; grow: number };
  triples: { from: number; base: number; grow: number };
  holds: { from: number; base: number; grow: number };
}

export const SONGS: Record<SongId, Song> = {
  passo: {
    id: 'passo',
    name: 'Primeiro Passo',
    tagline: 'Calma e doce no começo, mas nunca para de acelerar. Poucas notas juntas.',
    startBpm: 64,
    maxBpm: 360,
    bpmPerBar: 1.2,
    barsPerLevel: 14,
    levelStart: 0,
    levelMax: 4,
    progression: [0, 7, 9, 5],
    scale: [0, 2, 4, 7, 9],
    groove: 'basic',
    lead: 'soft',
    doubles: { from: 14, base: 0.06, grow: 0.004 },
    triples: { from: 70, base: 0.05, grow: 0.002 },
    holds: { from: 8, base: 0.08, grow: 0.003 },
  },
  mare: {
    id: 'mare',
    name: 'Maré Alta',
    tagline: 'Balanço com síncope. Notas fora do tempo, acordes e notas longas, como ondas.',
    startBpm: 78,
    maxBpm: 360,
    bpmPerBar: 1.6,
    barsPerLevel: 10,
    levelStart: 1,
    levelMax: 4,
    progression: [0, 10, 8, 7],
    scale: [0, 3, 5, 7, 10],
    groove: 'funk',
    lead: 'bright',
    doubles: { from: 6, base: 0.12, grow: 0.008 },
    triples: { from: 36, base: 0.08, grow: 0.004 },
    holds: { from: 6, base: 0.1, grow: 0.004 },
  },
  frenesi: {
    id: 'frenesi',
    name: 'Frenesi',
    tagline:
      'Pesada e sem descanso. Muitas notas, acordes de três e notas longas, até você aguentar.',
    startBpm: 92,
    maxBpm: 360,
    bpmPerBar: 2,
    barsPerLevel: 8,
    levelStart: 2,
    levelMax: 4,
    progression: [0, 5, 0, 7],
    scale: [0, 3, 5, 6, 7],
    groove: 'drive',
    lead: 'sharp',
    doubles: { from: 3, base: 0.18, grow: 0.01 },
    triples: { from: 24, base: 0.12, grow: 0.006 },
    holds: { from: 8, base: 0.1, grow: 0.004 },
  },
};

export const SONG_IDS: readonly SongId[] = ['passo', 'mare', 'frenesi'];

export function isSongId(id: unknown): id is SongId {
  return typeof id === 'string' && (SONG_IDS as readonly string[]).includes(id);
}

/** O modo guardado no servidor para uma música: `batida-passo`, `batida-mare`, `batida-frenesi`. */
export const batidaMode = (id: SongId): string => `batida-${id}`;

/** A música de um modo (`batida-mare` → mare), ou `null` se o modo não é do Batida. */
export function songOfMode(mode: string): Song | null {
  const id = mode.startsWith('batida-') ? mode.slice('batida-'.length) : '';
  return isSongId(id) ? SONGS[id] : null;
}

export type Judgement = 'perfect' | 'good' | 'miss';

export interface BatidaNote {
  /** Compasso (0 = contagem) e posição na colcheia (0 a 7). */
  bar: number;
  step: number;
  lane: number;
  /** Instante em que a nota chega ao molde (a hora de apertar). */
  t: number;
  /** Nota longa: instante em que ela termina (a hora de soltar). Sem isto, é um toque. */
  endT?: number;
}

export interface BatidaTap {
  lane: number;
  /** Instante em que apertou, em ms desde o início. */
  t: number;
  /** Instante em que soltou (depois de `t`). Só importa nas notas longas. */
  up: number;
}

// ---- andamento -------------------------------------------------------------

/** Batidas por minuto do compasso `bar` (sobe a cada compasso até o máximo da música). */
export function bpmAt(song: Song, bar: number): number {
  return Math.min(song.maxBpm, song.startBpm + song.bpmPerBar * bar);
}

/** Duração do compasso `bar` em ms. */
export function barMs(song: Song, bar: number): number {
  return (4 * 60_000) / bpmAt(song, bar);
}

const startCache = new Map<SongId, number[]>();

/** Instante em que o compasso `bar` começa. */
export function barStart(song: Song, bar: number): number {
  let cache = startCache.get(song.id);
  if (!cache) startCache.set(song.id, (cache = [0]));
  while (cache.length <= bar) {
    cache.push(cache[cache.length - 1]! + barMs(song, cache.length - 1));
  }
  return cache[bar]!;
}

/** Compasso que está tocando no instante `t`. */
export function barAt(song: Song, t: number): number {
  if (t <= 0) return 0;
  // Nenhum compasso é mais curto que o do andamento máximo: serve de teto para a busca.
  let bar = Math.min(100_000, Math.floor(t / ((4 * 60_000) / song.maxBpm)));
  while (bar > 0 && barStart(song, bar) > t) bar--;
  while (barStart(song, bar + 1) <= t) bar++;
  return bar;
}

/** Instante de uma posição (compasso e colcheia). */
export function timeOf(song: Song, bar: number, step: number): number {
  return barStart(song, bar) + (step * barMs(song, bar)) / STEPS_PER_BAR;
}

// ---- música ----------------------------------------------------------------

/**
 * Ritmos por nível de dificuldade: 8 colcheias por compasso, 1 = nota. Três por nível; cada frase
 * sorteia dois (A e B) e os alterna, então o ouvido reconhece o ritmo e a música "se forma".
 */
const MOTIFS: readonly (readonly (readonly number[])[])[] = [
  // 0: só semínimas, devagar para aprender
  [
    [1, 0, 1, 0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1, 0, 1, 0],
    [1, 0, 1, 0, 0, 0, 1, 0],
  ],
  // 1: colcheias aparecendo
  [
    [1, 0, 1, 1, 1, 0, 1, 0],
    [1, 1, 1, 0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1, 1, 1, 0],
  ],
  // 2: síncope
  [
    [1, 0, 0, 1, 1, 0, 1, 1],
    [1, 1, 0, 1, 0, 1, 1, 0],
    [1, 0, 1, 1, 0, 1, 1, 0],
  ],
  // 3: denso
  [
    [1, 1, 1, 0, 1, 1, 1, 0],
    [1, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 0],
  ],
  // 4: quase tudo
  [
    [1, 1, 1, 1, 1, 0, 1, 1],
    [1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0],
  ],
];

/** Uma frase tem 4 compassos: A, A, B e A com final diferente (a "virada"). */
export const BARS_PER_PHRASE = 4;

/** Nível de dificuldade (0 a 4) do compasso `bar`: começa no da música e sobe até o limite dela. */
export function levelAt(song: Song, bar: number): number {
  const up = Math.floor(Math.max(0, bar - LEAD_IN_BARS) / song.barsPerLevel);
  return Math.min(song.levelMax, Math.min(MOTIFS.length - 1, song.levelStart + up));
}

/** Pistas usadas em cada nível: começa só no meio (fácil de achar) e abre até as cinco. */
function laneRange(level: number): [number, number] {
  if (level === 0) return [1, 3];
  if (level === 1) return [0, 3];
  return [0, BATIDA_LANES - 1];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** A chance de um enfeite no compasso `bar` (0 antes de `from`; depois sobe sem parar, até `cap`). */
export function chanceAt(
  rule: { from: number; base: number; grow: number },
  bar: number,
  cap: number,
) {
  if (bar < rule.from) return 0;
  return Math.min(cap, rule.base + rule.grow * (bar - rule.from));
}

/**
 * Põe acordes (2 ou 3 notas juntas) e notas longas nas notas de um compasso. As chances vêm da
 * música e do compasso, então a dificuldade sobe sozinha. Uma nota longa só nasce onde a pista dela
 * fica livre até o fim, e nada nasce em cima de outra nota.
 */
function embellish(
  song: Song,
  bar: number,
  base: BatidaNote[],
  rng: () => number,
  lo: number,
  hi: number,
): BatidaNote[] {
  const pTriple = hi - lo >= 2 ? chanceAt(song.triples, bar, 0.3) : 0;
  const pDouble = chanceAt(song.doubles, bar, 0.5);
  const pHold = chanceAt(song.holds, bar, 0.3);
  const taken = new Set(base.map((n) => `${n.lane}:${n.step}`));
  const out: BatidaNote[] = [];
  for (const n of base) {
    out.push(n);
    const roll = rng();
    const wantsHold = rng() < pHold;
    const spare = rng();
    if (roll < pTriple + pDouble) {
      // 2 ou 3 notas no mesmo instante, em pistas livres.
      const extra = roll < pTriple ? 2 : 1;
      const free: number[] = [];
      for (let lane = lo; lane <= hi; lane++) if (!taken.has(`${lane}:${n.step}`)) free.push(lane);
      for (let k = 0; k < extra && free.length > 0; k++) {
        const pick = free.splice(Math.floor((k === 0 ? spare : rng()) * free.length), 1)[0]!;
        taken.add(`${pick}:${n.step}`);
        out.push({ bar, step: n.step, lane: pick, t: n.t });
      }
    } else if (wantsHold) {
      for (const len of spare < 0.5 ? HOLD_LENGTHS : [...HOLD_LENGTHS].reverse()) {
        // Termina no máximo na colcheia 6 e deixa uma colcheia livre depois: dá tempo de soltar
        // antes da próxima nota da mesma pista (que também pode ser a primeira do compasso seguinte).
        if (n.step + len > STEPS_PER_BAR - 2) continue;
        let free = true;
        for (let k = 1; k <= len + 1; k++) if (taken.has(`${n.lane}:${n.step + k}`)) free = false;
        if (!free) continue;
        for (let k = 1; k <= len + 1; k++) taken.add(`${n.lane}:${n.step + k}`);
        n.endT = timeOf(song, bar, n.step + len);
        break;
      }
    }
  }
  return out.sort((x, y) => x.step - y.step || x.lane - y.lane);
}

const phraseCache = new Map<string, BatidaNote[][]>();

/**
 * As notas dos 4 compassos da frase `phrase` (0, 1, 2...), um array por compasso. A melodia é uma
 * célula curta de 4 pistas que se repete subindo e descendo, e cada frase termina na pista de
 * repouso: assim as notas soam como um tema, não como sorteio.
 */
export function phraseNotes(seed: string, song: Song, phrase: number): BatidaNote[][] {
  const key = `${seed}:${song.id}:${phrase}`;
  const cached = phraseCache.get(key);
  if (cached) return cached;
  if (phraseCache.size > 400) phraseCache.clear();

  const firstBar = LEAD_IN_BARS + phrase * BARS_PER_PHRASE;
  const level = levelAt(song, firstBar);
  const [lo, hi] = laneRange(level);
  const rng = createRng(`${seed}:${song.id}:batida:${phrase}`);
  const extras = createRng(`${seed}:${song.id}:enfeite:${phrase}`);
  const set = MOTIFS[level]!;
  const a = set[randInt(rng, 0, set.length - 1)]!;
  let b = set[randInt(rng, 0, set.length - 1)]!;
  if (b === a) b = set[(set.indexOf(a) + 1) % set.length]!;

  // Célula melódica: caminha de 1 ou 2 pistas por vez dentro do alcance do nível.
  let at = randInt(rng, lo, hi);
  const cell: number[] = [];
  for (let i = 0; i < 4; i++) {
    cell.push(at);
    const jump = (rng() < 0.5 ? -1 : 1) * randInt(rng, 1, 2);
    at = clamp(at + jump, lo, hi);
    if (at === cell[i]) at = clamp(at + (at === hi ? -1 : 1), lo, hi);
  }
  // Pista de repouso do fim da frase: a mais central do alcance.
  const home = Math.round((lo + hi) / 2);

  const patterns = [a, a, b, a];
  const bars: BatidaNote[][] = [];
  let n = 0;
  const total = patterns.reduce((sum, p) => sum + p.reduce((x, y) => x + y, 0), 0);
  for (let i = 0; i < BARS_PER_PHRASE; i++) {
    const bar = firstBar + i;
    const notes: BatidaNote[] = [];
    patterns[i]!.forEach((on, step) => {
      // A última colcheia do compasso final vira uma "virada": some se for repetir o ritmo.
      if (!on) return;
      const shift = Math.floor(n / 4) % 2 === 1 ? 1 : 0;
      let lane = clamp(cell[n % 4]! + shift, lo, hi);
      if (n === total - 1) lane = home;
      notes.push({ bar, step, lane, t: timeOf(song, bar, step) });
      n++;
    });
    bars.push(embellish(song, bar, notes, extras, lo, hi));
  }
  phraseCache.set(key, bars);
  return bars;
}

/** As notas do compasso `bar` (a contagem, compasso 0, não tem notas). */
export function notesInBar(seed: string, song: Song, bar: number): BatidaNote[] {
  if (bar < LEAD_IN_BARS) return [];
  const rel = bar - LEAD_IN_BARS;
  return phraseNotes(seed, song, Math.floor(rel / BARS_PER_PHRASE))[rel % BARS_PER_PHRASE]!;
}

/** Todas as notas com `from <= t < to`, em ordem. */
export function notesBetween(seed: string, song: Song, from: number, to: number): BatidaNote[] {
  const out: BatidaNote[] = [];
  for (let bar = barAt(song, Math.max(0, from)); barStart(song, bar) < to; bar++) {
    for (const n of notesInBar(seed, song, bar)) if (n.t >= from && n.t < to) out.push(n);
  }
  return out;
}

// ---- harmonia (para o som) ------------------------------------------------

/** Raiz do acorde que toca no compasso `bar`, em semitones (um acorde a cada 2 compassos). */
export function rootAt(song: Song, bar: number): number {
  const rel = Math.max(0, bar - LEAD_IN_BARS);
  return song.progression[Math.floor(rel / 2) % song.progression.length]!;
}

/** Semitones da nota da pista `lane` no compasso `bar` (a pista escolhe o grau, o acorde a raiz). */
export function semitoneOf(song: Song, lane: number, bar: number): number {
  return rootAt(song, bar) + song.scale[clamp(lane, 0, BATIDA_LANES - 1)]!;
}

// ---- pontuação -------------------------------------------------------------

/** Multiplicador (1 a 4) para um combo. */
export function multiplierFor(combo: number): number {
  let m = 1;
  for (let i = 0; i < COMBO_STEPS.length; i++) if (combo >= COMBO_STEPS[i]!) m = i + 1;
  return m;
}

/** Como um toque a `delta` ms da nota é julgado (`delta` pode ser negativo: cedo). */
export function judge(delta: number): Judgement {
  const d = Math.abs(delta);
  return d <= PERFECT_MS ? 'perfect' : d <= GOOD_MS ? 'good' : 'miss';
}

export interface BatidaRun {
  /** Pontuação guardada, em décimos (já limitada ao teto). */
  tenths: number;
  perfect: number;
  good: number;
  /** Notas que passaram sem toque. */
  missed: number;
  /** Toques sem nota por perto. */
  stray: number;
  maxCombo: number;
  /** Notas longas seguradas até o fim e soltas cedo. */
  holds: number;
  holdsBroken: number;
  /** Instante em que a energia acabou (a partida terminou). */
  endedAtMs: number;
  /** Compasso em que a partida terminou. */
  endedBar: number;
  /** Toques que contam: depois do fim da partida (energia zerada) não pode haver mais nenhum. */
  usedTaps: number;
}

/**
 * Verifica os toques: pistas válidas, instantes inteiros, em ordem, soltar depois de apertar, sem
 * rajada impossível e sem apertar uma pista que ainda está apertada.
 */
export function validateTaps(taps: readonly BatidaTap[]): string | null {
  if (taps.length > BATIDA_MAX_TAPS) return 'Toques demais';
  const lastDown = new Array<number>(BATIDA_LANES).fill(-Infinity);
  const lastUp = new Array<number>(BATIDA_LANES).fill(-Infinity);
  let prev = 0;
  for (const tap of taps) {
    if (!Number.isInteger(tap.lane) || tap.lane < 0 || tap.lane >= BATIDA_LANES)
      return 'Pista inválida';
    if (!Number.isInteger(tap.t) || tap.t < 0 || tap.t > BATIDA_MAX_RUN_MS)
      return 'Instante inválido';
    if (!Number.isInteger(tap.up) || tap.up <= tap.t || tap.up > tap.t + BATIDA_MAX_HOLD_MS)
      return 'Soltou em instante inválido';
    if (tap.t < prev) return 'Toques fora de ordem';
    if (tap.t - lastDown[tap.lane]! < BATIDA_MIN_TAP_GAP_MS) return 'Toques rápidos demais';
    if (tap.t < lastUp[tap.lane]!) return 'Apertou sem soltar';
    lastDown[tap.lane] = tap.t;
    lastUp[tap.lane] = tap.up;
    prev = tap.t;
  }
  return null;
}

/** O que aconteceu num instante da partida (o jogo usa para tocar o som e piscar a tela). */
export type SimEvent =
  | { kind: 'hit'; judgement: 'perfect' | 'good'; note: BatidaNote; delta: number }
  | { kind: 'miss'; note: BatidaNote }
  | { kind: 'stray'; lane: number; t: number }
  /** Segurou a nota longa até o fim. */
  | { kind: 'holdDone'; lane: number; note: BatidaNote }
  /** Soltou a nota longa antes da hora. */
  | { kind: 'holdBroken'; lane: number; note: BatidaNote };

interface Pending {
  note: BatidaNote;
  done: boolean;
}

/**
 * A partida como máquina de estados: o tempo anda com `advance` (notas que passam viram erros) e
 * cada toque entra com `tap`. É usada pelo jogo, para o feedback ao vivo, e por `evaluateBatida`,
 * para o servidor refazer a partida: as duas contas são a mesma, então nunca divergem.
 */
export class BatidaSim {
  private energy = ENERGY_START;
  private combo = 0;
  private score = 0;
  private queue: Pending[] = [];
  private nextBar = 0;
  private counts = {
    perfect: 0,
    good: 0,
    missed: 0,
    stray: 0,
    maxCombo: 0,
    holds: 0,
    holdsBroken: 0,
  };
  /** Notas longas que a pessoa está segurando agora, por pista. */
  private holding = new Map<number, BatidaNote>();
  private end = { dead: false, atMs: 0, bar: 0 };
  private used = 0;

  constructor(
    private readonly seed: string,
    private readonly song: Song,
  ) {}

  get dead(): boolean {
    return this.end.dead;
  }
  get currentEnergy(): number {
    return Math.max(0, this.energy);
  }
  get currentCombo(): number {
    return this.combo;
  }
  get currentMultiplier(): number {
    return multiplierFor(this.combo);
  }
  /** A nota longa que está sendo segurada na pista (para desenhar a barra queimando). */
  holdingNote(lane: number): BatidaNote | undefined {
    return this.holding.get(lane);
  }
  get currentTenths(): number {
    return Math.min(BATIDA_MAX_TENTHS, this.score);
  }

  /** O resultado até agora (e, depois do fim, o resultado final). */
  get run(): BatidaRun {
    return {
      tenths: this.currentTenths,
      perfect: this.counts.perfect,
      good: this.counts.good,
      missed: this.counts.missed,
      stray: this.counts.stray,
      maxCombo: this.counts.maxCombo,
      holds: this.counts.holds,
      holdsBroken: this.counts.holdsBroken,
      endedAtMs: this.end.atMs,
      endedBar: this.end.bar,
      usedTaps: this.used,
    };
  }

  private fill(until: number) {
    while (barStart(this.song, this.nextBar) <= until) {
      for (const note of notesInBar(this.seed, this.song, this.nextBar))
        this.queue.push({ note, done: false });
      this.nextBar++;
    }
  }

  private finish(t: number) {
    this.end = { dead: true, atMs: t, bar: barAt(this.song, t) };
  }

  private lose(delta: number, t: number, kind: 'missed' | 'stray') {
    this.combo = 0;
    this.counts[kind]++;
    this.energy += delta;
    if (this.energy <= 0) this.finish(t);
  }

  /** Faz o tempo chegar a `t`: as notas cuja janela já fechou viram erros. */
  advance(t: number): SimEvent[] {
    const events: SimEvent[] = [];
    this.fill(t + GOOD_MS + 1);
    while (this.queue.length > 0 && !this.end.dead) {
      const head = this.queue[0]!;
      if (head.done) {
        this.queue.shift();
        continue;
      }
      if (head.note.t + GOOD_MS >= t) break;
      this.queue.shift();
      events.push({ kind: 'miss', note: head.note });
      this.lose(ENERGY_MISS, head.note.t + GOOD_MS, 'missed');
    }
    // Segurou a nota longa até o fim (ou quase): vale como um acerto Perfeito.
    if (!this.end.dead) {
      for (const [lane, note] of this.holding) {
        if (t < note.endT! - HOLD_END_SLACK_MS) continue;
        this.holding.delete(lane);
        this.counts.holds++;
        this.score += BATIDA_POINTS_HOLD * multiplierFor(this.combo);
        this.energy = Math.min(ENERGY_MAX, this.energy + ENERGY_HOLD);
        events.push({ kind: 'holdDone', lane, note });
      }
    }
    return events;
  }

  /** Um toque na pista `lane` no instante `t` (os toques chegam em ordem de tempo). */
  tap(lane: number, t: number): SimEvent[] {
    const events = this.advance(t);
    // Apertou de novo uma pista que ainda segurava: contou como soltar.
    if (this.holding.has(lane)) events.push(...this.release(lane, t));
    // Toque depois de a energia acabar não conta: a partida já tinha terminado.
    if (this.end.dead) return events;
    this.used++;
    let target: Pending | null = null;
    for (const q of this.queue) {
      if (q.note.t > t + GOOD_MS) break;
      if (q.done || q.note.lane !== lane || Math.abs(q.note.t - t) > GOOD_MS) continue;
      // A nota mais perto do toque vence (duas notas podem estar na janela).
      if (!target || Math.abs(q.note.t - t) < Math.abs(target.note.t - t)) target = q;
    }
    if (!target) {
      events.push({ kind: 'stray', lane, t });
      this.lose(ENERGY_STRAY, t, 'stray');
      return events;
    }
    target.done = true;
    const delta = t - target.note.t;
    const judgement = judge(delta) === 'perfect' ? 'perfect' : 'good';
    this.combo++;
    this.counts.maxCombo = Math.max(this.counts.maxCombo, this.combo);
    this.score +=
      (judgement === 'perfect' ? BATIDA_POINTS_PERFECT : BATIDA_POINTS_GOOD) *
      multiplierFor(this.combo);
    this.energy = Math.min(
      ENERGY_MAX,
      this.energy + (judgement === 'perfect' ? ENERGY_PERFECT : ENERGY_GOOD),
    );
    this.counts[judgement]++;
    events.push({ kind: 'hit', judgement, note: target.note, delta });
    // Nota longa: daqui em diante a pessoa tem que segurar até o fim.
    if (target.note.endT !== undefined) this.holding.set(lane, target.note);
    return events;
  }

  /** A pessoa soltou a pista `lane` no instante `t` (os toques e as soltadas chegam em ordem). */
  release(lane: number, t: number): SimEvent[] {
    const events = this.advance(t);
    const note = this.holding.get(lane);
    if (this.end.dead || !note) return events;
    // Soltou antes da hora (o `advance` já teria completado se fosse a tempo).
    this.holding.delete(lane);
    this.counts.holdsBroken++;
    this.combo = 0;
    this.energy += ENERGY_HOLD_BREAK;
    events.push({ kind: 'holdBroken', lane, note });
    if (this.energy <= 0) this.finish(t);
    return events;
  }

  /** Sem mais toques: o que ainda vier passa sem toque até a energia acabar. */
  runOut(from: number) {
    let horizon = from;
    for (let guard = 0; !this.end.dead && guard < 5000; guard++) {
      horizon += barMs(this.song, barAt(this.song, horizon));
      this.advance(horizon + GOOD_MS + 1);
    }
  }
}

/**
 * Refaz a partida a partir dos toques: junta cada toque com a nota mais próxima da pista (dentro
 * da janela), conta acertos, combo, multiplicador e energia, e para quando a energia acaba. Notas
 * que passam sem toque são erros, e continuam sendo mesmo se a pessoa parar de tocar.
 */
export function evaluateBatida(seed: string, song: Song, taps: readonly BatidaTap[]): BatidaRun {
  const sim = new BatidaSim(seed, song);
  // Cada toque vira dois instantes (apertar e soltar), em ordem de tempo; soltar vem antes de
  // apertar quando caem no mesmo milissegundo.
  const moments = taps
    .flatMap((tap) => [
      { down: true, lane: tap.lane, at: tap.t },
      { down: false, lane: tap.lane, at: Math.max(tap.up, tap.t + 1) },
    ])
    .sort((a, b) => a.at - b.at || Number(a.down) - Number(b.down));
  let last = 0;
  for (const m of moments) {
    if (m.down) sim.tap(m.lane, m.at);
    else sim.release(m.lane, m.at);
    last = m.at;
    if (sim.dead) break;
  }
  sim.runOut(last);
  return sim.run;
}

/** O mínimo que uma partida com este resultado leva: a duração até a energia acabar. */
export const batidaDurationMs = (run: BatidaRun): number => run.endedAtMs;
