import { createRng, randInt } from '../core/rng';

/**
 * Siga o Líder (spec 012): em cada rodada um jogador cria a sequência dentro de regras que o jogo
 * impõe, e os outros repetem. Lógica pura: o servidor valida o envio e calcula as notas.
 */

export const LEADER_MIN_ROUNDS = 4;
export const LEADER_MAX_ROUNDS = 12;
/** Ritmo da reprodução da sequência criada (igual ao Clássico). */
export const LEADER_STEP_MS = 700;
/** O líder pontua no máximo isto numa rodada: completar como seguidor (10) sempre vale mais. */
export const LEADER_MAX_POINTS = 7;
/** Ponto de partida: calibrar jogando. */
export const LEADER_COEFFICIENT = 0.7;

export type LeaderRule =
  | { kind: 'count'; n: number }
  | { kind: 'minColors'; k: number }
  | { kind: 'noRepeat' }
  | { kind: 'sameEnds' }
  | { kind: 'useAtLeast'; pad: number; times: number }
  | { kind: 'avoid'; pad: number };

/** Toques exigidos na rodada `r` (1, 2, 3...): 4, 6, 8, 10... até 20. */
export const leaderTaps = (r: number): number => Math.min(20, 4 + 2 * (r - 1));
/** Botões disponíveis: 4, 4, 5, 5, 6, 6... até 9. */
export const leaderPads = (r: number): number => Math.min(9, 4 + Math.floor((r - 1) / 2));
/** Regras extras além do total de toques: nenhuma nas rodadas 1 e 2, uma até a 6, duas depois. */
export const leaderExtras = (r: number): number => (r <= 2 ? 0 : r <= 6 ? 1 : 2);

/**
 * Tempo do líder para criar: 10 s + 2 s por toque exigido, no máximo 45 s. Curto de propósito: a
 * rodada anda e ninguém fica esperando parado.
 */
export const leaderCreateMs = (r: number): number =>
  Math.min(45_000, 10_000 + 2000 * leaderTaps(r));

/** Aviso "O LÍDER É @fulano" no começo de cada rodada. */
export const LEADER_ANNOUNCE_MS = 1600;

/** Quantas rodadas por padrão: o maior entre 6 e o número de jogadores, até 12. */
export const defaultLeaderRounds = (players: number): number =>
  Math.min(LEADER_MAX_ROUNDS, Math.max(6, players));

/** As regras da rodada, sorteadas pela seed. Só devolve combinações possíveis (testado). */
export function leaderRules(seed: string, round: number): LeaderRule[] {
  const n = leaderTaps(round);
  const pads = leaderPads(round);
  const rules: LeaderRule[] = [{ kind: 'count', n }];
  const rng = createRng(`${seed}:leader:${round}`);
  const kinds = ['minColors', 'noRepeat', 'sameEnds', 'useAtLeast', 'avoid'] as const;
  const bag = [...kinds];
  let useAt: number | null = null;
  let avoidPad: number | null = null;
  for (let i = 0; i < leaderExtras(round); i++) {
    const kind = bag.splice(randInt(rng, 0, bag.length - 1), 1)[0]!;
    if (kind === 'minColors') {
      rules.push({ kind, k: randInt(rng, 3, Math.min(pads - 1, 5)) });
    } else if (kind === 'noRepeat' || kind === 'sameEnds') {
      rules.push({ kind });
    } else if (kind === 'useAtLeast') {
      useAt = randInt(rng, 0, pads - 1);
      rules.push({ kind, pad: useAt, times: 2 });
    } else {
      // Não pode proibir o botão que outra regra exige.
      let pad = randInt(rng, 0, pads - 1);
      if (pad === useAt) pad = (pad + 1) % pads;
      avoidPad = pad;
      rules.push({ kind, pad });
    }
  }
  // Não pode proibir o botão que outra regra exige (a ordem de sorteio varia).
  const use = rules.find((r) => r.kind === 'useAtLeast');
  const avoid = rules.find((r) => r.kind === 'avoid');
  if (
    use &&
    avoid &&
    use.kind === 'useAtLeast' &&
    avoid.kind === 'avoid' &&
    use.pad === avoid.pad
  ) {
    avoid.pad = (avoid.pad + 1) % pads;
    avoidPad = avoid.pad;
  }
  // Se proibiu um botão, "usar K cores" ainda precisa caber nos que sobram.
  if (avoidPad !== null) {
    for (const r of rules) if (r.kind === 'minColors') r.k = Math.min(r.k, pads - 1);
  }
  return rules;
}

/** A regra `rule` é cumprida por `seq`? (o total de toques é conferido em `count`). */
export function ruleHolds(rule: LeaderRule, seq: readonly number[]): boolean {
  switch (rule.kind) {
    case 'count':
      return seq.length === rule.n;
    case 'minColors':
      return new Set(seq).size >= rule.k;
    case 'noRepeat':
      return seq.every((p, i) => i === 0 || p !== seq[i - 1]);
    case 'sameEnds':
      return seq.length > 0 && seq[0] === seq[seq.length - 1];
    case 'useAtLeast':
      return seq.filter((p) => p === rule.pad).length >= rule.times;
    case 'avoid':
      return !seq.includes(rule.pad);
  }
}

/** Índice da primeira regra que falha, ou `null` se a sequência vale. */
export function firstBrokenRule(
  seq: readonly number[],
  rules: readonly LeaderRule[],
  pads: number,
): number | null {
  if (seq.some((p) => !Number.isInteger(p) || p < 0 || p >= pads)) return 0;
  const i = rules.findIndex((r) => !ruleHolds(r, seq));
  return i === -1 ? null : i;
}

/**
 * Uma sequência que cumpre todas as regras (busca determinística pela seed, com poda). Usada
 * quando o tempo do líder acaba, e pelos testes para provar que as regras sorteadas são possíveis.
 */
export function validLeaderSequence(seed: string, round: number): number[] {
  const rules = leaderRules(seed, round);
  const n = leaderTaps(round);
  const pads = leaderPads(round);
  const rng = createRng(seed + ':leader-fallback:' + round);
  const avoid = rules.find((r) => r.kind === 'avoid');
  const minColors = rules.find((r) => r.kind === 'minColors');
  const use = rules.find((r) => r.kind === 'useAtLeast');
  const noRepeat = rules.some((r) => r.kind === 'noRepeat');
  const sameEnds = rules.some((r) => r.kind === 'sameEnds');
  const allowed = Array.from({ length: pads }, (_, i) => i)
    .filter((p) => !(avoid && avoid.kind === 'avoid' && avoid.pad === p))
    .sort(() => rng() - 0.5);

  const seq: number[] = [];
  let nodes = 0;
  const go = (): boolean => {
    if (++nodes > 200_000) throw new Error('regras impossíveis');
    if (seq.length === n) return rules.every((r) => ruleHolds(r, seq));
    const left = n - seq.length;
    const seen = new Set(seq);
    // Quem ainda falta cumprir vai primeiro: cores novas e o botão exigido.
    const order = [...allowed].sort((x, y) => Number(seen.has(x)) - Number(seen.has(y)));
    for (const p of order) {
      if (noRepeat && seq[seq.length - 1] === p) continue;
      if (sameEnds && left === 1 && p !== seq[0]) continue;
      seq.push(p);
      const colorsLeft =
        minColors && minColors.kind === 'minColors' ? minColors.k - new Set(seq).size : 0;
      const useLeft =
        use && use.kind === 'useAtLeast' ? use.times - seq.filter((q) => q === use.pad).length : 0;
      const ok = colorsLeft <= left - 1 && useLeft <= left - 1;
      if (ok && go()) return true;
      seq.pop();
    }
    return false;
  };
  if (!go()) throw new Error('regras impossíveis');
  return seq;
}

/** Seguidor: 10 × toques certos seguidos / total (completar vale 10), 1 casa. */
export function followerScore(correct: number, n: number): number {
  return Math.round(((10 * Math.min(correct, n)) / n) * 10) / 10;
}

/** Líder: 0,7 × (10 − média dos seguidores), no máximo 7, 1 casa. Sem seguidores, 0. */
export function leaderScore(followerScores: readonly number[]): number {
  if (followerScores.length === 0) return 0;
  const avg = followerScores.reduce((a, b) => a + b, 0) / followerScores.length;
  return Math.round(Math.min(LEADER_MAX_POINTS, LEADER_COEFFICIENT * (10 - avg)) * 10) / 10;
}

const COLOR_NAMES = [
  'laranja',
  'azul',
  'amarelo',
  'verde',
  'rosa',
  'roxo',
  'ciano',
  'vermelho',
  'grafite',
];

/** A regra em português, para a lista do líder e para o aviso de erro. */
export function ruleLabel(rule: LeaderRule): string {
  switch (rule.kind) {
    case 'count':
      return `Faça exatamente ${rule.n} toques`;
    case 'minColors':
      return `Use pelo menos ${rule.k} cores diferentes`;
    case 'noRepeat':
      return 'Nunca repita a mesma cor em seguida';
    case 'sameEnds':
      return 'Comece e termine na mesma cor';
    case 'useAtLeast':
      return `Use o ${COLOR_NAMES[rule.pad]} pelo menos ${rule.times} vezes`;
    case 'avoid':
      return `Não use o ${COLOR_NAMES[rule.pad]}`;
  }
}

/** Quanto da regra já foi cumprido (para mostrar "2/4"); `null` nas regras de sim ou não. */
export function ruleProgress(
  rule: LeaderRule,
  seq: readonly number[],
): { done: number; total: number } | null {
  switch (rule.kind) {
    case 'count':
      return { done: seq.length, total: rule.n };
    case 'minColors':
      return { done: Math.min(new Set(seq).size, rule.k), total: rule.k };
    case 'useAtLeast':
      return { done: Math.min(seq.filter((p) => p === rule.pad).length, rule.times), total: rule.times };
    default:
      return null;
  }
}
