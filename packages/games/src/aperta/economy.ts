// Economia do Aperta! (spec 038, seções 6 e 8): custos, passos de energia e metas por colapso.
// Os números moram aqui (dados) para o simulador ajustar sem mexer no motor.

import { GRIMOIRE_RARITIES, RARITY_LEVEL_CAP, RARITY_STEP, RARITY_UNLOCK_PICKS, type GrimoireRarity, type Rarity, type UpgradeDef } from './catalog';

/** O motor trava qualquer número aqui (seção 7.5): evita Infinity e NaN em vidas longas. */
export const MAX_NUMBER = 1e300;

/** Descontos de custo são multiplicativos, mas nunca passam de 60% (piso de 40% do custo). */
export const COST_FLOOR = 0.4;

/** Energia base por toque; o Reator soma `REACTOR_STEP` por nível. */
export const BASE_ENERGY_PER_TOUCH = 1;
export const REACTOR_STEP = 0.25;

/**
 * Passos de energia das seis primeiras escolhas; depois cresce `ENERGY_STEP_GROWTH` a cada escolha.
 * O 1º passo fecha com ~50 de poeira ganha: 25 toques, a 1ª melhoria (25 de poeira) e mais ~13 toques
 * de 2 poeira. As barras seguintes caem no começo (spec 038, 6.2). O crescimento depois da 6ª escolha era x1,35; a spec 040
 * pede 20 escolhas no 1º colapso dentro de 3 h e, com x1,35, o simulador levava ~6,7 h: x1,22 leva ~2,1 h.
 */
/** Spec 041 (B4): metade da dificuldade de antes (38, 80, 150...), para o grimório vir mais fácil. */
export const ENERGY_STEPS = [19, 40, 75, 130, 210, 320] as const;
export const ENERGY_STEP_GROWTH = 1.3;
/** A partir da 7ª escolha a barra pesa cada vez mais (até 10x): os itens de energia e os geradores enchem rápido, e o jogo quer uma escolha a cada poucos minutos. */
const ENERGY_STEP_LATE = 10;
const ENERGY_RAMP = 1.35;

/** Grimório repetido: cada nível soma metade do número base (+0,5 vira +0,75, +1...), até o nível 10. */
export const GRIMOIRE_MAX_LEVEL = 10;
export const GRIMOIRE_LEVEL_STEP = 1;
export const COMBO_BONUS_PER_POINT = 0.2;
/** Cada nível da Ressonância depois do 1º soma isto ao valor de cada ponto de combo. */
export const RESONANCE_POINT_PER_LEVEL = 0.05;
export const COMBO_BASE_MAX = 3;
export const COMBO_BASE_WINDOW_SEC = 1.3;
/** Teto duro de combo, para um empilhamento de grimórios não virar x(infinito). */
export const COMBO_HARD_CAP = 12;

/** Objetos no espaço (spec 038, 4.5): raros no começo, a Kepler os traz mais cedo. */
export const OBJECT_BASE_INTERVAL_SEC = 32;
export const OBJECT_MIN_INTERVAL_SEC = 4;
export const OBJECT_BASE_MAX = 1;
export const KEPLER_INTERVAL_PER_LEVEL_SEC = 3;
export const CHANDRA_LIFE_PER_LEVEL_SEC = 0.5;
export const VOYAGER_SEC_PER_LEVEL = 1;
/** Poder das melhorias de poeira: Hubble (por segundo) e Webb (por toque). */
export const HUBBLE_DUST_PER_SEC_PER_LEVEL = 1;
export const WEBB_DUST_PER_LEVEL = 5;

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

/** Tempo que as cartas ficam bloqueadas depois que a escolha abre (seção 4.7). */
export const CHOICE_LOCK_SEC = 1.6;
/** No máximo 12 toques por segundo no total, por segurança (seção 4.1). */
export const MAX_TOUCHES_PER_SEC = 12;
/** Intervalo maior que isto entre duas chamadas conta como jogo parado (aba escondida): o tempo congela. */
export const MAX_STEP_SEC = 5;

/** Custo do nível `level` (0 = a 1ª compra), arredondado, com o fator de desconto aplicado. */
export function upgradeCost(def: UpgradeDef, level: number, costFactor = 1): number {
  const l = Math.max(0, level);
  const soft = def.steep ? Math.min(l, def.steep.from) : l;
  const hard = def.steep ? Math.max(0, l - def.steep.from) : 0;
  const raw = def.base * Math.pow(def.growth, soft) * Math.pow(def.steep?.growth ?? 1, hard) * clampCostFactor(costFactor);
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
  const last = ENERGY_STEPS.length - 1;
  // Depois da 6ª escolha a barra cresce 1,3x por escolha e, em cima disso, pesa cada vez mais (até 10x): os itens de
  // energia e os geradores enchem rápido mais para a frente, mas o começo do jogo continua leve.
  const base =
    n < ENERGY_STEPS.length
      ? (ENERGY_STEPS[n] as number)
      : (ENERGY_STEPS[last] as number) * Math.pow(ENERGY_STEP_GROWTH, n - last) * Math.min(ENERGY_STEP_LATE, Math.pow(ENERGY_RAMP, n - last));
  const value = base * (Number.isFinite(stepFactor) && stepFactor > 0 ? stepFactor : 1);
  return Math.min(MAX_NUMBER, value);
}

/** Multiplicador de efeito de um grimório de nível `level` (1 = x1; cada nível extra soma 50%). */
export function levelFactor(level: number): number {
  const l = Math.min(GRIMOIRE_MAX_LEVEL, Math.max(1, Math.floor(level)));
  return 1 + GRIMOIRE_LEVEL_STEP * (l - 1);
}

/** Posição da raridade (0 comum a 3 lendário), que é como o save guarda a maior raridade de cada grimório. */
export function rarityRank(r: GrimoireRarity): number {
  return GRIMOIRE_RARITIES.indexOf(r);
}

/** Teto de níveis de um grimório cuja maior raridade é `rank` (spec 042). */
export function levelCapOfRank(rank: number): number {
  return RARITY_LEVEL_CAP[GRIMOIRE_RARITIES[Math.min(GRIMOIRE_RARITIES.length - 1, Math.max(0, rank))] as GrimoireRarity];
}

/**
 * Quanto o nível de um grimório pego na raridade `rarity` soma ao ganho (o número que escala os efeitos): o 1º nível
 * vale o passo da raridade inteiro e os seguintes, metade (como era antes da spec 042).
 */
export function levelGain(rarity: GrimoireRarity, first: boolean): number {
  return RARITY_STEP[rarity] * (first ? 1 : GRIMOIRE_LEVEL_STEP);
}

/** O que o livro da vida guarda de cada grimório: nível, ganho acumulado e maior raridade (posição). */
export interface GrimoireBook {
  build: Record<string, number>;
  buildGain: Record<string, number>;
  buildRarity: Record<string, number>;
}

/** Este grimório pode ser oferecido na raridade `rarity`? Nunca em raridade menor que a que já se tem, e só abaixo do teto. */
export function offerableAt(book: GrimoireBook, id: string, rarity: GrimoireRarity): boolean {
  const have = book.build[id] ?? 0;
  if (have === 0) return true;
  const rank = rarityRank(rarity);
  if (rank < (book.buildRarity[id] ?? 0)) return false;
  return have < levelCapOfRank(rank);
}

/** Pega o grimório na raridade `rarity` e sobe `levels` níveis (o 1º do grimório vale o passo cheio). Respeita o teto. */
export function pickInto(book: GrimoireBook, id: string, rarity: GrimoireRarity, levels = 1): GrimoireBook {
  const have = book.build[id] ?? 0;
  const rank = Math.max(book.buildRarity[id] ?? 0, rarityRank(rarity));
  const cap = levelCapOfRank(rank);
  const take = Math.max(0, Math.min(levels, cap - have));
  if (take === 0) return { ...book, buildRarity: { ...book.buildRarity, [id]: rank } };
  const gain = (book.buildGain[id] ?? 0) + levelGain(rarity, have === 0) + (take - 1) * levelGain(rarity, false);
  return {
    build: { ...book.build, [id]: have + take },
    buildGain: { ...book.buildGain, [id]: gain },
    buildRarity: { ...book.buildRarity, [id]: rank },
  };
}

/** Chave do álbum para uma versão descoberta: "moon:rare". Proibidos continuam com o id puro. */
export function albumKey(id: string, rarity: GrimoireRarity): string {
  return `${id}:${rarity}`;
}

/** O álbum tem alguma versão deste grimório (ou o id puro, no caso dos proibidos)? */
export function albumHas(album: readonly string[], id: string): boolean {
  return album.some((k) => k === id || k.startsWith(`${id}:`));
}

/** As versões (raridades) já descobertas de um grimório. */
export function albumVersions(album: readonly string[], id: string): GrimoireRarity[] {
  return GRIMOIRE_RARITIES.filter((r) => album.includes(albumKey(id, r)));
}

/** Ganho de um grimório que já estava no save antigo (nível `level` na raridade `rarity`). */
export function legacyGain(rarity: GrimoireRarity, level: number): number {
  return RARITY_STEP[rarity] * (1 + GRIMOIRE_LEVEL_STEP * (Math.max(1, level) - 1));
}

/**
 * Escolhas que liberam cada raridade nesta vida. Como cada vida zera as escolhas, os limiares caem
 * para 60% depois do 1º colapso e 40% depois do 5º (seção 6.6).
 */
export function rarityUnlockPicks(rarity: Rarity, collapses: number): number {
  const base = RARITY_UNLOCK_PICKS[rarity];
  if (base <= 0) return 0;
  const scale = collapses >= 5 ? 0.4 : collapses >= 1 ? 0.6 : 1;
  return Math.max(1, Math.ceil(base * scale));
}

// --- Requisitos de colapso (spec 040, seção 2) ---
// O jogo não tem último colapso: a meta de poeira cresce por uma razão fixa, sem teto, e o simulador
// confere que a vida do perfil normal fica dentro da faixa abaixo.

/**
 * Meta de poeira da vida do 1º colapso (50 mi; a spec previa 2 mi e o Lucas pediu 80 mi, mas com 80 mi a vida 1 leva 3,3 h e estoura a trava de 3 h) e a razão entre uma meta e a seguinte (spec 040, seção 2). A spec previa
 * x3 sempre; o simulador mostrou que o poder do jogador (Atlas e árvore, que enchem) não acompanha x3 depois dos
 * primeiros colapsos (spec 040, seção 10). A razão vira trechos: a do passo `n-1 -> n` é a do primeiro trecho cujo
 * `upTo` é >= `n`. Os números são o que o simulador calibra; o último trecho vale para sempre.
 */
export const GOAL_BASE = 5e7;
/**
 * Spec 041 (B5): metas de poeira calibradas no simulador para o 1º colapso em ~1 h e cada vida seguinte um pouco
 * mais longa (até ~1,8 h no 15º), sem saltos. Depois do 15º a meta cresce `GOAL_TAIL_RATIO` por colapso. O
 * vetor é mutável só para a ferramenta de calibragem (`tmp-calib`); o jogo nunca o altera.
 */
export const GOAL_TABLE: number[] = [5e11, 1.3e14, 1.3e15, 2.2e16, 9.5e16, 2e17, 4.5e17, 6e17, 7.5e17, 1e18, 1.4e18, 3e18, 4e18, 5e18, 6e18];
export const GOAL_TAIL_RATIO = 1.08;
export const GOAL_SEGMENTS: { upTo: number; ratio: number }[] = [{ upTo: Infinity, ratio: GOAL_TAIL_RATIO }];

/** Escolhas mínimas (spec 041: metade de antes): 12 no 1º colapso, 10 do 2º ao 5º e 8 a partir do 6º. */
export const MIN_PICKS_FIRST = 12;
export const MIN_PICKS_EARLY = 10;
export const MIN_PICKS_LATE = 8;

/**
 * Travas de duração da vida (perfil normal, 1 a 2 h por dia, spec 040 seção 2): até o 15º colapso cada vida
 * leva de 1 h a 3 h; depois pode crescer no máximo 3% por colapso em relação à anterior.
 */
/** Spec 041: o 1º colapso em ~1 h e as outras vidas entre 0,7 h e 2,5 h até o 15º (antes 1 h a 3 h). */
export const LIFE_HOURS_MIN = 0.6;
export const LIFE_HOURS_MAX = 2.5;
export const LIFE_BAND_LAST_COLLAPSE = 15;
export const LIFE_GROWTH_MAX = 0.03;

/**
 * Meta de poeira da vida que termina no colapso `nextCollapse` (1 = primeiro): `GOAL_BASE` vezes a razão de cada passo
 * (`GOAL_SEGMENTS`), sem teto até o guarda de 1e300 (`MAX_NUMBER`).
 */
export function dustGoal(nextCollapse: number): number {
  const k = Math.max(1, Math.floor(nextCollapse));
  if (k <= GOAL_TABLE.length) return GOAL_TABLE[k - 1] as number;
  const last = GOAL_TABLE[GOAL_TABLE.length - 1] as number;
  return Math.min(MAX_NUMBER, last * Math.pow(GOAL_TAIL_RATIO, k - GOAL_TABLE.length));
}

/** Maior colapso cuja meta ainda cabe abaixo do guarda de 1e300: o `validateSave` recusa mais que isto. */
export const MAX_COLLAPSE_COUNT = (() => {
  let k = 1;
  while (dustGoal(k + 1) < MAX_NUMBER && k < 100_000) k++;
  return k;
})();

export function minPicks(nextCollapse: number): number {
  const k = Math.max(1, Math.floor(nextCollapse));
  return k === 1 ? MIN_PICKS_FIRST : k <= 5 ? MIN_PICKS_EARLY : MIN_PICKS_LATE;
}

/** Faixa de horas permitida para a vida do colapso `nextCollapse` quando a anterior durou `prevHours` (ou `null`). */
export function lifeHoursBand(nextCollapse: number, prevHours: number | null): { min: number; max: number } {
  const k = Math.max(1, Math.floor(nextCollapse));
  if (k <= LIFE_BAND_LAST_COLLAPSE || prevHours === null) return { min: LIFE_HOURS_MIN, max: LIFE_HOURS_MAX };
  return { min: LIFE_HOURS_MIN, max: prevHours * (1 + LIFE_GROWTH_MAX) };
}

// --- Economia v2 (spec 039) ---

/** Toque nos últimos tantos segundos conta como "tocando" (só as habilidades olham isto: Autoclick e Dobra valem para quem está parado). */
export const ACTIVE_WINDOW_SEC = 4;
/**
 * Pedido do Lucas (24/10/2026): os geradores rendem o máximo SEMPRE, tocando ou não. Antes, parado rendia 25% do ritmo
 * ativo; agora é 1 (e o teto também), então não há mais "ritmo parado" nem efeito que o melhore.
 */
export const IDLE_FACTOR = 1;
/** Teto do ganho automático: fração do que os toques rendem no ritmo normal. */
/** Spec 041 (B2): subiu de 35% para 60% do toque; os geradores seguem sempre abaixo de tocar (e rendem igual parados). */
export const AUTO_CAP_SHARE = 0.6;
export const NOMINAL_TOUCHES_PER_SEC = 2.5;

export const CRIT_CHANCE = 0.06;
export const CRIT_MULT = 10;
export const TRAINED_N = 25;
export const TRAINED_MULT = 5;
export const ECHO_SHARE_OF_AUTO = 0.004;
export const CHARGED_ENERGY = 0.5;
export const GLOVES_FLAT = 2;
// Aquecimento (spec 039, 3): depois de `WARM_AFTER_SEC` tocando sem parar, o toque rende x`WARM_MULT` até soltar por `WARM_RELEASE_SEC`.
export const WARM_AFTER_SEC = 5;
export const WARM_RELEASE_SEC = 2;
export const WARM_MULT = 1.5;
// Melhorias de gerador (spec 039, 4.1). Todas são compra única e nenhuma deixa o auto passar do teto de 35% do toque.
export const NETWORK_PER_PROBE = 0.02;
export const BURST_EVERY_SEC = 60;
export const BURST_SECS = 10;
export const PEAK_MULT = 1.5;
export const PEAK_SEC = 20;
export const SCALE_EVERY = 4;
export const BULK_DISCOUNT = 0.05;
/** Menos que isto de níveis faltando, completar de uma vez não vale o botão. */
export const BULK_MIN = 3;
/** Conversão: toques equivalentes de energia por segundo que os geradores somam à barra (1 por minuto). */
export const CONVERT_PER_SEC = 1 / 60;
export const LURE_UNITS_PER_SEC = 2;
export const LURE_CAP_SEC = 4;
export const ROTATION_MULT = 2;
export const HANDS_GENERATORS_PER_POINT = 6;
export const VOYAGER_SEC = 4;
export const CHANDRA_LIFE_MULT = 1.5;

/** Janela do próximo objeto comum: de 60 a 90 s depois do anterior; melhorias encurtam, com piso. */
export const SPAWN_MIN_SEC = 60;
export const SPAWN_MAX_SEC = 90;
export const SPAWN_FLOOR_MIN_SEC = 30;
export const SPAWN_FLOOR_MAX_SEC = 45;
export const KEPLER_SPAWN_FACTOR = 0.8;
export const MAGNET_SEC_PER_TOUCH = 0.5;
/** O 1º objeto do tutorial aparece logo, para a dica "Pegue aqui" não esperar 90 s. */
export const FIRST_OBJECT_DELAY_SEC = 8;

/** A melhoria some como "???" até a poeira da vida chegar a esta fração do preço. */
export const REVEAL_SHARE = 0.7;
/** Quantas melhorias de cada tipo a prateleira mostra à frente das compradas. */
export const SHELF_AHEAD = 2;

// --- Objetos raros e efeitos de grimório (spec 039, seções 7 e 8) ---

/** Estrela Dourada: intervalo base de 8 min (±25%), nunca abaixo de 5 min, dura 10 s. */
export const RARE_INTERVAL_SEC = 480;
export const RARE_INTERVAL_JITTER = 0.25;
export const RARE_MIN_INTERVAL_SEC = 300;
export const RARE_LIFE_SEC = 10;
/** Frenesi: toque x7 por 30 s. Chuva: 5 min de produção de uma vez. Surto: geradores cheios e teto x3 por 45 s. */
export const FRENZY_MULT = 7;
export const FRENZY_SEC = 30;
export const RAIN_SEC = 300;
export const SURGE_SEC = 45;
export const SURGE_CAP_MULT = 3;
/** A poeira dos geradores também enche a barra de grimórios: conta como toques, a esta fração da energia do toque. */
export const AUTO_ENERGY_SHARE = 0.25;
export const IDLE_FACTOR_MAX = 1;
