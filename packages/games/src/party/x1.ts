import { createRng, randInt } from '../core/rng';
import { BIG_WEIGHT, MICRO_MAX } from './micro';

/**
 * Arena X1 (minijogo grande): duelos de reflexo. Em cada disparo surge um botão verde; quem clica
 * primeiro ganha 1 ponto e o outro perde 1 (sem nunca passar de zero para baixo). Vence o duelo
 * quem abrir 3 pontos de diferença;
 * se ninguém abrir em 15 disparos, é empate. Quem sobra num número ímpar enfrenta o Bot NoCap.
 */

export const X1_LEAD_TO_WIN = 3;
export const X1_MAX_ROUNDS = 15;
/** Espera aleatória antes de o botão aparecer. */
export const X1_MIN_DELAY_MS = 1500;
export const X1_MAX_DELAY_MS = 4000;
/** Reação do bot: humana e equilibrada (nem imbatível, nem boba). */
export const X1_BOT_MIN_MS = 280;
export const X1_BOT_MAX_MS = 460;
/** Quanto tempo o botão espera um clique antes de dar o disparo como perdido. */
export const X1_CLICK_WINDOW_MS = 2500;
/** Pausa entre um disparo e o seguinte. */
export const X1_BETWEEN_MS = 1500;
/** O servidor desconta no máximo isto de latência (ida e volta) da reação de cada um. */
export const X1_MAX_COMP_MS = 400;

export interface X1Shot {
  delayMs: number;
  /** Posição do botão em % da área. */
  x: number;
  y: number;
  botMs: number;
}

/** O disparo `round` (0, 1...) do duelo `duel`: tudo pela seed. */
export function x1Shot(seed: string, duel: number, round: number): X1Shot {
  const rng = createRng(`${seed}:x1:${duel}:${round}`);
  return {
    delayMs: randInt(rng, X1_MIN_DELAY_MS, X1_MAX_DELAY_MS),
    x: randInt(rng, 12, 88),
    y: randInt(rng, 20, 80),
    botMs: randInt(rng, X1_BOT_MIN_MS, X1_BOT_MAX_MS),
  };
}

export interface X1Score {
  a: number;
  b: number;
}

/**
 * Aplica um disparo: quem ganhou soma 1; quem perdeu tira 1, mas o placar nunca fica negativo
 * (com 0 e perdendo, continua 0). `winner` nulo = ninguém clicou, nada muda.
 */
export function x1Score(score: X1Score, winner: 'a' | 'b' | null): X1Score {
  if (winner === null) return score;
  const loser = winner === 'a' ? 'b' : 'a';
  return {
    ...score,
    [winner]: score[winner] + 1,
    [loser]: Math.max(0, score[loser] - 1),
  } as X1Score;
}

/** Diferença a favor de `a` (é ela que decide o duelo). */
export const x1Lead = (score: X1Score): number => score.a - score.b;

/** O duelo acabou? `a` vence com +3, `b` com -3, e o teto de disparos é empate. */
export function x1Outcome(lead: number, rounds: number): 'a' | 'b' | 'tie' | null {
  if (lead >= X1_LEAD_TO_WIN) return 'a';
  if (lead <= -X1_LEAD_TO_WIN) return 'b';
  return rounds >= X1_MAX_ROUNDS ? 'tie' : null;
}

/** Pontos na partida: vitória vale o dobro de um micro-desafio, empate metade disso, derrota 0. */
export function x1Points(result: 'win' | 'tie' | 'loss'): number {
  const full = MICRO_MAX * BIG_WEIGHT;
  return result === 'win' ? full : result === 'tie' ? full / 2 : 0;
}

/** Pares da sala (embaralhados pela seed); quem sobra enfrenta o bot (`b = null`). */
export function x1Pairs(seed: string, ids: readonly string[]): { a: string; b: string | null }[] {
  const rng = createRng(`${seed}:x1-pairs`);
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const out: { a: string; b: string | null }[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    out.push({ a: shuffled[i]!, b: shuffled[i + 1] ?? null });
  }
  return out;
}
