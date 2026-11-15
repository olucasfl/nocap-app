/**
 * Hordas do Night Hunt, desenhadas como as do Vampire Survivors: um fluxo contínuo de inimigos que sobe com o tempo
 * (a "população mínima" na tela) e, por cima, eventos com pausa: enxames de morcegos, anéis que se fecham, muralhas
 * que atravessam a tela, manadas de corredores, chefes grandes que trazem baú e o chefe final sem fim.
 * Tudo é por tempo de partida (s) e usa os inimigos do Slash.
 */
export interface DripTier {
  from: number;
  weights: ReadonlyArray<readonly [string, number]>;
}
/** Quem aparece no fluxo contínuo, por faixa de tempo. */
export const DRIP_TIERS: readonly DripTier[] = [
  { from: 0, weights: [['BasicEnemy', 1]] },
  {
    from: 60,
    weights: [
      ['BasicEnemy', 3],
      ['BasicEnemySkeleton', 2],
    ],
  },
  {
    from: 150,
    weights: [
      ['BasicEnemySkeleton', 2],
      ['StandardEnemy', 3],
      ['FastEnemy', 1],
    ],
  },
  {
    from: 300,
    weights: [
      ['StandardEnemy', 2],
      ['FastEnemy', 2],
      ['SpeedEnemy', 1],
      ['ToughEnemy', 3],
    ],
  },
  {
    from: 480,
    weights: [
      ['ToughEnemy', 2],
      ['HardEnemy', 3],
      ['SpeedEnemy', 2],
      ['TankEnemy', 1],
    ],
  },
  {
    from: 720,
    weights: [
      ['HardEnemy', 2],
      ['HarderEnemy', 3],
      ['TankEnemy', 2],
      ['BatEnemy', 2],
      ['StandardCheetah', 1],
    ],
  },
  {
    from: 960,
    weights: [
      ['HarderEnemy', 3],
      ['HardestEnemy', 3],
      ['TankEnemy', 2],
      ['SiegeEnemyMelee', 1],
      ['BatEnemy', 2],
      ['Hunter', 1],
    ],
  },
  {
    from: 1260,
    weights: [
      ['HardestEnemy', 3],
      ['EndEnemy', 2],
      ['SiegeEnemyMelee', 2],
      ['SkeletonRanger', 1],
      ['HunterMage', 1],
      ['SiegeEnemyRanged', 1],
    ],
  },
  {
    from: 1620,
    weights: [
      ['EndEnemy', 3],
      ['HardestEnemy', 2],
      ['SiegeEnemyMelee', 3],
      ['SiegeEnemyRanged', 2],
      ['SkeletonRanger', 2],
      ['HunterMage', 2],
    ],
  },
];
export function dripTier(t: number): DripTier {
  let cur = DRIP_TIERS[0]!;
  for (const tier of DRIP_TIERS) if (t >= tier.from) cur = tier;
  return cur;
}

/** Quantos inimigos o jogo tenta manter na tela só com o fluxo contínuo. */
export const minPopulation = (t: number): number => Math.min(380, 16 + t * 0.17);
/** Teto de inimigos vivos (protege o desempenho). */
export const MAX_ENEMIES = 460;
/** Vida extra dos inimigos comuns conforme o tempo (a partir dos 10 min). */
export const hpScale = (t: number): number => 1 + Math.max(0, t - 600) / 1200;
/** Valor de cada cristal de XP: sobe com o tempo, como as gemas verdes e vermelhas do Vampire Survivors. */
export const gemValue = (t: number): number =>
  Math.max(1, Math.floor(1 + Math.max(0, t - 240) / 110));

export type HordeShape = 'swarm' | 'ring' | 'wall' | 'boss';
export interface HordeEvent {
  id: string;
  from: number;
  every: number;
  shape: HordeShape;
  enemy(t: number): string;
  count(t: number): number;
  /** Segundos em que o fluxo contínuo para depois do evento (a pausa antes da próxima leva). */
  quiet: number;
}
const BOSSES = ['BasicBoss', 'StandardBoss', 'HardBoss', 'HarderBoss', 'HardestBoss'] as const;
export const HORDE_EVENTS: readonly HordeEvent[] = [
  {
    id: 'bats',
    from: 12,
    every: 38,
    shape: 'swarm',
    enemy: (t) => (t < 300 ? 'BasicEnemy' : 'BatEnemy'),
    count: (t) => Math.min(110, Math.round(26 + t * 0.1)),
    quiet: 7,
  },
  {
    id: 'ring',
    from: 60,
    every: 52,
    shape: 'ring',
    enemy: (t) =>
      t < 300
        ? 'CircleEnemyBat'
        : t < 600
          ? 'CircleEnemy'
          : t < 900
            ? 'CircleEnemyStandard'
            : t < 1200
              ? 'CircleEnemyTough'
              : t < 1500
                ? 'CircleEnemySkelePrison'
                : 'CircleEnemyDark',
    count: (t) => Math.min(76, Math.round(30 + t / 28)),
    quiet: 5,
  },
  {
    id: 'wall',
    from: 150,
    every: 66,
    shape: 'wall',
    enemy: (t) =>
      t < 480
        ? 'WaveEnemyArmor'
        : t < 900
          ? 'WaveEnemyArmorFast'
          : t < 1300
            ? 'WaveEnemyArmorMarch'
            : 'WaveEnemyArmorBlitz',
    count: (t) => Math.min(44, Math.round(10 + t / 48)),
    quiet: 6,
  },
  {
    id: 'stampede',
    from: 240,
    every: 84,
    shape: 'swarm',
    enemy: (t) => (t < 700 ? 'FastEnemy' : t < 1300 ? 'SpeedEnemy' : 'EndEnemy'),
    count: (t) => Math.min(60, Math.round(14 + t / 40)),
    quiet: 6,
  },
  {
    id: 'treasure',
    from: 120,
    every: 110,
    shape: 'swarm',
    enemy: () => 'TreasureEnemy',
    count: () => 1,
    quiet: 0,
  },
  {
    id: 'boss',
    from: 150,
    every: 150,
    shape: 'boss',
    enemy: (t) => BOSSES[Math.min(BOSSES.length - 1, Math.floor(t / 150 - 1) % BOSSES.length)]!,
    count: (t) => 1 + Math.floor(t / 900),
    quiet: 5,
  },
  {
    id: 'reaper',
    from: 1800,
    every: 25,
    shape: 'boss',
    enemy: () => 'FinalBoss',
    count: (t) => 1 + Math.floor((t - 1800) / 120),
    quiet: 0,
  },
];
/**
 * Vida dos chefes: bem maior que a do Slash, mas o primeiro (2:30) morre em cerca de 15 s com uma build inicial;
 * cresce de forma proporcional com o tempo e com o tipo do chefe, como a dos inimigos comuns.
 */
export const bossHp = (baseHealth: number, t: number): number =>
  Math.round(baseHealth * (7 + t / 45));
