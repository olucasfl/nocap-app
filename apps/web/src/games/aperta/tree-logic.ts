import {
  TREE_BRANCHES,
  TREE_NODES,
  canRespec,
  nodeLive,
  nodeNextCost,
  nodeLevelCost,
  sparkSources,
  sparksAvailable,
  sparksTotal,
  treeNodeById,
  type SaveState,
} from '@nocap/games';
import type { AstroId } from './astros';

/** Planeta-ícone de cada ramo (spec 038, 3.5). */
const BRANCH_ASTRO: Record<string, AstroId> = {
  automation: 'saturn',
  skills: 'star',
  luck: 'nebula',
  exploration: 'ice',
  cosmos: 'hole',
};

/**
 * owned: já comprado. buyable: o próximo e dá para pagar. short: o próximo, falta Cintila.
 * blocked: precisa do nível de baixo. closed: a árvore ainda não abriu (antes do 1º colapso).
 */
export type TreeNodeStatus = 'owned' | 'buyable' | 'short' | 'blocked' | 'closed' | 'soon';

export interface TreeNodeRow {
  id: string;
  name: string;
  tier: number;
  level: number;
  maxLevel: number;
  cost: number;
  text: string;
  status: TreeNodeStatus;
  /** Cintilas que faltam (só no `short`). */
  missing: number;
  /** Pré-requisitos que ainda faltam (nomes), no `blocked`. */
  needs: string[];
}

export interface TreeBranchRow {
  id: string;
  name: string;
  astro: AstroId;
  /** Nós já comprados (nível >= 1) e o total do ramo. */
  owned: number;
  total: number;
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
    /** Gasto na árvore (para explicar por que não dá para refazer agora). */
    spent: number;
    /** Cintilas que voltam ao refazer: todas as gastas (spec 040, 5.3). */
    refund: number;
  };
}

export function treeView(state: SaveState): TreeView {
  const open = state.collapses >= 1;
  const available = sparksAvailable(state);
  const branches = TREE_BRANCHES.map((b): TreeBranchRow => {
    const defs = TREE_NODES.filter((n) => n.branch === b.id);
    const nodes = defs.map((n): TreeNodeRow => {
      const level = state.tree[n.id] ?? 0;
      const cost = nodeLevelCost(n);
      const next = nodeNextCost(state, n.id);
      const missingParents = n.parents.filter((p) => (state.tree[p] ?? 0) < 1).map((p) => treeNodeById(p)?.name ?? p);
      let status: TreeNodeStatus;
      if (level >= n.maxLevel) status = 'owned';
      else if (!open) status = 'closed';
      else if (!nodeLive(n)) status = 'soon';
      else if (next === null) status = 'blocked';
      else status = available >= next ? 'buyable' : 'short';
      return {
        id: n.id,
        name: n.name,
        tier: n.tier,
        level,
        maxLevel: n.maxLevel,
        cost,
        text: n.text,
        status,
        missing: status === 'short' ? cost - available : 0,
        needs: status === 'blocked' ? missingParents : [],
      };
    });
    return { id: b.id, name: b.name, astro: BRANCH_ASTRO[b.id] ?? 'star', owned: nodes.filter((n) => n.level >= 1).length, total: nodes.length, nodes };
  });
  const can = canRespec(state);
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
    respec: { can, refund: can ? state.sparks.spent : 0, spent: state.sparks.spent },
  };
}
