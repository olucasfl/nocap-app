// Árvore de Habilidades (spec 040, seções 5 e 6): grafo de 120 nós em 5 ramos de 24, cada nó com 1 a 2 níveis (tier 1 a 5),
// pré-requisitos (1 ou 2 pais, mais ligações cruzadas raras entre ramos) e o EFEITO em dados.
//
// Cada nó só faz o que melhorias, grimórios e proibidos NÃO fazem. As exceções são os nós de PODER DIRETO (mais poeira ou
// energia, no máximo ~15% dos nós): são os que o simulador usa para nivelar o jogo. Os nós de mecânica que ainda não
// existem levam `needs` e ficam fechados (não se compram, não valem) até a etapa que os entrega ligar a chave em
// `TREE_FEATURES`: Automação e Habilidades na 19, Sorte e Exploração na 20.

import type { Effect } from './catalog';
import { UPGRADES } from './catalog';

export type TreeBranchId = 'automation' | 'skills' | 'luck' | 'exploration' | 'cosmos';

export interface TreeBranchDef {
  id: TreeBranchId;
  name: string;
  /** Prefixo do id dos nós (`au-01`). */
  prefix: string;
  hint: string;
}

export const TREE_BRANCHES: readonly TreeBranchDef[] = [
  { id: 'automation', name: 'Automação', prefix: 'au', hint: 'Máquinas que jogam por você, dentro do ritmo ativo.' },
  { id: 'skills', name: 'Habilidades ativas', prefix: 'sk', hint: 'Botões com recarga: Pulso, Supernova, Dobra e mais.' },
  { id: 'luck', name: 'Sorte', prefix: 'lu', hint: 'Rerolls, 4ª carta e garantia de cartas raras.' },
  { id: 'exploration', name: 'Exploração', prefix: 'ex', hint: 'Eventos raros, objetos lendários e o mapa estelar.' },
  { id: 'cosmos', name: 'Cosmos', prefix: 'co', hint: 'O fechamento: capas, sintonia, eco e a força dos proibidos.' },
];

/** Mecânicas que dependem de etapas futuras; o nó só abre quando a chave liga. */
export type TreeFeature = 'automation' | 'skills' | 'luck' | 'exploration' | 'observatory';

export const TREE_FEATURES: Record<TreeFeature, boolean> = {
  automation: false,
  skills: false,
  luck: true,
  exploration: true,
  // Observatório, Projeção, Mapa do cosmos e a Constelação eterna dependem de telas que a etapa 18/21 entrega.
  observatory: false,
};

/** Custo em Cintilas de UM nível, por tier (spec 040, 5.2). */
export const TREE_TIER_COST: readonly number[] = [1, 2, 3, 5, 8];

export interface TreeEffectDef {
  kind: string;
  /** Valor de cada parâmetro por nível; um vetor curto vale para os níveis seguintes. */
  params: Record<string, number[]>;
}

export interface TreeNodeDef {
  id: string;
  branch: TreeBranchId;
  name: string;
  text: string;
  tier: 1 | 2 | 3 | 4 | 5;
  maxLevel: number;
  /** Pais que precisam estar comprados (nível >= 1). Vazio = sai da raiz. */
  parents: string[];
  effect: TreeEffectDef;
  needs?: TreeFeature;
}

type Row = [name: string, tier: TreeNodeDef['tier'], levels: number, parents: number[], kind: string, params: Record<string, number[]>, text: string, needs?: TreeFeature];

const AU: Row[] = [
  ['Autoclick', 1, 2, [], 'autoclick', { cps: [2, 3] }, 'Habilidade: toques automáticos por 60 s.', 'automation'],
  ['Captura automática', 1, 2, [], 'autoCapture', { range: [1, 2] }, 'Pega sozinho os objetos comuns no alcance.', 'automation'],
  ['Compra automática', 1, 2, [], 'autoBuy', { limit: [50, 30] }, 'Compra a melhoria mais barata ao passar do limite que você define.', 'automation'],
  ['Gerador afinado', 1, 2, [], 'generatorPct', { pct: [1.5, 3] }, 'Os geradores de poeira rendem mais.'],
  ['Velocidade do autoclick', 2, 2, [1], 'autoclickSpeed', { cps: [4, 6] }, 'O autoclick toca mais rápido.', 'automation'],
  ['Duração do autoclick', 2, 2, [1], 'autoclickDuration', { sec: [90, 120] }, 'O autoclick dura mais.', 'automation'],
  ['Alcance da captura', 2, 2, [2], 'autoCaptureRange', { range: [2, 3] }, 'A captura automática alcança mais longe.', 'automation'],
  ['Limite da compra', 2, 2, [3], 'autoBuyLimit', { pct: [60, 80] }, 'A compra automática aceita gastar uma fatia maior da poeira.', 'automation'],
  ['Compra em lote', 2, 2, [3], 'autoBuyBatch', { n: [2, 3] }, 'A compra automática leva várias melhorias de uma vez.', 'automation'],
  ['Motor eficiente', 2, 2, [4], 'energyGenPct', { pct: [2, 4] }, 'Os geradores de energia rendem mais.'],
  ['Recarga do autoclick', 3, 2, [5], 'autoclickCooldown', { sec: [480, 360] }, 'O autoclick volta mais cedo.', 'automation'],
  ['Captura de raros', 3, 2, [7], 'autoCaptureRare', { rare: [1, 1], legendary: [0, 1] }, 'A captura automática pega raros e, no nível 2, lendários.', 'automation'],
  ['Compra inteligente', 3, 2, [9], 'autoBuySmart', { weight: [1, 2] }, 'A compra automática prefere a melhoria que mais rende.', 'automation'],
  ['Autoclick com combo', 3, 1, [6, 7], 'autoclickCombo', { on: [1] }, 'Os toques do autoclick mantêm o combo.', 'automation'],
  ['Escolha sugerida', 3, 1, [8], 'suggestPick', { on: [1] }, 'Destaca a carta mais forte para o plano atual.', 'automation'],
  ['Gerador reforçado', 3, 1, [10], 'generatorPct', { pct: [3] }, 'Mais poeira dos geradores.'],
  ['Autoclick duplo', 4, 1, [11], 'autoclickCharges', { n: [2] }, 'O autoclick guarda 2 cargas.', 'automation'],
  ['Ímã automático', 4, 1, [12], 'autoCaptureMagnet', { on: [1] }, 'A captura automática puxa os objetos para perto.', 'automation'],
  ['Reserva de compra', 4, 1, [13], 'autoBuyReserve', { pct: [20] }, 'A compra automática guarda uma reserva para a próxima melhoria grande.', 'automation'],
  ['Piloto automático', 4, 1, [14, 15], 'autopilot', { sec: [90] }, 'Liga autoclick, captura e compra juntos por um tempo.', 'automation'],
  ['Escolha automática', 4, 1, [16], 'autoPick', { on: [1] }, 'Escolhe a carta sugerida se você demora.', 'automation'],
  ['Autoclick eterno', 5, 1, [17, 18], 'autoclickDuration', { sec: [180] }, 'O autoclick passa a durar 180 s.', 'automation'],
  ['Piloto total', 5, 1, [19, 20], 'autopilotAll', { mult: [2] }, 'O piloto automático dura o dobro.', 'automation'],
  ['Mestre das máquinas', 5, 1, [21, 19], 'generatorPct', { pct: [7.5] }, 'Os geradores de poeira rendem muito mais.'],
];

const SK: Row[] = [
  ['Pulso', 1, 2, [], 'skillPulse', { touches: [30, 60] }, 'Habilidade: um pulso que dá poeira de vários toques.', 'skills'],
  ['Supernova menor', 1, 2, [], 'skillNova', { touches: [60, 120] }, 'Habilidade: gasta a energia e dá poeira.', 'skills'],
  ['Dobra temporal', 1, 2, [], 'skillWarp', { sec: [15, 20] }, 'Habilidade: o relógio dos geradores anda 2x.', 'skills'],
  ['Toque firme', 1, 2, [], 'dustPerTouchPct', { pct: [0.4, 0.75] }, 'A poeira por toque sobe.'],
  ['Pulso duplo', 2, 2, [1], 'pulseCharges', { n: [2, 3] }, 'O Pulso guarda mais cargas.', 'skills'],
  ['Recarga do pulso', 2, 2, [1], 'pulseCooldown', { sec: [150, 110] }, 'O Pulso volta mais cedo.', 'skills'],
  ['Nova concentrada', 2, 2, [2], 'novaPower', { mult: [1.5, 2] }, 'A Supernova menor rende mais.', 'skills'],
  ['Dobra longa', 2, 2, [3], 'warpDuration', { sec: [25, 35] }, 'A Dobra temporal dura mais.', 'skills'],
  ['Dobra rápida', 2, 2, [3], 'warpCooldown', { sec: [240, 180] }, 'A Dobra temporal volta mais cedo.', 'skills'],
  ['Toque firme II', 2, 2, [4], 'dustPerTouchPct', { pct: [0.5, 1] }, 'Mais poeira por toque.'],
  ['Lente', 3, 2, [5], 'skillLens', { sec: [30, 45] }, 'Habilidade: mostra os raros no campo.', 'skills'],
  ['Ímã estelar', 3, 2, [7], 'skillMagnet', { range: [1, 2] }, 'Habilidade: puxa os objetos para perto.', 'skills'],
  ['Nova em cadeia', 3, 2, [9], 'novaChain', { n: [2, 3] }, 'A Supernova menor repete com a energia que sobra.', 'skills'],
  ['Pulso de combo', 3, 1, [6, 7], 'pulseCombo', { on: [1] }, 'O Pulso enche o combo.', 'skills'],
  ['Lente ampla', 3, 1, [8], 'lensWide', { on: [1] }, 'A Lente vê a tela toda.', 'skills'],
  ['Toque firme III', 3, 1, [10], 'dustPerTouchPct', { pct: [0.75] }, 'Ainda mais poeira por toque.'],
  ['Ímã forte', 4, 1, [11], 'magnetPull', { mult: [2] }, 'O Ímã puxa depressa.', 'skills'],
  ['Lente longa', 4, 1, [12], 'lensLong', { sec: [60] }, 'A Lente dura 60 s.', 'skills'],
  ['Nova dupla', 4, 1, [13], 'novaDouble', { on: [1] }, 'A Supernova menor dispara duas vezes.', 'skills'],
  ['Combo de habilidades', 4, 1, [14, 15], 'skillCombo', { mult: [1.5] }, 'Usar duas habilidades em seguida rende mais.', 'skills'],
  ['Recarga global', 4, 1, [16], 'skillCooldownAll', { pct: [15] }, 'Todas as habilidades voltam mais cedo.', 'skills'],
  ['Maestria', 5, 1, [17, 18], 'skillMastery', { on: [1] }, 'Cada uso seguido de uma habilidade encurta a recarga.', 'skills'],
  ['Tempo dilatado', 5, 1, [19, 20], 'skillTimeDilate', { sec: [10] }, 'Habilidades duram +10 s.', 'skills'],
  ['Supernova maior', 5, 1, [21, 19], 'skillNovaBig', { mult: [3] }, 'A Supernova menor vira maior.', 'skills'],
];

const LU: Row[] = [
  ['Rerolls', 1, 2, [], 'rerolls', { n: [1, 1] }, 'Troca de uma carta por vida.'],
  ['Cartas raras', 1, 2, [], 'rareWeight', { add: [0.25, 0.5] }, 'As cartas raras pesam mais no sorteio (em pontos).'],
  ['Segunda chance', 1, 2, [], 'secondChance', { n: [1, 2] }, 'Descarta uma oferta ruim por vida e sorteia outra.'],
  ['Sorte de objetos', 1, 2, [], 'goldCut', { sec: [0.1, 0.2] }, 'A Estrela Dourada demora menos para aparecer.'],
  ['Mais rerolls', 2, 2, [1], 'rerolls', { n: [1, 1] }, 'Mais uma troca por vida.'],
  ['Pity de lendário', 2, 2, [1], 'pity', { cut: [1, 2] }, 'Mostra quantas ofertas faltam para um lendário garantido.'],
  ['Garantia', 2, 2, [2], 'guarantee', { every: [60, 45] }, 'A cada N ofertas uma vem pelo menos épica.'],
  ['Cartas épicas', 2, 2, [2], 'epicWeight', { add: [0.1, 0.2] }, 'As cartas épicas pesam mais (em pontos).'],
  ['Descarte extra', 2, 2, [3], 'secondChance', { n: [1, 1] }, 'Mais um descarte de oferta por vida.'],
  ['Raros mais perto', 2, 2, [4], 'goldCut', { sec: [0.2, 0.4] }, 'A Estrela Dourada vem bem mais cedo.'],
  ['Pity forte', 3, 2, [6], 'pity', { cut: [2, 3] }, 'Faltam menos ofertas para o lendário garantido.'],
  ['Garantia dupla', 3, 2, [7], 'legendEvery', { every: [120, 90] }, 'A cada N ofertas uma vem lendária.'],
  ['Repetir em dobro', 3, 2, [9], 'repeatBonus', { every: [36, 30] }, 'A cada N escolhas, repetir um grimório sobe 1 nível extra.'],
  ['Quarta carta', 3, 1, [5, 6], 'fourthCard', { on: [1] }, 'Toda 6ª oferta de grimórios e todo 4º colapso tem uma 4ª carta.'],
  ['Lendário certo', 3, 1, [8], 'legendWeight', { add: [0.1] }, 'As cartas lendárias pesam mais (em pontos).'],
  ['Raro dourado', 3, 1, [10], 'goldenBoost', { mult: [1.02] }, 'A Estrela Dourada rende mais.'],
  ['Pity máximo', 4, 1, [11], 'pity', { cut: [4] }, 'O lendário garantido chega bem antes.'],
  ['Mão cheia', 4, 1, [12], 'rerolls', { n: [1] }, 'Mais uma troca por vida.'],
  ['Descarte de reserva', 4, 1, [13], 'secondChance', { n: [1] }, 'Mais um descarte de oferta por vida.'],
  ['Duas escolhas', 4, 1, [14, 15], 'doublePick', { every: [100] }, 'A cada 100 ofertas você escolhe 2 cartas.'],
  ['Raros constantes', 4, 1, [16], 'rareStreak', { on: [1] }, 'Cada raro seguido que você pega faz o próximo pesar mais.'],
  ['Destino', 5, 1, [17, 18], 'destiny', { on: [1] }, 'Uma vez por vida, a oferta traz pelo menos uma carta rara ou melhor.'],
  ['Cartas premium', 5, 1, [19, 20], 'premiumWeight', { add: [0.2] }, 'Cartas épicas e lendárias pesam muito mais.'],
  ['Fortuna', 5, 1, [21, 19], 'legendEvery', { every: [60] }, 'Toda 60ª oferta traz uma carta lendária.'],
];

const EX: Row[] = [
  ['Radar de lendários', 1, 2, [], 'radar', { captures: [80, 60] }, 'Um contador de capturas enche e um objeto lendário nasce garantido.'],
  ['Chuva de ouro', 1, 2, [], 'eventGoldRain', { chance: [4, 6], sec: [20, 30] }, 'Evento: todo ganho em dobro.'],
  ['Alinhamento', 1, 2, [], 'eventAlign', { chance: [4, 6], sec: [20, 30] }, 'Evento: o combo não cai.'],
  ['Olhos de energia', 1, 2, [], 'energyPerTouchPct', { pct: [0.5, 1] }, 'A energia por toque sobe.'],
  ['Maré de energia', 2, 2, [2], 'eventTide', { chance: [4, 6], sec: [20, 30] }, 'Evento: a barra enche em dobro.'],
  ['Eclipse', 2, 2, [3], 'eventEclipse', { chance: [4, 6], sec: [20, 30] }, 'Evento: cada oferta de grimório traz uma carta extra.'],
  ['Radar rápido', 2, 2, [1], 'radarFast', { captures: [3, 6] }, 'O radar enche com menos capturas.'],
  ['Mapa estelar', 2, 2, [1], 'starMap', { on: [1, 1] }, 'Revela a região do próximo colapso e o que ela traz.'],
  ['Eventos frequentes', 2, 2, [2], 'eventChance', { pct: [5, 10] }, 'Os eventos raros aparecem com menos espera.'],
  ['Olhos de energia II', 2, 2, [4], 'energyPerTouchPct', { pct: [0.75, 1.5] }, 'Mais energia por toque.'],
  ['Chuva longa', 3, 2, [5], 'goldRainLong', { sec: [10, 20] }, 'A Chuva de ouro dura mais.'],
  ['Alinhamento longo', 3, 2, [6], 'alignLong', { sec: [10, 20] }, 'O Alinhamento dura mais.'],
  ['Mais objetos', 3, 2, [7], 'objectSlots', { add: [1, 1] }, 'Cabem mais objetos na tela (teto 6).'],
  ['Mapa detalhado', 3, 1, [8, 9], 'starMapDetail', { on: [1] }, 'O mapa mostra os grimórios que a região traz.'],
  ['Maré longa', 3, 1, [5], 'tideLong', { sec: [15] }, 'A Maré de energia dura mais.'],
  ['Olhos de energia III', 3, 1, [10], 'energyPerTouchPct', { pct: [1.25] }, 'Ainda mais energia por toque.'],
  ['Radar certeiro', 4, 1, [13], 'radarKeep', { on: [1] }, 'Depois que o lendário nasce, o radar volta com um quarto cheio.'],
  ['Eclipse longo', 4, 1, [12], 'eclipseLong', { sec: [20] }, 'O Eclipse dura mais.'],
  ['Eventos prolongados', 4, 1, [11, 12], 'eventDuration', { sec: [5] }, 'Todos os eventos duram 5 s a mais.'],
  ['Mapa vivo', 4, 1, [14], 'starMapLive', { on: [1] }, 'O mapa mostra o marco da próxima vida.'],
  ['Lendas generosas', 4, 1, [15], 'legendReward', { mult: [1.5] }, 'Os objetos lendários rendem o dobro.'],
  ['Lendários em dobro', 5, 1, [17, 18], 'legendMax', { n: [2] }, 'Dois lendários podem estar no campo ao mesmo tempo.'],
  ['Grande evento', 5, 1, [19, 21], 'eventGrand', { mult: [2] }, 'O primeiro evento de cada vida dura o dobro.'],
  ['Horizonte', 5, 1, [20, 21], 'horizon', { on: [1] }, 'O mapa mostra duas regiões à frente.'],
];

const CO: Row[] = [
  ['Cartas de capa', 1, 2, [], 'cover', { level: [1, 2] }, 'Seu grimório favorito comum começa cada vida já no nível indicado.'],
  ['Sintonia', 1, 2, [], 'attune', { add: [0.05, 0.1] }, 'Cada nível de proibido no Cofre soma poeira ao toque.'],
  ['Eco do colapso', 1, 2, [], 'echo', { touches: [40, 60], mult: [1.15, 1.3] }, 'Os primeiros toques da vida nova rendem várias vezes mais.'],
  ['Brilho cósmico', 1, 2, [], 'dustPerTouchPct', { pct: [0.5, 1] }, 'A poeira por toque sobe.'],
  ['Reforço dos proibidos', 2, 2, [2], 'forbiddenPower', { pct: [0.125, 0.25], priceCutPct: [0.1, 0.2] }, 'Os proibidos rendem mais e cobram menos.'],
  ['Observatório', 2, 2, [1], 'observatory', { on: [1, 1] }, 'Resumo da vida e projeção do próximo colapso.', 'observatory'],
  ['Eco prolongado', 2, 2, [3], 'echo', { touches: [30, 50], mult: [1.05, 1.1] }, 'O Eco do colapso dura mais.'],
  ['Brilho cósmico II', 2, 2, [4], 'energyPerTouchPct', { pct: [0.75, 1.5] }, 'A energia por toque sobe.'],
  ['Constelação pessoal', 2, 2, [2, 3], 'constellation', { add: [0.25, 0.5] }, 'Com 5 nós em um ramo, soma poeira ao toque por ramo assim.'],
  ['Largada', 2, 2, [3], 'warmStart', { touches: [8, 15] }, 'Cada vida começa com energia de vários toques.'],
  ['Reforço II', 3, 2, [5], 'forbiddenPower', { pct: [0.125, 0.25], priceCutPct: [0.1, 0.2] }, 'Os proibidos rendem ainda mais.'],
  ['Constelação maior', 3, 2, [9], 'constellation', { add: [0.5, 1] }, 'A Constelação pessoal soma mais por ramo.'],
  ['Largada longa', 3, 2, [10], 'warmStart', { touches: [15, 30] }, 'Mais energia na largada.'],
  ['Projeção', 3, 1, [6, 7], 'projection', { on: [1] }, 'O Observatório projeta quanto falta para colapsar.', 'observatory'],
  ['Brilho cósmico III', 3, 1, [8], 'dustPerTouchPct', { pct: [0.75] }, 'Mais poeira por toque.'],
  ['Sintonia total', 3, 1, [9], 'attune', { add: [0.15] }, 'A Sintonia soma mais por nível de proibido.'],
  ['Capa mestra', 4, 1, [11], 'cover', { level: [2] }, 'A carta de capa começa dois níveis acima.'],
  ['Reforço III', 4, 1, [12], 'forbiddenPower', { pct: [0.375], priceCutPct: [0.25] }, 'Os proibidos rendem muito mais.'],
  ['Eco supremo', 4, 1, [13], 'echo', { touches: [80], mult: [1.25] }, 'O começo da vida rende bem mais.'],
  ['Mapa do cosmos', 4, 1, [14, 15], 'cosmosMap', { on: [1] }, 'Mostra a ligação entre todos os ramos.', 'observatory'],
  ['Brilho cósmico IV', 4, 1, [16], 'energyPerTouchPct', { pct: [1.5] }, 'Muita energia por toque.'],
  ['Coroa dos proibidos', 5, 1, [17, 18], 'forbiddenPower', { pct: [0.75], priceCutPct: [0.4] }, 'Os proibidos no auge: mais ganho e menos preço.'],
  ['Constelação eterna', 5, 1, [19, 20], 'constellation', { add: [1.5] }, 'A Constelação soma o máximo por ramo.', 'observatory'],
  ['Singularidade', 5, 1, [21, 19], 'dustPerTouchPct', { pct: [1.5] }, 'O maior brilho: muita poeira por toque.'],
];

/** Ligações cruzadas raras entre ramos: [nó, pai de outro ramo]. Sempre de um tier mais fundo para um mais raso. */
const CROSS: readonly (readonly [string, string])[] = [
  ['sk-20', 'au-14'],
  ['lu-22', 'ex-16'],
  ['ex-20', 'lu-14'],
  ['au-24', 'co-16'],
  ['ex-22', 'co-15'],
  ['lu-24', 'co-17'],
];

const TABLES: Record<TreeBranchId, Row[]> = { automation: AU, skills: SK, luck: LU, exploration: EX, cosmos: CO };

function build(): TreeNodeDef[] {
  const out: TreeNodeDef[] = [];
  for (const b of TREE_BRANCHES) {
    const rows = TABLES[b.id];
    const idOf = (i: number): string => `${b.prefix}-${String(i).padStart(2, '0')}`;
    rows.forEach((r, i) => {
      const [name, tier, levels, parents, kind, params, text, needs] = r;
      const id = idOf(i + 1);
      const cross = CROSS.filter(([n]) => n === id).map(([, p]) => p);
      out.push({
        id,
        branch: b.id,
        name,
        text,
        tier,
        maxLevel: levels,
        parents: [...parents.map(idOf), ...cross],
        effect: { kind, params },
        ...(needs ? { needs } : {}),
      });
    });
  }
  return out;
}

export const TREE_NODES: readonly TreeNodeDef[] = build();
const BY_ID = new Map(TREE_NODES.map((n) => [n.id, n]));

export function treeNodeById(id: string): TreeNodeDef | undefined {
  return BY_ID.get(id);
}

export const nodeLevelCost = (n: TreeNodeDef): number => TREE_TIER_COST[n.tier - 1] as number;
export const nodeTotalCost = (n: TreeNodeDef): number => nodeLevelCost(n) * n.maxLevel;
/** T da seção 5.4: o custo de comprar todos os níveis de todos os nós. */
export const TREE_TOTAL_COST = TREE_NODES.reduce((sum, n) => sum + nodeTotalCost(n), 0);

/** Nós de poder direto: mexem em poeira ou energia, como as melhorias (no máximo ~15% da árvore). */
export const POWER_KINDS: ReadonlySet<string> = new Set(['dustPerTouchPct', 'energyPerTouchPct', 'generatorPct', 'energyGenPct']);
export const isPowerNode = (n: TreeNodeDef): boolean => POWER_KINDS.has(n.effect.kind);

/** O nó pode ser comprado e vale hoje (a mecânica que ele pede já existe)? */
export function nodeLive(n: TreeNodeDef): boolean {
  if (n.needs !== undefined && !TREE_FEATURES[n.needs]) return false;
  // Um nó cujo pai está fechado também está: não há como chegar nele.
  return n.parents.every((p) => {
    const parent = BY_ID.get(p);
    return parent === undefined || nodeLive(parent);
  });
}

/** Valor do parâmetro `key` no nível `level` (um vetor curto vale para os níveis seguintes). */
export function nodeParam(n: TreeNodeDef, key: string, level: number): number {
  const arr = n.effect.params[key];
  if (!arr || arr.length === 0 || level < 1) return 0;
  return arr[Math.min(level, arr.length) - 1] as number;
}

/** Custo gasto num estado de compras (soma do custo de cada nível comprado). */
export function treeSpent(tree: Readonly<Record<string, number>>): number {
  let sum = 0;
  for (const [id, lvl] of Object.entries(tree)) {
    const n = BY_ID.get(id);
    if (n) sum += nodeLevelCost(n) * Math.min(lvl, n.maxLevel);
  }
  return sum;
}

export function parentsMet(tree: Readonly<Record<string, number>>, n: TreeNodeDef): boolean {
  return n.parents.every((p) => (tree[p] ?? 0) >= 1);
}

/** Erros de coerência de uma árvore comprada: nó que não existe, nível além do máximo, feature fechada, pai faltando. */
export function treeErrors(tree: Readonly<Record<string, number>>): string[] {
  const errors: string[] = [];
  for (const [id, lvl] of Object.entries(tree)) {
    const n = BY_ID.get(id);
    if (!n) {
      errors.push(`Nó desconhecido: ${id}`);
      continue;
    }
    if (lvl > n.maxLevel) errors.push(`Nó acima do nível máximo: ${id}`);
    else if (lvl >= 1) {
      if (!nodeLive(n)) errors.push(`Nó ainda fechado: ${id}`);
      if (!parentsMet(tree, n)) errors.push(`Nó sem os pré-requisitos: ${id}`);
    }
  }
  return errors;
}

// --- Efeitos que o motor lê ---

/** Os efeitos "de fonte" da árvore (os que usam as primitivas de `catalog.ts`): poder direto e força dos proibidos. */
export function treeSourceEffects(tree: Readonly<Record<string, number>>): Effect[] {
  const out: Effect[] = [];
  for (const [id, lvl] of Object.entries(tree)) {
    const n = BY_ID.get(id);
    if (!n || lvl < 1 || !nodeLive(n)) continue;
    const k = n.effect.kind;
    if (POWER_KINDS.has(k)) out.push({ kind: k, pct: nodeParam(n, 'pct', lvl) } as Effect);
    else if (k === 'forbiddenPower') out.push({ kind: 'forbiddenPower', pct: nodeParam(n, 'pct', lvl), priceCutPct: nodeParam(n, 'priceCutPct', lvl) });
  }
  return out;
}

export interface TreeStats {
  /** Poeira fixa por nível de proibido no Cofre. */
  attunePerForbiddenLevel: number;
  /** Poeira fixa por ramo com 5 nós ou mais. */
  constellationPerBranch: number;
  /** Os primeiros `touches` toques da vida rendem x`mult`. */
  echoTouches: number;
  echoMult: number;
  /** Nível em que o grimório favorito comum começa cada vida. */
  coverLevel: number;
  /** Energia (em toques) com que a vida começa. */
  warmStartTouches: number;
}

export const EMPTY_TREE_STATS: TreeStats = {
  attunePerForbiddenLevel: 0,
  constellationPerBranch: 0,
  echoTouches: 0,
  echoMult: 1,
  coverLevel: 0,
  warmStartTouches: 0,
};

/** Quantos ramos têm pelo menos `min` nós comprados. */
export function branchesWith(tree: Readonly<Record<string, number>>, min: number): number {
  const count: Partial<Record<TreeBranchId, number>> = {};
  for (const [id, lvl] of Object.entries(tree)) {
    const n = BY_ID.get(id);
    if (n && lvl >= 1) count[n.branch] = (count[n.branch] ?? 0) + 1;
  }
  return Object.values(count).filter((c) => c >= min).length;
}

export const CONSTELLATION_MIN_NODES = 5;

export function treeStats(tree: Readonly<Record<string, number>>): TreeStats {
  const s: TreeStats = { ...EMPTY_TREE_STATS };
  for (const [id, lvl] of Object.entries(tree)) {
    const n = BY_ID.get(id);
    if (!n || lvl < 1 || !nodeLive(n)) continue;
    switch (n.effect.kind) {
      case 'attune':
        s.attunePerForbiddenLevel += nodeParam(n, 'add', lvl);
        break;
      case 'constellation':
        s.constellationPerBranch += nodeParam(n, 'add', lvl);
        break;
      case 'echo':
        s.echoTouches += nodeParam(n, 'touches', lvl);
        s.echoMult *= nodeParam(n, 'mult', lvl);
        break;
      case 'cover':
        s.coverLevel += nodeParam(n, 'level', lvl);
        break;
      case 'warmStart':
        s.warmStartTouches += nodeParam(n, 'touches', lvl);
        break;
      default:
    }
  }
  return s;
}

/** Os domínios de efeito de melhoria (para o teste de não-duplicação dos nós de mecânica). */
export const UPGRADE_DOMAINS: ReadonlySet<string> = new Set(UPGRADES.flatMap((u) => u.domains));
