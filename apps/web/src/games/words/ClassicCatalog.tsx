import { useParams } from '@tanstack/react-router';
import { ClassicLanding } from './ClassicLanding';

/** O catálogo de um modo do Classic (1, 2 ou 4 palavras): abre a tela do jogo já nesse modo; mantém os links antigos. */
export function ClassicCatalog() {
  const { modo } = useParams({ strict: false }) as { modo?: string };
  return <ClassicLanding key={modo} start={modo} />;
}
