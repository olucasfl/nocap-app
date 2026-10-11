/**
 * Ecooo Batida (spec 019): modo de ritmo, estilo Guitar Hero. Cinco pistas, notas que descem, e a
 * pessoa toca na hora certa. Lógica pura e determinística: a música é composta e fixa (versos, refrão), e
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

/** As três músicas do Batida: cada uma é composta à mão, com tom, harmonia, ritmo e refrão próprios. */
export type SongId = 'passo' | 'mare' | 'frenesi';

/** Um acorde da harmonia: a raiz (semitons acima da tônica) e se é menor. */
export interface Chord {
  root: number;
  minor: boolean;
}

/**
 * Um trecho da música. `bars` tem um compasso por texto, com 8 colcheias separadas por espaço:
 *  - `.` silêncio;
 *  - `3` uma nota na pista 3 (de 1 a 5);
 *  - `13` duas notas juntas (pistas 1 e 3);
 *  - `3-2` nota longa na pista 3, que dura 2 colcheias (de 2 a 4).
 * `chords` tem um acorde por compasso: `0` (raiz), `7` (cinco semitons acima...), `9m` (menor).
 */
export interface Section {
  bars: readonly string[];
  chords: readonly string[];
}

export interface Song {
  id: SongId;
  name: string;
  /** Uma linha que diz a proposta da música (aparece na escolha). */
  tagline: string;
  startBpm: number;
  maxBpm: number;
  /** Quanto o andamento sobe a cada compasso até o máximo. */
  bpmPerBar: number;
  /** O tom: semitons acima do dó. A tônica de tudo (melodia, acordes, baixo). */
  tonic: number;
  /**
   * As 5 notas da melodia (semitons acima da tônica), da pista 1 à 5. Cada pista é sempre a mesma
   * nota: o que a pessoa toca é a melodia de verdade, e os acordes passam por baixo.
   */
  scale: readonly number[];
  /** Jeito da bateria e do baixo (o som escolhe os padrões). */
  groove: 'basic' | 'funk' | 'drive';
  /** Timbre da melodia que a pessoa toca. */
  lead: 'soft' | 'bright' | 'sharp';
  /** Os trechos (verso, refrão, ponte) e a ordem em que tocam (a volta toda se repete). */
  sections: Readonly<Record<string, Section>>;
  /**
   * A ordem dos trechos. Um `+` no fim engrossa o trecho com uma segunda nota nos tempos fortes, e
   * `++` com notas juntas ainda mais seguidas (sempre no máximo duas): é o mesmo refrão, mais cheio.
   */
  arrangement: readonly string[];
}

export const SONGS: Record<SongId, Song> = {
  passo: {
    id: 'passo',
    name: 'Primeiro Passo',
    tagline: 'Doce e simples. Aprenda o refrão, que volta mais cheio e mais rápido a cada volta.',
    startBpm: 64,
    maxBpm: 360,
    bpmPerBar: 1.2,
    tonic: 0,
    scale: [0, 2, 4, 7, 9],
    groove: 'basic',
    lead: 'soft',
    sections: {
      verso: {
        chords: ['0', '0', '7', '7', '9m', '9m', '5', '5'],
        bars: [
          '3 . 3 . 4 . 3 .',
          '2 . 3 . 2 . . .',
          '3 . 3 . 4 . 3 .',
          '4 . 3 . 2 . . .',
          '3 . 3 . 4 . 4 .',
          '3 . 2 . 3 . . .',
          '4 . 3 . 2 . 3 .',
          '2 . . . 3-2 . . .',
        ],
      },
      refrao: {
        chords: ['0', '0', '7', '7', '9m', '9m', '5', '5'],
        bars: [
          '3 . 3 . 4 . 5 .',
          '4 . 3 . 2 . 3 .',
          '3 . 3 . 4 . 5 .',
          '5 . 4 . 3 . 2 .',
          '3 . 3 4 5 . 5 .',
          '4 . 3 . 5-2 . . .',
          '5 . 4 . 3 . 2 .',
          '3 . 2 . 1 . 1 .',
        ],
      },
      ponte: {
        chords: ['9m', '5', '0', '7'],
        bars: ['1 . 2 . 3 . 4 .', '5 . 4 . 3 . 2 .', '3 . 3 . 4 . 4 .', '5 . . . 5-2 . . 4'],
      },
    },
    arrangement: ['verso', 'refrao', 'verso', 'refrao', 'ponte', 'refrao+'],
  },
  mare: {
    id: 'mare',
    name: 'Maré Alta',
    tagline: 'Balanço com síncope. O refrão vem em ondas: aprenda o desenho e deixe a maré subir.',
    startBpm: 78,
    maxBpm: 360,
    bpmPerBar: 1.6,
    tonic: 9,
    scale: [0, 3, 5, 7, 10],
    groove: 'funk',
    lead: 'bright',
    sections: {
      verso: {
        chords: ['0m', '0m', '10', '10', '8', '8', '10', '10'],
        bars: [
          '1 . . 1 . 3 . 2',
          '1 . . 3 . 2 . .',
          '3 . . 3 . 4 . 3',
          '2 . . 3 . 2 . .',
          '2 . . 2 . 4 . 3',
          '2 . . 4-2 . . . 2',
          '3 . . 3 . 4 . 5',
          '4 . . 3 . 2 . 1',
        ],
      },
      refrao: {
        chords: ['0m', '10', '8', '10', '0m', '10', '8', '7'],
        bars: [
          '5 . 4 . . 3 4 .',
          '5 . 4 . . 3 . 2',
          '4 . 3 . . 2 3 .',
          '4 . 3 . 2 . 1 .',
          '5 . 4 . . 3 4 .',
          '5 . 4 . . 3 . 2',
          '4 . 3 . . 2 3 .',
          '3 . 2 . 1-2 . . 2',
        ],
      },
      ponte: {
        chords: ['8', '8', '10', '10'],
        bars: ['1 2 3 4 5 . 5 .', '5 4 3 2 1 . 1 .', '1 . 3 . 5 . 3 .', '5 . . . 5-2 . . 4'],
      },
    },
    arrangement: ['verso', 'refrao', 'verso', 'refrao+', 'ponte', 'refrao+'],
  },
  frenesi: {
    id: 'frenesi',
    name: 'Frenesi',
    tagline: 'Pesada e sem descanso. Riff de colcheias, refrão com notas longas e notas juntas.',
    startBpm: 92,
    maxBpm: 360,
    bpmPerBar: 2,
    tonic: 4,
    scale: [0, 3, 5, 6, 7],
    groove: 'drive',
    lead: 'sharp',
    sections: {
      verso: {
        chords: ['0m', '0m', '0m', '0m', '8', '8', '10', '10'],
        bars: [
          '1 1 . 3 . 1 . 4',
          '1 1 . 3 . 5 4 3',
          '1 1 . 3 . 1 . 4',
          '2 2 . 4 . 3 2 1',
          '3 3 . 5 . 3 . 4',
          '3 3 . 5 . 4 3 2',
          '2 2 . 4 . 2 . 3',
          '4 . 3 . 2 . 1 .',
        ],
      },
      refrao: {
        chords: ['0m', '0m', '8', '10', '0m', '0m', '8', '10'],
        bars: [
          '5 . 5 . 4-2 . . 3',
          '4 . 4 . 3-2 . . 2',
          '5 . 5 . 5-2 . . 4',
          '5 4 3 2 1 . 2 .',
          '5 . 5 . 4-2 . . 3',
          '4 . 4 . 3-2 . . 2',
          '3 3 4 4 5 5 . 5',
          '5 4 3 2 1 . 1 .',
        ],
      },
      ponte: {
        chords: ['0m', '8', '10', '0m'],
        bars: ['1-4 . . . . 5 . 4', '2-4 . . . . 4 . 5', '1 2 3 4 5 4 3 2', '5 . 5 . 5 . 5 5'],
      },
    },
    arrangement: ['verso', 'refrao', 'verso', 'refrao+', 'ponte', 'refrao++'],
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

/** Uma posição com nota: as pistas (1 a 3 juntas) e, se for nota longa, quantas colcheias dura. */
interface Beat {
  step: number;
  lanes: number[];
  hold?: number;
}

interface LapBar {
  /** Trecho a que o compasso pertence (verso, refrao, ponte), a posição nele e o tamanho dele. */
  section: string;
  index: number;
  count: number;
  /** Quantos `+` o trecho tem na ordem (0 = o original, 1 = engrossado, 2 = mais cheio). */
  thick: number;
  chord: Chord;
  beats: Beat[];
}

const HOLD_TOKEN = /^([1-5])-([2-4])$/;
const NOTE_TOKEN = /^[1-5]{1,2}$/;
const CHORD_TOKEN = /^(\d+)(m?)$/;

/** Lê o texto de um compasso (8 colcheias) e devolve as posições com nota. */
export function parseBar(text: string): Beat[] {
  const tokens = text.trim().split(/\s+/);
  if (tokens.length !== STEPS_PER_BAR) throw new Error(`Compasso sem 8 posições: "${text}"`);
  const beats: Beat[] = [];
  tokens.forEach((tok, step) => {
    if (tok === '.') return;
    const hold = HOLD_TOKEN.exec(tok);
    if (hold) return void beats.push({ step, lanes: [Number(hold[1]) - 1], hold: Number(hold[2]) });
    if (!NOTE_TOKEN.test(tok)) throw new Error(`Posição inválida "${tok}" em "${text}"`);
    const lanes = [...tok].map((c) => Number(c) - 1);
    if (new Set(lanes).size !== lanes.length) throw new Error(`Pista repetida em "${text}"`);
    if (lanes.includes(0) && lanes.includes(BATIDA_LANES - 1))
      throw new Error(`As pistas 1 e 5 não podem vir juntas: "${text}"`);
    beats.push({ step, lanes });
  });
  return beats;
}

export function parseChord(text: string): Chord {
  const m = CHORD_TOKEN.exec(text);
  if (!m) throw new Error(`Acorde inválido "${text}"`);
  return { root: Number(m[1]), minor: m[2] === 'm' };
}

/** Pistas vizinhas (em graus da escala) para formar acordes junto de uma nota. */
function companions(lane: number, taken: readonly number[], want: number): number[] {
  const out: number[] = [];
  for (const d of [2, -2, 1, -1, 3, -3]) {
    const l = lane + d;
    if (l < 0 || l >= BATIDA_LANES || taken.includes(l) || out.includes(l)) continue;
    // As duas pontas (pistas 1 e 5) nunca vêm juntas: não dá para alcançar com a mesma mão.
    const group = [...taken, ...out, l];
    if (group.includes(0) && group.includes(BATIDA_LANES - 1)) continue;
    out.push(l);
    if (out.length === want) break;
  }
  return out;
}

/**
 * Engrossa um compasso para as voltas mais cheias do refrão: o mesmo desenho, com mais notas
 * juntas. Nível 1 põe uma segunda nota nos tempos fortes (colcheias 0 e 4); nível 2 põe nos quatro
 * tempos. Nunca mais de duas notas juntas. Nota longa nunca é engrossada.
 */
function thicken(beats: Beat[], level: number): Beat[] {
  if (level === 0) return beats;
  return beats.map((b) => {
    if (b.hold !== undefined || b.lanes.length !== 1) return b;
    const strong = level >= 2 ? b.step % 2 === 0 : b.step === 0 || b.step === 4;
    if (!strong) return b;
    // No máximo duas notas juntas: uma segunda e nunca uma terceira.
    const extra = companions(b.lanes[0]!, b.lanes, 1);
    return { ...b, lanes: [...b.lanes, ...extra].sort((x, y) => x - y) };
  });
}

const lapCache = new Map<SongId, LapBar[]>();

/** Uma volta inteira da música: todos os compassos, na ordem em que tocam. */
function lapOf(song: Song): LapBar[] {
  let lap = lapCache.get(song.id);
  if (lap) return lap;
  lap = [];
  for (const entry of song.arrangement) {
    const name = entry.replace(/\+/g, '');
    const thick = entry.length - name.length;
    const section = song.sections[name];
    if (!section) throw new Error(`Trecho "${name}" não existe em ${song.id}`);
    if (section.bars.length !== section.chords.length)
      throw new Error(`${song.id}/${name}: um acorde por compasso`);
    section.bars.forEach((text, index) => {
      lap!.push({
        section: name,
        index,
        count: section.bars.length,
        thick,
        chord: parseChord(section.chords[index]!),
        beats: thicken(parseBar(text), thick),
      });
    });
  }
  lapCache.set(song.id, lap);
  return lap;
}

/** Quantos compassos tem uma volta da música (depois dela, tudo recomeça, cada vez mais rápido). */
export function lapLength(song: Song): number {
  return lapOf(song).length;
}

export interface SectionInfo {
  name: string;
  /** Primeiro e último compasso do trecho (o som marca a entrada e faz a virada). */
  first: boolean;
  last: boolean;
  thick: number;
}

/** Em que trecho da música está o compasso `bar` (a contagem inicial vale como verso). */
export function sectionAt(song: Song, bar: number): SectionInfo {
  const lap = lapOf(song);
  const b = lap[Math.max(0, bar - LEAD_IN_BARS) % lap.length]!;
  return {
    name: bar < LEAD_IN_BARS ? 'contagem' : b.section,
    first: b.index === 0,
    last: b.index === b.count - 1,
    thick: b.thick,
  };
}

const noteCache = new Map<string, BatidaNote[]>();

/**
 * As notas do compasso `bar` (a contagem, compasso 0, não tem notas). A música é composta e fixa:
 * é sempre a mesma sequência, para dar para decorar o refrão. A `seed` só identifica a partida.
 */
export function notesInBar(_seed: string, song: Song, bar: number): BatidaNote[] {
  if (bar < LEAD_IN_BARS) return [];
  const key = `${song.id}:${bar}`;
  const cached = noteCache.get(key);
  if (cached) return cached;
  if (noteCache.size > 800) noteCache.clear();
  const lap = lapOf(song);
  const out: BatidaNote[] = [];
  for (const beat of lap[(bar - LEAD_IN_BARS) % lap.length]!.beats) {
    for (const lane of beat.lanes) {
      const note: BatidaNote = { bar, step: beat.step, lane, t: timeOf(song, bar, beat.step) };
      if (beat.hold !== undefined) note.endT = timeOf(song, bar, beat.step + beat.hold);
      out.push(note);
    }
  }
  out.sort((x, y) => x.step - y.step || x.lane - y.lane);
  noteCache.set(key, out);
  return out;
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

/** O acorde que toca no compasso `bar` (a raiz em semitons acima da tônica, e se é menor). */
export function chordAt(song: Song, bar: number): Chord {
  const lap = lapOf(song);
  return lap[Math.max(0, bar - LEAD_IN_BARS) % lap.length]!.chord;
}

/** Raiz do acorde que toca no compasso `bar`, em semitons acima da tônica. */
export function rootAt(song: Song, bar: number): number {
  return chordAt(song, bar).root;
}

/**
 * Semitons (acima da tônica) da nota da pista `lane`. Cada pista é sempre a mesma nota: o que a
 * pessoa toca é a melodia de verdade e os acordes mudam por baixo.
 */
export function semitoneOf(song: Song, lane: number, _bar = 0): number {
  return song.scale[Math.max(0, Math.min(BATIDA_LANES - 1, lane))]!;
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
