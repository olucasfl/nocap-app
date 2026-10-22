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
 * Primitivas de efeito (seção 7.3). Os grimórios falam em NÚMEROS (poeira, energia, segundos, toques);
 * só os multiplicadores (x2, x3) e as trocas dos proibidos seguem como fator. `price: true` marca a
 * metade "com preço" de um proibido (o `forbiddenTradeoff`): o bônus de Buracos negros e a árvore
 * reduzem só o preço e reforçam só o ganho.
 *
 * As primitivas em % (`dustPerTouchPct`, `energyPerTouchPct`, `comboWindow.pct`, `objectDuration`,
 * `maxObjects`, `upgradeCostPct` das famílias) são do Atlas e da árvore, não de grimório.
 */
export type Effect = (
  // Atlas (bônus de conjunto) e árvore
  | { kind: 'dustPerTouchPct'; pct: number }
  | { kind: 'energyPerTouchPct'; pct: number }
  | { kind: 'objectDuration'; target: ObjectTarget; pct: number }
  | { kind: 'maxObjects'; add: number }
  | { kind: 'comboMax'; add: number }
  | { kind: 'freeUpgradeLevels'; upgrade: string; levels: number }
  | { kind: 'forbiddenUnlock'; picks: number }
  | { kind: 'forbiddenPower'; pct: number; priceCutPct: number }
  // Grimórios (e também a árvore, no caso de `comboWindow.pct` e `upgradeCostPct`)
  | { kind: 'comboWindow'; pct?: number; sec?: number; mult?: number }
  | { kind: 'upgradeCostPct'; pct: number }
  /** A cada `n` toques o toque vale `mult` vezes e soma `energy` de energia (número, não % da barra). */
  | { kind: 'everyNthTouch'; n: number; mult: number; energy?: number }
  /** Com o combo no máximo: +`add` de poeira por toque (soma ao toque, antes do combo). */
  | { kind: 'comboFullDust'; add: number }
  /** Com o combo no máximo: +`add` de energia por toque. */
  | { kind: 'comboFullEnergy'; add: number }
  /** Com o combo no máximo: poeira do toque x`mult`. */
  | { kind: 'comboFullMult'; mult: number }
  | { kind: 'dustMult'; mult: number }
  | { kind: 'energyMult'; mult: number }
  /** +`add` toques de recompensa no objeto: poeira (cometa, asteroide, satélite) ou energia (estrela cadente). */
  | { kind: 'objectReward'; target: ObjectTarget; add: number }
  | { kind: 'objectsDisabled' }
  /** O "Sinal forte" do satélite vale +`add` (x2 vira x2,5). */
  | { kind: 'satelliteMult'; add: number }
  | { kind: 'startDust'; amount: number }
  | { kind: 'choiceExtra'; reroll?: number; picks?: number; repeatLevels?: number; cards?: number }
  /** Energia de `energyTouches` toques por objeto capturado. */
  | { kind: 'onCapture'; energyTouches: number }
  | { kind: 'afterCaptureMult'; mult: number }
  /** +`add` de poeira por toque por grimório da raridade que está no livro. */
  | { kind: 'dustPerOwned'; rarity: Rarity; add: number }
  /** +`add` de poeira por toque por colapso já feito. */
  | { kind: 'dustPerCollapse'; add: number }
  /** Cada melhoria comprada devolve a poeira de `touches` toques. */
  | { kind: 'buyRefund'; touches: number }
  | { kind: 'energyStepPct'; pct: number }
) & { price?: true };

/**
 * Domínio de um efeito: o que ele mexe, em uma palavra. Melhorias e grimórios têm domínios
 * DIFERENTES (spec 038, 5.1): melhoria = poder básico contínuo, grimório = estilo e situação.
 * `catalog.test.ts` exige que nenhum grimório use um domínio de melhoria.
 */
export function effectDomain(e: Effect): string {
  switch (e.kind) {
    case 'dustPerTouchPct':
      return 'dustPerTouch';
    case 'energyPerTouchPct':
      return 'energyPerTouch';
    case 'objectDuration':
      return 'objectLife';
    case 'maxObjects':
      return 'objectRoom';
    case 'freeUpgradeLevels':
      return 'freeLevels';
    default:
      return e.kind;
  }
}

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
  grim('moon', 'Lua', 'common', 'moons', 'A cada 10 toques, o toque vale o dobro', 'esfera cinza clara com crateras', [
    { kind: 'everyNthTouch', n: 10, mult: 2 },
  ]),
  grim('mercury', 'Mercúrio', 'common', 'planets', 'A cada 5 toques, +2 de energia', 'esfera marrom-cinza, crateras pequenas', [
    { kind: 'everyNthTouch', n: 5, mult: 1, energy: 2 },
  ]),
  grim('venus', 'Vênus', 'common', 'planets', 'Cometas dão +3 toques de poeira', 'esfera creme-dourada com faixas de nuvem', [
    { kind: 'objectReward', target: 'comet', add: 3 },
  ]),
  grim('mars', 'Marte', 'common', 'planets', 'Estrelas cadentes dão +2 toques de energia', 'esfera ferrugem com calota polar branca', [
    { kind: 'objectReward', target: 'shooting-star', add: 2 },
  ]),
  grim('ceres', 'Ceres', 'common', 'small-bodies', 'Cada melhoria comprada devolve a poeira de 2 toques', 'rocha cinza com ponto brilhante', [
    { kind: 'buyRefund', touches: 2 },
  ]),
  grim('phobos', 'Fobos', 'common', 'moons', 'Cada objeto capturado dá a energia de 1 toque', 'rocha irregular com uma cratera grande', [
    { kind: 'onCapture', energyTouches: 1 },
  ]),
  grim('io', 'Io', 'common', 'moons', 'O sinal dos satélites vale x2,5 em vez de x2', 'esfera amarelo-enxofre com manchas vermelhas', [
    { kind: 'satelliteMult', add: 0.5 },
  ]),
  grim('vesta', 'Vesta', 'common', 'small-bodies', 'Com o combo no máximo, +0,5 poeira por toque', 'rocha clara com faixa escura', [
    { kind: 'comboFullDust', add: 0.5 },
  ]),
  grim('halley', 'Halley', 'common', 'small-bodies', 'Todo objeto vale +1 toque a mais', 'núcleo claro com cauda azul', [
    { kind: 'objectReward', target: 'all', add: 1 },
  ]),
  grim('uranus', 'Urano', 'common', 'planets', 'A janela do combo dura +0,2 s', 'esfera ciano-gelo com anel fino vertical', [
    { kind: 'comboWindow', sec: 0.2 },
  ]),

  // Raros
  grim('europa', 'Europa', 'rare', 'moons', 'A janela do combo dura +0,5 s', 'esfera branca com rachaduras marrons', [
    { kind: 'comboWindow', sec: 0.5 },
  ]),
  grim('titan', 'Titã', 'rare', 'moons', 'Cada vida começa com 200 de poeira', 'esfera laranja com névoa', [
    { kind: 'startDust', amount: 200 },
  ]),
  grim('jupiter', 'Júpiter', 'rare', 'planets', 'A cada 10 toques, o toque vale o triplo', 'esfera com faixas marrons e a grande mancha vermelha', [
    { kind: 'everyNthTouch', n: 10, mult: 3 },
  ]),
  grim('saturn', 'Saturno', 'rare', 'planets', 'Cada melhoria comprada devolve a poeira de 5 toques', 'esfera dourada com anéis inclinados', [
    { kind: 'buyRefund', touches: 5 },
  ]),
  grim('neptune', 'Netuno', 'rare', 'planets', 'O sinal dos satélites vale x3 em vez de x2', 'esfera azul-profundo com faixa branca', [
    { kind: 'satelliteMult', add: 1 },
  ]),
  grim('ganymede', 'Ganimedes', 'rare', 'moons', 'Com o combo no máximo, +0,5 de energia por toque', 'esfera cinza com sulcos claros', [
    { kind: 'comboFullEnergy', add: 0.5 },
  ]),
  grim('pluto', 'Plutão', 'rare', 'small-bodies', 'Todo objeto vale +2 toques a mais', 'esfera bege com "coração" claro', [
    { kind: 'objectReward', target: 'all', add: 2 },
  ]),
  grim('triton', 'Tritão', 'rare', 'moons', 'Cada objeto capturado dá a energia de 3 toques', 'esfera rosada com calota de gelo', [
    { kind: 'onCapture', energyTouches: 3 },
  ]),

  // Épicos
  grim('sirius', 'Sirius', 'epic', 'stars', 'Com o combo no máximo, +2 poeira por toque', 'estrela branca de 4 pontas com halo azul', [
    { kind: 'comboFullDust', add: 2 },
  ]),
  grim('vega', 'Vega', 'epic', 'stars', 'Cada grimório comum no livro soma +0,5 poeira por toque', 'estrela branco-azulada de 8 raios', [
    { kind: 'dustPerOwned', rarity: 'common', add: 0.5 },
  ]),
  grim('betelgeuse', 'Betelgeuse', 'epic', 'stars', 'Troque 1 das opções (1 vez por escolha)', 'gigante laranja com manchas', [
    { kind: 'choiceExtra', reroll: 1 },
  ]),
  grim('polaris', 'Polaris', 'epic', 'stars', 'O toque depois de capturar um objeto vale x5', 'estrela azul-branca com halo fino', [
    { kind: 'afterCaptureMult', mult: 5 },
  ]),
  grim('antares', 'Antares', 'epic', 'stars', 'Todo objeto vale +4 toques a mais', 'gigante vermelha com brilho', [
    { kind: 'objectReward', target: 'all', add: 4 },
  ]),
  grim('crab-nebula', 'Nebulosa do Caranguejo', 'epic', 'nebulae', 'Grimório repetido sobe 2 níveis', 'filamentos laranja e azuis', [
    { kind: 'choiceExtra', repeatLevels: 1 },
  ]),

  // Lendários
  grim('orion-nebula', 'Nebulosa de Órion', 'legendary', 'nebulae', 'Ao encher a energia, escolha 2 grimórios', 'nuvem rosa, turquesa e violeta com estrelas', [
    { kind: 'choiceExtra', picks: 1 },
  ]),
  grim('milky-way', 'Via Láctea', 'legendary', 'nebulae', 'Cada grimório raro no livro soma +1 poeira por toque', 'galáxia espiral de 4 braços', [
    { kind: 'dustPerOwned', rarity: 'rare', add: 1 },
  ]),
  grim('andromeda', 'Andrômeda', 'legendary', 'nebulae', 'Cada colapso já feito soma +1 poeira por toque', 'espiral inclinada com núcleo claro', [
    { kind: 'dustPerCollapse', add: 1 },
  ]),

  // Proibidos (o preço vai marcado com `price`)
  grim('sagittarius-a', 'Sagitário A*', 'forbidden', 'black-holes', 'Poeira por toque x3, mas a energia por toque cai para x0,3', 'disco de acreção dourado ao redor de círculo preto', [
    { kind: 'dustMult', mult: 3 },
    { kind: 'energyMult', mult: 0.3, price: true },
  ]),
  grim('cygnus-x1', 'Cygnus X-1', 'forbidden', 'black-holes', 'Com o combo no máximo, a poeira vale x2 e a janela dura o dobro, mas os objetos no espaço param de aparecer', 'buraco negro com estrela azul companheira', [
    { kind: 'comboFullMult', mult: 2 },
    { kind: 'comboWindow', mult: 2 },
    { kind: 'objectsDisabled', price: true },
  ], 3),
  grim('m87', 'M87*', 'forbidden', 'black-holes', 'Melhorias custam 30% menos, mas cada energia para o próximo grimório custa +25%', 'buraco negro com jato de luz', [
    { kind: 'upgradeCostPct', pct: -30 },
    { kind: 'energyStepPct', pct: 25, price: true },
  ], 5),

  // Colapsos 1 a 5 (seção 5.4)
  grim('pallas', 'Palas', 'common', 'small-bodies', 'Com o combo no máximo, +0,25 de energia por toque', 'rocha acinzentada com sulcos', [
    { kind: 'comboFullEnergy', add: 0.25 },
  ], 1),
  grim('hygiea', 'Hygiea', 'common', 'small-bodies', 'A cada 8 toques, +3 de energia', 'esfera escura quase redonda', [
    { kind: 'everyNthTouch', n: 8, mult: 1, energy: 3 },
  ], 1),
  grim('callisto', 'Calisto', 'rare', 'moons', 'Satélites capturados dão +4 toques de poeira', 'esfera cinza-marrom com crateras claras', [
    { kind: 'objectReward', target: 'satellite', add: 4 },
  ], 2),
  grim('enceladus', 'Encélado', 'rare', 'moons', 'Estrelas cadentes dão +4 toques de energia', 'esfera branca com jatos de gelo', [
    { kind: 'objectReward', target: 'shooting-star', add: 4 },
  ], 2),
  grim('eris', 'Éris', 'rare', 'small-bodies', 'Asteroides dão +6 toques de poeira', 'esfera clara com lua pequena', [
    { kind: 'objectReward', target: 'asteroid', add: 6 },
  ], 3),
  grim('haumea', 'Haumea', 'common', 'small-bodies', 'A janela do combo dura +0,3 s', 'elipsoide branco com anel', [
    { kind: 'comboWindow', sec: 0.3 },
  ], 3),
  grim('sedna', 'Sedna', 'epic', 'small-bodies', 'Cometas dão +15 toques de poeira', 'esfera vermelho-escura distante', [
    { kind: 'objectReward', target: 'comet', add: 15 },
  ], 4),
  grim('hale-bopp', 'Hale-Bopp', 'rare', 'small-bodies', 'Cometas dão +10 toques de poeira', 'núcleo com duas caudas, azul e branca', [
    { kind: 'objectReward', target: 'comet', add: 10 },
  ], 4),
  grim('proxima-centauri', 'Proxima Centauri', 'rare', 'stars', 'Com o combo no máximo, +1 poeira por toque', 'anã vermelha com chama pequena', [
    { kind: 'comboFullDust', add: 1 },
  ], 5),
  grim('alpha-centauri-a', 'Alfa Centauri A', 'epic', 'stars', 'A cada 25 toques, o toque vale x6', 'estrela amarela com halo dourado', [
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
  /** Custo do nível 0; cada nível multiplica por `growth` (suave, ~x1,13 nas primeiras compras). */
  base: number;
  growth: number;
  /** Depois de `from` níveis o fator por nível passa a `growth` de cá: o custo sobe mais que o ganho. */
  steep?: { from: number; growth: number };
  max: number;
  unlockedAtCollapse: number;
  /**
   * Liberação progressiva (spec 038, 5.1): a melhoria abre quando a vida já ganhou `dust` de poeira OU
   * quando a outra melhoria chega ao nível pedido. Sem `unlock`, abre no início. Depois do 1º colapso
   * as melhorias já conhecidas abrem no início da vida (o marco só vale na 1ª vida).
   */
  unlock?: { dust?: number; upgrade?: { id: string; level: number } };
  /** Exige a outra comprada, além do marco ("Plêiades exige a Ressonância"). */
  requiresUpgrade?: { id: string; level: number };
  /**
   * Domínios de efeito que a melhoria controla (ver `effectDomain`). Nenhum grimório pode usá-los:
   * melhoria é poder básico contínuo, grimório é estilo e situação.
   */
  domains: readonly string[];
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'pulse', name: 'Pulso Solar', text: '+1 poeira por toque', base: 25, growth: 1.12, steep: { from: 5, growth: 1.7 }, max: 40, unlockedAtCollapse: 0, domains: ['dustPerTouch'] },
  {
    id: 'resonance',
    name: 'Ressonância de Vênus',
    text: 'Libera o combo; níveis seguintes: cada ponto de combo vale mais',
    base: 150,
    growth: 1.35,
    max: 5,
    unlockedAtCollapse: 0,
    unlock: { dust: 100, upgrade: { id: 'pulse', level: 4 } },
    domains: ['comboUnlock', 'comboPoint'],
  },
  {
    id: 'reactor',
    name: 'Reator de Aldebarã',
    text: '+0,25 de energia por toque',
    base: 400,
    growth: 1.3, steep: { from: 3, growth: 1.7 },
    max: 20,
    unlockedAtCollapse: 0,
    unlock: { dust: 300, upgrade: { id: 'pulse', level: 8 } },
    domains: ['energyPerTouch'],
  },
  {
    id: 'pleiades',
    name: 'Alinhamento das Plêiades',
    text: 'Combo máximo +1',
    base: 1500,
    growth: 1.9,
    max: 5,
    unlockedAtCollapse: 0,
    unlock: { dust: 1000, upgrade: { id: 'resonance', level: 2 } },
    requiresUpgrade: { id: 'resonance', level: 1 },
    domains: ['comboMax'],
  },
  {
    id: 'kepler',
    name: 'Sonda Kepler',
    text: 'Objetos aparecem 3 s mais cedo; o 1º nível abre mais um lugar no campo',
    base: 4000,
    growth: 1.9,
    max: 5,
    unlockedAtCollapse: 0,
    unlock: { dust: 2500, upgrade: { id: 'reactor', level: 4 } },
    domains: ['objectSpawn', 'objectRoom'],
  },
  {
    id: 'hubble',
    name: 'Telescópio Hubble',
    text: '+1 poeira por segundo, sem tocar',
    base: 800,
    growth: 1.3, steep: { from: 4, growth: 1.7 },
    max: 30,
    unlockedAtCollapse: 0,
    unlock: { dust: 600, upgrade: { id: 'pulse', level: 10 } },
    domains: ['dustPerSecond'],
  },
  {
    id: 'voyager',
    name: 'Voyager',
    text: 'Satélites duram +1 s',
    base: 12000,
    growth: 1.7,
    max: 8,
    unlockedAtCollapse: 0,
    unlock: { dust: 8000, upgrade: { id: 'kepler', level: 2 } },
    domains: ['signalDuration'],
  },
  {
    id: 'webb',
    name: 'Observatório James Webb',
    text: '+5 poeira por toque',
    base: 120000,
    growth: 1.45,
    max: 20,
    unlockedAtCollapse: 1,
    domains: ['dustPerTouch'],
  },
  {
    id: 'chandra',
    name: 'Telescópio Chandra',
    text: 'Objetos ficam +0,5 s no campo',
    base: 300000,
    growth: 1.6,
    max: 10,
    unlockedAtCollapse: 3,
    domains: ['objectLife'],
  },
  { id: 'gaia', name: 'Observatório Gaia', text: 'O sorteio mostra o efeito já na carta', base: 1500000, growth: 1.5, max: 1, unlockedAtCollapse: 5, domains: ['cardInfo'] },
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
 * Reformulação (spec 6.2): no começo os objetos são raros e fracos; Kepler e grimórios os melhoram.
 */
export const OBJECT_REWARD = {
  cometTouches: 6,
  asteroidTouches: 4,
  asteroidEnergyTouches: 1,
  starEnergyTouches: 2,
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
