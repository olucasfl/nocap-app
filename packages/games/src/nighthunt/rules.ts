import {
  EVOLUTIONS,
  HEROES,
  HERO_IDS,
  MAPS,
  MAP_IDS,
  UPGRADE_IDS,
  type EvoId,
  type UpgradeId,
} from './data';
import { META_SETTINGS, PLAYER_SETTINGS } from './settings';
import { EXTRA_META, NO_META, metaBonus, metaCost, type MetaLevels, type RunResult } from './world';

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

/** Passivos globais que NÃO afetam a arma (linha "Ignora: ..." da carta). */
export const IGNORES: Partial<Record<UpgradeId, UpgradeId[]>> = {
  whip: ['swift'],
  garlic: ['swift', 'tome'],
  magma: ['swift'],
  pentagram: ['swift', 'duration'],
  sword: ['swift', 'duration'],
};
export const ignoresText = (id: UpgradeId): string =>
  (IGNORES[id] ?? []).map((u) => UPGRADES[u].name).join(', ');

export const UPGRADES: Record<UpgradeId, UpgradeInfo> = {
  whip: {
    id: 'whip',
    name: 'Chicote',
    desc: 'Estala para a frente e para trás, em linha larga. Cada nível acrescenta mais um corte em sequência.',
    max: 6,
    level: (n) =>
      n === 1
        ? 'Desbloqueia: dois cortes (frente e trás).'
        : [
            '',
            'Dano +30%.',
            '+1 corte.',
            'Dano +30%.',
            '+1 corte.',
            '+1 corte e golpe mais longo.',
          ][n - 1]!,
    icon: 'X/whip',
  },
  wand: {
    id: 'wand',
    name: 'Varinha Arcana',
    desc: 'Escolhe sozinha inimigos aleatórios por perto e dispara um projétil rápido em cada um.',
    max: 6,
    level: (n) =>
      n === 1
        ? 'Desbloqueia: 1 projétil por salva.'
        : [
            '',
            '+1 projétil.',
            'Recarga -15%.',
            '+1 projétil.',
            'Dano +40%.',
            '+1 projétil e atravessa 1 inimigo.',
          ][n - 1]!,
    icon: 'X/wand',
  },
  garlic: {
    id: 'garlic',
    name: 'Aura de Alho',
    desc: 'Um círculo em volta de você que fere e empurra todos que estiverem dentro, o tempo todo.',
    max: 6,
    level: (n) =>
      n === 1
        ? 'Desbloqueia: aura de raio 70.'
        : [
            '',
            'Raio +10%.',
            'Raio +15%.',
            'Dano +50%.',
            'Raio +20%.',
            'Empurrão forte e golpes mais rápidos.',
          ][n - 1]!,
    icon: 'X/garlic',
  },
  magma: {
    id: 'magma',
    name: 'Poças de Magma',
    desc: 'Frascos de magma criam poças que queimam quem pisar nelas por alguns segundos.',
    max: 6,
    level: (n) =>
      n === 1
        ? 'Desbloqueia: 1 poça por vez.'
        : ['', 'Área +30%.', '+1 poça.', 'Dano +40%.', 'Duração +25%.', '+1 poça.'][n - 1]!,
    icon: 'X/magma',
  },
  embers: {
    id: 'embers',
    name: 'Círculo de Brasas',
    desc: 'Um anel de bolas de fogo nasce em volta de você, gira por alguns segundos e some.',
    max: 6,
    level: (n) =>
      n === 1
        ? 'Desbloqueia: 3 bolas de fogo.'
        : ['', '+1 bola.', 'Dano +30%.', '+1 bola.', 'Duração +25%.', '+2 bolas.'][n - 1]!,
    icon: 'X/embers',
  },
  cross: {
    id: 'cross',
    name: 'Cruz',
    desc: 'Lança uma cruz que vai, desacelera, volta e atravessa tudo no caminho, nos dois sentidos.',
    max: 6,
    level: (n) =>
      n === 1
        ? 'Desbloqueia: 1 cruz.'
        : ['', 'Velocidade +20%.', '+1 cruz.', 'Dano +40%.', 'Tamanho +25%.', '+1 cruz.'][n - 1]!,
    icon: 'X/cross',
  },
  bone: {
    id: 'bone',
    name: 'Osso',
    desc: 'Arremessa um osso que, ao acertar, quica para o inimigo mais perto.',
    max: 6,
    level: (n) =>
      n === 1
        ? 'Desbloqueia: 1 osso, 2 quicadas.'
        : ['', 'Dano +25%.', '+1 osso.', '+1 quicada.', 'Dano +30%.', '+1 osso e +1 quicada.'][
            n - 1
          ]!,
    icon: 'X/bone',
  },
  runes: {
    id: 'runes',
    name: 'Rastreador de Runas',
    desc: 'Esferas de runa ricocheteiam nas bordas da tela e atravessam os inimigos.',
    max: 6,
    level: (n) =>
      n === 1
        ? 'Desbloqueia: 1 esfera.'
        : ['', 'Velocidade +20%.', '+1 esfera.', 'Duração +25%.', 'Dano +40%.', '+1 esfera.'][
            n - 1
          ]!,
    icon: 'X/runes',
  },
  pentagram: {
    id: 'pentagram',
    name: 'Pentagrama',
    desc: 'De tempos em tempos varre a tela: dano grande em todos os inimigos. A recarga é sorteada a cada uso, entre 40 e 80 segundos.',
    max: 6,
    level: (n) =>
      n === 1
        ? 'Desbloqueia: dano 15 a cada 40 a 80 s (sorteado).'
        : [
            '',
            'Recarga -5%.',
            'Dano +30%.',
            'Recarga -5%.',
            'Dano +30%.',
            'Alcance x2 e recarga -5%.',
          ][n - 1]!,
    icon: 'X/pentagram',
  },
  bomb: {
    id: 'bomb',
    name: 'Bomba de Cereja',
    desc: 'Lança uma bomba que quica pelo chão, explode em área e solta estilhaços.',
    max: 6,
    level: (n) =>
      n === 1
        ? 'Desbloqueia: 1 bomba.'
        : ['', 'Raio +20%.', '+1 bomba.', 'Dano +40%.', '+2 estilhaços.', '+1 bomba.'][n - 1]!,
    icon: 'X/bomb',
  },
  duration: {
    id: 'duration',
    name: 'Duração',
    desc: 'Poças, anéis, bumerangues e esferas duram mais tempo.',
    max: 5,
    level: (n) => `Duração de tudo +${n * 15}% (nível ${n}).`,
    icon: 'X/duration',
  },
  amount: {
    id: 'amount',
    name: 'Quantidade',
    desc: 'Mais um projétil, bomba, corte ou bola de fogo nas armas que têm quantidade. Raro.',
    max: 2,
    level: (n) => `+${n} em tudo que tem quantidade (nível ${n}).`,
    icon: 'X/amount',
  },
  curse: {
    id: 'curse',
    name: 'Maldição',
    desc: 'Inimigos mais fortes e rápidos, mas você ganha mais XP e mais ouro. Para quem quer risco.',
    max: 5,
    level: (n) =>
      `Inimigos +${n * 8}% de vida e +${n * 5}% de velocidade; XP e ouro +${n * 10}% (nível ${n}).`,
    icon: 'X/curse',
  },
  sword: {
    id: 'sword',
    name: 'Espada',
    desc: 'Gira em volta de você a cada 2 segundos. Cada nível alonga a lâmina e aumenta o dano.',
    max: 6,
    level: (n) =>
      n === 1 ? 'A espada que todo caçador leva.' : `Dano +1 e lâmina mais longa (nível ${n}).`,
    icon: 'UI/UpgradeIcons/WeaponLength',
  },
  weaponDamage: {
    id: 'weaponDamage',
    name: 'Poder',
    desc: 'Aumenta o dano de todas as suas armas, na mesma proporção.',
    max: 5,
    level: (n) => `Dano de tudo +${n * 12}% (nível ${n}).`,
    icon: 'UI/UpgradeIcons/WeaponDamage',
  },
  weaponLength: {
    id: 'weaponLength',
    name: 'Alcance',
    desc: 'Aumenta o tamanho e o alcance de todas as suas armas: espada, tiros, orbes e raios.',
    max: 5,
    level: (n) => `Alcance de tudo +${n * 10}% (nível ${n}).`,
    icon: 'X/area',
  },
  growth: {
    id: 'growth',
    name: 'Sabedoria',
    desc: 'Você ganha mais experiência de cada cristal.',
    max: 5,
    level: (n) => `XP ganho +${n * 8}% (nível ${n}).`,
    icon: 'X/growth',
  },
  greed: {
    id: 'greed',
    name: 'Ganância',
    desc: 'Inimigos e objetos soltam mais ouro.',
    max: 5,
    level: (n) => `Ouro ganho +${n * 10}% (nível ${n}).`,
    icon: 'X/greed',
  },
  swift: {
    id: 'swift',
    name: 'Ligeireza',
    desc: 'Todos os seus projéteis e os orbes se movem mais rápido.',
    max: 5,
    level: (n) => `Velocidade dos projéteis +${n * 10}% (nível ${n}).`,
    icon: 'X/swift',
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
  axe: {
    id: 'axe',
    name: 'Machado Giratório',
    desc: 'Arremessa machados para cima em arco. Eles caem girando e atravessam quem estiver no caminho.',
    max: 6,
    level: (n) =>
      n === 1
        ? 'Desbloqueia: 1 machado a cada 2,8 s.'
        : `Dano +1${n % 2 === 1 ? ' e +1 machado' : ''}.`,
    icon: 'UI/UpgradeIcons/ThrowAxe',
  },
  orbit: {
    id: 'orbit',
    name: 'Orbes Guardiões',
    desc: 'Orbes giram em volta de você o tempo todo e ferem quem encostar. Cada nível adiciona um orbe.',
    max: 6,
    level: (n) =>
      n === 1
        ? 'Desbloqueia: 2 orbes em órbita.'
        : `+1 orbe, mais dano e giro mais rápido (${n + 1} orbes).`,
    icon: 'X/orbit',
  },
  lightning: {
    id: 'lightning',
    name: 'Raio Lunar',
    desc: 'Raios caem do céu sobre inimigos aleatórios da tela, com dano alto.',
    max: 6,
    level: (n) =>
      n === 1 ? 'Desbloqueia: 1 raio a cada 2,4 s.' : `Dano +2${n % 2 === 0 ? ' e +1 raio' : ''}.`,
    icon: 'X/lightning',
  },
  armor: {
    id: 'armor',
    name: 'Armadura',
    desc: 'Reduz em 1 o dano de cada golpe que você recebe (mínimo 1).',
    max: 5,
    level: (n) => `Dano recebido -${n}.`,
    icon: 'X/armor',
  },
  boots: {
    id: 'boots',
    name: 'Botas de Caçador',
    desc: 'Você se move mais rápido.',
    max: 5,
    level: (n) => `Velocidade +${n * 8}%.`,
    icon: 'UI/MetaUpgradeIcons/MovementSpeed',
  },
  magnet: {
    id: 'magnet',
    name: 'Pedra Atrativa',
    desc: 'Puxa cristais e moedas que estiverem por perto, sem precisar tocar neles.',
    max: 5,
    level: (n) => `Alcance de atração ${40 + n * 38} px.`,
    icon: 'X/magnet',
  },
  heart: {
    id: 'heart',
    name: 'Amuleto Vital',
    desc: 'Aumenta a vida máxima e cura a diferença na hora.',
    max: 5,
    level: (n) => `Vida máxima +${n * 20}%.`,
    icon: 'UI/MetaUpgradeIcons/Health',
  },
  clover: {
    id: 'clover',
    name: 'Trevo da Lua',
    desc: 'Sorte: chance de aparecer uma quarta opção ao subir de nível.',
    max: 5,
    level: (n) => `${n * 10}% de chance de 4 opções.`,
    icon: 'X/clover',
  },
  tome: {
    id: 'tome',
    name: 'Diário de Caça',
    desc: 'Todas as armas recarregam mais rápido.',
    max: 5,
    level: (n) => `Recarga ${n * 8}% menor.`,
    icon: 'X/tome',
  },
};

export type MetaKey = keyof typeof META_SETTINGS | keyof typeof EXTRA_META;
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
  {
    key: 'reroll',
    name: 'Reroll',
    icon: 'X/reroll',
    desc: (b) => `+${b} reroll por partida: sorteia de novo as opções ao subir de nível.`,
  },
  {
    key: 'skip',
    name: 'Pular',
    icon: 'X/skip',
    desc: (b) => `+${b} pulo por partida: fecha a janela de nível e rende 5 de ouro.`,
  },
  {
    key: 'banish',
    name: 'Banir',
    icon: 'X/banish',
    desc: (b) => `+${b} banimento por partida: tira um item do jogo até o fim da partida.`,
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
  evolutions: EvoId[];
  heroRuns: Record<string, number>;
  heroBestTime: Record<string, number>;
  mapBestTime: Record<string, number>;
  banishes: number;
  rerolls: number;
  /** Mapas concluídos (id -> quando, ms): matar o chefe final libera o modo infinito do mapa. */
  mapsDone: Record<string, number>;
  /** Recordes do modo infinito por mapa. */
  mapRecords: Record<string, { t: number; kills: number; level: number }>;
  /** Bestiário: por inimigo, abates + 1 (ausente = nunca visto; 1 = visto, nenhum abate). */
  bestiary: Record<string, number>;
}
/** Partida guardada com "Sair e salvar" (a conta guarda junto com o resto do save). */
export interface SavedRun {
  /** Quando foi guardada (ms). */
  at: number;
  hero: string;
  map: string;
  /** Tempo de jogo (s), nível e abates, para mostrar na tela inicial. */
  t: number;
  level: number;
  kills: number;
  /** Texto de `NhWorld.snapshot()`. */
  snap: string;
}
/**
 * Geração do save. Subir este número zera o progresso de todo mundo: o aparelho descarta saves de outra geração e o
 * servidor (prefs.controller, `NH_EPOCH`) ignora e substitui o que a conta tinha. Zerado em 16/11/2026 (pedido do Lucas).
 */
export const NH_EPOCH = 2;

export interface NhSave {
  v: 1;
  /** Geração do save (`NH_EPOCH`). */
  epoch: number;
  /** Sobe a cada gravação; a conta guarda o save de maior `rev` (ver prefs.controller). */
  rev: number;
  gold: number;
  highscore: number;
  meta: MetaLevels;
  stats: NhStats;
  /** id da conquista -> data (ms) em que foi liberada. */
  achievements: Record<string, number>;
  /** itens já vistos (Coleção). */
  seen: UpgradeId[];
  /** Heróis comprados com ouro e escolhas da última partida. */
  heroes: string[];
  pick: { hero: string; map: string; infinite?: boolean };
  /** Partida em andamento guardada para continuar depois (uma só). */
  run?: SavedRun | null;
  music: boolean;
  sound: boolean;
  damageNumbers: boolean;
  flashes: boolean;
  /** Mostra o círculo do alcance de coleta e de atração em volta do personagem. */
  showRange?: boolean;
}

export function emptySave(): NhSave {
  return {
    v: 1,
    epoch: NH_EPOCH,
    rev: 0,
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
      upgradeBest: Object.fromEntries(UPGRADE_IDS.map((u) => [u, 0])) as Record<UpgradeId, number>,
      metaBought: 0,
      evolutions: [],
      heroRuns: {},
      heroBestTime: {},
      mapBestTime: {},
      banishes: 0,
      rerolls: 0,
      mapsDone: {},
      mapRecords: {},
      bestiary: {},
    },
    achievements: {},
    seen: [],
    heroes: ['kael'],
    pick: { hero: 'kael', map: 'campo' },
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
  mk('level-max', 'Lenda', 'Chegue ao nível 40.', 60, ICON.xp, (s) => [
    Math.min(40, s.stats.bestLevel),
    40,
  ]),
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
    'win-campo',
    'Senhor do Campo',
    'Conclua o Campo Verde derrotando o chefe final.',
    150,
    ICON.skull,
    (s) => [s.stats.mapsDone.campo ? 1 : 0, 1],
  ),
  mk(
    'win-deserto',
    'Senhor das Areias',
    'Conclua o Deserto Seco derrotando o Dragão Dourado.',
    250,
    ICON.skull,
    (s) => [s.stats.mapsDone.deserto ? 1 : 0, 1],
  ),
  mk(
    'sword-long',
    'Espada lendária',
    'Leve a Espada ao nível máximo.',
    25,
    UPGRADES.sword.icon,
    (s) => [s.stats.upgradeBest.sword, maxUp('sword')],
  ),
  mk(
    'sword-sharp',
    'Gume perfeito',
    'Leve o Poder ao nível máximo.',
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
  mk('evo-1', 'Primeira evolução', 'Evolua uma arma em um baú.', 40, 'X/evolve', (s) => [
    Math.min(1, s.stats.evolutions.length),
    1,
  ]),
  mk('evo-4', 'Forjador', 'Evolua 4 armas diferentes.', 90, 'X/evolve', (s) => [
    Math.min(4, s.stats.evolutions.length),
    4,
  ]),
  mk('evo-all', 'Mestre das lendas', 'Evolua todas as 7 armas.', 250, 'X/evolve', (s) => [
    s.stats.evolutions.length,
    EVOLUTIONS.length,
  ]),
  mk(
    'axe-max',
    'Chuva de aço',
    'Leve o Machado Giratório ao nível máximo.',
    35,
    UPGRADES.axe.icon,
    (s) => [s.stats.upgradeBest.axe, maxUp('axe')],
  ),
  mk(
    'orbit-max',
    'Satélites',
    'Leve os Orbes Guardiões ao nível máximo.',
    35,
    UPGRADES.orbit.icon,
    (s) => [s.stats.upgradeBest.orbit, maxUp('orbit')],
  ),
  mk(
    'lightning-max',
    'Senhor da tempestade',
    'Leve o Raio Lunar ao nível máximo.',
    35,
    UPGRADES.lightning.icon,
    (s) => [s.stats.upgradeBest.lightning, maxUp('lightning')],
  ),
  mk('armor-max', 'Muralha', 'Leve a Armadura ao nível máximo.', 30, UPGRADES.armor.icon, (s) => [
    s.stats.upgradeBest.armor,
    maxUp('armor'),
  ]),
  mk(
    'clover-max',
    'Sortudo',
    'Leve o Trevo da Lua ao nível máximo.',
    30,
    UPGRADES.clover.icon,
    (s) => [s.stats.upgradeBest.clover, maxUp('clover')],
  ),
  mk('banish-1', 'Sem essa', 'Bana um item em uma partida.', 10, 'X/banish', (s) => [
    Math.min(1, s.stats.banishes),
    1,
  ]),
  mk('reroll-10', 'Indeciso', 'Use 10 rerolls no total.', 20, 'X/reroll', (s) => [
    Math.min(10, s.stats.rerolls),
    10,
  ]),
  mk('hero-buy', 'Novo companheiro', 'Libere um herói novo com ouro.', 20, ICON.gather, (s) => [
    Math.min(2, s.heroes.length),
    2,
  ]),
  mk('hero-all', 'Esquadrão completo', 'Libere todos os heróis.', 100, ICON.gather, (s) => [
    s.heroes.length,
    HERO_IDS.length,
  ]),
  mk(
    'mara-5',
    'Velocista',
    'Sobreviva 5 minutos com Mara.',
    40,
    'UI/UpgradeIcons/HorizontalProjectile',
    (s) => [Math.min(300, s.stats.heroBestTime.mara ?? 0), 300],
  ),
  mk('brann-5', 'Fortaleza', 'Sobreviva 5 minutos com Brann.', 40, UPGRADES.orbit.icon, (s) => [
    Math.min(300, s.stats.heroBestTime.brann ?? 0),
    300,
  ]),
  mk(
    'ysolde-5',
    'Tempestade viva',
    'Sobreviva 5 minutos com Ysolde.',
    40,
    UPGRADES.lightning.icon,
    (s) => [Math.min(300, s.stats.heroBestTime.ysolde ?? 0), 300],
  ),
  mk('rurik-5', 'Lenhador', 'Sobreviva 5 minutos com Rurik.', 40, UPGRADES.axe.icon, (s) => [
    Math.min(300, s.stats.heroBestTime.rurik ?? 0),
    300,
  ]),
  mk(
    'map-deserto',
    'Sede de areia',
    'Sobreviva 5 minutos no Deserto Seco.',
    50,
    ICON.gather,
    (s) => [Math.min(300, s.stats.mapBestTime.deserto ?? 0), 300],
  ),
  mk('map-gelo', 'Sangue frio', 'Sobreviva 5 minutos na Planície Gelada.', 50, ICON.gather, (s) => [
    Math.min(300, s.stats.mapBestTime.gelo ?? 0),
    300,
  ]),
  mk('runs-10', 'Rotina noturna', 'Jogue 10 partidas.', 25, ICON.heart, (s) => [
    Math.min(10, s.stats.runs),
    10,
  ]),
];

/** Aplica o resultado de uma partida no save e devolve as conquistas liberadas (com o ouro do prêmio já somado). */
/** Ouro extra por concluir um mapa. */
export const VICTORY_GOLD = 500;
/** O mapa já foi concluído (chefe final morto)? Só então o modo infinito dele abre. */
export const mapCompleted = (s: NhSave, id: string): boolean => (s.stats.mapsDone[id] ?? 0) > 0;
export function applyRun(
  save: NhSave,
  r: RunResult,
  now = 0,
): { unlocked: Achievement[]; goldGained: number } {
  const st = save.stats;
  // vencer o mapa (chefe final) paga um prêmio extra
  const gained = goldWithBonus(r.gold, save.meta) + (r.won && !r.infinite ? VICTORY_GOLD : 0);
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
  st.banishes += r.banishesUsed;
  st.rerolls += r.rerollsUsed;
  st.heroRuns[r.hero] = (st.heroRuns[r.hero] ?? 0) + 1;
  st.heroBestTime[r.hero] = Math.max(st.heroBestTime[r.hero] ?? 0, r.score);
  st.mapBestTime[r.map] = Math.max(st.mapBestTime[r.map] ?? 0, r.score);
  // bestiário: quem apareceu vira "visto" e os abates somam
  for (const id of r.seenIds) st.bestiary[id] = st.bestiary[id] ?? 1;
  for (const [id, k] of Object.entries(r.killsById)) st.bestiary[id] = (st.bestiary[id] ?? 1) + k;
  if (r.won && !r.infinite) st.mapsDone[r.map] = st.mapsDone[r.map] ?? (now || 1);
  if (r.infinite) {
    const old = st.mapRecords[r.map] ?? { t: 0, kills: 0, level: 0 };
    st.mapRecords[r.map] = {
      t: Math.max(old.t, Math.floor(r.score)),
      kills: Math.max(old.kills, r.kills),
      level: Math.max(old.level, r.level + 1),
    };
  }
  for (const e of r.evolutions) if (!st.evolutions.includes(e)) st.evolutions.push(e);
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

// ---------------- vender o que foi comprado ----------------
/** Quanto do preço volta ao vender (desconto de 10%, pedido do Lucas em 16/11/2026). */
export const SELL_RATE = 0.9;

/** Ouro que volta ao vender o último nível comprado de uma melhoria (null = nada para vender). */
export function metaSellValue(save: NhSave, key: MetaKey): number | null {
  const lv = save.meta[key];
  if (lv <= 0) return null;
  const paid = metaCost(key, lv - 1);
  return paid === null ? null : Math.floor(paid * SELL_RATE);
}
/** Vende o último nível da melhoria: tira o nível e devolve 90% do que ele custou. Devolve o ouro recebido, ou null. */
export function sellMeta(save: NhSave, key: MetaKey): number | null {
  const v = metaSellValue(save, key);
  if (v === null) return null;
  save.meta[key] = save.meta[key] - 1;
  save.gold += v;
  save.stats.metaBought = Math.max(0, save.stats.metaBought - 1);
  return v;
}

// ---------------- heróis e mapas ----------------
export interface HeroInfo {
  id: string;
  name: string;
  title: string;
  desc: string;
}
export const HERO_INFO: Record<string, HeroInfo> = {
  kael: {
    id: 'kael',
    name: 'Kael',
    title: 'O Guerreiro',
    desc: 'Começa com a Espada (evolui em Lâmina Real com Poder). Ganha 20% mais XP: o jeito simples de aprender.',
  },
  vesper: {
    id: 'vesper',
    name: 'Vesper',
    title: 'A Açoitadora',
    desc: 'Começa com o Chicote (evolui em Laceração Sangrenta com Coração). 20% mais vida e 5% mais dano.',
  },
  mara: {
    id: 'mara',
    name: 'Mara',
    title: 'A Caçadora',
    desc: 'Começa com a Varinha Arcana (evolui em Santa Varinha com Diário de Caça). Projéteis 15% mais rápidos, 10% menos vida.',
  },
  brann: {
    id: 'brann',
    name: 'Brann',
    title: 'O Guardião',
    desc: 'Começa com a Aura de Alho (evolui em Devorador de Almas com Regeneração). 25% mais vida, anda 8% mais devagar.',
  },
  dorian: {
    id: 'dorian',
    name: 'Dorian',
    title: 'O Alquimista',
    desc: 'Começa com as Poças de Magma (evolui em Lava Viva com Imã). Zonas duram 15% mais e o alcance de atração é 20% maior.',
  },
  selene: {
    id: 'selene',
    name: 'Selene',
    title: 'A Piromante',
    desc: 'Começa com o Círculo de Brasas (evolui em Anel Infernal com Ligeireza). 12% mais dano, 15% menos vida.',
  },
  ysolde: {
    id: 'ysolde',
    name: 'Ysolde',
    title: 'A Tempestade',
    desc: 'Começa com o Raio Lunar (evolui em Tempestade com Trevo). Armas recarregam 12% mais rápido, 20% menos vida.',
  },
  rurik: {
    id: 'rurik',
    name: 'Rurik',
    title: 'O Lenhador',
    desc: 'Começa com o Machado Giratório (evolui com Armadura). Causa 18% mais dano e ganha 15% mais ouro.',
  },
};
/** Uma exigência para liberar um mapa (todas precisam estar cumpridas). */
export interface MapReq {
  label: string;
  need: number;
  have(s: NhSave): number;
}
export interface MapInfo {
  id: string;
  name: string;
  desc: string;
  reqs: MapReq[];
}
const reqMinutes = (m: number): MapReq => ({
  label: `Sobreviva ${m} minutos`,
  need: m * 60,
  have: (s) => s.stats.bestTime,
});
const reachLevel = (n: number): MapReq => ({
  label: `Chegue ao nível ${n}`,
  need: n,
  have: (s) => s.stats.bestLevel,
});
export const MAP_INFO: Record<string, MapInfo> = {
  campo: {
    id: 'campo',
    name: 'Campo Verde',
    desc: 'O campo do Slash. Sem regras extras.',
    reqs: [],
  },
  deserto: {
    id: 'deserto',
    name: 'Deserto Seco',
    desc: 'Inimigos 10% mais rápidos, mas 30% mais ouro.',
    reqs: [
      reachLevel(10),
      reqMinutes(8),
      { label: 'Derrote 3 chefes', need: 3, have: (s) => s.stats.bossKills },
    ],
  },
  gelo: {
    id: 'gelo',
    name: 'Planície Gelada',
    desc: 'Inimigos com 25% mais vida, mas 20% mais XP.',
    reqs: [
      reachLevel(25),
      reqMinutes(15),
      { label: 'Evolua 2 armas', need: 2, have: (s) => s.stats.evolutions.length },
    ],
  },
};
/** Progresso de cada exigência de um mapa, para a tela de mapas. */
export const mapProgress = (
  s: NhSave,
  id: string,
): Array<{ label: string; have: number; need: number; done: boolean }> =>
  (MAP_INFO[id]?.reqs ?? []).map((r) => {
    const have = Math.min(r.need, r.have(s));
    return { label: r.label, have, need: r.need, done: have >= r.need };
  });
export const heroUnlocked = (s: NhSave, id: string): boolean => s.heroes.includes(id);
export const mapUnlocked = (s: NhSave, id: string): boolean =>
  mapProgress(s, id).every((r) => r.done);
/** Compra um herói com ouro. */
export function buyHero(s: NhSave, id: string): boolean {
  const h = HEROES[id];
  if (!h || s.heroes.includes(id) || s.gold < h.price) return false;
  s.gold -= h.price;
  s.heroes.push(id);
  checkAchievements(s, Date.now());
  return true;
}
/** Dados do save que a conta guarda (e valida) sem confiar no aparelho. */
export const SAVE_LIMITS = { gold: 100_000_000, time: 36_000 } as const;
export const MAP_LIST = MAP_IDS.map((id) => ({ ...MAPS[id]!, ...MAP_INFO[id]! }));

export interface EvoInfo {
  id: EvoId;
  name: string;
  desc: string;
  /** Arma que evolui e passivo exigido, para a dica da coleção. */
  from: UpgradeId;
  passive: UpgradeId;
}
export const EVO_INFO: Record<EvoId, EvoInfo> = {
  evoWhip: {
    id: 'evoWhip',
    name: 'Laceração Sangrenta',
    desc: 'Evolução do Chicote. Golpe duas vezes mais longo, 40% mais rápido, causa dano crítico e absorve vida.',
    from: 'whip',
    passive: 'heart',
  },
  evoWand: {
    id: 'evoWand',
    name: 'Santa Varinha',
    desc: 'Evolução da Varinha Arcana. Dispara quase sem pausa, com projéteis dourados que atravessam 2 inimigos a mais.',
    from: 'wand',
    passive: 'tome',
  },
  evoGarlic: {
    id: 'evoGarlic',
    name: 'Devorador de Almas',
    desc: 'Evolução da Aura de Alho. Aura roxa 60% maior, o dobro de dano e cura 1 de vida a cada 5 inimigos atingidos.',
    from: 'garlic',
    passive: 'regeneration',
  },
  evoMagma: {
    id: 'evoMagma',
    name: 'Lava Viva',
    desc: 'Evolução das Poças de Magma. As poças deslizam, crescem com o tempo e duram o dobro.',
    from: 'magma',
    passive: 'magnet',
  },
  evoEmbers: {
    id: 'evoEmbers',
    name: 'Anel Infernal',
    desc: 'Evolução do Círculo de Brasas. Dois anéis girando em sentidos opostos, mais rápidos.',
    from: 'embers',
    passive: 'swift',
  },
  evoCross: {
    id: 'evoCross',
    name: 'Espada Celestial',
    desc: 'Evolução da Cruz. Espada dourada maior que vai e volta duas vezes, com 60% mais dano.',
    from: 'cross',
    passive: 'clover',
  },
  evoBone: {
    id: 'evoBone',
    name: 'Osso Maldito',
    desc: 'Evolução do Osso. Quica 2 vezes a mais e causa 50% mais dano.',
    from: 'bone',
    passive: 'armor',
  },
  evoRunes: {
    id: 'evoRunes',
    name: 'Sem Futuro',
    desc: 'Evolução do Rastreador de Runas. Esferas maiores que explodem quando o tempo acaba.',
    from: 'runes',
    passive: 'duration',
  },
  evoPentagram: {
    id: 'evoPentagram',
    name: 'Lua Esplêndida',
    desc: 'Evolução do Pentagrama. 50% mais dano e recarga menor.',
    from: 'pentagram',
    passive: 'growth',
  },
  evoBomb: {
    id: 'evoBomb',
    name: 'Bomba Cerejão',
    desc: 'Evolução da Bomba de Cereja. Cada estilhaço vira uma bomba menor que também explode.',
    from: 'bomb',
    passive: 'amount',
  },
  evoHorizontal: {
    id: 'evoHorizontal',
    name: 'Adagas Fantasma',
    desc: 'Leque de 5 adagas, uma salva a mais, atravessam 2 inimigos a mais e recarregam 25% mais rápido.',
    from: 'horizontal',
    passive: 'boots',
  },
  evoHalo: {
    id: 'evoHalo',
    name: 'Supernova',
    desc: 'Anel de 40 projéteis, mais dano e alcance, e o dobro de velocidade de recarga.',
    from: 'halo',
    passive: 'heart',
  },
  evoAxe: {
    id: 'evoAxe',
    name: 'Machado Titã',
    desc: 'Machados enormes, com o dobro de dano e 3 machados a mais por arremesso.',
    from: 'axe',
    passive: 'armor',
  },
  evoOrbit: {
    id: 'evoOrbit',
    name: 'Eclipse',
    desc: 'Orbes gigantes, 3 orbes a mais, órbita maior e o dobro de dano.',
    from: 'orbit',
    passive: 'magnet',
  },
  evoLightning: {
    id: 'evoLightning',
    name: 'Tempestade',
    desc: 'Dois raios a mais, 50% mais dano e o raio fere quem estiver em volta do alvo.',
    from: 'lightning',
    passive: 'clover',
  },
  evoSword: {
    id: 'evoSword',
    name: 'Lâmina Real',
    desc: 'A espada causa o dobro de dano e golpeia 40% mais rápido.',
    from: 'sword',
    passive: 'weaponDamage',
  },
};
