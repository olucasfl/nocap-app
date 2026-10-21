import { FAMILY_NAMES, GRIMOIRES, type SaveState } from '@nocap/games';
import { GrimoireBook } from './GrimoireBook';
import { albumView, astroFor } from './game-logic';
import { RARITY_LABEL } from './rarity';

/** Página de Grimórios (spec 038, 3.5): álbum com os escondidos trancados e o Atlas Eterno. */
export function GrimoiresPage({ state }: { state: SaveState }) {
  const album = albumView(state);
  const familyOf = (id: string) => GRIMOIRES.find((g) => g.id === id);
  return (
    <div className="ap-album-wrap">
      <p className="ap-album-count">
        <b>{album.discovered}</b> de {album.total} descobertos
      </p>
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
            <span className="ap-album-fx">{e.text}</span>
            {e.level > 0 && <span className="ap-album-lv">Nível {e.level}</span>}
          </li>
        ))}
      </ul>

      <section className="ap-atlas" aria-labelledby="ap-atlas-title">
        <h3 id="ap-atlas-title">Atlas Eterno</h3>
        <p className="ap-sub">
          {state.atlas.pages.length} de {state.atlas.slots} espaços de página em uso. As páginas ficam entre os colapsos.
        </p>
        <ul className="ap-atlas-pages">
          {Array.from({ length: state.atlas.slots }, (_, i) => {
            const page = state.atlas.pages[i];
            const def = page ? familyOf(page.grimoireId) : undefined;
            return (
              <li key={i} className={page ? 'is-full' : 'is-empty'}>
                {page && def ? (
                  <>
                    <b>{def.name}</b>
                    <small>
                      {FAMILY_NAMES[def.family]} · nível {page.level}
                    </small>
                  </>
                ) : (
                  <small>Espaço livre</small>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
