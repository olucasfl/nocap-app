import type { SaveState } from '@nocap/games';
import { AtlasSection } from './AtlasSection';
import { GrimoireBook } from './GrimoireBook';
import { albumView, astroFor } from './game-logic';
import { RARITY_LABEL } from './rarity';

/** Página de Grimórios (spec 038, 3.5): álbum com os escondidos trancados e o Atlas Eterno. */
export function GrimoiresPage({ state, onCollapse = () => {} }: { state: SaveState; onCollapse?: () => void }) {
  const album = albumView(state);
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

      <AtlasSection state={state} onCollapse={onCollapse} />
    </div>
  );
}
