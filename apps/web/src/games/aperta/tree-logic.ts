import { TREE, TREE_COSTS, sparkSources, sparksAvailable, sparksTotal, treeNodeCost, treeNodeId, type SaveState } from '@nocap/games';
import type { AstroId } from './astros';

/** Planeta-ícone de cada ramo (spec 038, 3.5). */
const BRANCH_ASTRO: Record<string, AstroId> = {
  'alpha-centauri': 'star',
  'crab-nebula': 'nebula',
  'kuiper-belt': 'ice',
  'saturn-rings': 'saturn',
  pleiades: 'starb',
  'event-horizon': 'hole',
};

/** O que cada nível entrega, em palavras (o número vem do catálogo do motor; aqui só a frase). */
const NODE_TEXT: Record<string, [string, string, string]> = {
  'alpha-centauri': ['Poeira por toque +10%', 'Poeira por toque +20%', 'Poeira por toque +35%'],
  'crab-nebula': ['Energia por toque +10%', 'Energia por toque +20%', 'Energia por toque +35%'],
  'kuiper-belt': ['+1 objeto máximo na tela', '+2 objetos máximos na tela', '+3 objetos máximos na tela'],
  'saturn-rings': ['Janela do combo +15%', 'Janela do combo +30%', 'Janela do combo +50%'],
  pleiades: ['Cada vida começa com 1 nível do Pulso Solar', 'Cada vida começa com 2 níveis do Pulso Solar', 'Cada vida começa com 4 níveis do Pulso Solar'],
  'event-horizon': [
    'Proibidos com 18 escolhas e 20% mais baratos',
    'Proibidos com 14 escolhas e 40% mais baratos',
    'Proibidos com 10 escolhas e 60% mais baratos',
  ],
};

/**
 * owned: já comprado. buyable: o próximo e dá para pagar. short: o próximo, falta Cintila.
 * blocked: precisa do nível de baixo. closed: a árvore ainda não abriu (antes do 1º colapso).
 */
export type TreeNodeStatus = 'owned' | 'buyable' | 'short' | 'blocked' | 'closed';

export interface TreeNodeRow {
  id: string;
  level: number;
  cost: number;
  text: string;
  status: TreeNodeStatus;
  /** Cintilas que faltam (só no `short`). */
  missing: number;
}

export interface TreeBranchRow {
  id: string;
  name: string;
  astro: AstroId;
  level: number;
  nodes: TreeNodeRow[];
}

export interface TreeView {
  open: boolean;
  available: number;
  spent: number;
  branches: TreeBranchRow[];
  /** Total já ganho e de onde veio (a página mostra para a pessoa saber como ganhar mais). */
  earned: number;
  sources: { id: string; label: string; value: number }[];
  respec: {
    can: boolean;
    /** Cintilas que voltam ao refazer: todas as gastas (spec 040, 5.3). */
    refund: number;
  };
}

export function treeView(state: SaveState): TreeView {
  const open = state.collapses >= 1;
  const available = sparksAvailable(state);
  const branches = TREE.map((b): TreeBranchRow => {
    const owned = Math.min(TREE_COSTS.length, state.tree[b.id] ?? 0);
    const nodes = TREE_COSTS.map((_, i): TreeNodeRow => {
      const level = i + 1;
      const cost = treeNodeCost(level);
      let status: TreeNodeStatus;
      if (!open) status = 'closed';
      else if (level <= owned) status = 'owned';
      else if (level > owned + 1) status = 'blocked';
      else status = available >= cost ? 'buyable' : 'short';
      return {
        id: treeNodeId(b.id, level),
        level,
        cost,
        text: NODE_TEXT[b.id]?.[i] ?? b.text,
        status,
        missing: status === 'short' ? cost - available : 0,
      };
    });
    return { id: b.id, name: b.name, astro: BRANCH_ASTRO[b.id] ?? 'star', level: owned, nodes };
  });
  const can = state.sparks.spent > 0 && Object.values(state.tree).some((l) => l > 0);
  const src = sparkSources(state);
  const sources = [
    { id: 'achievements', label: 'Conquistas', value: src.achievements },
    { id: 'album', label: 'Grimórios novos no álbum', value: src.album },
    { id: 'rare', label: 'Objetos raros', value: src.rareFirst + src.rareSteps },
    { id: 'stars', label: 'Estrela dos Proibidos', value: src.stars },
    { id: 'collapses', label: 'Colapsos e poeira total', value: src.collapseMarks + src.dustMarks },
    { id: 'events', label: 'Eventos raros', value: src.eventFirst },
    ...(state.sparks.legacy > 0 ? [{ id: 'legacy', label: 'Fragmentos de antes', value: state.sparks.legacy }] : []),
  ];
  return {
    open,
    available,
    spent: state.sparks.spent,
    earned: sparksTotal(state),
    sources,
    branches,
    respec: { can, refund: can ? state.sparks.spent : 0 },
  };
}
