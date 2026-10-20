import { getRouteApi } from '@tanstack/react-router';
import { EcoGame } from './EcoGame';

const route = getRouteApi('/eco');

/** Ponte entre a rota (/eco?modo=daily) e o jogo. Carregado sob demanda (lazy). */
export function EcoPage() {
  const { modo, aba } = route.useSearch();
  return <EcoGame initialMode={modo} initialTab={aba} />;
}
