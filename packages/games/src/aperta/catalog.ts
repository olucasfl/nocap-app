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
export type GrimoireCategory = 'touch' | 'objects' | 'luck';

export const GRIMOIRE_CATEGORIES: readonly { id: GrimoireCategory; label: string; hint: string }[] = [
  { id: 'touch', label: 'Toque', hint: 'Faz cada toque render mais.' },
  { id: 'objects', label: 'Objetos', hint: 'Melhora os cometas, satélites e a Estrela Dourada.' },
  { id: 'luck', label: 'Energia e sorte', hint: 'Enche a barra e ajuda nas escolhas e na economia.' },
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

/** Os 22 grimórios (spec 042 e adendo). Cada um faz uma coisa só; nenhum mexe em geradores (isso é das Melhorias e da Árvore). */
export const GRIMOIRES: readonly GrimoireDef[] = [
  // Toque
  grim('moon', 'Lua', 'moons', 'touch', 'A cada 10 toques, o 10º toque rende mais poeira.', 'esfera cinza clara com crateras', [
    { kind: 'everyNthTouch', n: 10, mult: 2 },
  ]),
  grim('sirius', 'Sirius', 'stars', 'touch', 'Combo (toques em sequência rápida) cheio: cada toque rende mais poeira.', 'estrela branca de 4 pontas com halo azul', [
    { kind: 'comboFullDust', add: 0.5 },
  ]),
  grim('uranus', 'Urano', 'planets', 'touch', 'Combo (toques em sequência rápida): mais folga entre os toques para não cair.', 'esfera ciano-gelo com anel inclinado', [
    { kind: 'comboWindow', sec: 0.2 },
  ], 1),
  grim('vega', 'Vega', 'stars', 'touch', 'Cada grimório que você tem soma poeira por toque.', 'estrela branco-azulada de 8 raios', [
    { kind: 'dustPerGrimoire', add: 0.15 },
  ]),
  grim('jupiter', 'Júpiter', 'planets', 'touch', 'Combo (toques em sequência rápida) cheio: o toque rende bem mais poeira.', 'gigante listrada com a Grande Mancha', [
    { kind: 'comboFullMult', mult: 1.25 },
  ]),
  grim('saturn', 'Saturno', 'planets', 'touch', 'Cada grimório raro que você tem soma poeira por toque.', 'esfera dourada com anéis largos', [
    { kind: 'dustPerOwned', rarity: 'rare', add: 0.6 },
  ]),
  grim('capella', 'Capela', 'stars', 'touch', 'Cada colapso que você já fez soma poeira por toque.', 'estrela amarela dupla com halo quente', [
    { kind: 'dustPerCollapse', add: 0.4 },
  ], 1),
  // Objetos
  grim('venus', 'Vênus', 'planets', 'objects', 'Cometas e asteroides capturados rendem mais poeira.', 'esfera creme-dourada com faixas de nuvem', [
    { kind: 'objectReward', target: 'comet', add: 3 },
    { kind: 'objectReward', target: 'asteroid', add: 2 },
  ]),
  grim('mars', 'Marte', 'planets', 'objects', 'Estrelas cadentes capturadas rendem mais energia.', 'esfera ferrugem com calota polar branca', [
    { kind: 'objectReward', target: 'shooting-star', add: 2 },
  ]),
  grim('io', 'Io', 'moons', 'objects', 'O sinal forte do satélite fica mais forte.', 'esfera amarelo-enxofre com manchas vermelhas', [
    { kind: 'satelliteMult', add: 0.5 },
  ]),
  grim('europa', 'Europa', 'moons', 'objects', 'Satélites capturados rendem mais poeira.', 'esfera de gelo rachada com linhas ocre', [
    { kind: 'objectReward', target: 'satellite', add: 4 },
  ]),
  grim('halley', 'Halley', 'small-bodies', 'objects', 'Todos os objetos rendem mais e aparecem mais cedo.', 'núcleo claro com cauda azul', [
    { kind: 'objectReward', target: 'all', add: 1 },
    { kind: 'spawnCut', sec: 3 },
  ], 1),
  grim('ganymede', 'Ganimedes', 'moons', 'objects', 'Os objetos comuns aparecem bem mais cedo.', 'esfera cinza-marrom com sulcos claros', [
    { kind: 'spawnCut', sec: 8 },
  ], 1),
  grim('antares', 'Antares', 'stars', 'objects', 'A Estrela Dourada vem mais cedo e fica mais tempo.', 'gigante vermelha com brilho', [
    { kind: 'rareCut', sec: 25 },
    { kind: 'rareLife', sec: 2 },
  ], 2),
  // Energia e sorte
  grim('mercury', 'Mercúrio', 'planets', 'luck', 'A cada 5 toques, o 5º toque dá energia (enche a barra de grimórios).', 'esfera marrom-cinza, crateras pequenas', [
    { kind: 'everyNthTouch', n: 5, mult: 1, energy: 2 },
  ]),
  grim('phobos', 'Fobos', 'moons', 'luck', 'Capturar um objeto dá energia.', 'rocha irregular com uma cratera grande', [
    { kind: 'onCapture', energyTouches: 1 },
  ]),
  grim('titan', 'Titã', 'moons', 'luck', 'Cada melhoria que você compra devolve um pouco da poeira gasta.', 'esfera laranja com névoa', [
    { kind: 'buyRefund', touches: 2 },
  ]),
  grim('polaris', 'Polaris', 'stars', 'luck', 'Combo (toques em sequência rápida) cheio: cada toque dá um pouco de energia a mais.', 'estrela branca fixa com cruz de luz', [
    { kind: 'comboFullEnergy', add: 0.3 },
  ]),
  grim('proxima', 'Proxima', 'stars', 'luck', 'A barra de energia do próximo grimório fica menor.', 'anã vermelha pequena com chama', [
    { kind: 'energyStepPct', pct: -3 },
  ]),
  grim('cassiopeia', 'Cassiopeia', 'stars', 'luck', 'Cartas épicas e lendárias aparecem mais nas escolhas.', 'cinco estrelas em W com poeira violeta', [
    { kind: 'rarityBoost', add: 2 },
  ], 2),
  grim('betelgeuse', 'Betelgeuse', 'stars', 'luck', 'Dá trocas de carta a mais em cada escolha.', 'gigante laranja com manchas', [
    { kind: 'choiceExtra', reroll: 1 },
  ]),
  grim('orion-nebula', 'Nebulosa de Órion', 'nebulae', 'luck', 'Cada escolha oferece mais cartas.', 'nuvem rosa, turquesa e violeta com estrelas', [
    { kind: 'choiceExtra', cards: 1 },
  ], 3),
];

const GRIMOIRE_BY_ID = new Map(GRIMOIRES.map((g) => [g.id, g]));
export function grimoireById(id: string): GrimoireDef | undefined {
  return GRIMOIRE_BY_ID.get(id);
}

// --- Melhorias (spec 039: toque conquistado, geradores e geradores de energia) ---

/**
 * `touch`: melhoria de toque (compra única); `generator`: poeira por segundo; `energy`: energia por segundo;
 * `perk`: melhoria de gerador (compra única que muda COMO os geradores funcionam, spec 039, 4.1).
 */
export type UpgradeKind = 'touch' | 'generator' | 'energy' | 'perk';

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

/**
 * Spec 041 (B1): cada gerador tem um limite de níveis (0/8, 0/10...) e a prateleira mostra um por vez; completar um
 * abre o próximo, mais caro e mais forte. Por isso não há mais os marcos de "dobra com 10, 25, 50 unidades".
 */
export const GENERATOR_GROWTH = 1.15;
/** Maior limite de níveis de um gerador (o teto de validação do save). */
export const GENERATOR_MAX = 12;

const touch = (
  id: string,
  name: string,
  base: number,
  text: string,
  domains: readonly string[],
  extra: Partial<UpgradeDef> = {},
): UpgradeDef => ({ id, name, text, kind: 'touch', base, growth: 1, max: 1, unlockedAtCollapse: 0, domains, ...extra });

const perk = (id: string, name: string, base: number, text: string, domains: readonly string[]): UpgradeDef => ({
  id,
  name,
  text,
  kind: 'perk',
  base,
  growth: 1,
  max: 1,
  unlockedAtCollapse: 0,
  domains,
});

const generator = (id: string, name: string, base: number, perSec: number, max: number): UpgradeDef => ({
  id,
  name,
  text: `+${String(perSec).replace('.', ',')} poeira por segundo`,
  kind: 'generator',
  base,
  growth: GENERATOR_GROWTH,
  max,
  unlockedAtCollapse: 0,
  perSec,
  domains: ['dustPerSecond'],
});

const energyGen = (id: string, name: string, base: number, perSec: number, max: number): UpgradeDef => ({
  id,
  name,
  text: `+${String(perSec).replace('.', ',')} toque de energia por segundo`,
  kind: 'energy',
  base,
  growth: GENERATOR_GROWTH,
  max,
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
  touch('gloves', 'Luvas de Astronauta', 225, '+2 poeira por toque', ['touchFlat']),
  touch('trained', 'Dedo Treinado', 500, 'A cada 25 toques, o 25º rende x5', ['touchNth']),
  touch('rhythm', 'Ritmo Firme', 850, 'Libera o combo: tocar de novo em até 1,3 s mantém a sequência, e cada toque seguido soma 0,2 do toque (até 3 seguidos)', ['comboUnlock', 'comboPoint']),
  touch('magnet', 'Toque Magnético', 1000, 'Cada toque encurta em 0,5 s a espera do próximo objeto', ['objectSpawn']),
  touch('hands', 'Mãos do Astronauta', 1000, 'A cada 6 níveis de gerador comprados, +1 poeira por toque', ['touchPerGenerator']),
  touch('charged', 'Pulso Carregado', 1500, '+0,5 de energia por toque', ['energyPerTouch']),
  touch('luck', 'Toque de Sorte', 2000, '6% de chance de o toque render x10', ['touchCrit']),
  touch('cadence', 'Cadência', 3000, 'Combo máximo +1', ['comboMax'], { requiresUpgrade: { id: 'rhythm', level: 1 } }),
  touch('kepler', 'Sonda Kepler', 4000, 'Objetos aparecem 20% mais cedo', ['objectSpawnWindow']),
  touch('voyager', 'Voyager', 12000, 'Satélites duram +4 s', ['signalDuration']),
  touch('echo', 'Eco', 20000, 'Cada toque rende +0,4% da produção por segundo dos geradores', ['touchEcho']),
  touch('lens2', 'Lente Dupla', 25000, 'Toque x2', ['touchMult']),
  touch('webb', 'Observatório James Webb', 120000, 'Toque x2', ['touchMult'], { unlockedAtCollapse: 1 }),
  touch('cabin', 'Cabine Reforçada', 150000, 'Toque x2', ['touchMult']),
  touch('chandra', 'Telescópio Chandra', 300000, 'Objetos ficam 50% mais tempo no campo', ['objectLife'], { unlockedAtCollapse: 3 }),
  touch('gaia', 'Observatório Gaia', 1500000, 'O sorteio mostra o efeito já na carta', ['cardInfo'], { unlockedAtCollapse: 5 }),

  generator('satellite', 'Satélite', 15, 0.2, 8),
  generator('probe', 'Sonda Voyager', 120, 1.6, 8),
  generator('telescope', 'Telescópio', 900, 12, 8),
  generator('observatory', 'Observatório', 8000, 60, 10),
  generator('station', 'Estação Orbital', 90000, 340, 10),
  generator('colony', 'Colônia Lunar', 1000000, 1900, 10),
  generator('fleet', 'Frota Estelar', 14000000, 11000, 12),
  generator('portal', 'Portal', 250000000, 62000, 12),
  generator('cluster', 'Aglomerado', 4000000000, 350000, 12),
  generator('quasar', 'Quasar', 90000000000, 2000000, 12),
  generator('web', 'Teia Cósmica', 2000000000000, 12000000, 12),

  energyGen('antenna', 'Antena', 300, 0.04, 6),
  energyGen('receiver', 'Receptor de Sinal', 2500, 0.2, 6),
  energyGen('matrix', 'Matriz de Escuta', 25000, 1, 8),
  energyGen('deepnet', 'Rede Profunda', 300000, 5, 8),
  energyGen('array', 'Conjunto Interestelar', 4000000, 25, 8),

  // Acrescentadas depois (spec 039, 3 e 4.1): ficam no fim do catálogo para os índices dos saves não mudarem;
  // a prateleira ordena cada tipo pelo preço (`shelfOf`).
  touch('warmup', 'Aquecimento', 3000, 'Depois de 5 s tocando sem parar, o toque rende +50% até você soltar por 2 s', ['touchWarm']),
  perk('network', 'Rede', 1200, 'Cada nível da Sonda Voyager dá +2% de poeira aos Satélites', ['genNetwork']),
  perk('lure', 'Isca', 2500, 'A cada 2 níveis do Satélite, o próximo objeto aparece 1 s mais cedo (até 4 s)', ['genLure']),
  perk('burst', 'Rajada', 6000, 'A cada 60 s, os geradores soltam de uma vez 10 s da própria produção', ['genBurst']),
  perk('scale', 'Escala', 9000, 'A cada 4 níveis de um gerador, o toque ganha +1 de poeira', ['genScale']),
  perk('peak', 'Hora de pico', 15000, 'Capturar um objeto faz os geradores renderem +50% por 20 s', ['genPeak']),
  perk('queue', 'Fila de pedidos', 40000, 'Completar um gerador de uma vez (todos os níveis que faltam) sai 5% mais barato', ['genBulk']),
  perk('convert', 'Conversão', 80000, 'Os geradores também enchem a barra de energia, o equivalente a 1 toque por minuto', ['genConvert']),
  perk('rotation', 'Revezamento', 200000, 'O gerador que você menos comprou rende o dobro', ['genRotation']),

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
