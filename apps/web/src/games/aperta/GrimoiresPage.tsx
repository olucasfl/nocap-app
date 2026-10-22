import type { SaveState } from '@nocap/games';
import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import { favoriteOpen } from './content-logic';
import { GrimoireBook } from './GrimoireBook';
import { albumView, astroFor } from './game-logic';
import { CategoryTag } from './CategoryTag';
import { RARITY_LABEL } from './rarity';

/** Página de Grimórios (spec 038, 3.5): álbum com os escondidos trancados. */
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
        <b>{album.discovered}</b> de {album.total} descobertos
      </p>
      {canFavorite && (
        <p className="ap-sub">Favoritar um grimório descoberto faz ele aparecer o dobro nas escolhas.</p>
      )}
      <ul className="ap-album" aria-label="Álbum de grimórios">
        {album.entries.map((e) => (
          <li
            key={e.id}
            className={`ap-album-item${e.discovered ? '' : ' is-locked'}${e.rarity === 'proibido' ? ' is-forbidden' : ''}`}
          >
            <GrimoireBook
              rarity={e.rarity}
              astro={astroFor(e.id, e.family)}
              name={e.name}
              locked={!e.discovered}
              size="sm"
              still
            />
            <span className="ap-album-name">{e.name}</span>
            {e.discovered && <span className="ap-pick-rar">{RARITY_LABEL[e.rarity]}</span>}
            {e.discovered && <CategoryTag category={e.category} />}
            <span className="ap-album-fx">{e.text}</span>
            {e.level > 0 && <span className="ap-album-lv">Nível {e.level}</span>}
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
