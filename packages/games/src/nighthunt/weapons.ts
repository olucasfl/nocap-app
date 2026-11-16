/**
 * Tabelas das armas novas (spec 084): um valor por nível (1 a 6). Os números são o ponto de partida do equilíbrio.
 * Alcance, Poder, Ligeireza, Diário de Caça, Duração e Quantidade entram em `world.ts`, por cima destes valores.
 */
export const WHIP = {
  /** Cortes em sequência por recarga (frente, trás, frente...). */
  cuts: [2, 2, 3, 3, 4, 5],
  dmg: [3, 3.9, 3.9, 5.1, 5.1, 5.1],
  cd: 1.4,
  /** Multiplicador da recarga por nível: devagar no nível 1 (2,1 s) e mais rápido ao evoluir. */
  cdLv: [1.5, 1.4, 1.3, 1.2, 1.1, 1],
  len: [130, 130, 130, 130, 130, 160],
  gap: 0.3,
  /** Quanto o estalo dura (s) e a altura da área (px): a animação tem o mesmo tamanho da área. */
  life: 0.2,
  height: 40,
} as const;
export const WAND = {
  n: [1, 2, 2, 3, 3, 4],
  dmg: [2, 2, 2, 2, 2.8, 2.8],
  cd: [1.2, 1.2, 1.02, 1.02, 1.02, 1.02],
  range: 260,
  pierce: [1, 1, 1, 1, 1, 2],
} as const;
export const GARLIC = {
  radius: [70, 77, 89, 89, 107, 107],
  dmg: [2, 2, 2, 3, 3, 3],
  every: [0.6, 0.6, 0.6, 0.6, 0.6, 0.5],
  knock: [70, 70, 70, 70, 70, 240],
} as const;
export const MAGMA = {
  n: [1, 1, 2, 2, 2, 3],
  r: [46, 60, 60, 60, 60, 60],
  dmg: [1.5, 1.5, 1.5, 2.1, 2.1, 2.1],
  dur: [3, 3, 3, 3, 3.75, 3.75],
  cd: 3.2,
  tick: 0.4,
  spread: 250,
} as const;
export const EMBERS = {
  n: [3, 4, 4, 5, 5, 7],
  dmg: [2, 2, 2.6, 2.6, 2.6, 2.6],
  dur: [2.5, 2.5, 2.5, 2.5, 3.1, 3.1],
  cd: 3,
  radius: 70,
  grow: 40,
  hit: 0.4,
} as const;
export const CROSS = {
  n: [1, 1, 2, 2, 2, 3],
  dmg: [3, 3, 3, 4.2, 4.2, 4.2],
  speed: [1, 1.2, 1.2, 1.2, 1.2, 1.2],
  size: [1, 1, 1, 1, 1.25, 1.25],
  cd: 2.2,
  life: 2.4,
  base: 330,
} as const;
export const BONE = {
  n: [1, 1, 2, 2, 2, 3],
  bounces: [2, 2, 2, 3, 3, 4],
  dmg: [3, 3.75, 3.75, 3.75, 4.8, 4.8],
  cd: 1.6,
  range: 360,
  speed: 260,
} as const;
export const RUNES = {
  n: [1, 1, 2, 2, 2, 3],
  dmg: [2, 2, 2, 2, 2.8, 2.8],
  dur: [5, 5, 5, 6.25, 6.25, 6.25],
  speed: [1, 1.2, 1.2, 1.2, 1.2, 1.2],
  cd: 3,
  base: 200,
  hit: 0.5,
} as const;
export const PENTAGRAM = {
  dmg: [15, 15, 19.5, 19.5, 24, 24],
  /** Recarga sorteada a cada uso entre estes dois valores (s); os níveis encurtam só um pouco (fator abaixo). */
  cdMin: 40,
  cdMax: 80,
  cdFactor: [1, 0.95, 0.95, 0.9, 0.9, 0.85],
  scale: [1, 1, 1, 1, 1, 2],
} as const;
export const BOMB = {
  n: [1, 1, 2, 2, 2, 3],
  r: [70, 84, 84, 84, 84, 84],
  dmg: [4, 4, 4, 5.6, 5.6, 5.6],
  shards: [3, 3, 3, 3, 5, 5],
  cd: 2.4,
  fly: 0.9,
  fuse: 1.5,
  spread: 220,
} as const;
