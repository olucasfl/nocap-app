/**
 * O Eco conta passos, não pontos de 0 a 10; para reaproveitar as faixas do app (CRAVOU, QUASE...),
 * os passos viram uma nota. CRAVOU é só o teto de 40 passos ("Eco perfeito"). Pontos de partida:
 * calibrar jogando (spec 012, decisões em aberto).
 */
const BANDS: [steps: number, score: number][] = [
  [40, 10],
  [30, 9],
  [20, 8],
  [14, 7],
  [10, 6],
  [7, 5],
  [4, 3],
  [2, 1],
];

export function ecoGradeScore(steps: number): number {
  return BANDS.find(([min]) => steps >= min)?.[1] ?? 0;
}
