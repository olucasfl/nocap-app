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
  /** O alvo que aparece na tela. */
  targetMs: number;
  /** Quanto tempo REAL a pessoa precisa contar para acertar (muda no Tempo Falso, Metade e Dobro). */
  expectedMs: number;
  /** Tempo Falso: o tempo "anda" X% mais rápido (`fast`) ou mais devagar na contagem de cabeça. */
  pct: number;
  fast: boolean;
  /** Sem Estourar: passar do alvo tira pontos. */
  noOver: boolean;
}

/**
 * Já Deu? na Maratona é igual ao jogo original: aparece o alvo e a regra, a pessoa aperta COMEÇAR
 * e conta de cabeça. Nunca há relógio nem número correndo. As regras só mudam o que se conta.
 */
export function timeChallenge(ref: MicroRef): TimeChallenge {
  const targetMs = generateTimeRound(ref.seed, MICRO_TIME_SETTINGS, 0);
  const rng = createRng(`${ref.seed}:falso`);
  const pct = rng() < 0.5 ? 15 : 20;
  const fast = rng() < 0.5;
  const expectedMs =
    ref.variant === 'falso'
      ? Math.round(targetMs / (fast ? 1 + pct / 100 : 1 - pct / 100))
      : ref.variant === 'metade'
        ? Math.round(targetMs / 2)
        : ref.variant === 'dobro'
          ? targetMs * 2
          : targetMs;
  return { targetMs, expectedMs, pct, fast, noOver: ref.variant === 'noover' };
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

export const ECO_MICRO_STEP_MS = 700;

/** Quantos passos tem a sequência mostrada, por regra. */
const ECO_LENGTHS: Record<string, [number, number]> = {
  standard: [5, 7],
  reverse: [4, 5],
  forbidden: [6, 7],
  oddonly: [6, 8],
  swap: [4, 6],
};

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
  // Curtas e jogáveis: o tamanho depende da regra (as que pedem mais atenção ficam menores).
  const [min, max] = ECO_LENGTHS[ref.variant] ?? ECO_LENGTHS.standard!;
  const length = randInt(rng, min, max);
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
  /** Palavra solta ou frase: a tela e o comando avisam qual é. */
  kind: 'palavra' | 'frase';
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
  const kind = usePhrase ? 'frase' : 'palavra';
  const lower = word.toLowerCase();
  const plain = strip(lower);
  switch (ref.variant) {
    case 'maohoba':
      return { word, kind, expected: null };
    case 'reverse':
      return { word, kind, expected: [...plain].reverse().join('') };
    case 'novowels':
      return { word, kind, expected: clean(plain.replace(/[aeiou]/g, '')) };
    case 'noaccents':
      return { word, kind, expected: plain };
    case 'noa':
      return { word, kind, expected: clean(plain.replace(/a/g, '')) };
    case 'count':
      return { word, kind, expected: String(plain.length) };
    case 'ends':
      return { word, kind, expected: plain[0]! + plain[plain.length - 1]! };
    case 'twice':
      return { word, kind, expected: plain + plain };
    default:
      return { word, kind, expected: plain };
  }
}

/** Quanto tempo a pessoa tem: 8 s numa palavra e até 17 s numa frase; a Mão Boba é curta. */
export function typingPickMs(ref: MicroRef): number {
  if (ref.variant === 'maohoba') return TYPING_TRAP_MS;
  const c = typingChallenge(ref);
  const len = Math.max(c.word.length, c.expected?.length ?? 0);
  return Math.min(17_000, Math.max(8000, 4500 + 480 * len));
}

/** Sem maiúsculas e sem espaços: errar um espaço não zera quem acertou as letras. */
function normalizeTyped(ref: MicroRef, text: string): string {
  const typed = text.toLowerCase();
  return (ref.variant === 'noaccents' ? typed : strip(typed)).replace(/\s+/g, '');
}

/** Quão perto o texto ficou do esperado, de 0 a 1 (distância de edição sobre o maior tamanho). */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const len = Math.max(a.length, b.length);
  if (len === 0) return 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return 1 - prev[b.length]! / len;
}

function closeness(ref: MicroRef, text: string): number {
  const c = typingChallenge(ref);
  if (c.expected === null) return 0;
  return similarity(normalizeTyped(ref, text), c.expected.replace(/\s+/g, ''));
}

/** Confere sem maiúsculas e sem se importar com espaços; só "sem acentos" exige não ter acento. */
export function typingMatches(ref: MicroRef, text: string): boolean {
  return closeness(ref, text) === 1;
}

/**
 * Correto vale 400 a 1000 conforme a rapidez. Acertar mais da metade vale pontos parciais (até 399,
 * proporcionais ao quanto ficou certo). Abaixo disso, errado: 0 (ou -300 nas regras de troll). Mão Boba: digitar ou enviar qualquer
 * coisa tira 500, e ficar quieto vale 1000.
 */
export function typingPoints(
  ref: MicroRef,
  text: string,
  touched: boolean,
  elapsedMs: number,
): number {
  if (ref.variant === 'maohoba') return text.trim() || touched ? -500 : MICRO_MAX;
  // "Sem acentos" com acento é quebrar a regra, não um erro pequeno de digitação.
  if (ref.variant === 'noaccents' && text !== strip(text)) return -300;
  const close = closeness(ref, text);
  if (close < 1) {
    if (close > 0.5) return Math.floor((399 * (close - 0.5)) / 0.5);
    // Nas regras de troll, errar custa 300; no texto exato, só deixa de pontuar.
    return ref.variant === 'standard' ? 0 : -300;
  }
  const speed = Math.max(0, 1 - elapsedMs / typingPickMs(ref));
  return 400 + Math.round(600 * speed);
}
