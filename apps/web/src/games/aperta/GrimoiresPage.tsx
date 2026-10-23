import type { SaveState } from '@nocap/games';
import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import { favoriteOpen } from './content-logic';
import { GrimoireBook } from './GrimoireBook';
import { albumView, astroFor } from './game-logic';
import { CategoryTag } from './CategoryTag';

/**
 * Livro de Grimórios (spec 042): um grimório por astro, cada um com 4 espaços (Comum, Raro, Épico, Lendário) que ficam
 * "???" até a versão ser pega pela primeira vez. A descoberta vale para sempre; nível e raridade em uso zeram por vida.
 */
export function GrimoiresPage({
  state,
  onFavorite,
}: {
  state: SaveState;
  /** Marca ou desmarca o favorito; sem isto (ou antes do colapso 2) o botão não aparece. */
  onFavorite?: (id: string | null) => void;
}) {
  const album = albumView(state);
  const canFavorite = onFavorite !== undefined && favoriteOpen(state);
  return (
    <div className="ap-album-wrap">
      <p className="ap-album-count">
        <b>{album.discovered}</b> de {album.total} versões descobertas
      </p>
      {canFavorite && <p className="ap-sub">Favoritar um grimório faz ele aparecer o dobro nas escolhas.</p>}
      <ul className="ap-album" aria-label="Livro de grimórios">
        {album.entries.map((e) => (
          <li key={e.id} className={`ap-album-item${e.discovered ? '' : ' is-locked'}`}>
            <GrimoireBook rarity={e.rarity} astro={astroFor(e.id, e.family)} name={e.name} locked={!e.discovered} size="sm" still />
            <span className="ap-album-name">{e.name}</span>
            {e.discovered && <CategoryTag category={e.category} compact />}
            <span className="ap-album-fx">{e.text}</span>
            <ul className="ap-slots" aria-label={`Versões de ${e.name}: ${e.found} de ${e.slots.length}`}>
              {e.slots.map((slot) => (
                <li key={slot.rarity} className={`ap-slot${slot.found ? ' is-found' : ''}`} data-rar={slot.rarity}>
                  {slot.found ? slot.label : '???'}
                </li>
              ))}
            </ul>
            {e.level > 0 && <span className="ap-album-lv">Nível {e.level} nesta vida</span>}
            {canFavorite && e.discovered && (
              <button
                type="button"
                className="ap-fav"
                aria-pressed={e.favorite}
                aria-label={e.favorite ? `Tirar ${e.name} dos favoritos` : `Marcar ${e.name} como favorito`}
                onClick={() => {
                  if (e.favorite) apertaSfx.clack(0);
                  else {
                    apertaSfx.star();
                    apertaVibrate(12);
                  }
                  onFavorite(e.favorite ? null : e.id);
                }}
              >
                {e.favorite ? 'Favorito' : 'Favoritar'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
