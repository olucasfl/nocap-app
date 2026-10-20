import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { ClassicPlay } from './ClassicPlay';
import { dailyEngine } from './classic-engine';

/** A rota /words/classic/jogar: o Daily (as outras partidas são as fases do catálogo). */
export function ClassicPlayPage() {
  const engine = useMemo(() => dailyEngine('classic'), []);
  return (
    <ClassicPlay
      mode="classic"
      engine={engine}
      loading="Abrindo o Daily..."
      endActions={() => (
        <>
          <Link to="/ranking" search={{ jogo: 'wclassic', modo: 'daily' }} className="btn alt">
            Ver ranking
          </Link>
          <Link to="/words/classic" className="btn ghost">
            Voltar aos modos
          </Link>
        </>
      )}
    />
  );
}
