// Conquistas do Aperta! (spec 038, seção 5.3; ampliadas pela spec 040, seção 4). Cada uma é uma linha de dados: meta
// `goal`, recompensa em Cintilas (`reward`) e uma função pura que lê o progresso do save. O motor chama
// `awardAchievements` depois de cada ação que muda esses números, e o id ganho fica em `save.achievements` (nunca sai,
// nem se a árvore for refeita). As Cintilas vêm de `sparks.ts`, que soma a recompensa de cada id ganho.
//
// Conquista que depende de conteúdo que ainda não existe (proibidos novos, automação, eventos e objetos lendários novos,
// árvore nova, sequência de dias) entra aqui com `needs` e só conta quando `FEATURES[needs]` for verdadeiro: a etapa que
// entrega a feature liga a chave e o resto já funciona.

import { GRIMOIRES, RARITIES, REGIONS, UPGRADES, grimoireById } from './catalog';
import { TREE_BRANCHES, TREE_NODES, nodeLive } from './tree';
import { FORBIDDEN_MAX_LEVEL } from './forbidden';
import { GRIMOIRE_MAX_LEVEL } from './economy';
import type { SaveState } from './engine';

export type AchievementGroup =
  | 'taps'
  | 'dust'
  | 'grimoires'
  | 'objects'
  | 'combo'
  | 'collapses'
  | 'forbidden'
  | 'automation'
  | 'luck'
  | 'explore'
  | 'tree'
  | 'gens'
  | 'missions'
  | 'regions'
  | 'time'
  | 'hidden';

export const ACHIEVEMENT_GROUPS: readonly { id: AchievementGroup; name: string }[] = [
  { id: 'taps', name: 'Toques' },
  { id: 'dust', name: 'Poeira' },
  { id: 'grimoires', name: 'Grimórios' },
  { id: 'objects', name: 'Objetos' },
  { id: 'combo', name: 'Combo e ritmo' },
  { id: 'collapses', name: 'Colapsos' },
  { id: 'forbidden', name: 'Proibidos' },
  { id: 'automation', name: 'Automação' },
  { id: 'luck', name: 'Sorte' },
  { id: 'explore', name: 'Exploração' },
  { id: 'tree', name: 'Árvore' },
  { id: 'gens', name: 'Geradores e toque' },
  { id: 'missions', name: 'Missões da estação' },
  { id: 'regions', name: 'Regiões' },
  { id: 'time', name: 'Tempo' },
  { id: 'hidden', name: 'Escondidas' },
];

/** Conteúdo que as etapas seguintes entregam; `FEATURES[x]` vira `true` quando a etapa chega. */
export type Feature = 'forbidden-new' | 'automation' | 'legendary-objects' | 'events-new' | 'tree-v2' | 'daily-streak' | 'regions-more';

export const FEATURES: Record<Feature, boolean> = {
  // Ligada na etapa 15: os 10 proibidos existem no Cofre.
  'forbidden-new': true,
  automation: false,
  // Ligadas na etapa 20: os 4 lendários e os 4 eventos da árvore existem.
  'legendary-objects': true,
  'events-new': true,
  'tree-v2': false,
  'daily-streak': false,
  'regions-more': false,
};

export const FEATURE_NAMES: Record<Feature, string> = {
  'forbidden-new': 'novos proibidos',
  automation: 'automações e habilidades',
  'legendary-objects': 'objetos lendários',
  'events-new': 'eventos novos',
  'tree-v2': 'a árvore nova',
  'daily-streak': 'a sequência de dias',
  'regions-more': 'mais regiões',
};

/** Recompensa em Cintilas por tamanho (spec 040, seção 4): pequena 1, média 2, grande 3, épica 5; escondida 3. */
export type RewardTier = 'S' | 'M' | 'L' | 'E';
export const TIER_REWARD: Record<RewardTier, number> = { S: 1, M: 2, L: 3, E: 5 };
export const HIDDEN_REWARD = 3;

export interface AchievementDef {
  id: string;
  group: AchievementGroup;
  name: string;
  text: string;
  goal: number;
  /** Cintilas ganhas ao conquistar. */
  reward: number;
  /** Escondida: aparece como "???" até ser ganha. */
  hidden?: boolean;
  /** Depende de uma feature que ainda não existe: não conta até `FEATURES[needs]`. */
  needs?: Feature;
  /** Aposentada (conteúdo que saiu do jogo): nunca é dada de novo, some da tela, mas a recompensa de quem já ganhou fica. */
  retired?: true;
  progress: (s: SaveState) => number;
}

const albumOf = (s: SaveState) => s.album.map((id) => grimoireById(id)).filter((g) => g !== undefined);
const planetsFound = (s: SaveState) => albumOf(s).filter((g) => g.family === 'planets').length;
const treeNodes = (s: SaveState) => Object.values(s.tree).reduce((sum, lvl) => sum + lvl, 0);
const fullBranches = (s: SaveState) =>
  TREE_BRANCHES.filter((b) => {
    const live = TREE_NODES.filter((n) => n.branch === b.id && nodeLive(n));
    return live.length > 0 && live.every((n) => (s.tree[n.id] ?? 0) >= n.maxLevel);
  }).length;
const albumRarity = (r: (typeof RARITIES)[number]) => (s: SaveState) => albumOf(s).filter((g) => g.rarity === r).length;
const count = (r: (typeof RARITIES)[number]) => GRIMOIRES.filter((g) => g.rarity === r).length;

interface Opts {
  hidden?: boolean;
  needs?: Feature;
  retired?: true;
}

const def = (
  id: string,
  group: AchievementGroup,
  tier: RewardTier,
  name: string,
  text: string,
  goal: number,
  progress: AchievementDef['progress'],
  opts: Opts = {},
): AchievementDef => ({
  id,
  group,
  name,
  text,
  goal,
  reward: opts.hidden ? HIDDEN_REWARD : TIER_REWARD[tier],
  progress,
  ...(opts.hidden ? { hidden: true } : {}),
  ...(opts.needs ? { needs: opts.needs } : {}),
  ...(opts.retired ? { retired: true as const } : {}),
});

const clicks = (s: SaveState) => s.stats.clicks;
const dust = (s: SaveState) => s.stats.dustTotal;
const captured = (s: SaveState) => s.stats.objectsCaptured;
const collapses = (s: SaveState) => s.collapses;
const hours = (s: SaveState) => s.playSeconds / 3600;
const best = (s: SaveState, id: string) => s.stats.forbiddenBest[id] ?? 0;
const touchUpgradeCount = UPGRADES.filter((u) => u.kind === 'touch').length;
const regionOpened = (id: string) => (s: SaveState) =>
  s.collapses >= (REGIONS.find((r) => r.id === id)?.unlockedAtCollapse ?? Infinity) ? 1 : 0;

/** Os 3 proibidos que existem e os 7 planejados (spec 040, seção 3). */
const FORBIDDEN_NOW: readonly [string, string][] = [
  ['sagittarius-a', 'Sagitário A*'],
  ['cygnus-x1', 'Cygnus X-1'],
  ['m87', 'M87*'],
];
const FORBIDDEN_PLANNED: readonly [string, string][] = [
  ['ton-618', 'TON 618'],
  ['phoenix-a', 'Phoenix A'],
  ['gaia-bh3', 'Gaia BH3'],
  ['gw150914', 'GW150914'],
  ['v404-cygni', 'V404 Cygni'],
  ['holmberg-15a', 'Holmberg 15A'],
  ['ic10-x1', 'IC 10 X-1'],
];

const forbiddenLadder = (): AchievementDef[] =>
  FORBIDDEN_NOW.flatMap(([id, name]) => [
    def(`forb-${id}`, 'forbidden', 'M', name, `Pegue o grimório proibido ${name}.`, 1, (s) => ((s.vault[id] ?? 0) > 0 ? 1 : 0)),
    def(`forb-${id}-3`, 'forbidden', 'L', `${name}, nível 3`, `Leve ${name} ao nível 3.`, 3, (s) => best(s, id)),
    def(`forb-${id}-5`, 'forbidden', 'E', `${name}, nível 5`, `Leve ${name} ao nível 5.`, 5, (s) => best(s, id)),
  ]);

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // --- Toques ---
  def('tap-1', 'taps', 'S', 'Primeiro toque', 'Aperte o botão pela primeira vez.', 1, clicks),
  def('tap-100', 'taps', 'S', 'Cem toques', 'Dê 100 toques no botão.', 100, clicks),
  def('tap-1k', 'taps', 'S', 'Mil toques', 'Dê 1.000 toques no botão.', 1_000, clicks),
  def('tap-5k', 'taps', 'M', 'Cinco mil toques', 'Dê 5.000 toques no botão.', 5_000, clicks),
  def('tap-10k', 'taps', 'M', 'Dedo de aço', 'Dê 10.000 toques no botão.', 10_000, clicks),
  def('tap-50k', 'taps', 'L', 'Cinquenta mil toques', 'Dê 50.000 toques no botão.', 50_000, clicks),
  def('tap-100k', 'taps', 'L', 'Pulso de pulsar', 'Dê 100.000 toques no botão.', 100_000, clicks),
  def('tap-1m', 'taps', 'E', 'Um milhão de toques', 'Dê 1.000.000 de toques no botão.', 1_000_000, clicks),

  // --- Poeira ---
  def('dust-1k', 'dust', 'S', 'Poeira de estrela', 'Junte 1 mil de poeira no total.', 1e3, dust),
  def('dust-1m', 'dust', 'S', 'Nuvem de poeira', 'Junte 1 milhão de poeira no total.', 1e6, dust),
  def('dust-1b', 'dust', 'M', 'Tempestade cósmica', 'Junte 1 bilhão de poeira no total.', 1e9, dust),
  def('dust-1t', 'dust', 'M', 'Maré de poeira', 'Junte 1 trilhão de poeira no total.', 1e12, dust),
  def('dust-1e15', 'dust', 'L', 'Oceano de poeira', 'Junte 1e15 de poeira no total.', 1e15, dust),
  def('dust-1e24', 'dust', 'L', 'Galáxia de poeira', 'Junte 1e24 de poeira no total.', 1e24, dust),
  def('dust-1e50', 'dust', 'E', 'Além dos números', 'Junte 1e50 de poeira no total.', 1e50, dust),
  def('dust-1e100', 'dust', 'E', 'Googol', 'Junte 1e100 de poeira no total.', 1e100, dust),

  // --- Grimórios ---
  def('grim-10', 'grimoires', 'S', 'Colecionador de astros', 'Descubra 10 grimórios.', 10, (s) => s.album.length),
  def('grim-20', 'grimoires', 'M', 'Biblioteca estelar', 'Descubra 20 grimórios.', 20, (s) => s.album.length),
  def('grim-all', 'grimoires', 'L', 'Atlas completo', 'Descubra os 30 grimórios do começo.', 30, (s) => s.album.length),
  def('grim-40', 'grimoires', 'M', 'Quarenta astros', 'Descubra 40 grimórios.', 40, (s) => s.album.length),
  def('grim-50', 'grimoires', 'L', 'Cinquenta astros', 'Descubra 50 grimórios.', 50, (s) => s.album.length),
  def('grim-catalog', 'grimoires', 'E', 'Álbum completo', 'Descubra todos os grimórios do álbum.', GRIMOIRES.length, (s) => s.album.length),
  def('grim-planets', 'grimoires', 'M', 'Colecionador de planetas', 'Descubra os 7 grimórios de Planetas.', 7, planetsFound),
  def(
    'grim-rarities',
    'grimoires',
    'M',
    'Um de cada raridade',
    'Descubra um grimório de cada raridade.',
    RARITIES.length,
    (s) => new Set(albumOf(s).map((g) => g.rarity)).size,
  ),
  def('grim-epic-5', 'grimoires', 'M', 'Cinco épicos', 'Descubra 5 grimórios épicos.', 5, albumRarity('epic')),
  def('grim-epic-all', 'grimoires', 'L', 'Todos os épicos', 'Descubra todos os grimórios épicos.', count('epic'), albumRarity('epic')),
  def('grim-legend-3', 'grimoires', 'L', 'Três lendas', 'Descubra 3 grimórios lendários.', 3, albumRarity('legendary')),
  def('grim-legend-all', 'grimoires', 'E', 'Todas as lendas', 'Descubra todos os grimórios lendários.', count('legendary'), albumRarity('legendary')),
  def('grim-lv5', 'grimoires', 'M', 'Brilho crescente', 'Leve um grimório ao nível 5.', 5, (s) => s.stats.bestLevel),
  def('grim-lv10', 'grimoires', 'L', 'Nível máximo', `Leve um grimório ao nível ${GRIMOIRE_MAX_LEVEL}.`, GRIMOIRE_MAX_LEVEL, (s) => s.stats.bestLevel),

  // --- Objetos ---
  def('obj-20', 'objects', 'S', 'Caçador de cometas', 'Capture 20 objetos no espaço.', 20, captured),
  def('obj-100', 'objects', 'M', 'Rede estelar', 'Capture 100 objetos no espaço.', 100, captured),
  def('obj-500', 'objects', 'L', 'Sentinela da Perigeu', 'Capture 500 objetos no espaço.', 500, captured),
  def('obj-1000', 'objects', 'L', 'Mil capturas', 'Capture 1.000 objetos no espaço.', 1_000, captured),
  def('obj-2500', 'objects', 'L', 'Guardião do espaço', 'Capture 2.500 objetos no espaço.', 2_500, captured),
  def('obj-5000', 'objects', 'E', 'Colecionador de sinais', 'Capture 5.000 objetos no espaço.', 5_000, captured),
  def('obj-sats', 'objects', 'M', 'Constelação de satélites', 'Capture 10 satélites em sequência.', 10, (s) => s.stats.satelliteBest),
  def('rare-1', 'objects', 'S', 'Estrela Dourada', 'Capture seu primeiro objeto raro (Estrela Dourada ou Sonda).', 1, (s) => s.stats.raresCaptured),
  def('rare-10', 'objects', 'M', 'Caça ao raro', 'Capture 10 objetos raros.', 10, (s) => s.stats.raresCaptured),
  def('rare-50', 'objects', 'L', 'Faro de caçador', 'Capture 50 objetos raros.', 50, (s) => s.stats.raresCaptured),
  def('rare-200', 'objects', 'E', 'Mestre dos raros', 'Capture 200 objetos raros.', 200, (s) => s.stats.raresCaptured),
  def('obj-kinds', 'objects', 'M', 'Um de cada', 'Capture um objeto de cada tipo que já apareceu no espaço.', 5, (s) => s.stats.capturedKinds.filter((k) => k !== 'golden').length),

  // --- Combo e ritmo ---
  def('combo-max', 'combo', 'S', 'Ressonância total', 'Chegue ao combo máximo.', 1, (s) => s.stats.comboMaxHits),
  def('combo-30', 'combo', 'M', 'Pulso constante', 'Mantenha o combo máximo por 30 segundos.', 30, (s) => Math.floor(s.stats.comboFullBest)),
  def('combo-60', 'combo', 'M', 'Um minuto cheio', 'Mantenha o combo máximo por 60 segundos.', 60, (s) => Math.floor(s.stats.comboFullBest)),
  def('combo-120', 'combo', 'L', 'Dois minutos cheios', 'Mantenha o combo máximo por 120 segundos.', 120, (s) => Math.floor(s.stats.comboFullBest)),
  def('combo-300', 'combo', 'E', 'Cinco minutos cheios', 'Mantenha o combo máximo por 300 segundos.', 300, (s) => Math.floor(s.stats.comboFullBest)),
  def('chain-10', 'combo', 'S', 'Sequência de 10', 'Dê 10 toques seguidos sem deixar o combo cair.', 10, (s) => s.stats.chainBest),
  def('chain-25', 'combo', 'M', 'Sequência de 25', 'Dê 25 toques seguidos sem deixar o combo cair.', 25, (s) => s.stats.chainBest),
  def('chain-50', 'combo', 'L', 'Sequência de 50', 'Dê 50 toques seguidos sem deixar o combo cair.', 50, (s) => s.stats.chainBest),
  def('chain-100', 'combo', 'E', 'Sequência de 100', 'Dê 100 toques seguidos sem deixar o combo cair.', 100, (s) => s.stats.chainBest),
  def('combo-hits-10k', 'combo', 'L', 'Dez mil no máximo', 'Dê 10.000 toques com o combo no máximo.', 10_000, (s) => s.stats.comboMaxHits),

  // --- Colapsos ---
  def('forbidden', 'collapses', 'M', 'Horizonte de eventos', 'Pegue um grimório proibido.', 1, (s) => Object.keys(s.vault).length),
  def('collapse-1', 'collapses', 'M', 'Primeira estrela colapsada', 'Colapse a estrela uma vez.', 1, collapses),
  def('collapse-3', 'collapses', 'M', 'Três estrelas', 'Colapse a estrela 3 vezes.', 3, collapses),
  def('collapse-5', 'collapses', 'M', 'Cinco estrelas', 'Colapse a estrela 5 vezes.', 5, collapses),
  def('collapse-10', 'collapses', 'L', 'Dez colapsos', 'Colapse a estrela 10 vezes.', 10, collapses),
  def('collapse-15', 'collapses', 'L', 'Quinze colapsos', 'Colapse a estrela 15 vezes.', 15, collapses),
  def('collapse-20', 'collapses', 'L', 'Vinte colapsos', 'Colapse a estrela 20 vezes.', 20, collapses),
  def('collapse-25', 'collapses', 'L', 'Veterana do espaço', 'Colapse a estrela 25 vezes.', 25, collapses),
  def('collapse-30', 'collapses', 'L', 'Trinta colapsos', 'Colapse a estrela 30 vezes.', 30, collapses),
  def('collapse-50', 'collapses', 'E', 'Lenda de Perigeu', 'Colapse a estrela 50 vezes.', 50, collapses),
  def('collapse-75', 'collapses', 'E', 'Setenta e cinco', 'Colapse a estrela 75 vezes.', 75, collapses),
  def('collapse-100', 'collapses', 'E', 'Cem estrelas', 'Colapse a estrela 100 vezes.', 100, collapses),
  // O Atlas saiu (etapa 15): as três conquistas dele ficam aposentadas (quem já as tem mantém as Cintilas) e entram as do Cofre.
  def('atlas-4', 'collapses', 'M', 'Atlas com 4 páginas', 'Guarde 4 páginas no Atlas.', 4, () => 0, { retired: true }),
  def('atlas-7', 'collapses', 'L', 'Atlas cheio', 'Guarde 7 páginas no Atlas.', 7, () => 0, { retired: true }),
  def('vault-4', 'collapses', 'M', 'Cofre com 4', 'Tenha 4 proibidos no Cofre.', 4, (s) => Object.keys(s.vault).length),
  def('vault-7', 'collapses', 'L', 'Cofre com 7', 'Tenha 7 proibidos no Cofre.', 7, (s) => Object.keys(s.vault).length),
  def('vault-10', 'collapses', 'L', 'Cofre completo', 'Tenha os 10 proibidos no Cofre.', 10, (s) => Object.keys(s.vault).length),
  def('seal-1', 'collapses', 'L', 'Selo Estelar', 'Ganhe seu primeiro Selo Estelar (todos os proibidos no nível 5).', 1, (s) => s.seals),
  def('seal-10', 'collapses', 'E', 'Dez selos', 'Ganhe 10 Selos Estelares.', 10, (s) => s.seals),
  def(
    'leave-solar',
    'collapses',
    'M',
    'Saí do Sistema Solar',
    'Chegue a Alfa Centauro, a primeira região fora do Sistema Solar.',
    1,
    regionOpened('alpha-centauri'),
  ),
  def('atlas-families', 'collapses', 'L', 'Atlas de todas as famílias', 'Guarde no Atlas uma página de cada família.', 5, () => 0, { retired: true }),

  // --- Proibidos (os 3 de hoje; os 7 novos entram quando o Cofre existir) ---
  ...forbiddenLadder(),
  ...FORBIDDEN_PLANNED.map(([id, name]) =>
    def(`forb-${id}-3`, 'forbidden', 'L', `${name}, nível 3`, `Leve ${name} ao nível 3.`, 3, (s) => best(s, id), { needs: 'forbidden-new' }),
  ),
  def(
    'forb-all-5',
    'forbidden',
    'E',
    'Dez no nível 5',
    'Leve os 10 grimórios proibidos ao nível 5.',
    10,
    (s) => Object.values(s.vault).filter((l) => l >= FORBIDDEN_MAX_LEVEL).length,
    { needs: 'forbidden-new' },
  ),

  // --- Automação (chega na etapa 19) ---
  ...(
    [
      ['autoclick', 'Autoclick'],
      ['auto-capture', 'Captura automática'],
      ['auto-buy', 'Compra automática'],
      ['auto-suggest', 'Escolha sugerida'],
      ['autopilot', 'Piloto automático'],
    ] as const
  ).map(([id, name]) =>
    def(`auto-${id}`, 'automation', 'M', name, `Use ${name} pela primeira vez.`, 1, (s) => s.stats.skillsUsed.filter((k) => k === id).length, { needs: 'automation' }),
  ),
  def('skills-5', 'automation', 'L', 'Caixa de ferramentas', 'Use as 5 habilidades ativas.', 5, (s) => s.stats.skillsUsed.filter((k) => ['pulse', 'supernova', 'time-warp', 'lens', 'magnet'].includes(k)).length, { needs: 'automation' }),
  def('skills-100', 'automation', 'L', 'Mão na massa', 'Use habilidades 100 vezes.', 100, (s) => s.stats.skillUses, { needs: 'automation' }),
  def('skills-1000', 'automation', 'E', 'Mestre das habilidades', 'Use habilidades 1.000 vezes.', 1_000, (s) => s.stats.skillUses, { needs: 'automation' }),

  // --- Sorte ---
  def('luck-legend-1', 'luck', 'M', 'Oferta de lenda', 'Veja um grimório lendário ou proibido numa oferta.', 1, (s) => s.stats.legendaryOffers),
  def('luck-legend-5', 'luck', 'L', 'Cinco ofertas de lenda', 'Veja grimórios lendários ou proibidos em 5 ofertas.', 5, (s) => s.stats.legendaryOffers),
  def('luck-legend-20', 'luck', 'E', 'Sorte de estrela', 'Veja grimórios lendários ou proibidos em 20 ofertas.', 20, (s) => s.stats.legendaryOffers),
  def('luck-streak-5', 'luck', 'M', 'Cinco raros seguidos', 'Escolha 5 grimórios raros ou melhores em sequência.', 5, (s) => s.stats.rareStreakBest),
  def('luck-streak-10', 'luck', 'L', 'Dez raros seguidos', 'Escolha 10 grimórios raros ou melhores em sequência.', 10, (s) => s.stats.rareStreakBest),
  def('luck-streak-20', 'luck', 'E', 'Vinte raros seguidos', 'Escolha 20 grimórios raros ou melhores em sequência.', 20, (s) => s.stats.rareStreakBest),
  def('luck-reroll-50', 'luck', 'M', 'Trocador', 'Troque cartas de oferta 50 vezes.', 50, (s) => s.stats.rerolls),
  def('luck-reroll-200', 'luck', 'L', 'Indeciso', 'Troque cartas de oferta 200 vezes.', 200, (s) => s.stats.rerolls),

  // --- Exploração ---
  def('explore-meteor', 'explore', 'M', 'Chuva de meteoros', 'Veja uma Chuva de meteoros.', 1, (s) => (s.stats.eventsSeen.includes('meteor-shower') ? 1 : 0)),
  def('explore-storm', 'explore', 'M', 'Tempestade solar', 'Veja uma Tempestade solar.', 1, (s) => (s.stats.eventsSeen.includes('solar-storm') ? 1 : 0)),
  ...(
    [
      ['gold-rain', 'Chuva de ouro'],
      ['alignment', 'Alinhamento'],
      ['energy-tide', 'Maré de energia'],
      ['eclipse', 'Eclipse'],
    ] as const
  ).map(([id, name]) => def(`explore-${id}`, 'explore', 'M', name, `Veja o evento ${name}.`, 1, (s) => (s.stats.eventsSeen.includes(id) ? 1 : 0), { needs: 'events-new' })),
  def('explore-events', 'explore', 'L', 'Todos os eventos', 'Veja todos os eventos raros do espaço.', 6, (s) => s.stats.eventsSeen.length, { needs: 'events-new' }),
  def('explore-legend-1', 'explore', 'M', 'Lenda no espaço', 'Capture um objeto lendário.', 1, (s) => s.stats.capturedKinds.filter((k) => k.startsWith('legend')).length, { needs: 'legendary-objects' }),
  def('explore-legend-all', 'explore', 'E', 'Todas as lendas do espaço', 'Capture todos os tipos de objeto lendário.', 4, (s) => s.stats.capturedKinds.filter((k) => k.startsWith('legend')).length, { needs: 'legendary-objects' }),

  // --- Árvore ---
  def('tree-1', 'tree', 'S', 'Primeira habilidade', 'Compre o primeiro nó da árvore.', 1, treeNodes),
  def('tree-5', 'tree', 'S', 'Cinco nós', 'Compre 5 níveis na árvore.', 5, treeNodes),
  def('tree-10', 'tree', 'M', 'Dez nós', 'Compre 10 níveis na árvore.', 10, treeNodes),
  def('tree-branch', 'tree', 'M', 'Ramo completo', 'Complete os 3 níveis de um ramo da árvore.', 1, fullBranches),
  def('tree-branch-3', 'tree', 'M', 'Três ramos', 'Complete 3 ramos da árvore.', 3, fullBranches),
  def('tree-all', 'tree', 'L', 'Árvore completa', 'Complete todos os ramos da árvore.', TREE_BRANCHES.length, fullBranches),
  ...([25, 50, 100, 120] as const).map((n) =>
    def(`tree-nodes-${n}`, 'tree', n >= 50 ? 'E' : 'L', `${n} nós`, `Compre ${n} nós na árvore nova.`, n, (s) => Object.keys(s.tree).length, { needs: 'tree-v2' }),
  ),

  // --- Geradores e toque ---
  def('gen-25', 'gens', 'M', 'Frota em crescimento', 'Leve um gerador ao nível 25.', 25, (s) => s.stats.genBest),
  def('gen-50', 'gens', 'M', 'Frota de verdade', 'Leve um gerador ao nível 50.', 50, (s) => s.stats.genBest),
  def('gen-100', 'gens', 'L', 'Cem de um tipo', 'Leve um gerador ao nível 100.', 100, (s) => s.stats.genBest),
  def('gen-200', 'gens', 'E', 'Duzentos de um tipo', 'Leve um gerador ao nível 200.', 200, (s) => s.stats.genBest),
  def('gen-400', 'gens', 'E', 'Gerador no limite', 'Leve um gerador ao nível máximo (400).', 400, (s) => s.stats.genBest),
  def('upg-100', 'gens', 'M', 'Cem compras', 'Faça 100 compras de melhorias.', 100, (s) => s.stats.upgradesBought),
  def('upg-1000', 'gens', 'L', 'Mil compras', 'Faça 1.000 compras de melhorias.', 1_000, (s) => s.stats.upgradesBought),
  def('touch-all', 'gens', 'L', 'Toque completo', 'Tenha todas as melhorias de toque numa mesma vida.', touchUpgradeCount, (s) => s.stats.touchBest),

  // --- Missões da estação ---
  def('miss-1', 'missions', 'S', 'Primeira missão', 'Cumpra uma missão da estação.', 1, (s) => s.stats.missionsDone),
  def('miss-5', 'missions', 'M', 'Cinco missões', 'Cumpra 5 missões da estação.', 5, (s) => s.stats.missionsDone),
  def('miss-10', 'missions', 'L', 'Dez missões', 'Cumpra 10 missões da estação.', 10, (s) => s.stats.missionsDone),
  def('miss-25', 'missions', 'L', 'Vinte e cinco missões', 'Cumpra 25 missões da estação.', 25, (s) => s.stats.missionsDone),
  def('miss-50', 'missions', 'E', 'Cinquenta missões', 'Cumpra 50 missões da estação.', 50, (s) => s.stats.missionsDone),
  def('miss-100', 'missions', 'E', 'Cem missões', 'Cumpra 100 missões da estação.', 100, (s) => s.stats.missionsDone),

  // --- Regiões ---
  def('region-asteroid-belt', 'regions', 'S', 'Cinturão de Asteroides', 'Chegue ao Cinturão de Asteroides.', 1, regionOpened('asteroid-belt')),
  def('region-jupiter-saturn', 'regions', 'S', 'Gigantes gasosos', 'Chegue a Júpiter e Saturno.', 1, regionOpened('jupiter-saturn')),
  def('region-kuiper-belt', 'regions', 'M', 'Cinturão de Kuiper', 'Chegue ao Cinturão de Kuiper.', 1, regionOpened('kuiper-belt')),
  def('region-oort-cloud', 'regions', 'M', 'Nuvem de Oort', 'Chegue à Nuvem de Oort.', 1, regionOpened('oort-cloud')),
  def('region-alpha-centauri', 'regions', 'L', 'Alfa Centauro', 'Chegue a Alfa Centauro.', 1, regionOpened('alpha-centauri')),
  def('regions-more', 'regions', 'E', 'Toda a viagem', 'Chegue à última região da viagem.', 16, (s) => REGIONS.filter((r) => s.collapses >= r.unlockedAtCollapse).length, { needs: 'regions-more' }),

  // --- Tempo ---
  def('time-1h', 'time', 'S', 'Uma hora de viagem', 'Jogue por 1 hora.', 1, hours),
  def('time-5h', 'time', 'M', 'Cinco horas', 'Jogue por 5 horas.', 5, hours),
  def('time-10h', 'time', 'L', 'Dez horas', 'Jogue por 10 horas.', 10, hours),
  def('time-25h', 'time', 'L', 'Vinte e cinco horas', 'Jogue por 25 horas.', 25, hours),
  def('time-50h', 'time', 'E', 'Cinquenta horas', 'Jogue por 50 horas.', 50, hours),
  def('time-100h', 'time', 'E', 'Cem horas', 'Jogue por 100 horas.', 100, hours),
  def('streak-3', 'time', 'M', 'Três dias seguidos', 'Jogue 3 dias seguidos.', 3, (s) => s.stats.dayStreakBest, { needs: 'daily-streak' }),
  def('streak-7', 'time', 'L', 'Uma semana', 'Jogue 7 dias seguidos.', 7, (s) => s.stats.dayStreakBest, { needs: 'daily-streak' }),
  def('streak-30', 'time', 'E', 'Um mês', 'Jogue 30 dias seguidos.', 30, (s) => s.stats.dayStreakBest, { needs: 'daily-streak' }),

  // --- Escondidas ---
  def('respec', 'hidden', 'S', 'Mudei de ideia', 'Refaça a árvore de habilidades.', 1, (s) => s.stats.respecs, { hidden: true }),
  def('hid-respec-3', 'hidden', 'S', 'Perfeccionista', 'Refaça a árvore 3 vezes.', 3, (s) => s.stats.respecs, { hidden: true }),
  def('hid-sats-20', 'hidden', 'S', 'Enxame', 'Capture 20 satélites em sequência.', 20, (s) => s.stats.satelliteBest, { hidden: true }),
  def('hid-chain-200', 'hidden', 'S', 'Dedos de pianista', 'Dê 200 toques seguidos sem deixar o combo cair.', 200, (s) => s.stats.chainBest, { hidden: true }),
  def('hid-cygnus-5', 'hidden', 'S', 'Olho do buraco negro', 'Leve Cygnus X-1 ao nível 5.', 5, (s) => best(s, 'cygnus-x1'), { hidden: true }),
  def('hid-first-legend', 'hidden', 'S', 'Estreia de gala', 'Veja um lendário já na primeira oferta do jogo.', 1, (s) => s.stats.firstOfferLegendary, { hidden: true }),
  def('hid-pillars', 'hidden', 'S', 'Pilares da Criação', 'Leve os Pilares da Criação ao nível máximo.', 1, (s) => (s.stats.bestLevel >= GRIMOIRE_MAX_LEVEL && s.album.includes('pillars') ? 1 : 0), { hidden: true }),
  def('hid-streak-20', 'hidden', 'S', 'Sorte grande', 'Escolha 15 grimórios raros ou melhores em sequência.', 15, (s) => s.stats.rareStreakBest, { hidden: true }),
  def('hid-offers-1000', 'hidden', 'S', 'Leitor voraz', 'Abra 1.000 ofertas de grimório.', 1_000, (s) => s.stats.offers, { hidden: true }),
  def('hid-spent-100', 'hidden', 'S', 'Investidor', 'Gaste 100 Cintilas na árvore.', 100, (s) => s.sparks.spent, { hidden: true, needs: 'tree-v2' }),
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export function achievementById(id: string): AchievementDef | undefined {
  return BY_ID.get(id);
}

export interface AchievementView {
  def: AchievementDef;
  earned: boolean;
  /** Progresso limitado à meta (uma conquista ganha mostra a meta cheia). */
  value: number;
  /** Depende de uma feature que ainda não chegou: não conta e a tela mostra "em breve". */
  locked: boolean;
}

/** A conquista conta agora? (sem `needs`, ou com a feature já ligada). */
export function achievementActive(a: AchievementDef): boolean {
  return a.needs === undefined || FEATURES[a.needs];
}

export function achievementViews(state: SaveState): AchievementView[] {
  return ACHIEVEMENTS.filter((a) => !a.retired || state.achievements.includes(a.id)).map((a) => {
    const earned = state.achievements.includes(a.id);
    const locked = !achievementActive(a);
    const value = earned ? a.goal : locked ? 0 : Math.min(a.goal, Math.max(0, a.progress(state)));
    return { def: a, earned, value, locked };
  });
}

/** Ids que passaram da meta e ainda não estão no save (as que dependem de feature ausente nunca entram). */
export function newlyEarned(state: SaveState): string[] {
  const have = new Set(state.achievements);
  return ACHIEVEMENTS.filter((a) => !a.retired && !have.has(a.id) && achievementActive(a) && a.progress(state) >= a.goal).map((a) => a.id);
}

/** Guarda no save as conquistas que acabaram de bater a meta. Devolve o mesmo objeto se não há nada novo. */
export function awardAchievements(state: SaveState): SaveState {
  const ids = newlyEarned(state);
  return ids.length === 0 ? state : { ...state, achievements: [...state.achievements, ...ids] };
}

/** Cintilas que as conquistas ativas ainda vão dar e as que já deram (a tela de Conquistas mostra os dois). */
export function achievementSparks(state: SaveState): { earned: number; toEarn: number; soon: number } {
  let earned = 0;
  let toEarn = 0;
  let soon = 0;
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.includes(a.id)) earned += a.reward;
    else if (a.retired) continue;
    else if (achievementActive(a)) toEarn += a.reward;
    else soon += a.reward;
  }
  return { earned, toEarn, soon };
}
