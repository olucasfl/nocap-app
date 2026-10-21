// Validação e junção de saves do Aperta! (spec 038, seção 10). Funções puras: o servidor usa as
// mesmas que o aparelho, então um save que passa num lado passa no outro.
//
// Dois tipos de problema: o que é IMPOSSÍVEL (formato, id fora do catálogo, gasto maior que o
// ganho, conteúdo de colapso futuro) recusa o save inteiro; o que é só rápido demais (tempo jogado
// maior que o tempo desde a criação, poeira acima do ritmo possível) corta ao valor possível e
// marca `flagged`, sem banir ninguém (seção 10.3).

import { z } from 'zod';
import { GRIMOIRES, OBJECTS, OBJECT_REWARD, REGIONS, TREE, TREE_COSTS, UPGRADES, grimoireById, type ObjectKind } from './catalog';
import {
  COMBO_BONUS_PER_POINT,
  COMBO_HARD_CAP,
  COST_FLOOR,
  GRIMOIRE_MAX_LEVEL,
  MAX_NUMBER,
  MAX_TOUCHES_PER_SEC,
  MISSION_FRAGMENTS,
  atlasSlots,
  energyCap,
  upgradeCost,
} from './economy';
import { eventsOpen, mechanicOpen, missionById } from './content';
import { SAVE_VERSION, effectiveStats, type SaveState } from './engine';
import { TUTORIAL_DUST_ALLOWANCE } from './tutorial';

/** Tamanho máximo do save em JSON (o real fica em poucos KB). */
export const MAX_SAVE_BYTES = 64 * 1024;
const MAX_COLLAPSES = 1000;
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

const EVENT_IDS = ['meteor-shower', 'solar-storm'] as const;
const OBJECT_KINDS = OBJECTS.map((o) => o.kind) as [ObjectKind, ...ObjectKind[]];

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
  boostUntil: stamp,
  boostMult: z.number().finite().min(1).max(1000),
  afterCapture: z.boolean(),
  objects: z
    .array(
      z.object({
        id: int(Number.MAX_SAFE_INTEGER),
        kind: z.enum(OBJECT_KINDS),
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
    })
    .nullable(),
  rngState: z.number().int().min(-2147483648).max(4294967295),
  lastGain: nonNeg,
  // Campos da etapa 12: saves antigos não os têm, então entram com o valor de "nada ainda".
  event: z.object({ id: z.enum(EVENT_IDS), until: stamp }).nullable().default(null),
  nextEventAt: stamp.nullable().default(null),
  mission: z
    .object({ id: id, progress: int(1e6), done: z.boolean() })
    .nullable()
    .default(null),
});

const saveSchema = z.object({
  version: z.number().int().min(1).max(SAVE_VERSION),
  name: z.string().trim().min(1).max(40),
  createdAt: nonNeg,
  playSeconds: z.number().finite().min(0).max(MAX_PLAY_SECONDS),
  clock: stamp,
  tutorial: z.union([z.literal('done'), z.number().int().min(1).max(MAX_TUTORIAL_STEP)]),
  storySeen: z.boolean(),
  run: runSchema,
  album: z.array(id).max(GRIMOIRES.length),
  atlas: z.object({
    slots: int(20),
    pages: z.array(z.object({ grimoireId: id, level: z.number().int().min(1).max(GRIMOIRE_MAX_LEVEL) })).max(20),
  }),
  collapses: int(MAX_COLLAPSES),
  regionId: id,
  favorite: id.nullable().default(null),
  seenUnlocks: z.array(id).max(MAX_SEEN_UNLOCKS),
  fragments: z.object({ earned: int(1e9), spent: int(1e9) }),
  tree: z.record(id, z.number().int().min(0).max(TREE_COSTS.length)),
  achievements: z.array(id).max(MAX_ACHIEVEMENTS),
  stats: z.object({
    clicks: int(Number.MAX_SAFE_INTEGER),
    objectsCaptured: int(Number.MAX_SAFE_INTEGER),
    picks: int(MAX_PICKS * 100),
    dustTotal: nonNeg,
  }),
});

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

/** Teto de poeira por segundo de jogo para o que está comprado: 12 toques/s com tudo no máximo, mais objetos. */
function dustPerSecondCeiling(save: SaveState): number {
  const s = effectiveStats(save);
  const comboMult = (1 + COMBO_BONUS_PER_POINT * s.combo.max) * (1 + s.combo.fullDustPct / 100);
  const nthMult = s.nth.reduce((m, r) => m * Math.max(1, r.mult), 1);
  const burst = Math.max(1, s.objects.afterCaptureMult) * Math.max(1, s.objects.signalMult);
  const perTouch = Math.max(1, s.dustPerTouch) * comboMult * nthMult * burst;
  const maxValue = Math.max(...Object.values(s.objects.valueMult), 1);
  const objects = s.objects.disabled
    ? 0
    : (1 / Math.max(0.5, s.objects.intervalSec)) * s.dustPerTouch * OBJECT_REWARD.cometTouches * maxValue;
  return MAX_TOUCHES_PER_SEC * perTouch + objects;
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

  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || 'save'}: ${i.message}`);
    return { ok: false, errors };
  }
  // O zod devolve uma cópia profunda (e descarta chaves desconhecidas): daqui para frente pode-se alterar.
  const save = parsed.data as unknown as SaveState;
  const errors: string[] = [];
  const flagged: string[] = [];
  const c = save.collapses;
  const run = save.run;

  // Conteúdo: só do catálogo e só de colapso já alcançado.
  if (!noDupes(save.album) || !noDupes(save.achievements) || !noDupes(save.seenUnlocks)) errors.push('Lista com itens repetidos');
  for (const gid of save.album) if (!grimoireById(gid)) errors.push(`Grimório desconhecido no álbum: ${gid}`);
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
    const def = OBJECTS.find((d) => d.kind === o.kind);
    if (!def || def.unlockedAtCollapse > c) errors.push(`Objeto de colapso futuro: ${o.kind}`);
  }
  if (!noDupes(run.objects.map((o) => String(o.id)))) errors.push('Objetos repetidos');
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
  if (Object.keys(run.build).length > run.picks) errors.push('Mais grimórios do que escolhas');
  if (levels.reduce((a, b) => a + b, 0) > run.picks * MAX_LEVELS_PER_PICK) errors.push('Níveis demais para as escolhas');
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
    if (def.unlockedAtCollapse > c) errors.push(`Melhoria de colapso futuro: ${def.id}`);
    if (def.requiresPicks !== undefined && run.picks < def.requiresPicks) errors.push(`Melhoria trancada: ${def.id}`);
    if (def.requiresUpgrade) {
      const need = UPGRADES.findIndex((u) => u.id === def.requiresUpgrade?.id);
      if ((run.upgradeLevels[need] ?? 0) < def.requiresUpgrade.level) errors.push(`Melhoria trancada: ${def.id}`);
    }
    for (let l = 0; l < Math.min(lvl, def.max); l++) spent += upgradeCost(def, l, COST_FLOOR);
  });
  if (spent > run.dustLife * TOLERANCE + 1) errors.push('Melhorias custam mais que a poeira ganha');
  if (run.dust > run.dustLife * TOLERANCE + 1) errors.push('Poeira maior que a ganha na vida');
  if (run.dustLife > save.stats.dustTotal * TOLERANCE + 1) errors.push('Poeira da vida maior que o total');

  // Atlas.
  const slots = atlasSlots(c);
  if (save.atlas.slots !== slots) errors.push('Espaços do Atlas não batem com os colapsos');
  if (save.atlas.pages.length > slots) errors.push('Páginas demais no Atlas');
  if (save.atlas.pages.length > c) errors.push('Páginas no Atlas sem colapso');
  if (!noDupes(save.atlas.pages.map((p) => p.grimoireId))) errors.push('Página repetida no Atlas');
  for (const p of save.atlas.pages) {
    const g = grimoireById(p.grimoireId);
    if (!g || g.unlockedAtCollapse > c) errors.push(`Página inválida: ${p.grimoireId}`);
    else if (!save.album.includes(p.grimoireId)) errors.push(`Página fora do álbum: ${p.grimoireId}`);
  }

  // Fragmentos e árvore.
  const { earned, spent: fragSpent } = save.fragments;
  if (fragSpent > earned) errors.push('Fragmentos gastos maiores que os ganhos');
  let minEarned = 0;
  let maxEarned = 0;
  const bonusCap = Math.max(0, Math.floor(Math.log10(Math.max(1, save.stats.dustTotal / 2e6))));
  for (let k = 1; k <= c; k++) {
    minEarned += 3 + k;
    maxEarned += 3 + k + bonusCap + (mechanicOpen('missions', k - 1) ? MISSION_FRAGMENTS : 0);
  }
  if (earned < minEarned || earned > maxEarned) errors.push('Fragmentos não batem com os colapsos');
  let treeCost = 0;
  for (const [branch, lvl] of Object.entries(save.tree)) {
    if (!TREE.some((b) => b.id === branch)) errors.push(`Ramo desconhecido: ${branch}`);
    for (let l = 1; l <= lvl; l++) treeCost += TREE_COSTS[l - 1] ?? 0;
  }
  if (Object.keys(save.tree).length > 0 && c < 1) errors.push('Árvore antes do 1º colapso');
  if (treeCost > fragSpent) errors.push('Árvore custa mais que os Fragmentos gastos');
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
  const ceiling = dustPerSecondCeiling(save) * save.playSeconds + effectiveStats(save).startDust + 1000 + TUTORIAL_DUST_ALLOWANCE;
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

  const slots = atlasSlots(top.collapses);
  const pages = top.atlas.pages.map((p) => ({ ...p }));
  for (const p of [...other.atlas.pages].sort((x, y) => y.level - x.level)) {
    const have = pages.find((q) => q.grimoireId === p.grimoireId);
    if (have) have.level = maxNum(have.level, p.level);
    else if (pages.length < slots) pages.push({ ...p });
  }

  // Árvore: máximo por ramo, só se os Fragmentos gastos cobrem; senão fica a da vencedora.
  const earned = maxNum(top.fragments.earned, other.fragments.earned);
  const tree: Record<string, number> = { ...top.tree };
  for (const [branch, lvl] of Object.entries(other.tree)) tree[branch] = maxNum(tree[branch] ?? 0, lvl);
  const treeCost = Object.values(tree).reduce((sum, lvl) => {
    let cost = 0;
    for (let l = 1; l <= lvl; l++) cost += TREE_COSTS[l - 1] ?? 0;
    return sum + cost;
  }, 0);
  const spentMax = maxNum(top.fragments.spent, other.fragments.spent);
  const fitsTree = Math.max(spentMax, treeCost) <= earned;
  const fragments = fitsTree ? { earned, spent: Math.max(spentMax, treeCost) } : { ...top.fragments };

  const tutorial =
    top.tutorial === 'done' || other.tutorial === 'done' ? 'done' : Math.max(top.tutorial, other.tutorial);

  const createdAts = [a.createdAt, b.createdAt].filter((t) => t > 0);
  const save: SaveState = {
    ...top,
    createdAt: createdAts.length > 0 ? Math.min(...createdAts) : top.createdAt,
    playSeconds: maxNum(a.playSeconds, b.playSeconds),
    tutorial,
    storySeen: a.storySeen || b.storySeen,
    album: union(top.album, other.album),
    atlas: { slots, pages },
    seenUnlocks: union(top.seenUnlocks, other.seenUnlocks),
    fragments,
    tree: fitsTree ? tree : { ...top.tree },
    achievements: union(top.achievements, other.achievements),
    stats: {
      clicks: maxNum(a.stats.clicks, b.stats.clicks),
      objectsCaptured: maxNum(a.stats.objectsCaptured, b.stats.objectsCaptured),
      picks: maxNum(a.stats.picks, b.stats.picks),
      dustTotal: maxNum(a.stats.dustTotal, b.stats.dustTotal),
    },
  };
  return { save, winner, conflict: !lifeDominated(other, top) };
}
