import { ConnectLanding } from './ConnectLanding';

export { CONNECT_RULES } from './ConnectLanding';

/** A página do Connect Word's é a tela própria do jogo (spec 065). */
export function ConnectCatalog() {
  return <ConnectLanding />;
}

/** O mesmo, já aberto no catálogo de fases (volta de uma fase). */
export function ConnectLevels() {
  return <ConnectLanding start="levels" />;
}
