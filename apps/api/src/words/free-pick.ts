/** Quantos dias à frente do Daily ficam fora do jogo livre (para ninguém "queimar" o puzzle do dia seguinte). */
export const FREE_HORIZON_DAYS = 30;

/**
 * Os puzzles que o jogo livre pode oferecer: os que a conta ainda não jogou, dos dias que já passaram
 * ou que estão longe no calendário. Quando a lista dá a volta, todos os puzzles já são "passados".
 */
export function freePool<T extends { id: string }>(puzzles: readonly T[], todayIndex: number, played: ReadonlySet<string>): T[] {
  return puzzles.filter((p, i) => !played.has(p.id) && (i < todayIndex || i >= todayIndex + FREE_HORIZON_DAYS));
}
