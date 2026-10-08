import { createRng, randInt } from '../core/rng';
import { ecoPresets, sequenceFor } from '../eco';
import { generateTimeRound, scoreTime, type TimeSettings } from '../time';
import { PHRASES, WORDS } from './words';

/** Pontos máximos de um micro-desafio; o minijogo grande vale `BIG_WEIGHT` vezes isto. */
export const MICRO_MAX = 1000;
export const BIG_WEIGHT = 2;

/** Nota 0 a 10 vira pontos: nota 10 = 1000, linear a partir da nota 5 (5 ou menos vale 0). */
export function noteToPoints(note: number): number {
  return Math.round(Math.max(0, (note - 5) / 5) * MICRO_MAX);
}

/** O que cada desafio precisa saber do seu sorteio (sem depender do resto do plano). */
export interface MicroRef {
  seed: string;
  variant: string;
}

export const PAD_NAMES = [
  'laranja',
  'azul',
  'amarelo',
  'verde',
  'rosa',
  'roxo',
  'ciano',
  'vermelho',
  'grafite',
] as const;

// ---- Já Deu? ----

export const MICRO_TIME_SETTINGS: TimeSettings = {
  rounds: 1,
  minMs: 2000,
  maxMs: 8000,
  noOvershoot: false,
  mix: 'uniform',
  fine: true,
};

export interface TimeChallenge {
  /** O alvo que aparece na tela (o relógio mostrado, no Tempo Falso). */
  targetMs: number;
  /** Quanto tempo REAL a pessoa precisa contar para acertar. */
  expectedMs: number;
  /** Tempo Falso: o relógio anda X% mais rápido (`fast`) ou mais devagar. */
  pct: number;
  fast: boolean;
  /** Relógio visível durante a contagem? (Tempo Falso e Cego; no Padrão não há relógio.) */
  showClock: boolean;
  /** Cego: o relógio some depois deste tempo. */
  hideAfterMs: number | null;
  /** Velocidade do relógio mostrado em relação ao real. */
  factor: number;
  /** Sem Estourar: passar do alvo tira pontos. */
  noOver: boolean;
}

export function timeChallenge(ref: MicroRef): TimeChallenge {
  const targetMs = generateTimeRound(ref.seed, MICRO_TIME_SETTINGS, 0);
  const rng = createRng(`${ref.seed}:falso`);
  const pct = rng() < 0.5 ? 15 : 20;
  const fast = rng() < 0.5;
  const falso = ref.variant === 'falso';
  const factor = falso ? (fast ? 1 + pct / 100 : 1 - pct / 100) : 1;
  return {
    targetMs,
    expectedMs: Math.round(targetMs / factor),
    pct,
    fast,
    showClock: ref.variant !== 'standard',
    hideAfterMs: ref.variant === 'cego' ? 1000 : null,
    factor,
    noOver: ref.variant === 'noover',
  };
}

/** Respostas absurdas (toque duplo ou contagem de 3x o esperado) não pontuam. */
export function timePoints(ref: MicroRef, ms: number): number {
  const c = timeChallenge(ref);
  if (!Number.isInteger(ms) || ms < 200 || ms > c.expectedMs * 3) return 0;
  // Sem Estourar: passou do alvo (com 150 ms de folga), perde 400.
  if (c.noOver && ms > c.expectedMs + 150) return -400;
  return noteToPoints(scoreTime(c.expectedMs, ms, MICRO_TIME_SETTINGS));
}

// ---- Ecooo ----

export const ECO_MICRO_STEP_MS = 600;

export interface EcoChallenge {
  sequence: number[];
  pads: number;
  stepMs: number;
  reverse: boolean;
  /** Botão a ignorar ao repetir (Botão Proibido); ele aparece na sequência mostrada. */
  forbidden: number | null;
  /** O que a pessoa precisa tocar, na ordem. */
  expected: number[];
}

export function ecoChallenge(ref: MicroRef): EcoChallenge {
  const rng = createRng(`${ref.seed}:eco`);
  const length = randInt(rng, 8, 12);
  const settings = { ...ecoPresets.classic, startLength: length };
  const sequence = sequenceFor(ref.seed, settings, 1);
  const forbidden = ref.variant === 'forbidden' ? sequence[randInt(rng, 0, length - 1)]! : null;
  // Trocado: esquerda e direita trocam de lugar (laranja com azul, amarelo com verde).
  const SWAP = [1, 0, 3, 2];
  const expected =
    ref.variant === 'reverse'
      ? [...sequence].reverse()
      : ref.variant === 'oddonly'
        ? sequence.filter((_, i) => i % 2 === 0)
        : ref.variant === 'swap'
          ? sequence.map((p) => SWAP[p]!)
          : forbidden !== null
            ? sequence.filter((p) => p !== forbidden)
            : sequence;
  return {
    sequence,
    pads: 4,
    stepMs: ECO_MICRO_STEP_MS,
    reverse: ref.variant === 'reverse',
    forbidden,
    expected,
  };
}

/**
 * Proporcional aos acertos por posição, descontando o que se acerta só por sorte (com 4 botões,
 * tocar ao acaso acerta 1 em cada 4): tocar qualquer coisa vale 0 e a sequência certa vale 1000.
 * Tocar o botão proibido tira 300.
 */
export function ecoPoints(ref: MicroRef, taps: readonly number[]): number {
  const c = ecoChallenge(ref);
  if (c.forbidden !== null && taps.includes(c.forbidden)) return -300;
  const hits = c.expected.reduce((n, pad, i) => n + (taps[i] === pad ? 1 : 0), 0);
  const chance = c.expected.length / c.pads;
  return Math.round((MICRO_MAX * Math.max(0, hits - chance)) / (c.expected.length - chance));
}

// ---- Digitação Ligeira ----

export const TYPING_TRAP_MS = 6000;

const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export interface TypingChallenge {
  /** A palavra ou a frase mostrada. */
  word: string;
  /** O que precisa ser digitado; `null` na Mão Boba (não digitar nada). */
  expected: string | null;
}

/** Regras que só funcionam com palavra solta (com frase ficariam longas ou confusas). */
const WORD_ONLY = new Set(['reverse', 'count', 'ends', 'twice']);

export function typingChallenge(ref: MicroRef): TypingChallenge {
  const rng = createRng(`${ref.seed}:word`);
  // Cerca de 4 em cada 10 textos são frases (quando a regra deixa).
  const usePhrase = !WORD_ONLY.has(ref.variant) && rng() < 0.4;
  let list: readonly string[] = usePhrase ? PHRASES : WORDS;
  // A regra só faz sentido se o texto tiver o que ela mexe: "sem A" precisa de A; "sem acentos"
  // precisa de acento.
  if (ref.variant === 'noaccents') list = list.filter((t) => t !== strip(t));
  if (ref.variant === 'noa') list = list.filter((t) => strip(t.toLowerCase()).includes('a'));
  const word = list[randInt(rng, 0, list.length - 1)]!;
  const lower = word.toLowerCase();
  const plain = strip(lower);
  switch (ref.variant) {
    case 'maohoba':
      return { word, expected: null };
    case 'reverse':
      return { word, expected: [...plain].reverse().join('') };
    case 'novowels':
      return { word, expected: clean(plain.replace(/[aeiou]/g, '')) };
    case 'noaccents':
      return { word, expected: plain };
    case 'noa':
      return { word, expected: clean(plain.replace(/a/g, '')) };
    case 'count':
      return { word, expected: String(plain.length) };
    case 'ends':
      return { word, expected: plain[0]! + plain[plain.length - 1]! };
    case 'twice':
      return { word, expected: plain + plain };
    default:
      return { word, expected: plain };
  }
}

/** Quanto tempo a pessoa tem: 8 s numa palavra e até 17 s numa frase; a Mão Boba é curta. */
export function typingPickMs(ref: MicroRef): number {
  if (ref.variant === 'maohoba') return TYPING_TRAP_MS;
  const c = typingChallenge(ref);
  const len = Math.max(c.word.length, c.expected?.length ?? 0);
  return Math.min(17_000, Math.max(8000, 4500 + 480 * len));
}

/** Compara sem maiúsculas, sem espaços sobrando; só "sem acentos" exige não ter acento. */
export function typingMatches(ref: MicroRef, text: string): boolean {
  const c = typingChallenge(ref);
  if (c.expected === null) return false;
  const typed = clean(text.toLowerCase());
  return ref.variant === 'noaccents' ? typed === c.expected : strip(typed) === c.expected;
}

/**
 * Correto vale 400 a 1000 conforme a rapidez; errado, 0. Mão Boba: digitar ou enviar qualquer
 * coisa tira 500, e ficar quieto vale 1000.
 */
export function typingPoints(
  ref: MicroRef,
  text: string,
  touched: boolean,
  elapsedMs: number,
): number {
  if (ref.variant === 'maohoba') return text.trim() || touched ? -500 : MICRO_MAX;
  // Nas regras de troll, errar custa 300; no texto exato, só deixa de pontuar.
  if (!typingMatches(ref, text)) return ref.variant === 'standard' ? 0 : -300;
  const speed = Math.max(0, 1 - elapsedMs / typingPickMs(ref));
  return 400 + Math.round(600 * speed);
}
