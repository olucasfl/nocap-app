/**
 * Aparelho fraco (4 núcleos ou menos): o Aperta! troca desfoque e sombras projetadas por degradês
 * e reduz as faíscas (spec 038, seção 11). Lido uma vez; o aparelho não muda durante a partida.
 */
export const LOW_END = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 4;
