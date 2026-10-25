// Catálogo do Aperta! (spec 038, seções 5 e 8). Tudo aqui é DADO: o motor só conhece as
// primitivas de efeito da seção 7.3, então um grimório novo é uma linha nesta tabela.
// Textos para o jogador ficam em pt-BR; ids e código em inglês.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'forbidden';
export type Family = 'planets' | 'moons' | 'small-bodies' | 'stars' | 'nebulae';
export type LegendaryKind = 'legend-comet' | 'legend-pulsar' | 'legend-nebula' | 'legend-wormhole';
export type ObjectKind = 'comet' | 'shooting-star' | 'satellite' | 'asteroid' | 'probe' | 'golden' | LegendaryKind;
/** O que a Estrela Dourada faz ao ser pega (sorteado quando ela nasce, para a etiqueta mostrar antes). */
export type RareEffect = 'frenzy' | 'rain' | 'surge';
export const RARE_EFFECTS: readonly RareEffect[] = ['frenzy', 'rain', 'surge'];
export type ObjectTarget = ObjectKind | 'all';

/** Raridades dos grimórios comuns do sorteio. Os proibidos moram no Cofre (`forbidden.ts`), não no sorteio. */
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];
export const FAMILIES: readonly Family[] = [
  'planets',
  'moons',
  'small-bodies',
  'stars',
  'nebulae',
];

export const FAMILY_NAMES: Record<Family, string> = {
  planets: 'Planetas',
  moons: 'Luas',
  'small-bodies': 'Pequenos corpos',
  stars: 'Estrelas',
  nebulae: 'Nebulosas e galáxias',
};

/** Peso de sorteio por raridade (seção 4.3): sorteia-se a raridade e depois a carta, para o peso não depender de quantas cartas existem. */
export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 100,
  rare: 40,
  epic: 22,
  legendary: 9,
  forbidden: 1,
};

/** Nº de escolhas já feitas que libera cada raridade na primeira vida (cai com os colapsos, ver economy.ts). */
export const RARITY_UNLOCK_PICKS: Record<Rarity, number> = {
  common: 0,
  rare: 2,
  epic: 5,
  legendary: 9,
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
  | { kind: 'forbiddenPower'; pct: number; priceCutPct: number }
  // Grimórios (e também a árvore, no caso de `comboWindow.pct` e `upgradeCostPct`)
  | { kind: 'comboWindow'; pct?: number; sec?: number; mult?: number }
  | { kind: 'upgradeCostPct'; pct: number }
  /** A cada `n` toques o toque vale `mult` vezes e soma `energy` de energia (número, não % da barra). */
  | { kind: 'everyNthTouch'; n: number; mult: number; energy?: number }
  /** Com o combo no máximo: +`add` de poeira por toque (soma ao toque, antes do combo). */
  | { kind: 'comboFullDust'; add: number }
  /** +`add` de poeira por toque por grimório que está no livro (qualquer raridade). */
  | { kind: 'dustPerGrimoire'; add: number }
  /** Com o combo no máximo: +`add` de energia por toque. */
  | { kind: 'comboFullEnergy'; add: number }
  /** +`add` de poeira por toque, simples (spec 043). */
  | { kind: 'dustFlat'; add: number }
  /** +`add` de energia por toque, simples (spec 043). */
  | { kind: 'energyFlat'; add: number }
  /** +`add` de energia por toque por colapso já feito. */
  | { kind: 'energyPerCollapse'; add: number }
  /** Todos os objetos ficam +`sec` segundos na tela. */
  | { kind: 'objectLife'; sec: number }
  /** +`add` objeto(s) na tela ao mesmo tempo. */
  | { kind: 'fieldSlots'; add: number }
  /** Com o combo no máximo: poeira do toque x`mult`. */
  | { kind: 'comboFullMult'; mult: number }
  | { kind: 'dustMult'; mult: number }
  | { kind: 'energyMult'; mult: number }
  /** +`add` toques de recompensa no objeto: poeira (cometa, asteroide, satélite) ou energia (estrela cadente). */
  | { kind: 'objectReward'; target: ObjectTarget; add: number }
  | { kind: 'objectsDisabled' }
  /** As ofertas de grimório não trazem cartas comuns (Gaia BH3). */
  | { kind: 'noCommon' }
  /** +`add` de peso de sorteio nas cartas épicas e lendárias (Gaia BH3). */
  | { kind: 'rarityBoost'; add: number }
  /** O "Sinal forte" do satélite vale +`add` (x2 vira x2,5). */
  | { kind: 'satelliteMult'; add: number }
  | { kind: 'startDust'; amount: number }
  | { kind: 'choiceExtra'; reroll?: number; picks?: number; repeatLevels?: number; cards?: number; discard?: number }
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
export type GrimoireCategory = 'touch' | 'energy' | 'luck' | 'objects';

export const GRIMOIRE_CATEGORIES: readonly { id: GrimoireCategory; label: string; hint: string }[] = [
  { id: 'touch', label: 'Toque', hint: 'Faz cada toque render mais poeira.' },
  { id: 'energy', label: 'Energia', hint: 'Enche a barra de grimórios mais rápido.' },
  { id: 'luck', label: 'Sorte', hint: 'Mais cartas, trocas e cartas melhores nas escolhas.' },
  { id: 'objects', label: 'Objetos', hint: 'Cometas, satélites e estrelas: mais cedo, mais tempo, mais recompensa.' },
];

/** Raridades em que um grimório pode vir (os proibidos moram no Cofre). */
export type GrimoireRarity = 'common' | 'rare' | 'epic' | 'legendary';
export const GRIMOIRE_RARITIES: readonly GrimoireRarity[] = ['common', 'rare', 'epic', 'legendary'];

/**
 * Spec 042: o grimório é um só e a raridade decide o tamanho do passo. Cada nível vale `RARITY_STEP` vezes o efeito
 * base (a raridade em que o nível foi pego fica guardada), e o teto de níveis acompanha a maior raridade que a
 * pessoa já tem dele.
 */
export const RARITY_STEP: Record<GrimoireRarity, number> = { common: 1, rare: 2, epic: 3, legendary: 4 };
export const RARITY_LEVEL_CAP: Record<GrimoireRarity, number> = { common: 5, rare: 6, epic: 8, legendary: 10 };

export interface GrimoireDef {
  id: string;
  name: string;
  family: Family;
  category: GrimoireCategory;
  /** O que ele faz, sem números: o antes e o depois vêm na linha "Você ganha" da carta. */
  text: string;
  /** Desenho da medalha (para a etapa de arte). */
  art: string;
  /** Efeitos com os números de um nível Comum; a raridade multiplica pelo `RARITY_STEP`. */
  effects: Effect[];
  /** Colapso a partir do qual o grimório existe para o jogador (seção 5.4). */
  unlockedAtCollapse: number;
}

function grim(
  id: string,
  name: string,
  family: Family,
  category: GrimoireCategory,
  text: string,
  art: string,
  effects: Effect[],
  unlockedAtCollapse = 0,
): GrimoireDef {
  return { id, name, family, category, text, art, effects, unlockedAtCollapse };
}

/**
 * Os 20 grimórios (spec 043): 4 categorias simples (Toque, Energia, Sorte, Objetos), cada um com UM efeito em número, sem
 * porcentagem e sem depender de mecânica que o iniciante não viu. Nenhum mexe em gerador (isso é dos itens e da Árvore).
 */
export const GRIMOIRES: readonly GrimoireDef[] = [
  // Toque
  grim('moon', 'Lua', 'moons', 'touch', 'Cada toque rende +3 poeira.', 'esfera cinza clara com crateras', [{ kind: 'dustFlat', add: 3 }]),
  grim('sirius', 'Sirius', 'stars', 'touch', 'A cada 10 toques, o 10º toque rende o dobro.', 'estrela branca de 4 pontas com halo azul', [
    { kind: 'everyNthTouch', n: 10, mult: 2 },
  ]),
  grim('vega', 'Vega', 'stars', 'touch', 'Cada grimório que você tem soma +0,5 poeira por toque.', 'estrela branco-azulada de 8 raios', [
    { kind: 'dustPerGrimoire', add: 0.5 },
  ]),
  grim('saturn', 'Saturno', 'planets', 'touch', 'O toque rende x1,5 de poeira.', 'esfera dourada com anéis largos', [{ kind: 'dustMult', mult: 1.5 }]),
  grim('capella', 'Capela', 'stars', 'touch', 'Cada colapso que você já fez soma +1 poeira por toque.', 'estrela amarela dupla com halo quente', [
    { kind: 'dustPerCollapse', add: 1 },
  ], 1),
  // Energia
  grim('mercury', 'Mercúrio', 'planets', 'energy', 'A energia de cada toque rende x1,5.', 'esfera marrom-cinza, crateras pequenas', [{ kind: 'energyMult', mult: 1.5 }]),
  grim('polaris', 'Polaris', 'stars', 'energy', 'Cada toque dá +0,5 de energia.', 'estrela branca fixa com cruz de luz', [{ kind: 'energyFlat', add: 0.5 }]),
  grim('proxima', 'Proxima', 'stars', 'energy', 'A barra de energia do próximo grimório enche mais rápido.', 'anã vermelha pequena com chama', [
    { kind: 'energyStepPct', pct: -3 },
  ]),
  grim('antares', 'Antares', 'stars', 'energy', 'Cada colapso que você já fez soma +0,25 de energia por toque.', 'gigante vermelha com brilho', [
    { kind: 'energyPerCollapse', add: 0.25 },
  ], 2),
  // Sorte
  grim('betelgeuse', 'Betelgeuse', 'stars', 'luck', 'Mais 1 troca de carta em cada escolha.', 'gigante laranja com manchas', [{ kind: 'choiceExtra', reroll: 1 }]),
  grim('orion-nebula', 'Nebulosa de Órion', 'nebulae', 'luck', 'Cada escolha oferece 1 carta a mais.', 'nuvem rosa, turquesa e violeta com estrelas', [
    { kind: 'choiceExtra', cards: 1 },
  ], 3),
  grim('cassiopeia', 'Cassiopeia', 'stars', 'luck', 'Cartas épicas e lendárias aparecem mais nas escolhas.', 'cinco estrelas em W com poeira violeta', [
    { kind: 'rarityBoost', add: 2 },
  ], 2),
  grim('titan', 'Titã', 'moons', 'luck', 'Cada item que você compra devolve um pouco da poeira gasta.', 'esfera laranja com névoa', [
    { kind: 'buyRefund', touches: 2 },
  ]),
  grim('uranus', 'Urano', 'planets', 'luck', 'Você pode descartar uma oferta e ver cartas novas.', 'esfera ciano-gelo com anel inclinado', [
    { kind: 'choiceExtra', discard: 1 },
  ], 1),
  // Objetos (todos os objetos, nunca um específico)
  grim('venus', 'Vênus', 'planets', 'objects', 'Todo objeto capturado rende mais.', 'esfera creme-dourada com faixas de nuvem', [
    { kind: 'objectReward', target: 'all', add: 3 },
  ]),
  grim('halley', 'Halley', 'small-bodies', 'objects', 'Os objetos aparecem mais cedo.', 'núcleo claro com cauda azul', [{ kind: 'spawnCut', sec: 4 }]),
  grim('ganymede', 'Ganimedes', 'moons', 'objects', 'Os objetos ficam mais tempo na tela.', 'esfera cinza-marrom com sulcos claros', [
    { kind: 'objectLife', sec: 2 },
  ], 1),
  grim('europa', 'Europa', 'moons', 'objects', 'Pode haver 1 objeto a mais na tela ao mesmo tempo.', 'esfera de gelo rachada com linhas ocre', [
    { kind: 'fieldSlots', add: 1 },
  ]),
  grim('io', 'Io', 'moons', 'objects', 'Depois de capturar um objeto, o próximo toque rende o dobro.', 'esfera amarelo-enxofre com manchas vermelhas', [
    { kind: 'afterCaptureMult', mult: 2 },
  ]),
  grim('phobos', 'Fobos', 'moons', 'objects', 'Capturar um objeto dá energia.', 'rocha irregular com uma cratera grande', [
    { kind: 'onCapture', energyTouches: 1 },
  ]),
];

const GRIMOIRE_BY_ID = new Map(GRIMOIRES.map((g) => [g.id, g]));
export function grimoireById(id: string): GrimoireDef | undefined {
  return GRIMOIRE_BY_ID.get(id);
}

// --- Itens e geradores (spec 043: itens de compra única, simples e diretos; geradores à parte) ---

/**
 * `item`: compra única, com UM efeito simples (ver `ItemEffect`); `generator`: poeira por segundo; `energy`: energia por
 * segundo. Itens e geradores zeram a cada colapso (são da vida).
 */
export type UpgradeKind = 'item' | 'generator' | 'energy';

/**
 * Os 5 únicos efeitos de um item (spec 043, seção 4): sem porcentagem, sem condição, sem cenário. A tela mostra sempre o
 * TOTAL de antes e depois ("Seu toque: 40 -> 80"), nunca só o que o item dá.
 */
export type ItemEffect =
  | { type: 'touchMult'; value: number }
  | { type: 'energyMult'; value: number }
  | { type: 'genMult'; value: number }
  | { type: 'energyGenMult'; value: number };

export type ItemEffectType = ItemEffect['type'];

/** Era de um item: define o acabamento do ícone (bronze, prata, ouro, plasma, cósmico) e a faixa de preço. */
export type ItemEra = 'poeira' | 'mil' | 'milhoes' | 'bilhoes' | 'trilhoes';
export const ITEM_ERAS: readonly { id: ItemEra; label: string; from: number }[] = [
  { id: 'poeira', label: 'Poeira', from: 0 },
  { id: 'mil', label: 'Mil', from: 1e4 },
  { id: 'milhoes', label: 'Milhões', from: 1e6 },
  { id: 'bilhoes', label: 'Bilhões', from: 1e9 },
  { id: 'trilhoes', label: 'Trilhões', from: 1e12 },
];

/** A era de um item pelo preço. */
export function eraOfPrice(price: number): ItemEra {
  let era: ItemEra = 'poeira';
  for (const e of ITEM_ERAS) if (price >= e.from) era = e.id;
  return era;
}

export interface UpgradeDef {
  id: string;
  name: string;
  /** Uma frase curta do efeito, sem % e sem condição ("Toque x2", "+2 poeira por toque"). */
  text: string;
  kind: UpgradeKind;
  /** Custo do nível 0; cada nível multiplica por `growth` (1,15 nos geradores; 1 nos itens, que são únicos). */
  base: number;
  growth: number;
  /** Depois de `from` níveis o fator por nível passa a `growth` de cá: o custo sobe mais que o ganho. */
  steep?: { from: number; growth: number };
  max: number;
  unlockedAtCollapse: number;
  /** Gerador: poeira por segundo por unidade. Gerador de energia: toques equivalentes por segundo. */
  perSec?: number;
  /** Só nos itens: o efeito e a era (ícone). */
  item?: ItemEffect;
  era?: ItemEra;
  /**
   * Domínios de efeito que a melhoria controla (ver `effectDomain`). Nenhum grimório pode usá-los:
   * item e gerador são poder básico, grimório é estilo e situação.
   */
  domains: readonly string[];
}

/**
 * Cada gerador tem um limite de níveis (0/8, 0/10...) e a prateleira mostra um por vez; completar um abre o próximo,
 * mais caro e mais forte.
 */
export const GENERATOR_GROWTH = 1.15;
/** Maior limite de níveis de um gerador (o teto de validação do save). */
export const GENERATOR_MAX = 12;

const ITEM_DOMAIN: Record<ItemEffectType, string> = {
  touchMult: 'touchMult',
  energyMult: 'energyPerTouch',
  genMult: 'dustPerSecond',
  energyGenMult: 'energyPerSecond',
};

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','));

/** O texto do item vem do efeito: não há como descrever uma coisa e fazer outra. */
export function itemText(e: ItemEffect): string {
  // Todo item é uma multiplicação: vale o mesmo (dobrar é dobrar) em qualquer hora do jogo.
  const times = (v: number): string => (v === 2 ? 'Dobra' : v === 3 ? 'Triplica' : `Multiplica por ${fmt(v)}`);
  switch (e.type) {
    case 'touchMult':
      return `${times(e.value)} a poeira de cada toque`;
    case 'energyMult':
      return `${times(e.value)} a energia de cada toque`;
    case 'genMult':
      return `${times(e.value)} a poeira de todos os geradores`;
    case 'energyGenMult':
      return `${times(e.value)} a energia de todos os geradores`;
  }
}

const item = (id: string, name: string, price: number, effect: ItemEffect, unlockedAtCollapse = 0): UpgradeDef => ({
  id,
  name,
  text: itemText(effect),
  kind: 'item',
  base: price,
  growth: 1,
  max: 1,
  unlockedAtCollapse,
  item: effect,
  era: eraOfPrice(price),
  domains: [ITEM_DOMAIN[effect.type]],
});

const touchMult = (value: number): ItemEffect => ({ type: 'touchMult', value });
const energyMult = (value: number): ItemEffect => ({ type: 'energyMult', value });
const genMult = (value: number): ItemEffect => ({ type: 'genMult', value });
const energyGenMult = (value: number): ItemEffect => ({ type: 'energyGenMult', value });

const generator = (id: string, name: string, base: number, perSec: number, max: number): UpgradeDef => {
  return {
  id,
  name,
  text: `+${fmt(perSec)} poeira por segundo`,
  kind: 'generator',
  base,
  growth: GENERATOR_GROWTH,
  max,
  unlockedAtCollapse: 0,
  perSec,
  domains: ['dustPerSecond'],
  };
};

const energyGen = (id: string, name: string, base: number, perSec: number, max: number): UpgradeDef => { return ({
  id,
  name,
  text: `+${fmt(Math.round(perSec * 600) / 10)} de energia por minuto`,
  kind: 'energy',
  base,
  growth: GENERATOR_GROWTH,
  max,
  unlockedAtCollapse: 0,
  perSec,
  domains: ['energyPerSecond'],
}); };

/**
 * A ordem dos itens é a do preço: a prateleira mostra o próximo e os dois seguintes. Os 24 primeiros abrem na primeira
 * vida (um a cada poucos minutos); os outros 18 entram, 6 por colapso, com valores de milhões e bilhões. Os números são
 * um primeiro rascunho: o simulador acerta preço e valor (spec 043, etapa 3).
 */
export const UPGRADES: readonly UpgradeDef[] = [
  // Era Poeira (até 10 mil)
  item('lens', 'Lente Polida', 100, touchMult(2)),
  item('gloves', 'Luvas de Astronauta', 170, touchMult(2)),
  item('charged', 'Pulso Carregado', 300, energyMult(2)),
  item('solar', 'Painéis Solares', 520, genMult(2)),
  item('lens2', 'Lente Dupla', 800, touchMult(2)),
  item('steel', 'Mãos de Aço', 1300, touchMult(1.5)),
  item('motor', 'Motor Iônico', 2200, genMult(1.25)),
  item('antenna2', 'Antena Dupla', 3600, energyGenMult(1.5)),
  // Era Mil (10 mil a 1 milhão)
  item('cabin', 'Cabine Reforçada', 6300, touchMult(1.25)),
  item('compact', 'Reator Compacto', 11000, genMult(1.25)),
  item('pulse2', 'Pulso Estelar', 19000, energyMult(1.5)),
  item('titan', 'Mãos de Titânio', 34000, touchMult(1.25)),
  item('lens3', 'Lente Tripla', 59000, touchMult(1.5)),
  item('plant', 'Usina Orbital', 100000, genMult(1.5)),
  item('receiver2', 'Receptor Ampliado', 180000, energyGenMult(2)),
  item('webb', 'Observatório Webb', 320000, touchMult(1.25)),
  item('diamond', 'Mãos de Diamante', 550000, touchMult(1.25)),
  // Era Milhões (1 milhão a 1 bilhão)
  item('fusion', 'Reator de Fusão', 970000, genMult(1.25)),
  item('quantum', 'Pulso Quântico', 1700000, energyMult(1.5)),
  item('stellar', 'Lente Estelar', 3000000, touchMult(1.5)),
  item('forge', 'Fornalha Estelar', 5200000, genMult(1.5)),
  item('chandra', 'Telescópio Chandra', 9100000, touchMult(1.25)),
  item('mesh', 'Malha de Escuta', 16000000, energyGenMult(2)),
  item('starhand', 'Mãos de Estrela', 28000000, touchMult(1.25)),
  // Colapso 1: milhões a centenas de milhões
  item('deep', 'Sonda Profunda', 53000000, genMult(1.5), 1),
  item('cosmic', 'Lente Cósmica', 100000000, touchMult(1.5), 1),
  item('pulsar', 'Núcleo Pulsar', 190000000, energyMult(2), 1),
  item('solarhand', 'Mãos Solares', 360000000, touchMult(1.25), 1),
  item('qheart', 'Coração de Quasar', 690000000, genMult(1.5), 1),
  item('galnet', 'Rede Galáctica', 1300000000, energyGenMult(2), 1),
  // Colapso 2: bilhões
  item('galens', 'Lente Galáctica', 2500000000, touchMult(1.5), 2),
  item('antimatter', 'Reator de Antimatéria', 4700000000, genMult(1.5), 2),
  item('cosmicpulse', 'Pulso Cósmico', 9000000000, energyMult(2), 2),
  item('nebhand', 'Mãos de Nebulosa', 17000000000, touchMult(1.25), 2),
  item('qforge', 'Forja de Quasar', 32000000000, genMult(1.5), 2),
  item('galecho', 'Eco Galáctico', 62000000000, energyGenMult(2), 2),
  // Colapso 3: dezenas de bilhões
  item('horizon', 'Lente do Horizonte', 120000000000, touchMult(2), 3),
  item('warp', 'Motor de Dobra', 220000000000, genMult(2), 3),
  item('singpulse', 'Pulso de Singularidade', 420000000000, energyMult(2), 3),
  item('cosmoshand', 'Mãos do Cosmos', 800000000000, touchMult(1.25), 3),
  item('galheart', 'Coração Galáctico', 1500000000000, genMult(2), 3),
  item('universe', 'Matriz do Universo', 2900000000000, energyGenMult(3), 3),

  generator('satellite', 'Satélite', 50, 0.2, 8),
  generator('probe', 'Sonda Voyager', 400, 1.1, 8),
  generator('telescope', 'Telescópio', 3500, 6, 8),
  generator('observatory', 'Observatório', 30000, 33, 10),
  generator('station', 'Estação Orbital', 300000, 180, 10),
  generator('colony', 'Colônia Lunar', 3000000, 1000, 10),
  generator('fleet', 'Frota Estelar', 40000000, 5500, 12),
  generator('portal', 'Portal', 600000000, 30000, 12),
  generator('cluster', 'Aglomerado', 10000000000, 165000, 12),
  generator('quasar', 'Quasar', 200000000000, 900000, 12),
  generator('web', 'Teia Cósmica', 5000000000000, 5000000, 12),

  energyGen('antenna', 'Antena', 300, 0.005, 6),
  energyGen('receiver', 'Receptor de Sinal', 2500, 0.025, 6),
  energyGen('matrix', 'Matriz de Escuta', 25000, 0.12, 8),
  energyGen('deepnet', 'Rede Profunda', 300000, 0.6, 8),
  energyGen('array', 'Conjunto Interestelar', 4000000, 3, 8),
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
 * Objetos lendários (spec 040, etapa 20): nunca nascem sozinhos nem no começo do jogo. Só vêm com o Radar de lendários
 * da árvore (um contador de capturas que, ao encher, faz um nascer garantido) ou no começo de certos eventos.
 * Recompensas em unidades de toque, como as dos objetos comuns.
 */
export interface LegendaryDef {
  kind: LegendaryKind;
  name: string;
  lifeSec: number;
  /** Poeira e energia de toque ao capturar. */
  dustTouches: number;
  energyTouches: number;
  /** Nebulosa errante: multiplicador do toque e duração (s). */
  boostMult?: number;
  boostSec?: number;
  /** Buraco de minhoca: enche a barra de energia na hora (abre uma oferta) e dá uma troca grátis. */
  fillsBar?: boolean;
  text: string;
}

export const LEGENDARY_OBJECTS: readonly LegendaryDef[] = [
  { kind: 'legend-comet', name: 'Grande Cometa', lifeSec: 9, dustTouches: 40, energyTouches: 0, text: 'Poeira de 40 toques.' },
  { kind: 'legend-pulsar', name: 'Pulsar', lifeSec: 8, dustTouches: 15, energyTouches: 15, text: 'Poeira e energia de 15 toques.' },
  { kind: 'legend-nebula', name: 'Nebulosa errante', lifeSec: 10, dustTouches: 10, energyTouches: 0, boostMult: 2, boostSec: 10, text: 'O toque rende x2 por 10 s.' },
  { kind: 'legend-wormhole', name: 'Buraco de minhoca', lifeSec: 7, dustTouches: 0, energyTouches: 0, fillsBar: true, text: 'Enche a barra de energia e dá uma troca grátis.' },
];

export const LEGENDARY_KINDS: readonly LegendaryKind[] = LEGENDARY_OBJECTS.map((o) => o.kind);

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
