import { ClassicLanding } from './ClassicLanding';

/** A página do Classic Word's é a tela própria do jogo (spec 065). */
export function ClassicPage() {
  return <ClassicLanding />;
}

/** O mesmo, já aberto no Daily (volta da partida do dia). */
export function ClassicDaily() {
  return <ClassicLanding start="daily" />;
}
