// Validação e junção de saves do Aperta! (spec 038, seção 10). Funções puras: o servidor usa as
// mesmas que o aparelho, então um save que passa num lado passa no outro.
//
// Dois tipos de problema: o que é IMPOSSÍVEL (formato, id fora do catálogo, gasto maior que o
// ganho, conteúdo de colapso futuro) recusa o save inteiro; o que é só rápido demais (tempo jogado
// maior que o tempo desde a criação, poeira acima do ritmo possível) corta ao valor possível e
// marca `flagged`, sem banir ninguém (seção 10.3).

import { z } from 'zod';
import { AUTOCLICK_MAX_CPS } from './tree-skills';
import { treeErrors, treeSpent, treeStats } from './tree';
import { GENERATOR_MAX, GRIMOIRES, LEGENDARY_KINDS, OBJECTS, REGIONS, UPGRADES, grimoireById, RARE_EFFECTS, type ObjectKind, type RareEffect } from './catalog';
import {
  COMBO_HARD_CAP,
  COST_FLOOR,
  GRIMOIRE_MAX_LEVEL,
  MAX_COLLAPSE_COUNT,
  MAX_NUMBER,
  MAX_TOUCHES_PER_SEC,
  dustGoal,
  energyCap,
  upgradeCost,
} from './economy';
import { eventsOpen, mechanicOpen, missionById } from './content';
import { achievementActive, achievementById } from './achievements';
import { EVENT_IDS_NOW, EVENT_IDS_PLANNED, sparkSources } from './sparks';
import { ATLAS_PAGE_SPARKS, FORBIDDEN, FORBIDDEN_MAX_LEVEL, forbiddenById } from './forbidden';
import { SAVE_VERSION, effectiveStats, upgradeLock, type SaveState } from './engine';
import { TUTORIAL_HINTS, UI_BUTTONS, migrateTutorial } from './tutorial';

/** Tamanho máximo do save em JSON (o real fica em poucos KB). */
export const MAX_SAVE_BYTES = 64 * 1024;
const MAX_PICKS = 100_000;
const MAX_PLAY_SECONDS = 1e9;
const MAX_ACHIEVEMENTS = 500;
const MAX_SEEN_UNLOCKS = 500;
const MAX_OBJECTS_ON_FIELD = 30;
const MAX_TUTORIAL_STEP = 30;
/** Cada escolha repetida soma até 2 níveis (1 base + Nebulosa de Órion); a primeira soma 1. */
const MAX_LEVELS_PER_PICK = 2;
/** Folga para arredondamento e para o relógio do aparelho andar um pouco à frente do servidor. */
const CLOCK_SLACK_SEC = 120;
const TOLERANCE = 1.000001;
/** Fragmentos extras por missão no tempo em que os Fragmentos existiam (só para o teto de `sparks.legacy`). */
const LEGACY_MISSION_FRAGMENTS = 2;

const EVENT_IDS = ['meteor-shower', 'solar-storm', 'gold-rain', 'alignment', 'energy-tide', 'eclipse'] as const;
const OBJECT_KINDS = [...OBJECTS.map((o) => o.kind), 'golden', ...LEGENDARY_KINDS] as unknown as [ObjectKind, ...ObjectKind[]];

// --- Formato ---

const nonNeg = z.number().finite().min(0).max(MAX_NUMBER);
const int = (max: number) => z.number().int().min(0).max(max);
/** Carimbos de tempo: o motor usa -1e9 para "nunca", então o piso é mais baixo. */
const stamp = z.number().finite().min(-2e9).max(MAX_NUMBER);
const id = z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9:_-]*$/);

const runSchema = z.object({
  dust: nonNeg,
  dustLife: nonNeg,
  energy: nonNeg,
  picks: int(MAX_PICKS),
  upgradeLevels: z.array(int(1000)).max(64),
  build: z.record(id, int(GRIMOIRE_MAX_LEVEL)),
  clicks: int(Number.MAX_SAFE_INTEGER),
  combo: int(COMBO_HARD_CAP),
  lastPressAt: stamp,
  comboFullSince: stamp.default(-1e9),
  boostUntil: stamp,
  boostMult: z.number().finite().min(1).max(1000),
  afterCapture: z.boolean(),
  warmSince: stamp.default(-1e9),
  peakUntil: stamp.default(-1e9),
  nextBurstAt: stamp.nullable().default(null),
  objects: z
    .array(
      z.object({
        id: int(Number.MAX_SAFE_INTEGER),
        kind: z.enum(OBJECT_KINDS),
        power: z.enum(RARE_EFFECTS as [RareEffect, ...RareEffect[]]).optional(),
        bornAt: stamp,
        expiresAt: stamp,
      }),
    )
    .max(MAX_OBJECTS_ON_FIELD),
  nextObjectId: int(Number.MAX_SAFE_INTEGER),
  nextSpawnAt: stamp.nullable(),
  freeRerolls: int(100),
  pending: z
    .object({
      offers: z.array(id).max(8),
      openedAt: stamp,
      selected: id.nullable(),
      picksLeft: int(10),
      rerollsLeft: int(100),
      rerolled: int(100).default(0),
    })
    .nullable(),
  rngState: z.number().int().min(-2147483648).max(4294967295),
  lastGain: nonNeg,
  // Campos da etapa 12: saves antigos não os têm, então entram com o valor de "nada ainda".
  event: z.object({ id: z.enum(EVENT_IDS), until: stamp }).nullable().default(null),
  nextEventAt: stamp.nullable().default(null),
  nextRareAt: stamp.nullable().default(null),
  surgeUntil: stamp.default(-1e9),
  mission: z
    .object({ id: id, progress: int(1e6), done: z.boolean(), doneAt: stamp.default(-1e9) })
    .nullable()
    .default(null),
  // Contadores do marco da vida (spec 040): saves antigos não os têm e entram zerados.
  captured: int(Number.MAX_SAFE_INTEGER).default(0),
  rares: int(Number.MAX_SAFE_INTEGER).default(0),
  chain: int(1e6).default(0),
  chainBest: int(1e6).default(0),
  fullBest: nonNeg.default(0),
  missionsDone: int(Number.MAX_SAFE_INTEGER).default(0),
  // Sorte e Exploração (etapa 20): saves antigos entram zerados.
  rerollsUsed: int(1000).default(0),
  discardsUsed: int(1000).default(0),
  radar: int(1000).default(0),
  eventsStarted: int(Number.MAX_SAFE_INTEGER).default(0),
  destinyUsed: z.boolean().default(false),
  // Habilidades ativas e Compra automática (etapa 19): saves antigos entram sem nada.
  skills: z.record(id, z.object({ readyAt: stamp, activeUntil: stamp, charges: int(10) })).default({}),
  autoBuy: z.object({ on: z.boolean(), limit: int(100) }).default({ on: false, limit: 50 }),
});

const saveSchema = z.object({
  // Saves de versões antigas são recusados: a economia v2 (spec 039) zerou todos.
  // A versão 2 (com Atlas) é migrada na leitura (`migrateVault`); a 1 (economia antiga) segue recusada.
  version: z.number().int().min(2).max(SAVE_VERSION),
  name: z.string().trim().min(1).max(40),
  createdAt: nonNeg,
  playSeconds: z.number().finite().min(0).max(MAX_PLAY_SECONDS),
  clock: stamp,
  tutorial: z.union([z.literal('done'), z.number().int().min(1).max(MAX_TUTORIAL_STEP)]),
  // Saves de antes do tutorial dinâmico não têm `ui`: `migrateTutorial` os trata depois da leitura.
  ui: z
    .object({
      unlocked: z.array(z.enum(UI_BUTTONS as [string, ...string[]])).max(UI_BUTTONS.length),
      hints: z.array(z.enum(TUTORIAL_HINTS as [string, ...string[]])).max(TUTORIAL_HINTS.length),
      achSeen: z.number().int().min(0).max(MAX_ACHIEVEMENTS).default(0),
    })
    .optional(),
  storySeen: z.boolean(),
  run: runSchema,
  album: z.array(id).max(GRIMOIRES.length + FORBIDDEN.length),
  // Cofre dos Proibidos e Selos Estelares (spec 040, etapa 15): saves de antes entram vazios.
  vault: z.record(id, int(FORBIDDEN_MAX_LEVEL)).default({}),
  seals: int(1_000_000).default(0),
  // Sem último colapso (spec 040): o teto é o do guarda de 1e300, onde a meta de poeira deixa de crescer.
  collapses: int(MAX_COLLAPSE_COUNT),
  regionId: id,
  favorite: id.nullable().default(null),
  seenUnlocks: z.array(id).max(MAX_SEEN_UNLOCKS),
  // Saves de antes da etapa 16 têm `fragments`: `migrateSparks` os transforma em `sparks` antes da leitura.
  sparks: z.object({ legacy: int(1e9), spent: int(1e9) }),
  tree: z.record(id, z.number().int().min(0).max(5)),
  achievements: z.array(id).max(MAX_ACHIEVEMENTS),
  stats: z.object({
    clicks: int(Number.MAX_SAFE_INTEGER),
    objectsCaptured: int(Number.MAX_SAFE_INTEGER),
    picks: int(MAX_PICKS * 100),
    dustTotal: nonNeg,
    // Campos das conquistas (etapa 10): saves antigos não têm, então entram zerados.
    bestLevel: int(GRIMOIRE_MAX_LEVEL).default(0),
    comboMaxHits: int(Number.MAX_SAFE_INTEGER).default(0),
    comboFullBest: nonNeg.default(0),
    satelliteStreak: int(Number.MAX_SAFE_INTEGER).default(0),
    satelliteBest: int(Number.MAX_SAFE_INTEGER).default(0),
    respecs: int(Number.MAX_SAFE_INTEGER).default(0),
    // Contadores das conquistas ampliadas e das fontes de Cintilas (spec 040, etapa 16): saves antigos entram zerados.
    raresCaptured: int(Number.MAX_SAFE_INTEGER).default(0),
    capturedKinds: z.array(id).max(32).default([]),
    chainBest: int(1e6).default(0),
    missionsDone: int(Number.MAX_SAFE_INTEGER).default(0),
    eventsSeen: z.array(id).max(32).default([]),
    genBest: int(1000).default(0),
    upgradesBought: int(Number.MAX_SAFE_INTEGER).default(0),
    touchBest: int(64).default(0),
    offers: int(Number.MAX_SAFE_INTEGER).default(0),
    legendaryOffers: int(Number.MAX_SAFE_INTEGER).default(0),
    firstOfferLegendary: int(1).default(0),
    rareStreak: int(Number.MAX_SAFE_INTEGER).default(0),
    rareStreakBest: int(Number.MAX_SAFE_INTEGER).default(0),
    rerolls: int(Number.MAX_SAFE_INTEGER).default(0),
    sinceLegend: int(Number.MAX_SAFE_INTEGER).default(0),
    forbiddenBest: z.record(id, int(GRIMOIRE_MAX_LEVEL)).default({}),
    skillsUsed: z.array(id).max(32).default([]),
    skillUses: int(Number.MAX_SAFE_INTEGER).default(0),
    dayStreakBest: int(100_000).default(0),
  }),
});

/**
 * Saves anteriores à etapa 16 guardam `fragments { earned, spent }`: viram `sparks { legacy, spent }` 1:1 (o saldo e o
 * gasto são os mesmos; o resto das Cintilas vem das fontes novas). Não muta o que recebe.
 */
function migrateSparks(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  if (o.sparks !== undefined || typeof o.fragments !== 'object' || o.fragments === null) return raw;
  const f = o.fragments as Record<string, unknown>;
  const { fragments: _old, ...rest } = o;
  void _old;
  return { ...rest, sparks: { legacy: f.earned, spent: f.spent } };
}

/**
 * Saves da versão 2 (com Atlas Eterno) viram a versão 3 (com Cofre dos Proibidos): cada página do Atlas vira
 * `ATLAS_PAGE_SPARKS` Cintilas em `sparks.legacy` (valor fixo, spec 040 etapa 15), o Atlas some, o Cofre começa vazio e os
 * proibidos antigos saem da vida em andamento (eles agora só se ganham ao colapsar). Não muta o que recebe.
 */
function migrateVault(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  if (o.version !== 2) return raw;
  const out: Record<string, unknown> = { ...o, version: 3, vault: {}, seals: 0 };
  const atlas = o.atlas as { pages?: unknown[] } | undefined;
  const pages = Array.isArray(atlas?.pages) ? (atlas?.pages as unknown[]).length : 0;
  delete out.atlas;
  const sp = out.sparks as { legacy?: number; spent?: number } | undefined;
  if (sp && typeof sp.legacy === 'number') out.sparks = { ...sp, legacy: sp.legacy + pages * ATLAS_PAGE_SPARKS };
  const run = o.run as Record<string, unknown> | undefined;
  if (run && typeof run === 'object') {
    const old = new Set(['sagittarius-a', 'cygnus-x1', 'm87']);
    const build = Object.fromEntries(Object.entries((run.build ?? {}) as Record<string, number>).filter(([k]) => !old.has(k)));
    let pending = run.pending as { offers?: string[]; selected?: string | null } | null | undefined;
    if (pending && Array.isArray(pending.offers)) {
      const offers = pending.offers.filter((x) => !old.has(x));
      pending = offers.length === 0 ? null : { ...pending, offers, selected: pending.selected && old.has(pending.selected) ? null : pending.selected };
    }
    out.run = { ...run, build, pending };
  }
  return out;
}

/**
 * Versão 3 para 4: a árvore antiga (6 ramos de 3 níveis) é descartada. O que ela custou volta como Cintilas livres
 * (`sparks.spent` zera: era só o gasto na árvore), então ninguém perde nada e a árvore nova começa vazia.
 */
function migrateTree(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  if (o.version !== 3) return raw;
  const sp = o.sparks as { legacy?: number; spent?: number } | undefined;
  return { ...o, version: 4, tree: {}, ...(sp && typeof sp.legacy === 'number' ? { sparks: { ...sp, spent: 0 } } : {}) };
}

/**
 * Versão 4 para 5 (spec 041, economia v3): os geradores ganharam limite de níveis e outro preço, então as melhorias
 * compradas na vida em andamento voltam como poeira (`run.dust` = o que a vida já ganhou). Álbum, Cofre, árvore e
 * conquistas não mudam.
 */
function migrateEconomy(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  if (o.version !== 4) return raw;
  const run = o.run as Record<string, unknown> | undefined;
  if (!run || typeof run !== 'object') return { ...o, version: SAVE_VERSION };
  const life = typeof run.dustLife === 'number' ? run.dustLife : 0;
  const levels = Array.isArray(run.upgradeLevels) ? (run.upgradeLevels as unknown[]).map(() => 0) : [];
  return { ...o, version: SAVE_VERSION, run: { ...run, upgradeLevels: levels, dust: life } };
}

export type SaveValidation =
  | { ok: true; save: SaveState; flagged: string[] }
  | { ok: false; errors: string[] };

export interface ValidateOptions {
  /** Agora, em ms (o servidor passa o relógio dele; o aparelho não é fonte de verdade). */
  nowMs?: number;
  /** Quando o save nasceu, em ms (no servidor, o `created_at` da linha). Sem isso, o tempo jogado não é checado. */
  createdAtMs?: number;
}

const noDupes = (list: readonly string[]) => new Set(list).size === list.length;

/**
 * Teto de poeira por segundo de jogo para o que está comprado: 12 toques/s com tudo no máximo, mais
 * objetos e o ganho passivo. Saves antigos (economia anterior à reformulação do começo, spec 038 6.2)
 * passam por este mesmo teto: se a poeira da vida passa dele, `validateSave` corta ao teto e marca
 * `dustLife` em `flagged`, sem recusar o save.
 */
function dustPerSecondCeiling(save: SaveState): number {
  const s = effectiveStats(save);
  const comboMult = (1 + s.combo.pointValue * s.combo.max) * s.combo.fullMult;
  const nthMult = s.nth.reduce((m, r) => m * Math.max(1, r.mult), 1);
  const burst = Math.max(1, s.objects.afterCaptureMult) * Math.max(1, s.objects.signalMult);
  // A Estrela Dourada (frenesi x7 por 30 s e chuva de 5 min a cada 5 min no mínimo) pode somar até ~3x à média.
  const crit = (s.crit.chance > 0 ? s.crit.mult : 1) * 3;
  const perTouch = (Math.max(1, s.dustPerTouch) + s.combo.fullDustAdd) * comboMult * nthMult * burst * crit;
  const bestObject = Math.max(...Object.values(s.objects.reward).map((r) => r.dust));
  const objects = s.objects.disabled ? 0 : (1 / Math.max(0.5, s.objects.spawnMinSec)) * s.dustPerTouch * bestObject;
  // Autoclick e Piloto somam até 6 toques/s por cima dos 12 manuais; a Dobra dobra os geradores; a Supernova e o Pulso
  // são rajadas de até ~15 minutos de toques a cada recarga.
  const auto = s.skills.has.autoclick || s.skills.has.autopilot ? AUTOCLICK_MAX_CPS * perTouch : 0;
  const bursts = s.skills.has.pulse || s.skills.has.supernova ? 2 * perTouch * Math.max(s.skills.pulse.touches, s.skills.supernova.touches * s.skills.supernova.big * 3) / 150 : 0;
  const warp = s.skills.has['time-warp'] ? 2 : 1;
  return (MAX_TOUCHES_PER_SEC * perTouch + auto + bursts) + objects + warp * Math.min(s.autoDustPerSec, s.autoDustCap);
}

/** Metas de poeira de antes da spec 040 (economia v2 calibrada, 22/10/2026): só para o piso dos saves antigos. */
const LEGACY_DUST_GOAL = [8.803e7, 1.972e8, 2.5e8, 2.6e8, 1.0e8, 6.3e7, 6.5e7, 6.7e7, 6.9e7, 7.1e7, 7.3e7, 7.5e7, 7.7e7, 7.9e7, 8.1e7];

function legacyDustGoal(k: number): number {
  if (k <= LEGACY_DUST_GOAL.length) return LEGACY_DUST_GOAL[k - 1] as number;
  return Math.min(MAX_NUMBER, (LEGACY_DUST_GOAL[LEGACY_DUST_GOAL.length - 1] as number) * Math.pow(3, k - LEGACY_DUST_GOAL.length));
}

/** Confere formato e coerência de um save vindo de fora (aparelho ou banco). Não muta `raw`. */
export function validateSave(raw: unknown, opts: ValidateOptions = {}): SaveValidation {
  let size = 0;
  try {
    size = JSON.stringify(raw)?.length ?? 0;
  } catch {
    return { ok: false, errors: ['Save ilegível'] };
  }
  if (size > MAX_SAVE_BYTES) return { ok: false, errors: ['Save grande demais'] };

  const parsed = saveSchema.safeParse(migrateEconomy(migrateTree(migrateVault(migrateSparks(raw)))));
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || 'save'}: ${i.message}`);
    return { ok: false, errors };
  }
  // O zod devolve uma cópia profunda (e descarta chaves desconhecidas): daqui para frente pode-se alterar.
  const save = migrateTutorial(parsed.data as unknown as SaveState);
  const errors: string[] = [];
  const flagged: string[] = [];
  const c = save.collapses;
  const run = save.run;

  // Conteúdo: só do catálogo e só de colapso já alcançado.
  if (!noDupes(save.album) || !noDupes(save.achievements) || !noDupes(save.seenUnlocks)) errors.push('Lista com itens repetidos');
  for (const gid of save.album) if (!grimoireById(gid) && !forbiddenById(gid)) errors.push(`Grimório desconhecido no álbum: ${gid}`);
  for (const [gid, lvl] of Object.entries(run.build)) {
    const g = grimoireById(gid);
    if (!g) errors.push(`Grimório desconhecido: ${gid}`);
    else if (g.unlockedAtCollapse > c) errors.push(`Grimório de colapso futuro: ${gid}`);
    else if (lvl < 1) errors.push(`Nível inválido: ${gid}`);
    else if (!save.album.includes(gid)) errors.push(`Grimório fora do álbum: ${gid}`);
  }
  const region = REGIONS.find((r) => r.id === save.regionId);
  if (!region || region.unlockedAtCollapse > c) errors.push('Região ainda fechada');
  for (const o of run.objects) {
    if (o.kind === 'golden') continue;
    // Lendário só com o Radar (ou num evento que o Radar libera); a árvore pode ter sido refeita depois, mas o objeto vive segundos.
    if ((LEGENDARY_KINDS as readonly string[]).includes(o.kind)) continue;
    const def = OBJECTS.find((d) => d.kind === o.kind);
    if (!def || def.unlockedAtCollapse > c) errors.push(`Objeto de colapso futuro: ${o.kind}`);
  }
  if (!noDupes(run.objects.map((o) => String(o.id)))) errors.push('Objetos repetidos');
  // Contadores do marco: nenhum passa do que a vida (ou a conta) já fez.
  if (run.captured > save.stats.objectsCaptured) errors.push('Capturas da vida maiores que o total');
  if (run.rares > run.captured) errors.push('Raros maiores que as capturas');
  if (run.chainBest > run.clicks || run.chain > run.chainBest) errors.push('Sequência de combo incoerente');
  if (run.fullBest > save.playSeconds + CLOCK_SLACK_SEC) errors.push('Combo cheio maior que o tempo jogado');
  if (run.missionsDone > 0 && !mechanicOpen('missions', c)) errors.push('Missão de colapso futuro');
  // Missão cumprida de save antigo: conta como feita (o contador novo não existia).
  if (run.mission?.done && run.missionsDone === 0) run.missionsDone = 1;
  if (run.event && !eventsOpen(c).includes(run.event.id)) errors.push(`Evento de colapso futuro: ${run.event.id}`);
  if (run.mission) {
    const def = missionById(run.mission.id);
    if (!def || !mechanicOpen('missions', c)) errors.push(`Missão de colapso futuro: ${run.mission.id}`);
    else if (run.mission.progress > def.target || run.mission.done !== run.mission.progress >= def.target) errors.push('Missão incoerente');
  }
  if (save.favorite !== null) {
    const fav = grimoireById(save.favorite);
    if (!fav || fav.unlockedAtCollapse > c || !mechanicOpen('favorite', c) || !save.album.includes(save.favorite)) errors.push('Favorito inválido');
  }
  if (run.pending) {
    for (const oid of [...run.pending.offers, ...(run.pending.selected ? [run.pending.selected] : [])]) {
      const g = grimoireById(oid);
      if (!g || g.unlockedAtCollapse > c) errors.push(`Oferta inválida: ${oid}`);
    }
  }

  // Escolhas e níveis: cada escolha compra um grimório novo (nível 1) ou sobe um repetido.
  const levels = Object.values(run.build);
  // Cartas de capa (árvore): o favorito comum pode começar a vida num nível, sem ter gasto escolha.
  const cover = treeStats(save.tree).coverLevel;
  if (Object.keys(run.build).length > run.picks + (cover > 0 ? 1 : 0)) errors.push('Mais grimórios do que escolhas');
  if (levels.reduce((a, b) => a + b, 0) > run.picks * MAX_LEVELS_PER_PICK + cover) errors.push('Níveis demais para as escolhas');
  if (run.picks > save.stats.picks) errors.push('Escolhas da vida maiores que o total');
  if (save.stats.picks < c) errors.push('Escolhas totais menores que os colapsos');

  // Melhorias: nível dentro do máximo, aberta, e o custo (no desconto máximo) cabe na poeira da vida.
  if (run.upgradeLevels.length > UPGRADES.length) errors.push('Melhorias demais');
  while (run.upgradeLevels.length < UPGRADES.length) run.upgradeLevels.push(0);
  let spent = 0;
  UPGRADES.forEach((def, i) => {
    const lvl = run.upgradeLevels[i] ?? 0;
    if (lvl === 0) return;
    if (lvl > def.max) errors.push(`Nível acima do máximo: ${def.id}`);
    // Liberação progressiva: o marco (poeira da vida ou nível de outra melhoria) e a exigência precisam estar cumpridos.
    const lock = upgradeLock(save, i);
    if (lock?.kind === 'collapse') errors.push(`Melhoria de colapso futuro: ${def.id}`);
    else if (lock) errors.push(`Melhoria trancada: ${def.id}`);
    for (let l = 0; l < Math.min(lvl, def.max); l++) spent += upgradeCost(def, l, COST_FLOOR);
  });
  if (spent > run.dustLife * TOLERANCE + 1) errors.push('Melhorias custam mais que a poeira ganha');
  if (run.dust > run.dustLife * TOLERANCE + 1) errors.push('Poeira maior que a ganha na vida');
  if (run.dustLife > save.stats.dustTotal * TOLERANCE + 1) errors.push('Poeira da vida maior que o total');

  // Cofre dos Proibidos: só proibidos que existem, nível 1 a 5, e cada colapso deu no máximo um nível ou um selo.
  for (const [vid, lvl] of Object.entries(save.vault)) {
    if (!forbiddenById(vid) || lvl < 1) errors.push(`Proibido inválido no Cofre: ${vid}`);
    else if (!save.album.includes(vid)) errors.push(`Proibido fora do álbum: ${vid}`);
  }
  if (Object.values(save.vault).reduce((a, b) => a + b, 0) + save.seals > c) errors.push('Cofre maior que os colapsos');
  // Selo Estelar só existe com os 10 proibidos no nível 5.
  if (save.seals > 0 && !FORBIDDEN.every((f) => (save.vault[f.id] ?? 0) >= FORBIDDEN_MAX_LEVEL)) errors.push('Selos sem o Cofre completo');

  // Cintilas: `legacy` só pode valer o que os Fragmentos antigos podiam ter dado (3 + nº do colapso, mais 1 por década
  // de poeira acima de 2 mi e 2 por missão); um save novo tem 0. O gasto cabe no que as fontes já deram.
  const { legacy, spent: sparkSpent } = save.sparks;
  let legacyMax = 0;
  const bonusCap = Math.max(0, Math.floor(Math.log10(Math.max(1, save.stats.dustTotal / 2e6))));
  for (let k = 1; k <= c; k++) legacyMax += 3 + k + bonusCap + (mechanicOpen('missions', k - 1) ? LEGACY_MISSION_FRAGMENTS : 0);
  legacyMax += ATLAS_PAGE_SPARKS * 7;
  if (legacy > legacyMax) errors.push('Cintilas migradas não batem com os colapsos');
  const sources = sparkSources(save);
  if (sparkSpent > legacy + sources.total) errors.push('Cintilas gastas maiores que as ganhas');

  // Conquistas e contadores novos: só ids do catálogo, só conteúdo que já existe e nada acima do que a conta fez.
  for (const aid of save.achievements) {
    const def = achievementById(aid);
    if (!def) errors.push(`Conquista desconhecida: ${aid}`);
    else if (!achievementActive(def)) errors.push(`Conquista de conteúdo que ainda não existe: ${aid}`);
  }
  const st = save.stats;
  if (st.raresCaptured > st.objectsCaptured) errors.push('Raros capturados maiores que as capturas');
  const kinds = new Set<string>([...OBJECTS.map((o) => o.kind as string), 'golden', ...LEGENDARY_KINDS]);
  if (st.capturedKinds.some((k) => !kinds.has(k)) || !noDupes(st.capturedKinds)) errors.push('Tipos de objeto capturados inválidos');
  if (st.eventsSeen.some((e) => !(EVENT_IDS_NOW.includes(e) ? eventsOpen(c).includes(e as never) : EVENT_IDS_PLANNED.includes(e))) || !noDupes(st.eventsSeen)) errors.push('Eventos vistos inválidos');
  for (const [gid, lvl] of Object.entries(st.forbiddenBest)) {
    if (!forbiddenById(gid) || lvl < 1) errors.push(`Nível de proibido inválido: ${gid}`);
  }
  // O recorde de cada proibido nunca fica abaixo do nível que ele tem no Cofre.
  for (const [vid, lvl] of Object.entries(save.vault)) st.forbiddenBest[vid] = Math.max(st.forbiddenBest[vid] ?? 0, lvl);
  // Saves de antes da etapa 16 não têm os totais da conta: o que a vida em andamento já fez entra neles.
  st.chainBest = Math.max(st.chainBest, run.chainBest);
  st.missionsDone = Math.max(st.missionsDone, run.missionsDone);
  st.raresCaptured = Math.max(st.raresCaptured, run.rares);
  st.objectsCaptured = Math.max(st.objectsCaptured, run.captured);
  if (st.rareStreak > st.rareStreakBest || st.rareStreakBest > st.picks) errors.push('Sequência de raros incoerente');
  if (st.legendaryOffers > st.offers && st.offers > 0) errors.push('Ofertas lendárias maiores que as ofertas');
  if (st.genBest > GENERATOR_MAX || st.touchBest > UPGRADES.filter((u) => u.kind === 'touch').length) errors.push('Recorde de melhorias impossível');
  errors.push(...treeErrors(save.tree));
  const treeCost = treeSpent(save.tree);
  if (Object.keys(save.tree).length > 0 && c < 1) errors.push('Árvore antes do 1º colapso');
  if (treeCost > sparkSpent) errors.push('Árvore custa mais que as Cintilas gastas');
  // Piso do total ganho: cada colapso exigiu a meta de poeira da vida, nas regras de hoje ou nas de antes da
  // spec 040 (a menor das duas vale, para um save antigo legítimo nunca ser recusado).
  let minTotal = 0;
  for (let k = 1; k <= c; k++) minTotal += Math.min(dustGoal(k), legacyDustGoal(k));
  if (save.stats.dustTotal * TOLERANCE + 1 < Math.min(MAX_NUMBER, minTotal)) errors.push('Poeira total menor que a exigida pelos colapsos');
  // Cada colapso começa com o tutorial concluído (seção 8.1); o motor não mexe nele, então normaliza em vez de recusar.
  if (c > 0) save.tutorial = 'done';

  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)].slice(0, 8) };

  // --- Ritmo possível: corta e marca, sem recusar ---
  const created = opts.createdAtMs ?? (save.createdAt > 0 ? save.createdAt : undefined);
  if (created !== undefined && opts.nowMs !== undefined) {
    const maxPlay = Math.max(0, (opts.nowMs - created) / 1000 + CLOCK_SLACK_SEC);
    if (save.playSeconds > maxPlay) {
      save.playSeconds = Math.floor(maxPlay);
      flagged.push('playSeconds');
    }
  }
  // Teto teórico desta vida (do colapso `c`): o que o que está comprado rende no pior caso, sem passar do guarda de 1e300.
  const perSec = dustPerSecondCeiling(save);
  const rawCeiling = (Number.isFinite(perSec) ? perSec : MAX_NUMBER) * save.playSeconds + effectiveStats(save).startDust + 1000;
  const ceiling = Number.isFinite(rawCeiling) ? Math.min(MAX_NUMBER, rawCeiling) : MAX_NUMBER;
  if (run.dustLife > ceiling) {
    const excess = run.dustLife - ceiling;
    run.dustLife = ceiling;
    run.dust = Math.min(run.dust, Math.max(0, ceiling - spent));
    save.stats.dustTotal = Math.max(save.stats.dustTotal - excess, ceiling);
    flagged.push('dustLife');
  }
  const cap = energyCap(run.picks, effectiveStats(save).energyStepFactor);
  if (run.energy > cap) {
    run.energy = cap;
    flagged.push('energy');
  }
  return { ok: true, save, flagged };
}

// --- Junção entre aparelhos ---

export interface MergeResult {
  save: SaveState;
  /** Qual lado deu a vida em andamento (o mais avançado). */
  winner: 'a' | 'b';
  /**
   * `true` quando o outro aparelho tinha uma vida que não cabe na vencedora (jogou por caminho
   * diferente): o cliente avisa "Este save mudou em outro aparelho" e deixa a pessoa escolher.
   * Mesmo assim álbum, conquistas, Atlas, árvore e totais foram unidos: nada permanente se perde.
   */
  conflict: boolean;
}

const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];
const mergeBest = (a: Record<string, number>, b: Record<string, number>): Record<string, number> => {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
};
const maxNum = (a: number, b: number) => Math.max(a, b);

/** Quem está mais adiante: mais colapsos; empate, mais escolhas e depois mais poeira da vida. */
function advance(a: SaveState, b: SaveState): 'a' | 'b' {
  if (a.collapses !== b.collapses) return a.collapses > b.collapses ? 'a' : 'b';
  if (a.run.picks !== b.run.picks) return a.run.picks > b.run.picks ? 'a' : 'b';
  if (a.run.dustLife !== b.run.dustLife) return a.run.dustLife > b.run.dustLife ? 'a' : 'b';
  return a.playSeconds >= b.playSeconds ? 'a' : 'b';
}

/** A vida de `loser` cabe na de `winner`? (nada que ela tenha deixa de existir na vencedora) */
function lifeDominated(loser: SaveState, winner: SaveState): boolean {
  if (loser.collapses < winner.collapses) return true;
  const l = loser.run;
  const w = winner.run;
  if (l.picks > w.picks || l.dustLife > w.dustLife) return false;
  for (const [gid, lvl] of Object.entries(l.build)) if ((w.build[gid] ?? 0) < lvl) return false;
  return l.upgradeLevels.every((lvl, i) => (w.upgradeLevels[i] ?? 0) >= lvl);
}

/**
 * Junta dois saves do mesmo jogo sem perder progresso: a vida em andamento vem do mais avançado;
 * álbum, conquistas, avisos vistos e totais são unidos; o Atlas e a árvore ficam com o máximo de cada
 * um (dentro dos espaços e dos Fragmentos). Os dois lados devem ter passado por `validateSave`.
 */
export function mergeSaves(a: SaveState, b: SaveState): MergeResult {
  const winner = advance(a, b);
  const [top, other] = winner === 'a' ? [a, b] : [b, a];

  // Cofre: o maior nível de cada proibido; se a soma passa do que os colapsos do save mais avançado permitem, fica o dele.
  const vault = mergeBest(a.vault, b.vault);
  const vaultOk = Object.values(vault).reduce((x, y) => x + y, 0) + maxNum(a.seals, b.seals) <= top.collapses;

  // Árvore: máximo por nó (a união de duas árvores válidas é válida: os pais de um nó vêm de uma das duas), só se as Cintilas gastas cobrem; senão fica a da vencedora.
  const tree: Record<string, number> = { ...top.tree };
  for (const [branch, lvl] of Object.entries(other.tree)) tree[branch] = maxNum(tree[branch] ?? 0, lvl);
  const treeCost = treeSpent(tree);

  const tutorial =
    top.tutorial === 'done' || other.tutorial === 'done' ? 'done' : Math.max(top.tutorial, other.tutorial);

  const createdAts = [a.createdAt, b.createdAt].filter((t) => t > 0);
  const save: SaveState = {
    ...top,
    createdAt: createdAts.length > 0 ? Math.min(...createdAts) : top.createdAt,
    playSeconds: maxNum(a.playSeconds, b.playSeconds),
    tutorial,
    ui: {
      unlocked: union(a.ui.unlocked, b.ui.unlocked) as SaveState['ui']['unlocked'],
      hints: union(a.ui.hints, b.ui.hints) as SaveState['ui']['hints'],
      achSeen: maxNum(a.ui.achSeen ?? 0, b.ui.achSeen ?? 0),
    },
    storySeen: a.storySeen || b.storySeen,
    album: union(top.album, other.album),
    vault: vaultOk ? vault : { ...top.vault },
    seals: vaultOk ? maxNum(a.seals, b.seals) : top.seals,
    seenUnlocks: union(top.seenUnlocks, other.seenUnlocks),
    sparks: { ...top.sparks },
    tree,
    achievements: union(top.achievements, other.achievements),
    stats: {
      clicks: maxNum(a.stats.clicks, b.stats.clicks),
      objectsCaptured: maxNum(a.stats.objectsCaptured, b.stats.objectsCaptured),
      picks: maxNum(a.stats.picks, b.stats.picks),
      dustTotal: maxNum(a.stats.dustTotal, b.stats.dustTotal),
      bestLevel: maxNum(a.stats.bestLevel, b.stats.bestLevel),
      comboMaxHits: maxNum(a.stats.comboMaxHits, b.stats.comboMaxHits),
      comboFullBest: maxNum(a.stats.comboFullBest, b.stats.comboFullBest),
      satelliteStreak: maxNum(a.stats.satelliteStreak, b.stats.satelliteStreak),
      satelliteBest: maxNum(a.stats.satelliteBest, b.stats.satelliteBest),
      respecs: maxNum(a.stats.respecs, b.stats.respecs),
      raresCaptured: maxNum(a.stats.raresCaptured, b.stats.raresCaptured),
      capturedKinds: union(a.stats.capturedKinds, b.stats.capturedKinds),
      chainBest: maxNum(a.stats.chainBest, b.stats.chainBest),
      missionsDone: maxNum(a.stats.missionsDone, b.stats.missionsDone),
      eventsSeen: union(a.stats.eventsSeen, b.stats.eventsSeen),
      genBest: maxNum(a.stats.genBest, b.stats.genBest),
      upgradesBought: maxNum(a.stats.upgradesBought, b.stats.upgradesBought),
      touchBest: maxNum(a.stats.touchBest, b.stats.touchBest),
      offers: maxNum(a.stats.offers, b.stats.offers),
      legendaryOffers: maxNum(a.stats.legendaryOffers, b.stats.legendaryOffers),
      firstOfferLegendary: maxNum(a.stats.firstOfferLegendary, b.stats.firstOfferLegendary),
      rareStreak: top.stats.rareStreak,
      rareStreakBest: maxNum(a.stats.rareStreakBest, b.stats.rareStreakBest),
      rerolls: maxNum(a.stats.rerolls, b.stats.rerolls),
      sinceLegend: maxNum(a.stats.sinceLegend, b.stats.sinceLegend),
      forbiddenBest: mergeBest(a.stats.forbiddenBest, b.stats.forbiddenBest),
      skillsUsed: union(a.stats.skillsUsed, b.stats.skillsUsed),
      skillUses: maxNum(a.stats.skillUses, b.stats.skillUses),
      dayStreakBest: maxNum(a.stats.dayStreakBest, b.stats.dayStreakBest),
    },
  };
  // Cintilas: o `legacy` maior e o gasto maior (ou o que a árvore unida custa), desde que as fontes da conta unida cubram.
  const legacy = maxNum(a.sparks.legacy, b.sparks.legacy);
  const spent = Math.max(maxNum(a.sparks.spent, b.sparks.spent), treeCost);
  if (spent <= legacy + sparkSources(save).total) {
    save.sparks = { legacy, spent };
  } else {
    save.tree = { ...top.tree };
    save.sparks = { ...top.sparks };
  }
  return { save, winner, conflict: !lifeDominated(other, top) };
}
