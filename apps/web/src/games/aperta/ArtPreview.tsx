import { useEffect, useState } from 'react';
import { ASTROS, ASTRO_LABEL } from './astros';
import { AstroMedal } from './AstroMedal';
import { BigButton } from './BigButton';
import { loadSpaceFonts } from './fonts';
import { GrimoireBook, type BookSize } from './GrimoireBook';
import { RARITIES, RARITY_LABEL, type Rarity } from './rarity';
import { REGION_IDS, REGIONS, RegionBackdrop, type RegionId } from './RegionBackdrop';
import { SpaceArtSprite } from './SpaceArtSprite';
import { SPACE_OBJECT_COLOR, SPACE_OBJECT_LABEL, SPACE_OBJECTS, SpaceObject } from './SpaceObject';
import './space-tokens.css';
import './art.css';
import './ArtPreview.css';

const SAMPLE_ASTRO: Record<Rarity, { astro: (typeof ASTROS)[number]; name: string }> = {
  comum: { astro: 'moon', name: 'Lua' },
  raro: { astro: 'saturn', name: 'Saturno' },
  epico: { astro: 'starb', name: 'Vega' },
  lendario: { astro: 'galaxy', name: 'Via Láctea' },
  proibido: { astro: 'hole', name: 'Sgr A*' },
};

const BOOK_SIZES: BookSize[] = ['sm', 'md', 'lg'];

const TOKENS = [
  ['--space-bg', 'azul-noite'],
  ['--space-panel', 'painel'],
  ['--space-panel-2', 'painel 2'],
  ['--space-line', 'linha'],
  ['--space-blue', 'azul'],
  ['--space-gold', 'ouro'],
  ['--space-red', 'vermelho'],
  ['--space-cyan', 'ciano'],
  ['--space-violet', 'violeta'],
  ['--space-comum-trim', 'comum'],
  ['--space-raro-trim', 'raro'],
  ['--space-epico-trim', 'épico'],
  ['--space-lendario-trim', 'lendário'],
  ['--space-proibido-trim', 'proibido'],
] as const;

/** Pré-visualização do kit de arte. Só existe em desenvolvimento (aperta-art.html), fora do app final. */
export function ArtPreview() {
  const [region, setRegion] = useState<RegionId>(0);
  const [pressed, setPressed] = useState(false);
  const [presses, setPresses] = useState(0);

  useEffect(() => loadSpaceFonts(), []);

  return (
    <div className="space-theme ap-pv">
      <SpaceArtSprite />
      <header className="ap-pv-head">
        <h1>Kit de arte do Aperta!</h1>
        <p>Pré-visualização de desenvolvimento. Cada seção mostra um componente em todas as variações.</p>
      </header>

      <section className="ap-pv-sec">
        <h2>Tokens</h2>
        <div className="ap-pv-swatches">
          {TOKENS.map(([token, label]) => (
            <div key={token} className="ap-pv-swatch">
              <i style={{ background: `var(${token})` }} />
              <span>{label}</span>
              <code>{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="ap-pv-sec">
        <h2>AstroMedal</h2>
        <div className="ap-pv-grid">
          {ASTROS.map((a) => (
            <figure key={a} className="ap-pv-cell">
              <div className="ap-pv-row">
                <AstroMedal astro={a} size={32} />
                <AstroMedal astro={a} size={64} />
                <AstroMedal astro={a} size={96} trim="var(--space-cyan)" />
              </div>
              <figcaption>{ASTRO_LABEL[a]}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="ap-pv-sec">
        <h2>GrimoireBook</h2>
        {BOOK_SIZES.map((size) => (
          <div key={size} className="ap-pv-books">
            <h3>Tamanho {size}</h3>
            <div className="ap-pv-row ap-pv-row--wrap">
              {RARITIES.map((r) => (
                <figure key={r} className="ap-pv-cell">
                  <GrimoireBook rarity={r} size={size} {...SAMPLE_ASTRO[r]} />
                  <figcaption>{RARITY_LABEL[r]}</figcaption>
                </figure>
              ))}
              <figure className="ap-pv-cell">
                <GrimoireBook rarity="comum" astro="lock" name="" locked size={size} />
                <figcaption>Trancado</figcaption>
              </figure>
            </div>
          </div>
        ))}
      </section>

      <section className="ap-pv-sec">
        <h2>SpaceObject</h2>
        <div className="ap-pv-row ap-pv-row--wrap">
          {SPACE_OBJECTS.map((k) => (
            <figure key={k} className="ap-pv-cell">
              <div className="ap-pv-row">
                <SpaceObject kind={k} size={40} />
                <SpaceObject kind={k} size={62} glow />
                <SpaceObject kind={k} size={96} glow />
              </div>
              <figcaption style={{ color: SPACE_OBJECT_COLOR[k] }}>{SPACE_OBJECT_LABEL[k]}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="ap-pv-sec">
        <h2>BigButton</h2>
        <div className="ap-pv-row ap-pv-row--wrap">
          <figure className="ap-pv-cell">
            <BigButton size="200px" />
            <figcaption>Normal (clique para afundar)</figcaption>
          </figure>
          <figure className="ap-pv-cell">
            <BigButton size="200px" pressed />
            <figcaption>Afundado</figcaption>
          </figure>
          <figure className="ap-pv-cell">
            <BigButton size="200px" highlight />
            <figcaption>Destaque do tutorial</figcaption>
          </figure>
          <figure className="ap-pv-cell">
            <BigButton
              size="200px"
              pressed={pressed}
              onPointerDown={() => setPressed(true)}
              onPointerUp={() => setPressed(false)}
              onPointerLeave={() => setPressed(false)}
              onClick={() => setPresses((n) => n + 1)}
            />
            <figcaption>Controlado: {presses} toques</figcaption>
          </figure>
        </div>
      </section>

      <section className="ap-pv-sec">
        <h2>RegionBackdrop</h2>
        <div className="ap-pv-tabs" role="tablist" aria-label="Região">
          {REGION_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={region === id}
              className={region === id ? 'on' : undefined}
              onClick={() => setRegion(id)}
            >
              {id}. {REGIONS[id].name}
            </button>
          ))}
        </div>
        <div className="ap-pv-stages">
          <div className="ap-pv-stage ap-pv-stage--wide">
            <RegionBackdrop region={region} />
            <div className="ap-pv-stage-btn">
              <BigButton size="min(40%, 220px)" />
            </div>
          </div>
          <div className="ap-pv-stage ap-pv-stage--phone">
            <RegionBackdrop region={region} />
            <div className="ap-pv-stage-btn">
              <BigButton size="60%" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
