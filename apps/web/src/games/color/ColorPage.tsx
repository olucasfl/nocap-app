import { getRouteApi } from '@tanstack/react-router';
import { ColorGame } from './ColorGame';

const route = getRouteApi('/cor');

/** Ponte entre a rota (/cor?modo=daily) e o jogo. Carregado sob demanda (lazy). */
export function ColorPage() {
  const { modo, aba, jogar } = route.useSearch();
  return <ColorGame initialMode={modo} initialTab={aba} autoStart={jogar} />;
}
