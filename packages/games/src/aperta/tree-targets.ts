// Alvo da árvore nova (spec 040, seção 6): ~120 nós em 5 ramos de 24, cada nó com 1 a 5 níveis e custo por tier
// (1, 2, 3, 5 e 8 Cintilas por nível, seção 5.2). A árvore real chega na etapa 17; até lá este arquivo só guarda o
// FORMATO de custos que o teste de balanço (`balance.ts`, seção 5.4) precisa para calcular T. Quando `tree.ts` existir,
// o teste passa a ler a árvore real e este alvo vira só uma referência.

/** Custo em Cintilas de um nível de nó, por tier (profundidade do nó na árvore). */
export const TIER_COST: readonly number[] = [1, 2, 3, 5, 8];

export interface TargetNode {
  tier: 1 | 2 | 3 | 4 | 5;
  levels: number;
}

export interface TargetBranch {
  id: string;
  name: string;
  nodes: readonly TargetNode[];
}

const nodes = (tier: TargetNode['tier'], levels: number[]): TargetNode[] => levels.map((l) => ({ tier, levels: l }));

/**
 * Um ramo: 24 nós. Tier 1 (4 nós de 2 níveis), tier 2 (6 de 2), tier 3 (6: três de 2 e três de 1), tier 4 (5 de 1) e
 * tier 5 (3 de 1): 108 Cintilas por ramo. O poder direto (+% de poeira ou energia) fica abaixo de ~15% dos nós.
 */
const branch = (id: string, name: string): TargetBranch => ({
  id,
  name,
  nodes: [
    ...nodes(1, [2, 2, 2, 2]),
    ...nodes(2, [2, 2, 2, 2, 2, 2]),
    ...nodes(3, [2, 2, 2, 1, 1, 1]),
    ...nodes(4, [1, 1, 1, 1, 1]),
    ...nodes(5, [1, 1, 1]),
  ],
});

export const TARGET_BRANCHES: readonly TargetBranch[] = [
  branch('automation', 'Automação'),
  branch('abilities', 'Habilidades ativas'),
  branch('luck', 'Sorte'),
  branch('exploration', 'Exploração'),
  branch('cosmos', 'Cosmos'),
];

export function targetNodeCount(): number {
  return TARGET_BRANCHES.reduce((n, b) => n + b.nodes.length, 0);
}

/** T: custo total de comprar todos os níveis de todos os nós do alvo. */
export function targetTreeCost(): number {
  return TARGET_BRANCHES.reduce((sum, b) => sum + b.nodes.reduce((s, n) => s + n.levels * (TIER_COST[n.tier - 1] as number), 0), 0);
}
