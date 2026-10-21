// Economia do Aperta! (spec 038, seções 6 e 8): custos, passos de energia e metas por colapso.
// Os números moram aqui (dados) para o simulador ajustar sem mexer no motor.

import { RARITY_UNLOCK_PICKS, SET_BONUS_THRESHOLDS, type Rarity, type UpgradeDef } from './catalog';

/** O motor trava qualquer número aqui (seção 7.5): evita Infinity e NaN em vidas longas. */
export const MAX_NUMBER = 1e300;

export const COST_GROWTH = 1.65;
/** Descontos de custo são multiplicativos, mas nunca passam de 60% (piso de 40% do custo). */
export const COST_FLOOR = 0.4;

/** Energia base por toque; o Reator soma `REACTOR_STEP` por nível. */
export const BASE_ENERGY_PER_TOUCH = 0.25;
export const REACTOR_STEP = 0.125;

/** Passos de energia das seis primeiras escolhas; depois cresce `ENERGY_STEP_GROWTH` a cada escolha. */
export const ENERGY_STEPS = [60, 90, 130, 180, 240, 320] as const;
export const ENERGY_STEP_GROWTH = 1.35;

/** Grimório repetido: +50% do efeito por nível, até o nível 10. */
export const GRIMOIRE_MAX_LEVEL = 10;
export const GRIMOIRE_LEVEL_STEP = 0.5;
/** Uma página do Atlas guarda 60% do poder do grimório. */
export const ATLAS_PAGE_POWER = 0.6;

export const ATLAS_BASE_SLOTS = 3;
export const ATLAS_SLOT_COLLAPSES = [5, 10, 25, 50] as const;

export const COMBO_BONUS_PER_POINT = 0.2;
export const COMBO_BASE_MAX = 3;
export const COMBO_BASE_WINDOW_SEC = 1.3;
export const COMBO_WINDOW_PER_LEVEL_SEC = 0.2;
/** Teto duro de combo, para um empilhamento de grimórios não virar x(infinito). */
export const COMBO_HARD_CAP = 12;

export const OBJECT_BASE_INTERVAL_SEC = 9;
export const OBJECT_BASE_MAX = 2;
export const KEPLER_SPAWN_PER_LEVEL = 0.1;
export const HUBBLE_VALUE_PER_LEVEL_PCT = 10;
export const CHANDRA_LIFE_PER_LEVEL_PCT = 5;
export const WEBB_COST_PER_LEVEL_PCT = -2;
export const VOYAGER_SEC_PER_LEVEL = 1;

/** Eventos (spec 038, 5.4): um a cada ~8 min de jogo (sorteio de ±25%), 15 s cada. */
export const EVENT_INTERVAL_SEC = 480;
export const EVENT_JITTER = 0.25;
export const EVENT_DURATION_SEC = 15;
/** Chuva de meteoros: uma estrela cadente por segundo, com folga no campo para todas caberem. */
export const METEOR_SHOWER_INTERVAL_SEC = 1;
export const METEOR_SHOWER_EXTRA_MAX = 6;
export const SOLAR_STORM_ENERGY_MULT = 2;
/** Favorito pesa o dobro no sorteio da carta dentro da raridade. */
export const FAVORITE_WEIGHT = 2;
/** Fragmentos extras por missão da estação cumprida na vida. */
export const MISSION_FRAGMENTS = 2;

/** Tempo que as cartas ficam bloqueadas depois que a escolha abre (seção 4.7). */
export const CHOICE_LOCK_SEC = 1.6;
/** No máximo 12 toques por segundo no total, por segurança (seção 4.1). */
export const MAX_TOUCHES_PER_SEC = 12;
/** Intervalo maior que isto entre duas chamadas conta como jogo parado (aba escondida): o tempo congela. */
export const MAX_STEP_SEC = 5;

/** Poeira inicial do Pulso Solar etc: custo do nível `level` (arredondado) com o fator de desconto aplicado. */
export function upgradeCost(def: UpgradeDef, level: number, costFactor = 1): number {
  const raw = def.base * Math.pow(COST_GROWTH, Math.max(0, level)) * clampCostFactor(costFactor);
  return Math.min(MAX_NUMBER, Math.max(1, Math.round(raw)));
}

/** Aplica o piso de 40% ao fator multiplicativo de custo. */
export function clampCostFactor(factor: number): number {
  if (!Number.isFinite(factor)) return 1;
  return Math.max(COST_FLOOR, factor);
}

/** Energia necessária para a escolha número `picks` (0 = a primeira). */
export function energyCap(picks: number, stepFactor = 1): number {
  const n = Math.max(0, Math.floor(picks));
  const base =
    n < ENERGY_STEPS.length
      ? (ENERGY_STEPS[n] as number)
      : (ENERGY_STEPS[ENERGY_STEPS.length - 1] as number) *
        Math.pow(ENERGY_STEP_GROWTH, n - (ENERGY_STEPS.length - 1));
  const value = base * (Number.isFinite(stepFactor) && stepFactor > 0 ? stepFactor : 1);
  return Math.min(MAX_NUMBER, value);
}

/** Multiplicador de efeito de um grimório de nível `level` (1 = x1; cada nível extra soma 50%). */
export function levelFactor(level: number): number {
  const l = Math.min(GRIMOIRE_MAX_LEVEL, Math.max(1, Math.floor(level)));
  return 1 + GRIMOIRE_LEVEL_STEP * (l - 1);
}

/**
 * Escolhas que liberam cada raridade nesta vida. Como cada vida zera as escolhas, os limiares caem
 * para 60% depois do 1º colapso e 40% depois do 5º (seção 6.6).
 */
export function rarityUnlockPicks(rarity: Rarity, collapses: number, forbiddenOverride?: number): number {
  const base = rarity === 'forbidden' && forbiddenOverride !== undefined ? forbiddenOverride : RARITY_UNLOCK_PICKS[rarity];
  if (base <= 0) return 0;
  const scale = collapses >= 5 ? 0.4 : collapses >= 1 ? 0.6 : 1;
  return Math.max(1, Math.ceil(base * scale));
}

// --- Metas de colapso (seção 6.6) ---
// Índice 0 = 1º colapso. `DUST_GOAL` é a variável que o simulador calibra.

/** Duração-alvo de cada vida, em horas de jogo aberto (perfil normal, 2,5 toques/s). */
export const TARGET_HOURS = [8, 5, 3.5, 3, 2.6, 2.3, 2.1, 1.9, 1.75, 1.6, 1.5, 1.4, 1.3, 1.25, 1.2] as const;

/** Poeira acumulada na vida necessária para a estrela ficar pronta (calibrada pelo simulador). */
export const DUST_GOAL: number[] = [
  // Vidas 1 a 5 (v1): calibradas pelo simulador, perfil normal, média de 3 sementes (spec 038, 6.6).
  5.36e6, 5.87e6, 6.15e6, 11.2e6, 8.06e6,
  // Vidas 6 a 15: provisórias, sem calibrar (o conteúdo desses colapsos chega nas etapas 14 e 15).
  5.5e6, 5.7e6, 5.9e6, 6.1e6, 6.3e6, 6.5e6, 6.7e6, 6.9e6, 7.1e6, 7.3e6,
];

/** Escolhas mínimas: 20 no 1º colapso, 15 do 2º ao 5º e 12 a partir do 6º. */
export const MIN_PICKS = [20, 15, 15, 15, 15, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12] as const;

/** Meta de poeira da vida que termina no colapso `nextCollapse` (1 = primeiro). Passando de 15, segue x3 por colapso. */
export function dustGoal(nextCollapse: number): number {
  const k = Math.max(1, Math.floor(nextCollapse));
  if (k <= DUST_GOAL.length) return DUST_GOAL[k - 1] as number;
  const last = DUST_GOAL[DUST_GOAL.length - 1] as number;
  return Math.min(MAX_NUMBER, last * Math.pow(3, k - DUST_GOAL.length));
}

export function minPicks(nextCollapse: number): number {
  const k = Math.max(1, Math.floor(nextCollapse));
  return MIN_PICKS[Math.min(k, MIN_PICKS.length) - 1] as number;
}

export function targetHours(nextCollapse: number): number {
  const k = Math.max(1, Math.floor(nextCollapse));
  return TARGET_HOURS[Math.min(k, TARGET_HOURS.length) - 1] as number;
}

/** Fragmentos do colapso `collapseNumber` (1 = primeiro): `3 + nº` mais 1 por década acima de 2 mi de poeira. */
export function fragmentsFor(collapseNumber: number, dustLife: number): number {
  const base = 3 + Math.max(1, Math.floor(collapseNumber));
  const ratio = dustLife / 2e6;
  const bonus = Number.isFinite(ratio) && ratio >= 10 ? Math.floor(Math.log10(ratio)) : 0;
  return base + bonus;
}

/** Espaços do Atlas depois de `collapses` colapsos: 3 mais 1 em cada marco 5, 10, 25 e 50. */
export function atlasSlots(collapses: number): number {
  return ATLAS_BASE_SLOTS + ATLAS_SLOT_COLLAPSES.filter((c) => collapses >= c).length;
}

/** Nível do bônus de conjunto (0, 1 ou 2) para `count` páginas da família, ou -1 sem bônus. */
export function setBonusTier(count: number): number {
  let tier = -1;
  SET_BONUS_THRESHOLDS.forEach((t, i) => {
    if (count >= t) tier = i;
  });
  return tier;
}

/** Fragmentos devolvidos ao refazer a árvore: tudo menos 20% (taxa arredondada para cima, mínimo 1 se houve gasto). */
export function respecFee(spent: number): number {
  if (spent <= 0) return 0;
  return Math.max(1, Math.ceil(spent * 0.2));
}
