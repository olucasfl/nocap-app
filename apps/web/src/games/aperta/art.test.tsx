import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ASTROS } from './astros';
import { AstroMedal } from './AstroMedal';
import { BigButton } from './BigButton';
import { GrimoireBook } from './GrimoireBook';
import { RARITIES, RARITY_GEMS } from './rarity';
import { REGION_ART, RegionBackdrop } from './regions';
import { SpaceArtSprite } from './SpaceArtSprite';
import { SPACE_OBJECTS, SpaceObject } from './SpaceObject';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('kit de arte do Aperta!', () => {
  it('o sprite define um símbolo para cada astro', () => {
    const markup = html(<SpaceArtSprite />);
    for (const a of ASTROS) expect(markup).toContain(`id="ap-art-${a}"`);
  });

  it('AstroMedal é decorativo sem rótulo e acessível com rótulo', () => {
    const deco = html(<AstroMedal astro="moon" />);
    expect(deco).toContain('aria-hidden="true"');
    expect(deco).toContain('href="#ap-art-moon"');
    const named = html(<AstroMedal astro="saturn" label="Saturno" />);
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Saturno"');
    expect(named).not.toContain('aria-hidden');
  });

  it.each(ASTROS)('AstroMedal renderiza o astro %s', (a) => {
    expect(html(<AstroMedal astro={a} />)).toContain(`data-astro="${a}"`);
  });

  it.each(RARITIES)('GrimoireBook %s acende as gemas da raridade', (r) => {
    const markup = html(<GrimoireBook rarity={r} astro="moon" name="Lua" />);
    expect(markup).toContain(`ap-book--${r}`);
    expect(markup.match(/<i class="on">/g)?.length ?? 0).toBe(RARITY_GEMS[r]);
    expect(markup).toContain('aria-label="Grimório Lua,');
  });

  it('GrimoireBook trancado esconde o nome e usa o cadeado', () => {
    const markup = html(<GrimoireBook rarity="lendario" astro="galaxy" name="Via Láctea" locked />);
    expect(markup).toContain('???');
    expect(markup).toContain('href="#ap-art-lock"');
    expect(markup).toContain('aria-label="Grimório escondido"');
    expect(markup).not.toContain('Via Láctea');
    expect(markup).not.toContain('<i class="on">');
  });

  it('só o proibido tem rachaduras', () => {
    expect(html(<GrimoireBook rarity="proibido" astro="hole" name="Sgr A*" />)).toContain(
      'ap-book-cracks',
    );
    expect(html(<GrimoireBook rarity="epico" astro="starb" name="Vega" />)).not.toContain(
      'ap-book-cracks',
    );
  });

  it.each(SPACE_OBJECTS)('SpaceObject %s é decorativo por padrão', (k) => {
    const markup = html(<SpaceObject kind={k} />);
    expect(markup).toContain(`data-kind="${k}"`);
    expect(markup).toContain('aria-hidden="true"');
  });

  it('BigButton tem rótulo, é button e afunda por prop', () => {
    const normal = html(<BigButton />);
    expect(normal).toContain('<button');
    expect(normal).toContain('aria-label="Apertar o botão"');
    expect(normal).not.toContain('is-down');
    expect(html(<BigButton pressed />)).toContain('is-down');
    expect(html(<BigButton highlight />)).toContain('ap-bigbtn-halo');
  });

  it.each(REGION_ART.map((r) => r.id))(
    'RegionBackdrop %s renderiza céu, estrelas e camadas',
    (id) => {
      const markup = html(<RegionBackdrop region={id} />);
      expect(markup).toContain(`ap-region--${id}`);
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('ap-stars');
      expect(markup.match(/class="ap-layer /g)?.length).toBe(2);
    },
  );

  it('RegionBackdrop pausa quando pedido', () => {
    expect(html(<RegionBackdrop region="inner-solar-system" paused />)).toContain('is-paused');
  });
});
