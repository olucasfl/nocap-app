// Catálogo do Aperta! (spec 038, seções 5 e 8). Tudo aqui é DADO: o motor só conhece as
// primitivas de efeito da seção 7.3, então um grimório novo é uma linha nesta tabela.
// Textos para o jogador ficam em pt-BR; ids e código em inglês.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'forbidden';
export type Family = 'planets' | 'moons' | 'small-bodies' | 'stars' | 'nebulae' | 'black-holes';
export type ObjectKind = 'comet' | 'shooting-star' | 'satellite' | 'asteroid' | 'probe';
export type ObjectTarget = ObjectKind | 'all';

export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary', 'forbidden'];
export const FAMILIES: readonly Family[] = [
  'planets',
  'moons',
  'small-bodies',
  'stars',
  'nebulae',
  'black-holes',
];

export const FAMILY_NAMES: Record<Family, string> = {
  planets: 'Planetas',
  moons: 'Luas',
  'small-bodies': 'Pequenos corpos',
  stars: 'Estrelas',
  nebulae: 'Nebulosas e galáxias',
  'black-holes': 'Buracos negros',
};

/** Peso de sorteio por raridade (seção 4.3): sorteia-se a raridade e depois a carta, para o peso não depender de quantas cartas existem. */
export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 100,
  rare: 24,
  epic: 9,
  legendary: 3,
  forbidden: 1,
};

/** Nº de escolhas já feitas que libera cada raridade na primeira vida (cai com os colapsos, ver economy.ts). */
export const RARITY_UNLOCK_PICKS: Record<Rarity, number> = {
  common: 0,
  rare: 3,
  epic: 8,
  legendary: 14,
  forbidden: 22,
};

/**
 * Primitivas de efeito (seção 7.3). `price: true` marca a metade "com preço" de um proibido
 * (é o `forbiddenTradeoff`): o bônus de Buracos negros e a árvore reduzem só o preço e
 * reforçam só o ganho.
 */
export type Effect = (
  | { kind: 'dustPerTouchPct'; pct: number; when?: 'comboFull' }
  | { kind: 'dustMult'; mult: number }
  | { kind: 'energyPerTouchPct'; pct: number }
  | { kind: 'energyFillRate'; pct: number }
  | { kind: 'everyNthTouch'; n: number; mult: number; energyBarPct?: number }
  | {
      kind: 'objectDuration';
      target: ObjectTarget;
      /** `life` = tempo no campo; `effect` = duração do efeito (só o satélite: "Sinal forte"). */
      of?: 'life' | 'effect';
      sec?: number;
      mult?: number;
      pct?: number;
    }
  | { kind: 'objectSpawnRate'; pct: number }
  | { kind: 'objectValuePct'; target: ObjectTarget; pct: number }
  | { kind: 'objectsDisabled' }
  | { kind: 'maxObjects'; add: number }
  | { kind: 'satelliteMult'; add: number }
  | { kind: 'comboMax'; add?: number; mult?: number }
  | { kind: 'comboWindow'; pct?: number; mult?: number }
  | { kind: 'upgradeCostPct'; pct: number }
  | { kind: 'energyStepPct'; pct: number }
  | { kind: 'startDust'; upgrade: string; levels: number }
  | { kind: 'freeUpgradeLevels'; upgrade: string; levels: number }
  | { kind: 'choiceExtra'; reroll?: number; picks?: number; repeatLevels?: number; cards?: number }
  | { kind: 'onCapture'; energyTouches: number }
  | { kind: 'afterCaptureMult'; mult: number }
  | { kind: 'dustPerOwned'; rarity: Rarity; pct: number }
  | { kind: 'dustPerCollapse'; pct: number }
  | { kind: 'forbiddenUnlock'; picks: number }
  | { kind: 'forbiddenPower'; pct: number; priceCutPct: number }
) & { price?: true };

export interface GrimoireDef {
  id: string;
  name: string;
  rarity: Rarity;
  family: Family;
  /** Texto do efeito, como aparece na carta. */
  text: string;
  /** Desenho da medalha (para a etapa de arte). */
  art: string;
  effects: Effect[];
  /** Colapso a partir do qual o grimório existe para o jogador (seção 5.4). */
  unlockedAtCollapse: number;
}

function grim(
  id: string,
  name: string,
  rarity: Rarity,
  family: Family,
  text: string,
  art: string,
  effects: Effect[],
  unlockedAtCollapse = 0,
): GrimoireDef {
  return { id, name, rarity, family, text, art, effects, unlockedAtCollapse };
}

export const GRIMOIRES: readonly GrimoireDef[] = [
  // Comuns
  grim('moon', 'Lua', 'common', 'moons', 'A cada 10 toques, +1 toque de poeira', 'esfera cinza clara com crateras', [
    { kind: 'everyNthTouch', n: 10, mult: 2 },
  ]),
  grim('mercury', 'Mercúrio', 'common', 'planets', 'A energia enche 10% mais rápido', 'esfera marrom-cinza, crateras pequenas', [
    { kind: 'energyFillRate', pct: 10 },
  ]),
  grim('venus', 'Vênus', 'common', 'planets', 'Objetos duram 2 s a mais', 'esfera creme-dourada com faixas de nuvem', [
    { kind: 'objectDuration', target: 'all', sec: 2 },
  ]),
  grim('mars', 'Marte', 'common', 'planets', 'Cometas dão +25%', 'esfera ferrugem com calota polar branca', [
    { kind: 'objectValuePct', target: 'comet', pct: 25 },
  ]),
  grim('ceres', 'Ceres', 'common', 'small-bodies', 'Melhorias custam 3% menos', 'rocha cinza com ponto brilhante', [
    { kind: 'upgradeCostPct', pct: -3 },
  ]),
  grim('phobos', 'Fobos', 'common', 'moons', 'Estrelas cadentes dão +25% de energia', 'rocha irregular com uma cratera grande', [
    { kind: 'objectValuePct', target: 'shooting-star', pct: 25 },
  ]),
  grim('io', 'Io', 'common', 'moons', 'Satélites duram +2 s', 'esfera amarelo-enxofre com manchas vermelhas', [
    { kind: 'objectDuration', target: 'satellite', of: 'effect', sec: 2 },
  ]),
  grim('vesta', 'Vesta', 'common', 'small-bodies', '+5% de poeira por toque', 'rocha clara com faixa escura', [
    { kind: 'dustPerTouchPct', pct: 5 },
  ]),
  grim('halley', 'Halley', 'common', 'small-bodies', 'Objetos aparecem 10% mais rápido', 'núcleo claro com cauda azul', [
    { kind: 'objectSpawnRate', pct: 10 },
  ]),
  grim('uranus', 'Urano', 'common', 'planets', 'Janela do combo +10%', 'esfera ciano-gelo com anel fino vertical', [
    { kind: 'comboWindow', pct: 10 },
  ]),

  // Raros
  grim('europa', 'Europa', 'rare', 'moons', 'O combo dura 20% mais', 'esfera branca com rachaduras marrons', [
    { kind: 'comboWindow', pct: 20 },
  ]),
  grim('titan', 'Titã', 'rare', 'moons', 'Cada vida começa com poeira extra (1 nível do Pulso)', 'esfera laranja com névoa', [
    { kind: 'startDust', upgrade: 'pulse', levels: 1 },
  ]),
  grim('jupiter', 'Júpiter', 'rare', 'planets', 'Todo 10º toque vale o triplo', 'esfera com faixas marrons e a grande mancha vermelha', [
    { kind: 'everyNthTouch', n: 10, mult: 3 },
  ]),
  grim('saturn', 'Saturno', 'rare', 'planets', 'Melhorias custam 8% menos', 'esfera dourada com anéis inclinados', [
    { kind: 'upgradeCostPct', pct: -8 },
  ]),
  grim('neptune', 'Netuno', 'rare', 'planets', 'Satélites duram o dobro', 'esfera azul-profundo com faixa branca', [
    { kind: 'objectDuration', target: 'satellite', of: 'effect', mult: 2 },
  ]),
  grim('ganymede', 'Ganimedes', 'rare', 'moons', '+10% de energia por toque', 'esfera cinza com sulcos claros', [
    { kind: 'energyPerTouchPct', pct: 10 },
  ]),
  grim('pluto', 'Plutão', 'rare', 'small-bodies', 'Objetos valem +12%', 'esfera bege com "coração" claro', [
    { kind: 'objectValuePct', target: 'all', pct: 12 },
  ]),
  grim('triton', 'Tritão', 'rare', 'moons', 'Cada objeto capturado dá energia de 2 toques', 'esfera rosada com calota de gelo', [
    { kind: 'onCapture', energyTouches: 2 },
  ]),

  // Épicos
  grim('sirius', 'Sirius', 'epic', 'stars', 'Combo máximo +2', 'estrela branca de 4 pontas com halo azul', [
    { kind: 'comboMax', add: 2 },
  ]),
  grim('vega', 'Vega', 'epic', 'stars', '+15% de poeira por toque', 'estrela branco-azulada de 8 raios', [
    { kind: 'dustPerTouchPct', pct: 15 },
  ]),
  grim('betelgeuse', 'Betelgeuse', 'epic', 'stars', 'Troque 1 das opções (1 vez por escolha)', 'gigante laranja com manchas', [
    { kind: 'choiceExtra', reroll: 1 },
  ]),
  grim('polaris', 'Polaris', 'epic', 'stars', 'O toque depois de capturar um objeto vale x5', 'estrela azul-branca com halo fino', [
    { kind: 'afterCaptureMult', mult: 5 },
  ]),
  grim('antares', 'Antares', 'epic', 'stars', 'Objetos valem +20%', 'gigante vermelha com brilho', [
    { kind: 'objectValuePct', target: 'all', pct: 20 },
  ]),
  grim('crab-nebula', 'Nebulosa do Caranguejo', 'epic', 'nebulae', 'Grimório repetido sobe 2 níveis', 'filamentos laranja e azuis', [
    { kind: 'choiceExtra', repeatLevels: 1 },
  ]),

  // Lendários
  grim('orion-nebula', 'Nebulosa de Órion', 'legendary', 'nebulae', 'Ao encher a energia, escolha 2 grimórios', 'nuvem rosa, turquesa e violeta com estrelas', [
    { kind: 'choiceExtra', picks: 1 },
  ]),
  grim('milky-way', 'Via Láctea', 'legendary', 'nebulae', 'Cada grimório raro vale +10% de poeira', 'galáxia espiral de 4 braços', [
    { kind: 'dustPerOwned', rarity: 'rare', pct: 10 },
  ]),
  grim('andromeda', 'Andrômeda', 'legendary', 'nebulae', 'Cada colapso já feito dá +3% de poeira por toque', 'espiral inclinada com núcleo claro', [
    { kind: 'dustPerCollapse', pct: 3 },
  ]),

  // Proibidos (o preço vai marcado com `price`)
  grim('sagittarius-a', 'Sagitário A*', 'forbidden', 'black-holes', 'Poeira por toque x3, mas a energia enche 70% mais devagar', 'disco de acreção dourado ao redor de círculo preto', [
    { kind: 'dustMult', mult: 3 },
    { kind: 'energyFillRate', pct: -70, price: true },
  ]),
  grim('cygnus-x1', 'Cygnus X-1', 'forbidden', 'black-holes', 'Combo máximo x2 e janela x2, mas os objetos no espaço param de aparecer', 'buraco negro com estrela azul companheira', [
    { kind: 'comboMax', mult: 2 },
    { kind: 'comboWindow', mult: 2 },
    { kind: 'objectsDisabled', price: true },
  ], 3),
  grim('m87', 'M87*', 'forbidden', 'black-holes', 'Melhorias custam 30% menos, mas cada energia para o próximo grimório custa +25%', 'buraco negro com jato de luz', [
    { kind: 'upgradeCostPct', pct: -30 },
    { kind: 'energyStepPct', pct: 25, price: true },
  ], 5),

  // Colapsos 1 a 5 (seção 5.4)
  grim('pallas', 'Palas', 'common', 'small-bodies', 'Objetos duram +1,5 s', 'rocha acinzentada com sulcos', [
    { kind: 'objectDuration', target: 'all', sec: 1.5 },
  ], 1),
  grim('hygiea', 'Hygiea', 'common', 'small-bodies', '+8% de energia por toque', 'esfera escura quase redonda', [
    { kind: 'energyPerTouchPct', pct: 8 },
  ], 1),
  grim('callisto', 'Calisto', 'rare', 'moons', 'Satélites dão x2,5 em vez de x2', 'esfera cinza-marrom com crateras claras', [
    { kind: 'satelliteMult', add: 0.5 },
  ], 2),
  grim('enceladus', 'Encélado', 'rare', 'moons', 'Estrela cadente dá +50% de energia', 'esfera branca com jatos de gelo', [
    { kind: 'objectValuePct', target: 'shooting-star', pct: 50 },
  ], 2),
  grim('eris', 'Éris', 'rare', 'small-bodies', 'Objetos valem +10%', 'esfera clara com lua pequena', [
    { kind: 'objectValuePct', target: 'all', pct: 10 },
  ], 3),
  grim('haumea', 'Haumea', 'common', 'small-bodies', 'Janela do combo +10%', 'elipsoide branco com anel', [
    { kind: 'comboWindow', pct: 10 },
  ], 3),
  grim('sedna', 'Sedna', 'epic', 'small-bodies', 'Objetos aparecem 20% mais rápido', 'esfera vermelho-escura distante', [
    { kind: 'objectSpawnRate', pct: 20 },
  ], 4),
  grim('hale-bopp', 'Hale-Bopp', 'rare', 'small-bodies', 'Cometas duram o dobro', 'núcleo com duas caudas, azul e branca', [
    { kind: 'objectDuration', target: 'comet', mult: 2 },
  ], 4),
  grim('proxima-centauri', 'Proxima Centauri', 'rare', 'stars', '+8% de poeira por toque', 'anã vermelha com chama pequena', [
    { kind: 'dustPerTouchPct', pct: 8 },
  ], 5),
  grim('alpha-centauri-a', 'Alfa Centauri A', 'epic', 'stars', 'Todo 25º toque vale x6', 'estrela amarela com halo dourado', [
    { kind: 'everyNthTouch', n: 25, mult: 6 },
  ], 5),
];

const GRIMOIRE_BY_ID = new Map(GRIMOIRES.map((g) => [g.id, g]));
export function grimoireById(id: string): GrimoireDef | undefined {
  return GRIMOIRE_BY_ID.get(id);
}

// --- Melhorias (seção 5.1 e 6.2) ---

export interface UpgradeDef {
  id: string;
  name: string;
  text: string;
  /** Custo do nível 0; cada nível multiplica por 1,65. */
  base: number;
  max: number;
  unlockedAtCollapse: number;
  /** "Libera após N escolhas" (Hubble, Voyager). */
  requiresPicks?: number;
  /** "Libera após comprar outra melhoria" (Plêiades exige a Ressonância). */
  requiresUpgrade?: { id: string; level: number };
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'pulse', name: 'Pulso Solar', text: '+1 poeira por toque', base: 1500, max: 30, unlockedAtCollapse: 0 },
  { id: 'resonance', name: 'Ressonância de Vênus', text: 'Libera o combo; níveis seguintes alargam a janela', base: 5400, max: 10, unlockedAtCollapse: 0 },
  { id: 'reactor', name: 'Reator de Aldebarã', text: '+0,125 de energia por toque', base: 8400, max: 20, unlockedAtCollapse: 0 },
  { id: 'pleiades', name: 'Alinhamento das Plêiades', text: 'Combo máximo +1', base: 15600, max: 5, unlockedAtCollapse: 0, requiresUpgrade: { id: 'resonance', level: 1 } },
  { id: 'kepler', name: 'Sonda Kepler', text: 'Objetos aparecem mais rápido e cabe mais um no campo', base: 12000, max: 5, unlockedAtCollapse: 0 },
  { id: 'hubble', name: 'Telescópio Hubble', text: 'Objetos valem +10%', base: 30000, max: 20, unlockedAtCollapse: 0, requiresPicks: 3 },
  { id: 'voyager', name: 'Voyager', text: 'Satélites duram +1 s', base: 60000, max: 8, unlockedAtCollapse: 0, requiresPicks: 8 },
  { id: 'webb', name: 'Observatório James Webb', text: 'Melhorias custam 2% menos', base: 120000, max: 10, unlockedAtCollapse: 1 },
  { id: 'chandra', name: 'Telescópio Chandra', text: 'Objetos duram +5% no campo', base: 400000, max: 10, unlockedAtCollapse: 3 },
  { id: 'gaia', name: 'Observatório Gaia', text: 'O sorteio mostra o efeito já na carta', base: 1500000, max: 1, unlockedAtCollapse: 5 },
];

const UPGRADE_INDEX = new Map(UPGRADES.map((u, i) => [u.id, i]));
export function upgradeIndex(id: string): number {
  return UPGRADE_INDEX.get(id) ?? -1;
}

// --- Objetos no espaço (seção 4.5 e 5.4) ---

export interface ObjectDef {
  kind: ObjectKind;
  name: string;
  unlockedAtCollapse: number;
  /** Peso no sorteio entre os objetos já abertos (comet 50 / estrela 25 / satélite 25, seção 4.5). */
  weight: number;
  /** Tempo no campo, em segundos. */
  lifeSec: number;
}

export const OBJECTS: readonly ObjectDef[] = [
  { kind: 'comet', name: 'Cometa', unlockedAtCollapse: 0, weight: 50, lifeSec: 7 },
  { kind: 'shooting-star', name: 'Estrela cadente', unlockedAtCollapse: 0, weight: 25, lifeSec: 7 },
  { kind: 'satellite', name: 'Satélite', unlockedAtCollapse: 0, weight: 25, lifeSec: 7 },
  { kind: 'asteroid', name: 'Asteroide', unlockedAtCollapse: 1, weight: 20, lifeSec: 11 },
  { kind: 'probe', name: 'Sonda Voyager', unlockedAtCollapse: 2, weight: 8, lifeSec: 6 },
];

/**
 * Recompensas base, em unidades de toque (poeira de toque e energia de toque). A energia dos objetos
 * NÃO é % da barra como na spec 6.2: com a barra crescendo x1,35 por escolha, uma estrela de 10% da
 * barra dava uma escolha a cada poucos minutos em qualquer fase e anulava o passo de energia.
 */
export const OBJECT_REWARD = {
  cometTouches: 20,
  asteroidTouches: 12,
  asteroidEnergyTouches: 3,
  starEnergyTouches: 8,
  satelliteMult: 2,
  satelliteSec: 8,
} as const;

// --- Regiões (cenário de cada colapso, seção 5.4; a arte vem na etapa 12) ---

export interface RegionDef {
  id: string;
  name: string;
  unlockedAtCollapse: number;
}

export const REGIONS: readonly RegionDef[] = [
  { id: 'inner-solar-system', name: 'Sistema Solar interno', unlockedAtCollapse: 0 },
  { id: 'asteroid-belt', name: 'Cinturão de Asteroides', unlockedAtCollapse: 1 },
  { id: 'jupiter-saturn', name: 'Júpiter e Saturno', unlockedAtCollapse: 2 },
  { id: 'kuiper-belt', name: 'Cinturão de Kuiper', unlockedAtCollapse: 3 },
  { id: 'oort-cloud', name: 'Nuvem de Oort', unlockedAtCollapse: 4 },
  { id: 'alpha-centauri', name: 'Alfa Centauro', unlockedAtCollapse: 5 },
];

// --- Bônus de conjunto do Atlas por família (seção 8.2): com 2, 3 e 4+ páginas ---

export const SET_BONUS_THRESHOLDS = [2, 3, 4] as const;

export const SET_BONUSES: Record<Family, [Effect, Effect, Effect]> = {
  planets: [
    { kind: 'dustPerTouchPct', pct: 5 },
    { kind: 'dustPerTouchPct', pct: 12 },
    { kind: 'dustPerTouchPct', pct: 25 },
  ],
  moons: [
    { kind: 'energyPerTouchPct', pct: 5 },
    { kind: 'energyPerTouchPct', pct: 12 },
    { kind: 'energyPerTouchPct', pct: 25 },
  ],
  'small-bodies': [
    { kind: 'objectDuration', target: 'all', pct: 10 },
    { kind: 'objectDuration', target: 'all', pct: 20 },
    { kind: 'objectDuration', target: 'all', pct: 35 },
  ],
  stars: [
    { kind: 'comboMax', add: 1 },
    { kind: 'comboMax', add: 2 },
    { kind: 'comboMax', add: 3 },
  ],
  nebulae: [
    { kind: 'upgradeCostPct', pct: -3 },
    { kind: 'upgradeCostPct', pct: -6 },
    { kind: 'upgradeCostPct', pct: -10 },
  ],
  'black-holes': [
    { kind: 'forbiddenPower', pct: 20, priceCutPct: 25 },
    { kind: 'forbiddenPower', pct: 40, priceCutPct: 50 },
    { kind: 'forbiddenPower', pct: 80, priceCutPct: 75 },
  ],
};

// --- Árvore de Habilidades (seção 8.3): 6 ramos x 3 níveis, custo 1, 2 e 4 Fragmentos ---

export const TREE_COSTS = [1, 2, 4] as const;

export interface TreeBranchDef {
  id: string;
  name: string;
  text: string;
  /** Efeito de cada nível (o nível 2 substitui o 1; não acumulam). */
  levels: [Effect[], Effect[], Effect[]];
}

export const TREE: readonly TreeBranchDef[] = [
  {
    id: 'alpha-centauri',
    name: 'Sistema Alfa Centauro',
    text: 'Poeira por toque +10% / +20% / +35%',
    levels: [[{ kind: 'dustPerTouchPct', pct: 10 }], [{ kind: 'dustPerTouchPct', pct: 20 }], [{ kind: 'dustPerTouchPct', pct: 35 }]],
  },
  {
    id: 'crab-nebula',
    name: 'Nebulosa do Caranguejo',
    text: 'Energia por toque +10% / +20% / +35%',
    levels: [[{ kind: 'energyPerTouchPct', pct: 10 }], [{ kind: 'energyPerTouchPct', pct: 20 }], [{ kind: 'energyPerTouchPct', pct: 35 }]],
  },
  {
    id: 'kuiper-belt',
    name: 'Cinturão de Kuiper',
    text: '+1 / +2 / +3 objetos máximos na tela',
    levels: [[{ kind: 'maxObjects', add: 1 }], [{ kind: 'maxObjects', add: 2 }], [{ kind: 'maxObjects', add: 3 }]],
  },
  {
    id: 'saturn-rings',
    name: 'Anéis de Saturno',
    text: 'Janela do combo +15% / +30% / +50%',
    levels: [[{ kind: 'comboWindow', pct: 15 }], [{ kind: 'comboWindow', pct: 30 }], [{ kind: 'comboWindow', pct: 50 }]],
  },
  {
    id: 'pleiades',
    name: 'Plêiades',
    text: 'Cada vida começa com 1 / 2 / 4 níveis do Pulso Solar de graça',
    levels: [
      [{ kind: 'freeUpgradeLevels', upgrade: 'pulse', levels: 1 }],
      [{ kind: 'freeUpgradeLevels', upgrade: 'pulse', levels: 2 }],
      [{ kind: 'freeUpgradeLevels', upgrade: 'pulse', levels: 4 }],
    ],
  },
  {
    id: 'event-horizon',
    name: 'Horizonte de Eventos',
    text: 'Proibidos liberam com 18 / 14 / 10 escolhas e custam 20% / 40% / 60% menos',
    levels: [
      [{ kind: 'forbiddenUnlock', picks: 18 }, { kind: 'forbiddenPower', pct: 0, priceCutPct: 20 }],
      [{ kind: 'forbiddenUnlock', picks: 14 }, { kind: 'forbiddenPower', pct: 0, priceCutPct: 40 }],
      [{ kind: 'forbiddenUnlock', picks: 10 }, { kind: 'forbiddenPower', pct: 0, priceCutPct: 60 }],
    ],
  },
];

export function treeNodeId(branchId: string, level: number): string {
  return `${branchId}:${level}`;
}
