export const RARITIES = ['comum', 'raro', 'epico', 'lendario', 'proibido'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABEL: Record<Rarity, string> = {
  comum: 'Comum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
  proibido: 'Proibido',
};

/** Gemas acesas na lombada (de 5): a raridade não depende só de cor. */
export const RARITY_GEMS: Record<Rarity, number> = {
  comum: 1,
  raro: 2,
  epico: 3,
  lendario: 4,
  proibido: 5,
};

export const GEM_SLOTS = 5;
