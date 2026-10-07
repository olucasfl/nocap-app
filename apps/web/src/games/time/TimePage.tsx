import { getRouteApi } from '@tanstack/react-router';
import { TimeGame } from './TimeGame';

const route = getRouteApi('/tempo');

/** Ponte entre a rota (/tempo?modo=daily) e o jogo. Carregado sob demanda (lazy). */
export function TimePage() {
  const { modo, aba, quadro } = route.useSearch();
  return <TimeGame initialMode={modo} initialTab={aba} initialBoard={quadro} />;
}
