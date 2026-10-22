// Cofre dos Proibidos (spec 040, seção 3): 10 Grimórios Proibidos que a pessoa GANHA ao colapsar (1 de 3 opções).
// Cada um tem um bônus forte e um preço, os dois em NÚMEROS fixos por nível (1 a 5), e um selo extra no nível 5.
// Todos os que a pessoa tem ficam ativos ao mesmo tempo (não há espaços). O bônus cresce mais depressa que o preço.
// Os efeitos usam só as primitivas de `catalog.ts`; `price: true` marca a metade "preço" (a árvore e o poder de
// Buracos negros reforçam só o ganho e cortam só o preço).

import type { Effect } from './catalog';

export const FORBIDDEN_MAX_LEVEL = 5;
/** Quantas opções o colapso oferece. */
export const VAULT_OFFER_SIZE = 3;
/** Selo Estelar (quando todos os proibidos estão no nível 5): poeira fixa por toque, por selo. */
export const SEAL_DUST_PER_TOUCH = 100;
/** Cintilas que cada página do Atlas antigo vale na migração (spec 040, seção 3, etapa 15). */
export const ATLAS_PAGE_SPARKS = 2;

export interface ForbiddenDef {
  id: string;
  name: string;
  /** Uma linha de ideia (para a carta). */
  art: string;
  /** Efeitos do nível `level` (1 a 5), sem o selo. */
  effects: (level: number) => Effect[];
  /** Efeitos extras do nível 5. */
  seal: Effect[];
  /** Textos por nível: o que ganha, o que paga e o selo. */
  bonus: (level: number) => string;
  price: (level: number) => string;
  sealText: string;
}

const lin = (base: number, step: number, level: number): number => base + step * (level - 1);
/** Crescimento geométrico por nível: o poder precisa acompanhar a meta de poeira, que sobe x1,28 por colapso. */
const geo = (base: number, ratio: number, level: number): number => base * ratio ** (level - 1);
const n = (x: number): string => String(Math.round(x * 100) / 100).replace('.', ',');
const priced = (e: Effect): Effect => ({ ...e, price: true }) as Effect;

export const FORBIDDEN: readonly ForbiddenDef[] = [
  {
    id: 'sagittarius-a',
    name: 'Sagitário A*',
    art: 'disco de acreção dourado ao redor de círculo preto',
    effects: (l) => [{ kind: 'dustMult', mult: geo(5, 1.6, l) }, priced({ kind: 'energyMult', mult: lin(0.5, -0.04, l) })],
    seal: [{ kind: 'everyNthTouch', n: 50, mult: 10 }],
    bonus: (l) => `O toque rende x${n(geo(5, 1.6, l))} de poeira.`,
    price: (l) => `O toque dá só x${n(lin(0.5, -0.04, l))} da energia: os grimórios demoram mais.`,
    sealText: 'Todo 50º toque rende x10.',
  },
  {
    id: 'cygnus-x1',
    name: 'Cygnus X-1',
    art: 'buraco negro com estrela azul companheira',
    effects: (l) => [
      { kind: 'comboFullMult', mult: lin(2, 0.5, l) },
      { kind: 'comboWindow', mult: 2 },
      priced({ kind: 'objectsDisabled' }),
    ],
    seal: [{ kind: 'comboFullEnergy', add: 2 }],
    bonus: (l) => `Com o combo no máximo o toque rende x${n(lin(2, 0.5, l))}, e a folga entre toques dobra.`,
    price: () => 'Os objetos param de aparecer.',
    sealText: 'Com o combo no máximo, +2 de energia por toque.',
  },
  {
    id: 'm87',
    name: 'M87*',
    art: 'buraco negro com jato de luz',
    effects: (l) => [{ kind: 'upgradeCostPct', pct: -lin(40, 8, l) }, priced({ kind: 'energyStepPct', pct: lin(20, 2, l) })],
    seal: [{ kind: 'buyRefund', touches: 10 }],
    bonus: (l) => `As melhorias custam ${n(lin(40, 8, l))}% menos.`,
    price: (l) => `A barra de energia do próximo grimório fica ${n(lin(20, 2, l))}% maior.`,
    sealText: 'Cada melhoria devolve a poeira de 10 toques.',
  },
  {
    id: 'ton-618',
    name: 'TON 618',
    art: 'quasar gigante com jatos azuis',
    effects: (l) => [{ kind: 'generatorPct', pct: geo(200, 1.6, l) }, { kind: 'idleFloor', add: lin(0.05, 0.05, l) }, priced({ kind: 'dustMult', mult: lin(0.92, -0.01, l) })],
    seal: [{ kind: 'energyGenPct', pct: 60 }],
    bonus: (l) => `Os geradores de poeira rendem +${n(geo(200, 1.6, l))}% e, parados, mantêm +${n(lin(5, 5, l))} pontos do ritmo ativo.`,
    price: (l) => `O toque rende só x${n(lin(0.92, -0.01, l))} de poeira.`,
    sealText: 'Os geradores de energia rendem +60%.',
  },
  {
    id: 'phoenix-a',
    name: 'Phoenix A',
    art: 'aglomerado em chamas ao redor de um núcleo',
    effects: (l) => [{ kind: 'energyGenPct', pct: geo(200, 1.6, l) }, { kind: 'comboWindow', sec: lin(0.5, 0.25, l) }, priced({ kind: 'energyMult', mult: lin(0.75, -0.03, l) })],
    seal: [{ kind: 'activeWindow', sec: 4 }],
    bonus: (l) => `Os geradores de energia rendem +${n(geo(200, 1.6, l))}% e a janela do combo ganha +${n(lin(0.5, 0.25, l))} s.`,
    price: (l) => `O toque dá só x${n(lin(0.75, -0.03, l))} da energia.`,
    sealText: 'Os geradores contam como "tocando" por +4 s depois de cada toque.',
  },
  {
    id: 'gaia-bh3',
    name: 'Gaia BH3',
    art: 'buraco negro solitário entre estrelas distantes',
    effects: (l) => [{ kind: 'rarityBoost', add: lin(4, 4, l) }, priced({ kind: 'noCommon' })],
    seal: [{ kind: 'choiceExtra', reroll: 1 }],
    bonus: (l) => `As cartas épicas e lendárias pesam +${n(lin(4, 4, l))} no sorteio.`,
    price: () => 'Os grimórios comuns somem das ofertas.',
    sealText: '+1 troca grátis por escolha.',
  },
  {
    id: 'gw150914',
    name: 'GW150914',
    art: 'duas espirais de luz se fundindo',
    effects: (l) => [
      { kind: 'everyNthTouch', n: lin(30, -2, l), mult: geo(30, 1.4, l) },
      priced({ kind: 'dustMult', mult: lin(0.5, -0.025, l) }),
    ],
    seal: [{ kind: 'onCapture', energyTouches: 3 }],
    bonus: (l) => `A cada ${lin(30, -2, l)} toques, o toque rende x${n(geo(30, 1.4, l))}.`,
    price: (l) => `Entre os pulsos o toque rende só x${n(lin(0.5, -0.025, l))}.`,
    sealText: 'Cada objeto capturado dá +3 toques de energia.',
  },
  {
    id: 'v404-cygni',
    name: 'V404 Cygni',
    art: 'buraco negro devorando uma estrela vizinha',
    effects: (l) => [
      { kind: 'spawnCut', sec: lin(25, 8, l) },
      { kind: 'maxObjects', add: Math.floor((l + 1) / 2) },
      { kind: 'objectReward', target: 'all', add: lin(2, 1, l) },
      priced({ kind: 'generatorPct', pct: -lin(20, 5, l) }),
    ],
    seal: [{ kind: 'rareLife', sec: 6 }],
    bonus: (l) => `Objetos chegam ${n(lin(25, 8, l))} s mais cedo, cabem ${Math.floor((l + 1) / 2)} a mais na tela e valem +${n(lin(2, 1, l))} toques.`,
    price: (l) => `Os geradores de poeira rendem ${n(lin(20, 5, l))}% menos.`,
    sealText: 'A Estrela Dourada fica +6 s no campo.',
  },
  {
    id: 'holmberg-15a',
    name: 'Holmberg 15A',
    art: 'galáxia elíptica gigante e pálida',
    effects: (l) => [{ kind: 'startDust', amount: geo(5e6, 2.2, l) }, priced({ kind: 'upgradeCostPct', pct: lin(10, 2, l) })],
    seal: [{ kind: 'freeUpgradeLevels', upgrade: 'satellite', levels: 5 }],
    bonus: (l) => `Cada vida começa com ${n(geo(5, 2.2, l))} mi de poeira.`,
    price: (l) => `As melhorias custam ${n(lin(10, 2, l))}% mais.`,
    sealText: 'Cada vida começa com 5 níveis de Satélite de graça.',
  },
  {
    id: 'ic10-x1',
    name: 'IC 10 X-1',
    art: 'buraco negro numa galáxia anã irregular',
    effects: (l) => [
      { kind: 'afterCaptureMult', mult: geo(3, 1.4, l) },
      { kind: 'objectReward', target: 'all', add: lin(2, 1, l) },
      priced({ kind: 'dustMult', mult: lin(0.95, -0.02, l) }),
    ],
    seal: [{ kind: 'rareCut', sec: 60 }],
    bonus: (l) => `O toque depois de uma captura rende x${n(geo(3, 1.4, l))} e cada objeto vale +${n(lin(2, 1, l))} toques.`,
    price: (l) => `O toque rende só x${n(lin(0.95, -0.02, l))} de poeira.`,
    sealText: 'A Estrela Dourada vem 60 s mais cedo.',
  },
];

const BY_ID = new Map(FORBIDDEN.map((f) => [f.id, f]));
export const FORBIDDEN_IDS: readonly string[] = FORBIDDEN.map((f) => f.id);

export function forbiddenById(id: string): ForbiddenDef | undefined {
  return BY_ID.get(id);
}

/** Efeitos ativos de um proibido no nível `level` (o selo entra no nível 5). */
export function forbiddenEffects(id: string, level: number): Effect[] {
  const def = BY_ID.get(id);
  const l = Math.min(FORBIDDEN_MAX_LEVEL, Math.max(0, Math.floor(level)));
  if (!def || l < 1) return [];
  return [...def.effects(l), ...(l >= FORBIDDEN_MAX_LEVEL ? def.seal : [])];
}
