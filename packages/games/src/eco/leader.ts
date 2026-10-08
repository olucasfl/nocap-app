import { createRng, randInt } from '../core/rng';

/**
 * Siga o Líder (spec 012): em cada rodada um jogador cria a sequência dentro de regras que o jogo
 * impõe, e os outros repetem. Lógica pura: o servidor valida o envio e calcula as notas.
 */

export const LEADER_MIN_ROUNDS = 2;
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

export interface LeaderSpec {
  taps: number;
  pads: number;
  /** A primeira regra é sempre o total de toques; as outras são as regras extras. */
  rules: LeaderRule[];
}

type Profile = 'rules' | 'long' | 'tiny' | 'medium';
const PROFILES: Profile[] = ['rules', 'long', 'tiny', 'medium'];

/** Botões: 4 nas três primeiras rodadas e mais um a cada 3 rodadas, até 9. */
const padsFor = (round: number): number => Math.min(9, 4 + Math.floor((round - 1) / 3));

/** O "tipo" da rodada a partir da 4ª: nunca o mesmo duas vezes seguidas (dá diversidade). */
function profileFor(seed: string, round: number): Profile {
  let prev: Profile | null = null;
  let current: Profile = 'rules';
  for (let i = 4; i <= round; i++) {
    const rng = createRng(`${seed}:leader-profile:${i}`);
    const options = PROFILES.filter((x) => x !== prev);
    current = options[Math.floor(rng() * options.length)]!;
    prev = current;
  }
  return current;
}

/**
 * Tamanho e regras da rodada. As três primeiras são fixas e crescem devagar: 3 toques sem regra,
 * 4 com uma regra, 5 com duas. Depois vem variedade que vai ficando mais difícil: curta com várias
 * regras, longa sem regra nenhuma, minúscula com regras, média com poucas.
 */
function shapeFor(seed: string, round: number): { taps: number; pads: number; extras: number } {
  const pads = padsFor(round);
  if (round === 1) return { taps: 3, pads, extras: 0 };
  if (round === 2) return { taps: 4, pads, extras: 1 };
  if (round === 3) return { taps: 5, pads, extras: 2 };
  const lv = round - 3;
  switch (profileFor(seed, round)) {
    case 'rules':
      return {
        taps: Math.min(8, 4 + Math.floor(lv / 3)),
        pads,
        extras: Math.min(3, 2 + Math.floor(lv / 4)),
      };
    case 'long':
      return { taps: Math.min(12, 6 + Math.floor(lv / 2)), pads, extras: 0 };
    case 'tiny':
      return {
        taps: Math.min(5, 3 + Math.floor(lv / 5)),
        pads,
        extras: Math.min(3, 2 + Math.floor(lv / 3)),
      };
    default:
      return {
        taps: Math.min(9, 5 + Math.floor(lv / 3)),
        pads,
        extras: Math.min(2, 1 + Math.floor(lv / 4)),
      };
  }
}

const specCache = new Map<string, LeaderSpec>();

/** Tudo da rodada `round` (1, 2, 3...), sorteado pela seed. Só devolve combinações possíveis (testado). */
export function leaderSpec(seed: string, round: number): LeaderSpec {
  const key = `${seed}|${round}`;
  const cached = specCache.get(key);
  if (cached) return cached;
  const { taps, pads, extras } = shapeFor(seed, round);
  const rng = createRng(`${seed}:leader:${round}`);
  const bag = ['minColors', 'noRepeat', 'sameEnds', 'useAtLeast', 'avoid'] as const;
  const pool = [...bag].sort(() => rng() - 0.5).slice(0, extras);
  const has = (k: (typeof bag)[number]) => pool.includes(k);
  const rules: LeaderRule[] = [{ kind: 'count', n: taps }];

  // As regras precisam caber juntas: "usar K cores" respeita o que sobra depois de proibir um
  // botão e depois de exigir repetição (usar um botão 2 vezes ou começar e terminar igual).
  let usePad: number | null = null;
  if (has('useAtLeast')) usePad = randInt(rng, 0, pads - 1);
  for (const kind of pool) {
    if (kind === 'minColors') {
      const maxK = Math.min(
        5,
        pads - (has('avoid') ? 1 : 0),
        taps - (has('useAtLeast') || has('sameEnds') ? 1 : 0),
      );
      rules.push({ kind, k: randInt(rng, 2, Math.max(2, maxK)) });
    } else if (kind === 'noRepeat' || kind === 'sameEnds') {
      rules.push({ kind });
    } else if (kind === 'useAtLeast') {
      rules.push({ kind, pad: usePad!, times: 2 });
    } else {
      // Nunca proibir o botão que outra regra exige.
      let pad = randInt(rng, 0, pads - 1);
      if (pad === usePad) pad = (pad + 1) % pads;
      rules.push({ kind, pad });
    }
  }
  const spec = { taps, pads, rules };
  specCache.set(key, spec);
  return spec;
}

export const leaderTaps = (seed: string, round: number): number => leaderSpec(seed, round).taps;
export const leaderPads = (seed: string, round: number): number => leaderSpec(seed, round).pads;
export const leaderRules = (seed: string, round: number): LeaderRule[] =>
  leaderSpec(seed, round).rules;

/**
 * Tempo do líder para criar: 10 s + 2 s por toque + 3 s por regra extra, no máximo 45 s. Curto de
 * propósito: a rodada anda e ninguém fica esperando parado.
 */
export const leaderCreateMs = (taps: number, extraRules = 0): number =>
  Math.min(45_000, 10_000 + 2000 * taps + 3000 * extraRules);

/** Aviso "O LÍDER É @fulano" no começo de cada rodada. */
export const LEADER_ANNOUNCE_MS = 1600;

/** Quantas rodadas por padrão: o maior entre 6 e o número de jogadores, até 12. */
export const defaultLeaderRounds = (players: number): number =>
  Math.min(LEADER_MAX_ROUNDS, Math.max(6, players));

/**
 * Rodadas que fazem cada pessoa criar o mesmo número de vezes: múltiplos do número de jogadores,
 * até 12. Assim ninguém lidera mais que os outros.
 */
export function fairLeaderRounds(players: number): number[] {
  const p = Math.max(2, players);
  const out: number[] = [];
  for (let r = p; r <= LEADER_MAX_ROUNDS; r += p) out.push(r);
  return out.length > 0 ? out : [LEADER_MAX_ROUNDS];
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
  const { rules, taps: n, pads } = leaderSpec(seed, round);
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
      return {
        done: Math.min(seq.filter((p) => p === rule.pad).length, rule.times),
        total: rule.times,
      };
    default:
      return null;
  }
}
