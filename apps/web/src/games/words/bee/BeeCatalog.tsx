import { BeeLanding } from './BeeLanding';

export { BEE_RULES } from './BeeLanding';

/** A página do Bee Word's é a tela própria do jogo (spec 065). */
export function BeeCatalog() {
  return <BeeLanding />;
}

/** O mesmo, já aberto no catálogo de fases (volta de uma fase). */
export function BeeLevels() {
  return <BeeLanding start="levels" />;
}
