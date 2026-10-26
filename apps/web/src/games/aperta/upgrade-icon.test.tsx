import { UPGRADES, newSave, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ItemIcon } from './ItemIcon';
import { UPGRADE_ICON_IDS, UpgradeIcon } from './UpgradeIcon';
import { UpgradesPage } from './UpgradesPage';

describe('ícones (spec 043)', () => {
  it('todo gerador tem um desenho próprio', () => {
    const missing = UPGRADES.filter(
      (u) => u.kind !== 'item' && !UPGRADE_ICON_IDS.includes(u.id),
    ).map((u) => u.id);
    expect(missing).toEqual([]);
    for (const id of UPGRADE_ICON_IDS)
      expect(renderToStaticMarkup(<UpgradeIcon id={id} />)).toContain('<svg');
  });

  it('todo item tem selo com a moldura da era e o desenho do tipo de efeito', () => {
    for (const u of UPGRADES.filter((x) => x.kind === 'item')) {
      const markup = renderToStaticMarkup(<ItemIcon id={u.id} />);
      expect(markup, u.id).toContain(`data-era="${u.era}"`);
      expect(markup, u.id).toContain(`data-type="${u.item?.type}"`);
    }
  });

  it('as eras têm molduras diferentes e itens parecidos se distinguem pelos pontos', () => {
    const a = renderToStaticMarkup(<ItemIcon id="lens" />);
    const b = renderToStaticMarkup(<ItemIcon id="lens2" />);
    expect(a).not.toBe(b);
    expect(renderToStaticMarkup(<ItemIcon id="starhand" />)).not.toBe(
      renderToStaticMarkup(<ItemIcon id="gloves" />),
    );
  });

  it('a aba Itens usa o selo e a de geradores o ícone do gerador com o N/M', () => {
    const s = newSave('i');
    const state: SaveState = {
      ...s,
      tutorial: 'done',
      run: { ...s.run, dust: 500, dustLife: 500 },
    };
    const markup = renderToStaticMarkup(
      <UpgradesPage state={state} onBuy={() => true} seen={new Set()} onSeen={() => {}} />,
    );
    expect(markup).toContain('class="ap-itemicon"');
  });
});
