// Marco da vida (spec 040, seção 2): o terceiro requisito do colapso. Gira entre 6 tipos conforme o
// número do colapso e cresce com ele. Funções puras: o motor lê os contadores da vida (`RunState`) e a
// tela mostra a mesma barra.

import { GENERATOR_MAX, UPGRADES } from './catalog';
import { mechanicOpen } from './content';

export type MilestoneKind = 'capture' | 'combo' | 'generators' | 'missions' | 'rares' | 'comboFull';

/** Ordem do ciclo: o marco do colapso `n` é o de índice `n mod 6` (o 6º volta ao primeiro). */
export const MILESTONE_ORDER: readonly MilestoneKind[] = ['capture', 'combo', 'generators', 'missions', 'rares', 'comboFull'];

/** Teto da sequência de combo (toques seguidos dentro da janela) e do tempo de combo cheio, para a meta seguir humana. */
export const COMBO_CHAIN_CAP = 30;
export const COMBO_FULL_CAP_SEC = 180;
/** Depois de uma missão cumprida, a próxima da estação chega depois desta pausa (a barra "cumprida" fica visível). */
export const MISSION_NEXT_DELAY_SEC = 5;

/** Contadores da vida que os marcos leem (todos zerados no colapso). */
export interface MilestoneCounters {
  captured: number;
  rares: number;
  /** Maior sequência de toques seguidos com o combo ligado (cada toque dentro da janela do anterior). */
  chainBest: number;
  /** Maior tempo seguido, em segundos, com o combo no máximo. */
  fullBest: number;
  missionsDone: number;
  upgradeLevels: readonly number[];
}

export interface MilestoneGoal {
  kind: MilestoneKind;
  /** Quantidade pedida: objetos, toques seguidos, geradores, missões, raros ou segundos. */
  target: number;
  /** Só em `generators`: nível que cada gerador precisa ter. */
  level: number;
}

/** Índices dos geradores (poeira e energia) na lista de melhorias. */
const GENERATOR_INDEXES = UPGRADES.map((u, i) => (u.kind === 'generator' || u.kind === 'energy' ? i : -1)).filter((i) => i >= 0);

/** Quantos geradores existem hoje: o marco `generators` nunca pede mais que isto. */
export const GENERATOR_COUNT = GENERATOR_INDEXES.length;

/**
 * O marco só vale se o conteúdo que ele exige já existe nesta altura do jogo; senão é pulado. Com os objetos
 * desligados por um grimório proibido (Cygnus X-1), os marcos que dependem deles também são pulados: sem isso a
 * vida ficaria impossível de colapsar.
 */
export function milestoneAvailable(kind: MilestoneKind, collapses: number, objectsDisabled = false): boolean {
  if (objectsDisabled && (kind === 'capture' || kind === 'rares' || kind === 'missions')) return false;
  if (kind === 'missions') return mechanicOpen('missions', collapses);
  return true;
}

/** Tipo do marco do colapso `n` (1 = primeiro), pulando para o próximo do ciclo os que ainda não existem. */
export function milestoneKind(n: number, collapses = n - 1, objectsDisabled = false): MilestoneKind {
  const k = Math.max(1, Math.floor(n));
  for (let i = 0; i < MILESTONE_ORDER.length; i++) {
    const kind = MILESTONE_ORDER[(k + i) % MILESTONE_ORDER.length] as MilestoneKind;
    if (milestoneAvailable(kind, collapses, objectsDisabled)) return kind;
  }
  return 'capture';
}

/**
 * Meta de cada tipo no colapso `n`:
 * objetos `ceil(2 + n/2)`; combo `min(5 + n/3, teto)` toques seguidos; geradores `k` no nível `f(n)`
 * (a tabela de `generatorGoal`); missões `ceil(n/4)`; raros `ceil(n/5)`; combo cheio `min(20 + n, teto)` s.
 */
export function milestoneGoal(kind: MilestoneKind, n: number): MilestoneGoal {
  const k = Math.max(1, Math.floor(n));
  switch (kind) {
    case 'capture':
      return { kind, target: Math.ceil(2 + k / 2), level: 0 };
    case 'combo':
      return { kind, target: Math.min(COMBO_CHAIN_CAP, 5 + Math.floor(k / 3)), level: 0 };
    case 'generators': {
      const g = generatorGoal(k);
      return { kind, target: g.count, level: g.level };
    }
    case 'missions':
      return { kind, target: Math.ceil(k / 4), level: 0 };
    case 'rares':
      return { kind, target: Math.ceil(k / 5), level: 0 };
    case 'comboFull':
      return { kind, target: Math.min(COMBO_FULL_CAP_SEC, 20 + k), level: 0 };
  }
}

/**
 * `k` geradores no nível `f(n)` ou acima. Desde a spec 041 cada gerador vai até 8 a 12 níveis e a prateleira mostra um por
 * vez: o marco começa em 1 gerador no nível 4 e sobe, até 3 geradores no nível 8 (os primeiros completos).
 */
export const GENERATOR_GOAL_LEVEL_CAP = 8;
export const GENERATOR_GOAL_COUNT_CAP = 3;
export function generatorGoal(n: number): { count: number; level: number } {
  const k = Math.max(1, Math.floor(n));
  return {
    count: Math.min(GENERATOR_COUNT, GENERATOR_GOAL_COUNT_CAP, 1 + Math.floor(k / 10)),
    level: Math.min(GENERATOR_MAX, GENERATOR_GOAL_LEVEL_CAP, 3 + Math.ceil(k / 3)),
  };
}

/** Quantos geradores têm pelo menos `level`. */
export function generatorsAtLevel(upgradeLevels: readonly number[], level: number): number {
  let n = 0;
  for (const i of GENERATOR_INDEXES) if ((upgradeLevels[i] ?? 0) >= level) n++;
  return n;
}

export interface MilestoneProgress {
  kind: MilestoneKind;
  value: number;
  target: number;
  level: number;
  done: boolean;
  /** 0 a 1. */
  fill: number;
}

/** Quanto do marco do colapso `n` a vida já cumpriu. */
export function milestoneProgress(n: number, collapses: number, c: MilestoneCounters, objectsDisabled = false): MilestoneProgress {
  const goal = milestoneGoal(milestoneKind(n, collapses, objectsDisabled), n);
  const raw =
    goal.kind === 'capture'
      ? c.captured
      : goal.kind === 'combo'
        ? c.chainBest
        : goal.kind === 'generators'
          ? generatorsAtLevel(c.upgradeLevels, goal.level)
          : goal.kind === 'missions'
            ? c.missionsDone
            : goal.kind === 'rares'
              ? c.rares
              : c.fullBest;
  const value = Math.min(goal.target, Math.floor(raw));
  return {
    kind: goal.kind,
    value: Math.max(0, value),
    target: goal.target,
    level: goal.level,
    done: raw >= goal.target,
    fill: goal.target > 0 ? Math.min(1, Math.max(0, raw / goal.target)) : 1,
  };
}

/**
 * Contadores que cumprem exatamente o marco do colapso `collapses + 1`: para testes e ferramentas que
 * montam uma vida "pronta" sem jogar. Devolve só os campos que mudam (os níveis dos geradores vêm inteiros).
 */
export function meetMilestone(
  collapses: number,
  upgradeLevels: readonly number[],
  objectsDisabled = false,
): Partial<Omit<MilestoneCounters, 'upgradeLevels'>> & { upgradeLevels?: number[] } {
  const n = collapses + 1;
  const goal = milestoneGoal(milestoneKind(n, collapses, objectsDisabled), n);
  switch (goal.kind) {
    case 'capture':
      return { captured: goal.target };
    case 'combo':
      return { chainBest: goal.target };
    case 'generators': {
      const levels = upgradeLevels.slice();
      let left = goal.target;
      for (const i of GENERATOR_INDEXES) {
        if (left === 0) break;
        levels[i] = Math.max(levels[i] ?? 0, goal.level);
        left--;
      }
      return { upgradeLevels: levels };
    }
    case 'missions':
      return { missionsDone: goal.target };
    case 'rares':
      return { captured: goal.target, rares: goal.target };
    case 'comboFull':
      return { fullBest: goal.target };
  }
}
