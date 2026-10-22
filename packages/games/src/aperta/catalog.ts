// Catálogo do Aperta! (spec 038, seções 5 e 8). Tudo aqui é DADO: o motor só conhece as
// primitivas de efeito da seção 7.3, então um grimório novo é uma linha nesta tabela.
// Textos para o jogador ficam em pt-BR; ids e código em inglês.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'forbidden';
export type Family = 'planets' | 'moons' | 'small-bodies' | 'stars' | 'nebulae' | 'black-holes';
export type ObjectKind = 'comet' | 'shooting-star' | 'satellite' | 'asteroid' | 'probe' | 'golden';
/** O que a Estrela Dourada faz ao ser pega (sorteado quando ela nasce, para a etiqueta mostrar antes). */
export type RareEffect = 'frenzy' | 'rain' | 'surge';
export const RARE_EFFECTS: readonly RareEffect[] = ['frenzy', 'rain', 'surge'];
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
  /** Geradores de poeira rendem +`pct`%. */
  | { kind: 'generatorPct'; pct: number }
  /** Geradores de energia rendem +`pct`%. */
  | { kind: 'energyGenPct'; pct: number }
  /** Os geradores contam como "tocando" por +`sec` segundos depois de cada toque. */
  | { kind: 'activeWindow'; sec: number }
  /** Parado, os geradores rendem +`add` (0,1 = +10 pontos) do ritmo ativo; nunca passa de 50%. */
  | { kind: 'idleFloor'; add: number }
  /** Os objetos comuns aparecem `sec` segundos mais cedo (a janela de 60 a 90 s encurta, com piso). */
  | { kind: 'spawnCut'; sec: number }
  /** A Estrela Dourada vem `sec` segundos mais cedo (o intervalo nunca fica abaixo de 5 min). */
  | { kind: 'rareCut'; sec: number }
  /** A Estrela Dourada fica +`sec` segundos no campo. */
  | { kind: 'rareLife'; sec: number }
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

/**
 * Categoria de um grimório: o que ele ajuda, visível na carta (a família é a do astro e conta para o conjunto
 * do Atlas; a categoria é a função). Todo grimório tem categoria e raridade.
 */
export type GrimoireCategory = 'touch' | 'objects' | 'generators' | 'luck';

export const GRIMOIRE_CATEGORIES: readonly { id: GrimoireCategory; label: string; hint: string }[] = [
  { id: 'touch', label: 'Toque', hint: 'Faz cada toque render mais.' },
  { id: 'objects', label: 'Objetos', hint: 'Melhora os cometas, satélites e a Estrela Dourada.' },
  { id: 'generators', label: 'Geradores', hint: 'Turbina o ganho automático.' },
  { id: 'luck', label: 'Energia e sorte', hint: 'Enche a barra, ajuda nas escolhas e na economia.' },
];

const CATEGORY_OF: Record<string, GrimoireCategory> = {
  // Toque
  moon: 'touch', jupiter: 'touch', vesta: 'touch', sirius: 'touch', 'proxima-centauri': 'touch', vega: 'touch',
  'milky-way': 'touch', andromeda: 'touch', uranus: 'touch', europa: 'touch', haumea: 'touch',
  'alpha-centauri-a': 'touch', 'sagittarius-a': 'touch', 'cygnus-x1': 'touch', deimos: 'touch', rigel: 'touch',
  aldebaran: 'touch',
  // Objetos
  venus: 'objects', mars: 'objects', halley: 'objects', pluto: 'objects', antares: 'objects', io: 'objects',
  neptune: 'objects', callisto: 'objects', enceladus: 'objects', eris: 'objects', sedna: 'objects',
  'hale-bopp': 'objects', polaris: 'objects', triton: 'objects', phobos: 'objects', 'voyager-1': 'objects',
  oumuamua: 'objects', ryugu: 'objects', 'golden-record': 'objects',
  // Geradores
  pallas: 'generators', hygiea: 'generators', earth: 'generators', sun: 'generators', 'kepler-22b': 'generators',
  'pleiades-cluster': 'generators', 'trappist-1': 'generators', 'vela-pulsar': 'generators', sombrero: 'generators',
  // Energia e sorte
  mercury: 'luck', ceres: 'luck', saturn: 'luck', titan: 'luck', ganymede: 'luck', betelgeuse: 'luck',
  'crab-nebula': 'luck', 'orion-nebula': 'luck', m87: 'luck', charon: 'luck', tethys: 'luck', horsehead: 'luck',
  pillars: 'luck',
};

export interface GrimoireDef {
  id: string;
  name: string;
  rarity: Rarity;
  family: Family;
  category: GrimoireCategory;
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
  const category = CATEGORY_OF[id];
  if (!category) throw new Error(`Grimório sem categoria: ${id}`);
  return { id, name, rarity, family, category, text, art, effects, unlockedAtCollapse };
}

export const GRIMOIRES: readonly GrimoireDef[] = [
  // Comuns
  grim('moon', 'Lua', 'common', 'moons', 'A cada 10 toques, o 10º toque rende o dobro de poeira.', 'esfera cinza clara com crateras', [
    { kind: 'everyNthTouch', n: 10, mult: 2 },
  ]),
  grim('mercury', 'Mercúrio', 'common', 'planets', 'A cada 5 toques, o 5º toque dá +2 de energia (enche a barra de grimórios).', 'esfera marrom-cinza, crateras pequenas', [
    { kind: 'everyNthTouch', n: 5, mult: 1, energy: 2 },
  ]),
  grim('venus', 'Vênus', 'common', 'planets', 'Cada cometa capturado dá +3 toques de poeira (3 vezes o que o seu toque rende).', 'esfera creme-dourada com faixas de nuvem', [
    { kind: 'objectReward', target: 'comet', add: 3 },
  ]),
  grim('mars', 'Marte', 'common', 'planets', 'Cada estrela cadente capturada dá +2 toques de energia (2 vezes a energia do seu toque).', 'esfera ferrugem com calota polar branca', [
    { kind: 'objectReward', target: 'shooting-star', add: 2 },
  ]),
  grim('ceres', 'Ceres', 'common', 'small-bodies', 'Cada melhoria que você compra devolve a poeira de 2 toques.', 'rocha cinza com ponto brilhante', [
    { kind: 'buyRefund', touches: 2 },
  ]),
  grim('phobos', 'Fobos', 'common', 'moons', 'Capturar um objeto dá a energia de 1 toque, e os geradores de energia rendem x1,1.', 'rocha irregular com uma cratera grande', [
    { kind: 'onCapture', energyTouches: 1 },
    { kind: 'energyGenPct', pct: 10 },
  ]),
  grim('io', 'Io', 'common', 'moons', 'Satélite capturado: o toque rende x2,5 por 8 s, em vez de x2.', 'esfera amarelo-enxofre com manchas vermelhas', [
    { kind: 'satelliteMult', add: 0.5 },
  ]),
  grim('vesta', 'Vesta', 'common', 'small-bodies', 'Combo (toques em sequência rápida) no máximo: cada toque rende +0,5 de poeira a mais.', 'rocha clara com faixa escura', [
    { kind: 'comboFullDust', add: 0.5 },
  ]),
  grim('halley', 'Halley', 'common', 'small-bodies', 'Cada objeto capturado dá +1 toque de recompensa e os objetos aparecem 4 s mais cedo.', 'núcleo claro com cauda azul', [
    { kind: 'objectReward', target: 'all', add: 1 },
    { kind: 'spawnCut', sec: 4 },
  ]),
  grim('uranus', 'Urano', 'common', 'planets', 'Combo (toques em sequência rápida, liberado pelo Ritmo Firme): +0,2 s de folga entre os toques para não perder a sequência.', 'esfera ciano-gelo com anel fino vertical', [
    { kind: 'comboWindow', sec: 0.2 },
  ]),

  // Raros
  grim('europa', 'Europa', 'rare', 'moons', 'Combo (toques em sequência rápida, liberado pelo Ritmo Firme): +0,5 s de folga entre os toques para não perder a sequência.', 'esfera branca com rachaduras marrons', [
    { kind: 'comboWindow', sec: 0.5 },
  ]),
  grim('titan', 'Titã', 'rare', 'moons', 'Cada vida começa com 200 de poeira.', 'esfera laranja com névoa', [
    { kind: 'startDust', amount: 200 },
  ]),
  grim('jupiter', 'Júpiter', 'rare', 'planets', 'A cada 10 toques, o 10º toque rende o triplo de poeira.', 'esfera com faixas marrons e a grande mancha vermelha', [
    { kind: 'everyNthTouch', n: 10, mult: 3 },
  ]),
  grim('saturn', 'Saturno', 'rare', 'planets', 'Cada melhoria que você compra devolve a poeira de 5 toques.', 'esfera dourada com anéis inclinados', [
    { kind: 'buyRefund', touches: 5 },
  ]),
  grim('neptune', 'Netuno', 'rare', 'planets', 'Satélite capturado: o toque rende x3 por 8 s, em vez de x2.', 'esfera azul-profundo com faixa branca', [
    { kind: 'satelliteMult', add: 1 },
  ]),
  grim('ganymede', 'Ganimedes', 'rare', 'moons', 'Combo (toques em sequência rápida) no máximo: +0,5 de energia por toque. Parado, os geradores rendem 0,35 do ritmo de quando você toca.', 'esfera cinza com sulcos claros', [
    { kind: 'comboFullEnergy', add: 0.5 },
    { kind: 'idleFloor', add: 0.1 },
  ]),
  grim('pluto', 'Plutão', 'rare', 'small-bodies', 'Cada objeto capturado dá +2 toques de recompensa e os objetos aparecem 6 s mais cedo.', 'esfera bege com "coração" claro', [
    { kind: 'objectReward', target: 'all', add: 2 },
    { kind: 'spawnCut', sec: 6 },
  ]),
  grim('triton', 'Tritão', 'rare', 'moons', 'Capturar um objeto dá a energia de 3 toques.', 'esfera rosada com calota de gelo', [
    { kind: 'onCapture', energyTouches: 3 },
  ]),

  // Épicos
  grim('sirius', 'Sirius', 'epic', 'stars', 'Combo (toques em sequência rápida) no máximo: cada toque rende +2 de poeira a mais.', 'estrela branca de 4 pontas com halo azul', [
    { kind: 'comboFullDust', add: 2 },
  ]),
  grim('vega', 'Vega', 'epic', 'stars', 'Cada grimório comum que você tem soma +0,5 de poeira por toque.', 'estrela branco-azulada de 8 raios', [
    { kind: 'dustPerOwned', rarity: 'common', add: 0.5 },
  ]),
  grim('betelgeuse', 'Betelgeuse', 'epic', 'stars', 'Quando a barra enche, você pode trocar 1 das 3 cartas oferecidas (1 vez por escolha).', 'gigante laranja com manchas', [
    { kind: 'choiceExtra', reroll: 1 },
  ]),
  grim('polaris', 'Polaris', 'epic', 'stars', 'O toque logo depois de capturar um objeto rende x5.', 'estrela azul-branca com halo fino', [
    { kind: 'afterCaptureMult', mult: 5 },
  ]),
  grim('antares', 'Antares', 'epic', 'stars', 'Cada objeto capturado dá +4 toques de recompensa, e a Estrela Dourada vem 45 s mais cedo.', 'gigante vermelha com brilho', [
    { kind: 'objectReward', target: 'all', add: 4 },
    { kind: 'rareCut', sec: 45 },
  ]),
  grim('crab-nebula', 'Nebulosa do Caranguejo', 'epic', 'nebulae', 'Pegar um grimório que você já tem faz ele subir 2 níveis em vez de 1.', 'filamentos laranja e azuis', [
    { kind: 'choiceExtra', repeatLevels: 1 },
  ]),

  // Lendários
  grim('orion-nebula', 'Nebulosa de Órion', 'legendary', 'nebulae', 'Quando a barra de energia enche, você escolhe 2 grimórios em vez de 1.', 'nuvem rosa, turquesa e violeta com estrelas', [
    { kind: 'choiceExtra', picks: 1 },
  ]),
  grim('milky-way', 'Via Láctea', 'legendary', 'nebulae', 'Cada grimório raro que você tem soma +1 de poeira por toque, e os geradores de poeira rendem x1,3.', 'galáxia espiral de 4 braços', [
    { kind: 'dustPerOwned', rarity: 'rare', add: 1 },
    { kind: 'generatorPct', pct: 30 },
  ]),
  grim('andromeda', 'Andrômeda', 'legendary', 'nebulae', 'Cada colapso que você já fez soma +1 de poeira por toque.', 'espiral inclinada com núcleo claro', [
    { kind: 'dustPerCollapse', add: 1 },
  ]),

  // Proibidos (o preço vai marcado com `price`)
  grim('sagittarius-a', 'Sagitário A*', 'forbidden', 'black-holes', 'O toque rende x3 de poeira, mas dá só x0,3 da energia (os grimórios demoram mais para chegar).', 'disco de acreção dourado ao redor de círculo preto', [
    { kind: 'dustMult', mult: 3 },
    { kind: 'energyMult', mult: 0.3, price: true },
  ]),
  grim('cygnus-x1', 'Cygnus X-1', 'forbidden', 'black-holes', 'Combo (toques em sequência rápida) no máximo: o toque rende x2 e a folga entre toques dobra, mas os objetos param de aparecer.', 'buraco negro com estrela azul companheira', [
    { kind: 'comboFullMult', mult: 2 },
    { kind: 'comboWindow', mult: 2 },
    { kind: 'objectsDisabled', price: true },
  ], 3),
  grim('m87', 'M87*', 'forbidden', 'black-holes', 'Melhorias custam 30% menos, mas a barra de energia do próximo grimório fica 25% maior.', 'buraco negro com jato de luz', [
    { kind: 'upgradeCostPct', pct: -30 },
    { kind: 'energyStepPct', pct: 25, price: true },
  ], 5),

  // Colapsos 1 a 5 (seção 5.4)
  grim('pallas', 'Palas', 'common', 'small-bodies', 'Os geradores de energia rendem x1,15.', 'rocha acinzentada com sulcos', [
    { kind: 'energyGenPct', pct: 15 },
  ], 1),
  grim('hygiea', 'Hygiea', 'common', 'small-bodies', 'A cada 8 toques, o 8º toque dá +3 de energia, e os geradores de poeira rendem x1,06.', 'esfera escura quase redonda', [
    { kind: 'everyNthTouch', n: 8, mult: 1, energy: 3 },
    { kind: 'generatorPct', pct: 6 },
  ], 1),
  grim('callisto', 'Calisto', 'rare', 'moons', 'Cada satélite capturado dá +4 toques de poeira (4 vezes o que o seu toque rende).', 'esfera cinza-marrom com crateras claras', [
    { kind: 'objectReward', target: 'satellite', add: 4 },
  ], 2),
  grim('enceladus', 'Encélado', 'rare', 'moons', 'Cada estrela cadente capturada dá +4 toques de energia (4 vezes a energia do seu toque).', 'esfera branca com jatos de gelo', [
    { kind: 'objectReward', target: 'shooting-star', add: 4 },
  ], 2),
  grim('eris', 'Éris', 'rare', 'small-bodies', 'Cada asteroide capturado dá +6 toques de poeira (6 vezes o que o seu toque rende).', 'esfera clara com lua pequena', [
    { kind: 'objectReward', target: 'asteroid', add: 6 },
  ], 3),
  grim('haumea', 'Haumea', 'common', 'small-bodies', 'Combo (toques em sequência rápida): +0,3 s de folga entre os toques. Os geradores seguem cheios por +2 s depois de cada toque.', 'elipsoide branco com anel', [
    { kind: 'comboWindow', sec: 0.3 },
    { kind: 'activeWindow', sec: 2 },
  ], 3),
  grim('sedna', 'Sedna', 'epic', 'small-bodies', 'Cada cometa capturado dá +15 toques de poeira (15 vezes o que o seu toque rende).', 'esfera vermelho-escura distante', [
    { kind: 'objectReward', target: 'comet', add: 15 },
  ], 4),
  grim('hale-bopp', 'Hale-Bopp', 'rare', 'small-bodies', 'Cada cometa capturado dá +10 toques de poeira (10 vezes o que o seu toque rende).', 'núcleo com duas caudas, azul e branca', [
    { kind: 'objectReward', target: 'comet', add: 10 },
  ], 4),
  grim('proxima-centauri', 'Proxima Centauri', 'rare', 'stars', 'Combo (toques em sequência rápida) no máximo: +1 de poeira por toque. A Estrela Dourada fica +5 s no campo.', 'anã vermelha com chama pequena', [
    { kind: 'comboFullDust', add: 1 },
    { kind: 'rareLife', sec: 5 },
  ], 5),
  grim('alpha-centauri-a', 'Alfa Centauri A', 'epic', 'stars', 'A cada 25 toques, o 25º toque rende x6, e os geradores de poeira rendem x1,15.', 'estrela amarela com halo dourado', [
    { kind: 'everyNthTouch', n: 25, mult: 6 },
    { kind: 'generatorPct', pct: 15 },
  ], 5),

  // Economia v2 (spec 039): mais grimórios, para cada categoria ter de todas as raridades
  grim('earth', 'Terra', 'common', 'planets', 'Os geradores de poeira rendem x1,08.', 'esfera azul com nuvens e continentes', [
    { kind: 'generatorPct', pct: 8 },
  ]),
  grim('sun', 'Sol', 'rare', 'stars', 'Os geradores de poeira rendem x1,2.', 'esfera amarela com coroa de fogo', [
    { kind: 'generatorPct', pct: 20 },
  ]),
  grim('deimos', 'Deimos', 'common', 'moons', 'A cada 15 toques, o 15º toque rende x4 de poeira.', 'rocha pequena e irregular', [
    { kind: 'everyNthTouch', n: 15, mult: 4 },
  ]),
  grim('charon', 'Caronte', 'common', 'moons', 'Capturar um objeto dá a energia de 2 toques.', 'esfera cinza com faixa avermelhada', [
    { kind: 'onCapture', energyTouches: 2 },
  ]),
  grim('tethys', 'Tétis', 'rare', 'moons', 'A cada 6 toques, o 6º toque dá +3 de energia.', 'esfera clara com um vale enorme', [
    { kind: 'everyNthTouch', n: 6, mult: 1, energy: 3 },
  ]),
  grim('rigel', 'Rigel', 'rare', 'stars', 'Combo (toques em sequência rápida) no máximo: cada toque rende +1,5 de poeira a mais.', 'estrela azul brilhante', [
    { kind: 'comboFullDust', add: 1.5 },
  ]),
  grim('voyager-1', 'Voyager 1', 'rare', 'small-bodies', 'Os objetos do espaço aparecem 8 s mais cedo.', 'sonda com antena dourada', [
    { kind: 'spawnCut', sec: 8 },
  ]),
  grim('ryugu', 'Ryugu', 'common', 'small-bodies', 'Cada asteroide capturado dá +3 toques de poeira (3 vezes o que o seu toque rende).', 'rocha escura em forma de pião', [
    { kind: 'objectReward', target: 'asteroid', add: 3 },
  ], 1),
  grim('kepler-22b', 'Kepler-22b', 'rare', 'planets', 'Os geradores de energia rendem x1,25 e os de poeira x1,05.', 'esfera azul-esverdeada distante', [
    { kind: 'energyGenPct', pct: 25 },
    { kind: 'generatorPct', pct: 5 },
  ], 1),
  grim('horsehead', 'Cabeça de Cavalo', 'epic', 'nebulae', 'Você ganha 1 troca grátis a mais por escolha de grimório.', 'nebulosa escura em forma de cabeça de cavalo', [
    { kind: 'choiceExtra', reroll: 1 },
  ], 2),
  grim('golden-record', 'Disco de Ouro', 'legendary', 'small-bodies', 'A Estrela Dourada vem 90 s mais cedo e fica +8 s no campo.', 'disco dourado com sulcos', [
    { kind: 'rareCut', sec: 90 },
    { kind: 'rareLife', sec: 8 },
  ], 2),
  grim('trappist-1', 'TRAPPIST-1', 'rare', 'stars', 'Parado, os geradores rendem 0,4 do ritmo de quando você toca (em vez de 0,25).', 'anã vermelha com sete planetas', [
    { kind: 'idleFloor', add: 0.15 },
  ], 3),
  grim('aldebaran', 'Aldebarã', 'epic', 'stars', 'A cada 12 toques, o 12º toque rende x5 de poeira.', 'gigante laranja com brilho forte', [
    { kind: 'everyNthTouch', n: 12, mult: 5 },
  ], 3),
  grim('oumuamua', 'Oumuamua', 'epic', 'small-bodies', 'Cada objeto capturado dá +6 toques de recompensa e os objetos aparecem 5 s mais cedo.', 'rocha comprida e avermelhada', [
    { kind: 'objectReward', target: 'all', add: 6 },
    { kind: 'spawnCut', sec: 5 },
  ], 4),
  grim('vela-pulsar', 'Pulsar de Vela', 'epic', 'stars', 'Os geradores seguem rendendo cheios por +5 s depois de cada toque.', 'estrela de nêutrons com feixes de luz', [
    { kind: 'activeWindow', sec: 5 },
  ], 4),
  grim('pleiades-cluster', 'Plêiades', 'epic', 'stars', 'Os geradores de poeira rendem x1,25.', 'aglomerado de sete estrelas azuis', [
    { kind: 'generatorPct', pct: 25 },
  ], 5),
  grim('sombrero', 'Galáxia do Sombrero', 'legendary', 'nebulae', 'Os geradores de poeira e de energia rendem x1,5.', 'galáxia com anel de poeira e núcleo claro', [
    { kind: 'generatorPct', pct: 50 },
    { kind: 'energyGenPct', pct: 50 },
  ], 5),
  grim('pillars', 'Pilares da Criação', 'legendary', 'nebulae', 'Cada vida começa com 1500 de poeira, e você ganha 1 troca grátis a mais por escolha.', 'colunas de gás com estrelas nascendo', [
    { kind: 'startDust', amount: 1500 },
    { kind: 'choiceExtra', reroll: 1 },
  ], 5),
];

const GRIMOIRE_BY_ID = new Map(GRIMOIRES.map((g) => [g.id, g]));
export function grimoireById(id: string): GrimoireDef | undefined {
  return GRIMOIRE_BY_ID.get(id);
}

// --- Melhorias (spec 039: toque conquistado, geradores e geradores de energia) ---

/** `touch`: melhoria de toque (compra única); `generator`: poeira por segundo; `energy`: energia por segundo. */
export type UpgradeKind = 'touch' | 'generator' | 'energy';

export interface UpgradeDef {
  id: string;
  name: string;
  text: string;
  kind: UpgradeKind;
  /** Custo do nível 0; cada nível multiplica por `growth` (1,15 nos geradores; 1 nas de toque, que são únicas). */
  base: number;
  growth: number;
  /** Depois de `from` níveis o fator por nível passa a `growth` de cá: o custo sobe mais que o ganho. */
  steep?: { from: number; growth: number };
  max: number;
  unlockedAtCollapse: number;
  /** Gerador: poeira por segundo por unidade. Gerador de energia: toques equivalentes por segundo. */
  perSec?: number;
  /** Exige a outra comprada ("Cadência exige o Ritmo Firme"). */
  requiresUpgrade?: { id: string; level: number };
  /**
   * Domínios de efeito que a melhoria controla (ver `effectDomain`). Nenhum grimório pode usá-los:
   * melhoria é poder básico contínuo, grimório é estilo e situação.
   */
  domains: readonly string[];
}

/** Dobra o gerador com tantas unidades (spec 039, seção 4). */
export const GENERATOR_MILESTONES = [10, 25, 50] as const;
export const GENERATOR_GROWTH = 1.15;
export const GENERATOR_MAX = 400;

const touch = (
  id: string,
  name: string,
  base: number,
  text: string,
  domains: readonly string[],
  extra: Partial<UpgradeDef> = {},
): UpgradeDef => ({ id, name, text, kind: 'touch', base, growth: 1, max: 1, unlockedAtCollapse: 0, domains, ...extra });

const generator = (id: string, name: string, base: number, perSec: number): UpgradeDef => ({
  id,
  name,
  text: `+${String(perSec).replace('.', ',')} poeira por segundo`,
  kind: 'generator',
  base,
  growth: GENERATOR_GROWTH,
  max: GENERATOR_MAX,
  unlockedAtCollapse: 0,
  perSec,
  domains: ['dustPerSecond'],
});

const energyGen = (id: string, name: string, base: number, perSec: number): UpgradeDef => ({
  id,
  name,
  text: `+${String(perSec).replace('.', ',')} toque de energia por segundo`,
  kind: 'energy',
  base,
  growth: GENERATOR_GROWTH,
  max: GENERATOR_MAX,
  unlockedAtCollapse: 0,
  perSec,
  domains: ['energyPerSecond'],
});

/**
 * A ordem é a do preço dentro de cada tipo: a prateleira (`upgradeShelf`) mostra os primeiros e deixa o resto
 * escondido. Os números são os iniciais da spec 039 e passam pelo simulador antes de valerem.
 */
export const UPGRADES: readonly UpgradeDef[] = [
  touch('lens', 'Lente Polida', 100, 'Toque x2', ['touchMult']),
  touch('gloves', 'Luvas de Astronauta', 225, '+1 poeira por toque', ['touchFlat']),
  touch('trained', 'Dedo Treinado', 500, 'A cada 25 toques, o 25º rende x5', ['touchNth']),
  touch('rhythm', 'Ritmo Firme', 850, 'Libera o combo: tocar de novo em até 1,3 s mantém a sequência, e cada toque seguido soma 0,2 do toque (até 3 seguidos)', ['comboUnlock', 'comboPoint']),
  touch('magnet', 'Toque Magnético', 1000, 'Cada toque encurta em 0,5 s a espera do próximo objeto', ['objectSpawn']),
  touch('hands', 'Mãos do Astronauta', 1000, 'A cada 10 geradores comprados, +1 poeira por toque', ['touchPerGenerator']),
  touch('charged', 'Pulso Carregado', 1500, '+0,25 de energia por toque', ['energyPerTouch']),
  touch('luck', 'Toque de Sorte', 2000, '4% de chance de o toque render x10', ['touchCrit']),
  touch('cadence', 'Cadência', 3000, 'Combo máximo +1', ['comboMax'], { requiresUpgrade: { id: 'rhythm', level: 1 } }),
  touch('kepler', 'Sonda Kepler', 4000, 'Objetos aparecem 20% mais cedo', ['objectSpawnWindow']),
  touch('voyager', 'Voyager', 12000, 'Satélites duram +4 s', ['signalDuration']),
  touch('echo', 'Eco', 20000, 'Cada toque rende +0,4% da produção por segundo dos geradores', ['touchEcho']),
  touch('lens2', 'Lente Dupla', 25000, 'Toque x2', ['touchMult']),
  touch('webb', 'Observatório James Webb', 120000, 'Toque x2', ['touchMult'], { unlockedAtCollapse: 1 }),
  touch('cabin', 'Cabine Reforçada', 150000, 'Toque x2', ['touchMult']),
  touch('chandra', 'Telescópio Chandra', 300000, 'Objetos ficam 50% mais tempo no campo', ['objectLife'], { unlockedAtCollapse: 3 }),
  touch('gaia', 'Observatório Gaia', 1500000, 'O sorteio mostra o efeito já na carta', ['cardInfo'], { unlockedAtCollapse: 5 }),

  generator('satellite', 'Satélite', 15, 0.1),
  generator('probe', 'Sonda Voyager', 100, 1),
  generator('telescope', 'Telescópio', 1100, 8),
  generator('observatory', 'Observatório', 12000, 47),
  generator('station', 'Estação Orbital', 130000, 260),
  generator('colony', 'Colônia Lunar', 1400000, 1400),
  generator('fleet', 'Frota Estelar', 20000000, 7800),
  generator('portal', 'Portal', 330000000, 44000),

  energyGen('antenna', 'Antena', 400, 0.02),
  energyGen('receiver', 'Receptor de Sinal', 3000, 0.1),
  energyGen('matrix', 'Matriz de Escuta', 30000, 0.5),
  energyGen('deepnet', 'Rede Profunda', 400000, 2.5),
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
      [{ kind: 'freeUpgradeLevels', upgrade: 'satellite', levels: 1 }],
      [{ kind: 'freeUpgradeLevels', upgrade: 'satellite', levels: 2 }],
      [{ kind: 'freeUpgradeLevels', upgrade: 'satellite', levels: 4 }],
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
