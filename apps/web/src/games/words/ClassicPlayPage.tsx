import { useSearch } from '@tanstack/react-router';
import { ClassicPlay } from './ClassicPlay';

type Search = { tipo?: 'daily' | 'solo'; modo?: 'classic' | 'dueto' | 'quarteto' };

/** A rota /words/classic/jogar: `?tipo=daily|solo&modo=classic|dueto|quarteto`. */
export function ClassicPlayPage() {
  const { tipo, modo } = useSearch({ strict: false }) as Search;
  const daily = tipo === 'daily';
  return (
    <ClassicPlay key={`${tipo}-${modo}`} kind={daily ? 'daily' : 'solo'} mode={daily ? 'classic' : (modo ?? 'classic')} />
  );
}
