import type { GameId } from '@/lib/stats';

/** Os jogos que usam as telas padrão (modos, abas, ficha): os três do ranking e o Sinal Vermelho. */
export type UiGame = GameId | 'sinal';
