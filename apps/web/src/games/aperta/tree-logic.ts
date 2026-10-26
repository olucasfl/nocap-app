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
  branch: string;
  branchName: string;
  /** Todos os pais, com o estado de cada um (a tela mostra o que falta). */
  parents: { id: string; name: string; owned: boolean }[];
  /** `soon`: o que traz o nó ("Chega com as habilidades ativas"). */
  soonHint: string | null;
  /** Comprou ao menos 1 nível. */
  owned: boolean;
  /** Efeito do nível atual e do próximo, em palavras (o painel mostra "o que muda"). */
  nowText: string | null;
  nextText: string | null;
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

/** Frase curta com os números de um nível do nó. */
const PARAM_LABEL: Record<string, string> = {
  pct: 'bônus',
  priceCutPct: 'corte do preço',
  sec: 'segundos',
  n: 'quantidade',
  every: 'a cada',
  chance: 'chance',
  add: 'soma',
  touches: 'toques',
  mult: 'multiplicador',
  levels: 'níveis',
  captures: 'capturas',
  level: 'nível',
  cps: 'toques por segundo',
  range: 'alcance',
  limit: 'limite',
  cut: 'ofertas a menos',
};

export function describeLevel(
  node: { effect: { params: Record<string, number[]> } },
  level: number,
): string {
  const parts = Object.entries(node.effect.params)
    .filter(([key]) => key !== 'on')
    .map(([key, arr]) => {
      const v = arr[Math.min(level, arr.length) - 1] ?? 0;
      return `${PARAM_LABEL[key] ?? key} ${String(v).replace('.', ',')}${key.endsWith('Pct') || key === 'pct' || key === 'chance' ? '%' : ''}`;
    });
  return parts.length > 0 ? parts.join(', ') : 'ativa o efeito';
}

const FEATURE_HINT: Record<string, string> = {
  automation: 'Chega com as automações',
  skills: 'Chega com as habilidades ativas',
  luck: 'Chega com a Sorte',
  exploration: 'Chega com a Exploração',
  observatory: 'Chega com o Observatório',
};

/** O que falta existir para o nó abrir: a mecânica dele ou a do primeiro antepassado fechado. */
function soonHint(id: string, seen = new Set<string>()): string {
  const n = treeNodeById(id);
  if (!n || seen.has(id)) return 'Chega em uma atualização';
  seen.add(id);
  if (n.needs && !nodeLive({ ...n, parents: [] }))
    return FEATURE_HINT[n.needs] ?? 'Chega em uma atualização';
  for (const p of n.parents) {
    const parent = treeNodeById(p);
    if (parent && !nodeLive(parent)) return soonHint(p, seen);
  }
  return 'Chega em uma atualização';
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
      const missingParents = n.parents
        .filter((p) => (state.tree[p] ?? 0) < 1)
        .map((p) => treeNodeById(p)?.name ?? p);
      let status: TreeNodeStatus;
      if (level >= n.maxLevel) status = 'owned';
      else if (!open) status = 'closed';
      else if (!nodeLive(n)) status = 'soon';
      else if (next === null) status = 'blocked';
      else status = available >= next ? 'buyable' : 'short';
      const maxed = level >= n.maxLevel;
      return {
        branch: b.id,
        branchName: b.name,
        parents: n.parents.map((p) => ({
          id: p,
          name: treeNodeById(p)?.name ?? p,
          owned: (state.tree[p] ?? 0) >= 1,
        })),
        soonHint: status === 'soon' ? soonHint(n.id) : null,
        owned: level >= 1,
        nowText: level >= 1 ? describeLevel(n, level) : null,
        nextText: maxed ? null : describeLevel(n, level + 1),
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
    return {
      id: b.id,
      name: b.name,
      astro: BRANCH_ASTRO[b.id] ?? 'star',
      owned: nodes.filter((n) => n.level >= 1).length,
      total: nodes.length,
      nodes,
    };
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
    ...(state.sparks.legacy > 0
      ? [{ id: 'legacy', label: 'Fragmentos de antes', value: state.sparks.legacy }]
      : []),
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
