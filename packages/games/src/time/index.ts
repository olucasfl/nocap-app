import { z } from 'zod';
import { createRng, randInt } from '../core/rng';
import { SURVIVAL_MAX_ROUNDS } from '../core/survival';
import type { GameDefinition } from '../core/types';

export const timeSettingsSchema = z.object({
  rounds: z.number().int().min(1).max(30),
  /** Faixa do alvo, em ms (múltiplos de 100). Médios 5–15 s; curtos 1–5 s; longos 15–30 s. */
  minMs: z.number().int().min(1000).max(30_000),
  maxMs: z.number().int().min(1000).max(30_000),
  /** "Sem estourar": passou do alvo, a rodada vale zero. */
  noOvershoot: z.boolean(),
  /**
   * Como os alvos se distribuem: `uniform` (qualquer valor da faixa), `alternate` (curto, longo,
   * curto...) ou `mostly-low` (quase sempre curto, de vez em quando longo).
   */
  mix: z.enum(['uniform', 'alternate', 'mostly-low']),
  /** Sobrevivência: 3 vidas, nota mínima crescente; `rounds` é só o limite. */
  survival: z.boolean().optional(),
  /**
   * Alvos "quebrados" (2,89 s, 5,78 s: passo de 10 ms) e rodadas de uma mesma partida afastadas
   * entre si. Sem isto vale o jeito antigo (passo de 100 ms), que as partidas antigas usam.
   */
  fine: z.boolean().optional(),
});
export type TimeSettings = z.infer<typeof timeSettingsSchema>;

/** Alvos curtos (abaixo de 10 s) e longos (acima de 10 s) dos modos com `mix`. */
export const SHORT_TARGET_MS = { min: 1000, max: 9900 } as const;
export const LONG_TARGET_MS = { min: 10_100, max: 18_000 } as const;
/** No `mostly-low`, a chance de uma rodada sair longa (cerca de 1 em 7). */
export const LONG_CHANCE = 0.15;

/**
 * Dentro de cada faixa os alvos não são uniformes: `u^k` empurra o sorteio para o começo da faixa,
 * então saem mais tempos baixos (curtos: mediana ~3,8 s, média ~4,3 s; longos: média ~15 s).
 */
const SHORT_SKEW = 1.7;
const LONG_SKEW = 1.4;

/** O alvo da rodada, em ms. Sempre regenerado pela seed (não é guardado no banco). */
export type TimeRound = number;
/** A resposta é a duração medida no aparelho, em ms. */
export type TimeAnswer = number;

export const timePresets: Record<string, TimeSettings> = {
  /** 3 rodadas, curto-longo-curto: prioriza alvos abaixo de 10 s sem deixar de variar. */
  classic: {
    rounds: 3,
    minMs: 1000,
    maxMs: 18_000,
    noOvershoot: false,
    mix: 'alternate',
    fine: true,
  },
  /** Jogo rápido: 1 rodada, quase sempre curta. Ranking próprio. */
  quick: {
    rounds: 1,
    minMs: 1000,
    maxMs: 18_000,
    noOvershoot: false,
    mix: 'mostly-low',
    fine: true,
  },
  /** Sem estourar: passou do alvo vale zero. Mesma cadência do clássico. */
  strict: {
    rounds: 3,
    minMs: 1000,
    maxMs: 18_000,
    noOvershoot: true,
    mix: 'alternate',
    fine: true,
  },
  /** Sequência: 5 alvos curtos (2 a 6 s) um atrás do outro, sem pausa. */
  sequence: { rounds: 5, minMs: 2000, maxMs: 6000, noOvershoot: false, mix: 'uniform', fine: true },
  /** Sobrevivência: joga até perder as 3 vidas; alvos quase sempre curtos. */
  survival: {
    rounds: SURVIVAL_MAX_ROUNDS.time,
    minMs: 1000,
    maxMs: 18_000,
    noOvershoot: false,
    mix: 'mostly-low',
    fine: true,
    survival: true,
  },
};

/**
 * Presets de antes (5 rodadas, alvos uniformes de 5 a 15 s). Só servem para o histórico mostrar
 * certo as partidas antigas, que o servidor guardou com 5 respostas.
 */
export const legacyTimePresets: Record<string, TimeSettings> = {
  classic: { rounds: 5, minMs: 5000, maxMs: 15_000, noOvershoot: false, mix: 'uniform' },
  quick: { rounds: 1, minMs: 5000, maxMs: 15_000, noOvershoot: false, mix: 'uniform' },
  strict: { rounds: 5, minMs: 5000, maxMs: 15_000, noOvershoot: true, mix: 'uniform' },
};

/** O preset com que uma partida foi jogada, pelo número de respostas guardadas. */
export function presetFor(mode: string, answerCount: number): TimeSettings | undefined {
  const current = timePresets[mode];
  // Sobrevivência tem número variável de rodadas: vale sempre o preset atual.
  if (current?.survival) return current;
  if (current && current.rounds === answerCount) return current;
  const legacy = legacyTimePresets[mode];
  return legacy && legacy.rounds === answerCount ? legacy : current;
}

/** Muda sempre que a curva muda; guardada em `matches.settings` para nunca misturar curvas. */
export const TIME_SCORE_VERSION = 1;

/**
 * Curva da nota do Tempo (PROPOSTA, brief #4: ajustar jogando). Erro relativo `e` = |resposta − alvo| / alvo:
 * `10 / (1 + (e / 0.15)^1.6)`, em [0, 10], 1 casa. Mesma filosofia da Cor: topo largo e cauda
 * longa (errar 20% ainda rende ~4).
 *
 * | erro | 1% | 3% | 5% | 10% | 20% | 40% | 80% |
 * | nota | 9,9| 9,3| 8,5| 6,6 | 3,9 | 1,7 | 0,6 |
 */
export function scoreFromError(e: number): number {
  const raw = 10 / (1 + (Math.max(0, e) / 0.15) ** 1.6);
  return Math.max(0, Math.min(10, Math.round(raw * 10) / 10));
}

/** Erro relativo ao alvo (ex.: 0,05 = 5%). */
export function relativeError(target: number, answer: number): number {
  return Math.abs(answer - target) / target;
}

/** Mínimo de diferença entre os alvos de uma mesma partida (modo `fine`). */
const MIN_GAP_MS = 400;

/** Um sorteio de alvo, no passo do modo (10 ms nos modos novos, 100 ms nos antigos). */
function pickTarget(rng: () => number, settings: TimeSettings, index: number): TimeRound {
  const step = settings.fine ? 10 : 100;
  const mix = settings.mix ?? 'uniform';
  if (mix !== 'uniform') {
    const long = mix === 'alternate' ? index % 2 === 1 : rng() < LONG_CHANCE;
    const band = long ? LONG_TARGET_MS : SHORT_TARGET_MS;
    const steps = (band.max - band.min) / step + 1;
    const pick = Math.min(steps - 1, Math.floor(steps * rng() ** (long ? LONG_SKEW : SHORT_SKEW)));
    return band.min + pick * step;
  }
  const lo = Math.ceil(settings.minMs / step);
  const hi = Math.max(lo, Math.floor(settings.maxMs / step));
  return randInt(rng, lo, hi) * step;
}

/**
 * O alvo da rodada `index`. Nos modos `fine` os alvos têm centésimos (2,89 s) e nenhuma rodada
 * repete (ou fica a menos de 0,4 s de) um alvo anterior da mesma partida, então a Sequência não
 * vira "3,5, 4,5, 3,5". Determinístico pela seed (servidor e app calculam igual).
 */
export function generateTimeRound(seed: string, settings: TimeSettings, index: number): TimeRound {
  if (!settings.fine) return pickTarget(createRng(`${seed}:${index}`), settings, index);
  const previous: number[] = [];
  let value = 0;
  for (let i = 0; i <= index; i++) {
    const rng = createRng(`${seed}:${i}`);
    value = pickTarget(rng, settings, i);
    const clash = (v: number) => previous.some((p) => Math.abs(p - v) < MIN_GAP_MS);
    for (let tries = 0; tries < 12 && clash(value); tries++) value = pickTarget(rng, settings, i);
    if (clash(value)) value = farthestFree(rng, settings, value, previous);
    previous.push(value);
  }
  return value;
}

/**
 * Plano B quando os sorteios caem perto de alvos já usados (faixa estreita, como a Sequência):
 * sorteia entre TODOS os valores da faixa que respeitam o espaço mínimo; se não sobrar nenhum,
 * fica o que mais se afasta dos outros.
 */
function farthestFree(
  rng: () => number,
  settings: TimeSettings,
  near: number,
  previous: number[],
): number {
  const step = 10;
  const band =
    settings.mix === 'uniform'
      ? { min: settings.minMs, max: settings.maxMs }
      : near > SHORT_TARGET_MS.max
        ? LONG_TARGET_MS
        : SHORT_TARGET_MS;
  const gap = (v: number) => Math.min(...previous.map((p) => Math.abs(p - v)));
  const all: number[] = [];
  for (let v = band.min; v <= band.max; v += step) all.push(v);
  const free = all.filter((v) => gap(v) >= MIN_GAP_MS);
  if (free.length > 0) return free[Math.floor(rng() * free.length)]!;
  return all.reduce((best, v) => (gap(v) > gap(best) ? v : best), near);
}

export function scoreTime(target: TimeRound, answer: TimeAnswer, settings: TimeSettings): number {
  if (settings.noOvershoot && answer > target) return 0;
  return scoreFromError(relativeError(target, answer));
}

/**
 * Respostas plausíveis para uma rodada: nem um toque duplo (< 200 ms) nem uma contagem absurda
 * (mais de 3× o alvo). O servidor recusa o que ficar fora disto (brief #6).
 */
export function isPlausibleAnswer(target: TimeRound, answer: TimeAnswer): boolean {
  return Number.isInteger(answer) && answer >= 200 && answer <= target * 3;
}

export const timeGame: GameDefinition<TimeSettings, TimeRound, TimeAnswer> = {
  id: 'time',
  meta: { minPlayers: 1, maxPlayers: 12, solo: true, daily: true, ranking: 'score' },
  settingsSchema: timeSettingsSchema,
  presets: timePresets,
  generateRound: generateTimeRound,
  score: scoreTime,
};
