import type { SaveState } from '@nocap/games';
import { AstroMedal } from './AstroMedal';
import { atlasView, collapseView } from './game-logic';
import './collapse.css';

interface Props {
  state: SaveState;
  /** Abre o modal de colapso (só com a estrela pronta). */
  onCollapse: () => void;
}

/** Atlas Eterno (spec 038, 8.1 e 8.2): espaços, família de cada página, bônus de conjunto e o botão de colapsar. */
export function AtlasSection({ state, onCollapse }: Props) {
  const atlas = atlasView(state);
  const collapse = collapseView(state);
  return (
    <section className="ap-atlas" aria-labelledby="ap-atlas-title">
      <h3 id="ap-atlas-title">Atlas Eterno</h3>
      <p className="ap-sub">
        {atlas.pages.length} de {atlas.slots} espaços de página em uso. Cada página guarda um grimório a 60% do poder em todas as vidas.
        {atlas.nextSlotAt !== null ? ` Um espaço novo chega no colapso ${atlas.nextSlotAt}.` : ''}
      </p>
      <ul className="ap-atlas-pages">
        {Array.from({ length: atlas.slots }, (_, i) => {
          const page = atlas.pages[i];
          return (
            <li key={i} className={page ? 'is-full' : 'is-empty'}>
              {page ? (
                <>
                  <span className="ap-atlas-medal">
                    <AstroMedal astro={page.astro} />
                  </span>
                  <b>{page.name}</b>
                  <small>
                    {page.familyName} · nível {page.level}
                  </small>
                </>
              ) : (
                <small>Espaço livre</small>
              )}
            </li>
          );
        })}
      </ul>

      <h4 className="ap-atlas-sub">Bônus de conjunto</h4>
      <ul className="ap-sets" aria-label="Bônus de conjunto por família">
        {atlas.bonuses.map((b) => (
          <li key={b.family} className={b.tier >= 0 ? 'is-on' : b.count > 0 ? 'is-part' : 'is-off'}>
            <b>{b.familyName}</b>
            <small>
              {b.active ?? (b.next ? `Com 2 páginas: ${b.next}` : '')}
              {b.active && b.missing !== null ? ` · falta ${b.missing} para o próximo` : ''}
            </small>
          </li>
        ))}
      </ul>

      <div className="ap-collapse-box">
        <h4 className="ap-atlas-sub">Colapsar a estrela</h4>
        <div
          className="ap-cbar"
          role="progressbar"
          aria-label="Poeira da vida para colapsar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(collapse.dustFill * 100)}
        >
          <i style={{ transform: `scaleX(${collapse.dustFill})` }} />
        </div>
        {collapse.ready ? (
          <p className="ap-sub">A estrela está pronta. Ao colapsar você ganha {collapse.fragments} Fragmentos e começa uma vida nova.</p>
        ) : (
          <p className="ap-sub">{collapse.hint}</p>
        )}
        <button type="button" className="ap-hbtn ap-hbtn-go" disabled={!collapse.ready} onClick={onCollapse}>
          {collapse.ready ? 'Colapsar a estrela' : 'Estrela ainda não está pronta'}
        </button>
      </div>
    </section>
  );
}
