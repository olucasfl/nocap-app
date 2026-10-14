import { AtravessaGame } from './AtravessaGame';

/** A rota /atravessa. Carregada sob demanda (lazy), como os outros jogos; o Three.js só baixa aqui. */
export function AtravessaPage() {
  return <AtravessaGame />;
}
