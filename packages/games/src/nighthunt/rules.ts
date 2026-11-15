import { UPGRADE_IDS, type UpgradeId } from './data';
import { META_SETTINGS, PLAYER_SETTINGS } from './settings';
import { NO_META, metaBonus, metaCost, type MetaLevels, type RunResult } from './world';

export interface UpgradeInfo {
  id: UpgradeId;
  name: string;
  /** Descrição curta do item (pedido do Lucas: todo item tem descrição). */
  desc: string;
  max: number;
  /** O que muda ao chegar neste nível (1 = primeira vez). */
  level(n: number): string;
  icon: string;
}

const cd = (n: number) =>
  (PLAYER_SETTINGS.haloLauncher.launcher.cooldown / n).toFixed(1).replace('.', ',');
const rg = (n: number) => (PLAYER_SETTINGS.regenerationDelay / n).toFixed(1).replace('.', ',');

export const UPGRADES: Record<UpgradeId, UpgradeInfo> = {
  weaponLength: {
    id: 'weaponLength',
    name: 'Lâmina Longa',
    desc: 'A espada gira em volta de você a cada 2 segundos. Cada nível alonga a lâmina.',
    max: 5,
    level: (n) => `Alcance da espada +1 (nível ${n}).`,
    icon: 'UI/UpgradeIcons/WeaponLength',
  },
  weaponDamage: {
    id: 'weaponDamage',
    name: 'Lâmina Afiada',
    desc: 'Cada nível aumenta o dano da espada em 1.',
    max: 10,
    level: (n) => `Dano da espada +1 (nível ${n}).`,
    icon: 'UI/UpgradeIcons/WeaponDamage',
  },
  horizontal: {
    id: 'horizontal',
    name: 'Adagas Voadoras',
    desc: 'Lança três adagas para cima a cada 4 segundos. Cada nível adiciona mais uma salva.',
    max: 6,
    level: (n) =>
      n === 1 ? 'Desbloqueia: 1 salva de 3 adagas.' : `+1 salva (${n} salvas por disparo).`,
    icon: 'UI/UpgradeIcons/HorizontalProjectile',
  },
  diagonal: {
    id: 'diagonal',
    name: 'Tiro Arcano',
    desc: 'Dispara dois tiros em diagonal para baixo a cada 4 segundos. Cada nível adiciona uma salva.',
    max: 6,
    level: (n) =>
      n === 1 ? 'Desbloqueia: 1 salva de 2 tiros.' : `+1 salva (${n} salvas por disparo).`,
    icon: 'UI/UpgradeIcons/DiagonalProjectile',
  },
  halo: {
    id: 'halo',
    name: 'Nova Ígnea',
    desc: 'Solta um anel de 20 projéteis em volta de você. Cada nível reduz o tempo de recarga.',
    max: 6,
    level: (n) =>
      n === 1 ? `Desbloqueia: anel de 20 projéteis a cada ${cd(1)} s.` : `Recarga: ${cd(n)} s.`,
    icon: 'UI/UpgradeIcons/HaloProjectile',
  },
  regeneration: {
    id: 'regeneration',
    name: 'Regeneração',
    desc: 'Recupera 1 de vida de tempos em tempos. Cada nível acelera a cura.',
    max: 6,
    level: (n) =>
      n === 1 ? `Desbloqueia: +1 de vida a cada ${rg(1)} s.` : `+1 de vida a cada ${rg(n)} s.`,
    icon: 'UI/UpgradeIcons/Regeneration',
  },
};

export type MetaKey = keyof typeof META_SETTINGS;
export interface MetaInfo {
  key: MetaKey;
  name: string;
  icon: string;
  desc(bonus: number): string;
}
export const META_LIST: readonly MetaInfo[] = [
  {
    key: 'health',
    name: 'Vida',
    icon: 'UI/MetaUpgradeIcons/Health',
    desc: (b) => `Aumenta a vida máxima em ${b}.`,
  },
  {
    key: 'overallDamage',
    name: 'Dano geral',
    icon: 'UI/MetaUpgradeIcons/OverallDamage',
    desc: (b) => `Aumenta o dano de espada e projéteis em ${String(b).replace('.', ',')}.`,
  },
  {
    key: 'projectilePiercing',
    name: 'Perfuração',
    icon: 'UI/MetaUpgradeIcons/ProjectilePiercing',
    desc: (b) => `Projéteis atravessam ${b} inimigo${b > 1 ? 's' : ''} a mais.`,
  },
  {
    key: 'movementSpeed',
    name: 'Velocidade',
    icon: 'UI/MetaUpgradeIcons/MovementSpeed',
    desc: (b) => `Aumenta a velocidade de movimento em ${b}.`,
  },
  {
    key: 'xpGatherer',
    name: 'Coletor de XP',
    icon: 'UI/MetaUpgradeIcons/XpGatherer',
    desc: (b) => `Ganha ${Math.round(b * 100)}% mais experiência.`,
  },
  {
    key: 'goldGatherer',
    name: 'Coletor de ouro',
    icon: 'UI/MetaUpgradeIcons/GoldGatherer',
    desc: (b) => `Ganha ${Math.round(b * 100)}% mais ouro ao fim da partida.`,
  },
];

/** Ouro creditado ao fim da partida: o Coletor de ouro (que no Slash não chega a valer) multiplica o total. */
export function goldWithBonus(gold: number, meta: MetaLevels): number {
  return Math.round(gold * (1 + metaBonus('goldGatherer', meta.goldGatherer)));
}

// ---------------- save e conquistas ----------------
export interface NhStats {
  runs: number;
  kills: number;
  gold: number;
  bossKills: number;
  finalBossKills: number;
  chests: number;
  magnets: number;
  bestTime: number;
  bestLevel: number;
  bestKills: number;
  noHitBest: number;
  upgradeBest: Record<UpgradeId, number>;
  metaBought: number;
}
export interface NhSave {
  v: 1;
  gold: number;
  highscore: number;
  meta: MetaLevels;
  stats: NhStats;
  /** id da conquista -> data (ms) em que foi liberada. */
  achievements: Record<string, number>;
  /** itens já vistos (Coleção). */
  seen: UpgradeId[];
  music: boolean;
  sound: boolean;
  damageNumbers: boolean;
  flashes: boolean;
}

export function emptySave(): NhSave {
  return {
    v: 1,
    gold: 0,
    highscore: 0,
    meta: { ...NO_META },
    stats: {
      runs: 0,
      kills: 0,
      gold: 0,
      bossKills: 0,
      finalBossKills: 0,
      chests: 0,
      magnets: 0,
      bestTime: 0,
      bestLevel: 0,
      bestKills: 0,
      noHitBest: 0,
      upgradeBest: {
        weaponLength: 0,
        weaponDamage: 0,
        horizontal: 0,
        diagonal: 0,
        halo: 0,
        regeneration: 0,
      },
      metaBought: 0,
    },
    achievements: {},
    seen: [],
    music: true,
    sound: true,
    damageNumbers: true,
    flashes: true,
  };
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  /** Ouro creditado ao liberar. */
  reward: number;
  icon: string;
  /** Progresso atual e meta, para a barra na tela de conquistas. */
  progress(s: NhSave): [number, number];
}

const maxUp = (id: UpgradeId) => UPGRADES[id].max;
const mk = (
  id: string,
  name: string,
  desc: string,
  reward: number,
  icon: string,
  progress: Achievement['progress'],
): Achievement => ({ id, name, desc, reward, icon, progress });
const minutes = (m: number) => m * 60;
const ICON = {
  gold: 'UI/GoldIcon',
  skull: 'UI/MetaUpgradeIcons/OverallDamage',
  heart: 'UI/MetaUpgradeIcons/Health',
  boot: 'UI/MetaUpgradeIcons/MovementSpeed',
  xp: 'UI/MetaUpgradeIcons/XpGatherer',
  gather: 'UI/MetaUpgradeIcons/GoldGatherer',
  pierce: 'UI/MetaUpgradeIcons/ProjectilePiercing',
};

export const ACHIEVEMENTS: readonly Achievement[] = [
  mk('first-blood', 'Primeiro sangue', 'Derrote seu primeiro inimigo.', 5, ICON.skull, (s) => [
    Math.min(1, s.stats.kills),
    1,
  ]),
  mk('kills-100', 'Caçador', 'Derrote 100 inimigos.', 10, ICON.skull, (s) => [
    Math.min(100, s.stats.kills),
    100,
  ]),
  mk('kills-1000', 'Exterminador', 'Derrote 1.000 inimigos.', 30, ICON.skull, (s) => [
    Math.min(1000, s.stats.kills),
    1000,
  ]),
  mk('kills-5000', 'Flagelo da noite', 'Derrote 5.000 inimigos.', 80, ICON.skull, (s) => [
    Math.min(5000, s.stats.kills),
    5000,
  ]),
  mk(
    'run-kills-300',
    'Onda de sangue',
    'Derrote 300 inimigos em uma só partida.',
    20,
    ICON.skull,
    (s) => [Math.min(300, s.stats.bestKills), 300],
  ),
  mk('time-1', 'Ainda de pé', 'Sobreviva 1 minuto.', 5, ICON.heart, (s) => [
    Math.min(60, s.stats.bestTime),
    60,
  ]),
  mk('time-3', 'Resistente', 'Sobreviva 3 minutos.', 10, ICON.heart, (s) => [
    Math.min(minutes(3), s.stats.bestTime),
    minutes(3),
  ]),
  mk('time-5', 'Veterano', 'Sobreviva 5 minutos.', 20, ICON.heart, (s) => [
    Math.min(minutes(5), s.stats.bestTime),
    minutes(5),
  ]),
  mk('time-10', 'Insone', 'Sobreviva 10 minutos.', 40, ICON.heart, (s) => [
    Math.min(minutes(10), s.stats.bestTime),
    minutes(10),
  ]),
  mk('time-15', 'Madrugada', 'Sobreviva 15 minutos.', 70, ICON.heart, (s) => [
    Math.min(minutes(15), s.stats.bestTime),
    minutes(15),
  ]),
  mk('time-20', 'Amanhecer', 'Sobreviva 20 minutos.', 120, ICON.heart, (s) => [
    Math.min(minutes(20), s.stats.bestTime),
    minutes(20),
  ]),
  mk('level-5', 'Aprendiz', 'Chegue ao nível 5.', 5, ICON.xp, (s) => [
    Math.min(5, s.stats.bestLevel),
    5,
  ]),
  mk('level-10', 'Experiente', 'Chegue ao nível 10.', 15, ICON.xp, (s) => [
    Math.min(10, s.stats.bestLevel),
    10,
  ]),
  mk(
    'level-max',
    'Lenda',
    `Chegue ao nível máximo (${PLAYER_SETTINGS.requiredXP.length + 1}).`,
    60,
    ICON.xp,
    (s) => [
      Math.min(PLAYER_SETTINGS.requiredXP.length + 1, s.stats.bestLevel),
      PLAYER_SETTINGS.requiredXP.length + 1,
    ],
  ),
  mk('gold-100', 'Bolso cheio', 'Junte 100 de ouro no total.', 5, ICON.gold, (s) => [
    Math.min(100, s.stats.gold),
    100,
  ]),
  mk('gold-500', 'Tesoureiro', 'Junte 500 de ouro no total.', 15, ICON.gold, (s) => [
    Math.min(500, s.stats.gold),
    500,
  ]),
  mk('gold-2000', 'Dragão', 'Junte 2.000 de ouro no total.', 50, ICON.gold, (s) => [
    Math.min(2000, s.stats.gold),
    2000,
  ]),
  mk('chest-1', 'Primeiro baú', 'Abra um baú.', 10, 'Drops/Chest00', (s) => [
    Math.min(1, s.stats.chests),
    1,
  ]),
  mk('chest-10', 'Saqueador', 'Abra 10 baús.', 40, 'Drops/Chest00', (s) => [
    Math.min(10, s.stats.chests),
    10,
  ]),
  mk('magnet-5', 'Atração fatal', 'Pegue 5 ímãs.', 15, ICON.pierce, (s) => [
    Math.min(5, s.stats.magnets),
    5,
  ]),
  mk('boss-1', 'Caça-chefes', 'Derrote um chefe.', 15, ICON.skull, (s) => [
    Math.min(1, s.stats.bossKills),
    1,
  ]),
  mk('boss-10', 'Quebra-trono', 'Derrote 10 chefes.', 60, ICON.skull, (s) => [
    Math.min(10, s.stats.bossKills),
    10,
  ]),
  mk('final-boss', 'Rei da noite', 'Derrote o chefe final.', 200, ICON.skull, (s) => [
    Math.min(1, s.stats.finalBossKills),
    1,
  ]),
  mk(
    'sword-long',
    'Alcance total',
    'Leve a Lâmina Longa ao nível máximo.',
    25,
    UPGRADES.weaponLength.icon,
    (s) => [s.stats.upgradeBest.weaponLength, maxUp('weaponLength')],
  ),
  mk(
    'sword-sharp',
    'Gume perfeito',
    'Leve a Lâmina Afiada ao nível 10.',
    40,
    UPGRADES.weaponDamage.icon,
    (s) => [s.stats.upgradeBest.weaponDamage, maxUp('weaponDamage')],
  ),
  mk(
    'daggers',
    'Chuva de adagas',
    'Leve as Adagas Voadoras ao nível máximo.',
    35,
    UPGRADES.horizontal.icon,
    (s) => [s.stats.upgradeBest.horizontal, maxUp('horizontal')],
  ),
  mk(
    'arcane',
    'Arcanista',
    'Leve o Tiro Arcano ao nível máximo.',
    35,
    UPGRADES.diagonal.icon,
    (s) => [s.stats.upgradeBest.diagonal, maxUp('diagonal')],
  ),
  mk('nova', 'Supernova', 'Leve a Nova Ígnea ao nível máximo.', 35, UPGRADES.halo.icon, (s) => [
    s.stats.upgradeBest.halo,
    maxUp('halo'),
  ]),
  mk(
    'regen',
    'Imortal (quase)',
    'Leve a Regeneração ao nível máximo.',
    35,
    UPGRADES.regeneration.icon,
    (s) => [s.stats.upgradeBest.regeneration, maxUp('regeneration')],
  ),
  mk('untouched', 'Intocável', 'Sobreviva 2 minutos sem tomar dano.', 30, ICON.heart, (s) => [
    Math.min(120, s.stats.noHitBest),
    120,
  ]),
  mk(
    'first-upgrade',
    'Primeira melhoria',
    'Compre uma melhoria permanente.',
    10,
    ICON.gather,
    (s) => [Math.min(1, s.stats.metaBought), 1],
  ),
  mk('shopper', 'Cliente fiel', 'Compre 6 melhorias permanentes.', 40, ICON.gather, (s) => [
    Math.min(6, s.stats.metaBought),
    6,
  ]),
];

/** Aplica o resultado de uma partida no save e devolve as conquistas liberadas (com o ouro do prêmio já somado). */
export function applyRun(
  save: NhSave,
  r: RunResult,
  now = 0,
): { unlocked: Achievement[]; goldGained: number } {
  const st = save.stats;
  const gained = goldWithBonus(r.gold, save.meta);
  save.gold += gained;
  save.highscore = Math.max(save.highscore, r.score);
  st.runs++;
  st.kills += r.kills;
  st.gold += gained;
  st.bossKills += r.bossKills;
  st.finalBossKills += r.finalBossKills;
  st.chests += r.chests;
  st.magnets += r.magnets;
  st.bestTime = Math.max(st.bestTime, r.score);
  st.bestLevel = Math.max(st.bestLevel, r.level + 1);
  st.bestKills = Math.max(st.bestKills, r.kills);
  if (r.damageTaken === 0) st.noHitBest = Math.max(st.noHitBest, r.score);
  for (const id of UPGRADE_IDS) {
    const lv = r.upgrades[id] ?? 0;
    st.upgradeBest[id] = Math.max(st.upgradeBest[id], lv);
    if (lv > 0 && !save.seen.includes(id)) save.seen.push(id);
  }
  return { unlocked: checkAchievements(save, now), goldGained: gained };
}

export function checkAchievements(save: NhSave, now = 0): Achievement[] {
  const out: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id] !== undefined) continue;
    const [v, goal] = a.progress(save);
    if (v >= goal) {
      save.achievements[a.id] = now || 1;
      save.gold += a.reward;
      out.push(a);
    }
  }
  return out;
}

/** Compra o próximo nível de uma melhoria permanente. Devolve false se faltar ouro ou se já estiver no máximo. */
export function buyMeta(save: NhSave, key: MetaKey): boolean {
  const lv = save.meta[key];
  const cost = metaCost(key, lv);
  if (cost === null || save.gold < cost) return false;
  save.gold -= cost;
  save.meta[key] = lv + 1;
  save.stats.metaBought++;
  return true;
}
