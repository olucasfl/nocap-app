import { createRng } from '../core/rng';

/** Regras puras do Intruso (variante da Cor só para sala). Ver specs/011-impostor.md. */

export const IMPOSTOR_MIN_PLAYERS = 3;
export const IMPOSTOR_MAX_PLAYERS = 8;
export const IMPOSTOR_MAX_COUNT = 3;

/**
 * Quantos intrusos uma sala de `players` pessoas aguenta: até 3, mas sempre sobra pelo menos uma
 * pessoa normal (3 pessoas: até 2 intrusos contra 1; ninguém joga com todo mundo intruso).
 */
export function impostorLimit(players: number): number {
  return Math.max(1, Math.min(IMPOSTOR_MAX_COUNT, players - 1));
}

/** O número pedido pelo host, ajustado ao que a sala suporta. */
export function effectiveImpostors(requested: number, players: number): number {
  return Math.max(1, Math.min(requested, impostorLimit(players)));
}

/** Sorteia quem é intruso na rodada: determinístico pela seed e pela posição da rodada. */
export function assignImpostors(
  ids: readonly string[],
  count: number,
  seed: string,
  roundIndex: number,
): string[] {
  const rng = createRng(`${seed}:impostor:${roundIndex}`);
  const pool = [...ids].sort();
  // Fisher-Yates: o sorteio não depende da ordem em que as pessoas entraram.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}

export interface VoteResult {
  /** Votos recebidos por pessoa (só quem recebeu pelo menos um aparece). */
  counts: Record<string, number>;
  /** Quem foi pego: mais votos que o (K+1)-ésimo mais votado, com K = número de intrusos. */
  caught: string[];
}

/**
 * Conta os votos (`votes[votante] = suspeito`). Com K intrusos, é "pego" quem recebeu
 * estritamente mais votos que o (K+1)-ésimo da fila: empate na fronteira não pega ninguém.
 */
export function tallyVotes(
  memberIds: readonly string[],
  votes: Readonly<Record<string, string>>,
  impostorCount: number,
): VoteResult {
  const counts: Record<string, number> = {};
  for (const [voter, target] of Object.entries(votes)) {
    if (voter === target || !memberIds.includes(target) || !memberIds.includes(voter)) continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }
  const ranked = memberIds.map((id) => ({ id, n: counts[id] ?? 0 })).sort((a, b) => b.n - a.n);
  const border = ranked[impostorCount]?.n ?? 0;
  const caught = ranked.filter((r) => r.n > border && r.n > 0).map((r) => r.id);
  return { counts, caught };
}

export const POINTS = { rightVote: 3, survived: 6, perVoteOnInnocent: 1 } as const;

export interface RoundScoreInput {
  memberIds: readonly string[];
  impostors: readonly string[];
  /** Nota da recriação (0 a 10) de cada pessoa; quem não respondeu conta 0. */
  accuracy: Readonly<Record<string, number>>;
  votes: Readonly<Record<string, string>>;
}

/** Pontos da rodada por pessoa (1 casa). */
export function scoreImpostorRound(input: RoundScoreInput): {
  points: Record<string, number>;
  tally: VoteResult;
} {
  const { memberIds, impostors, accuracy, votes } = input;
  const tally = tallyVotes(memberIds, votes, impostors.length);
  const points: Record<string, number> = {};
  for (const id of memberIds) points[id] = accuracy[id] ?? 0;
  for (const [voter, target] of Object.entries(votes)) {
    if (voter !== target && impostors.includes(target) && memberIds.includes(voter)) {
      points[voter] = (points[voter] ?? 0) + POINTS.rightVote;
    }
  }
  const onInnocents = memberIds
    .filter((id) => !impostors.includes(id))
    .reduce((sum, id) => sum + (tally.counts[id] ?? 0), 0);
  for (const id of impostors) {
    if (!tally.caught.includes(id)) points[id] = (points[id] ?? 0) + POINTS.survived;
    points[id] = (points[id] ?? 0) + onInnocents * POINTS.perVoteOnInnocent;
  }
  for (const id of memberIds) points[id] = Math.round(points[id]! * 10) / 10;
  return { points, tally };
}
