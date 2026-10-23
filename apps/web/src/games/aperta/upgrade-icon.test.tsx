import { UPGRADES, newSave, upgradeIndex, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UPGRADE_ICON_IDS, UpgradeIcon } from './UpgradeIcon';
import { UpgradesPage } from './UpgradesPage';

describe('ícones das melhorias (spec 041, A9)', () => {
  it('toda melhoria do catálogo tem um desenho próprio', () => {
    const missing = UPGRADES.filter((u) => !UPGRADE_ICON_IDS.includes(u.id)).map((u) => u.id);
    expect(missing).toEqual([]);
    for (const id of UPGRADE_ICON_IDS) expect(renderToStaticMarkup(<UpgradeIcon id={id} />)).toContain('<svg');
  });

  it('as Luvas de Astronauta não usam mais um planeta: o cartão leva o ícone próprio e o N/M', () => {
    const s = newSave('i');
    const lv = s.run.upgradeLevels.slice();
    lv[upgradeIndex('satellite')] = 3;
    const state: SaveState = { ...s, tutorial: 'done', run: { ...s.run, upgradeLevels: lv, dust: 500, dustLife: 500 } };
    const markup = renderToStaticMarkup(<UpgradesPage state={state} onBuy={() => true} seen={new Set()} onSeen={() => {}} />);
    expect(markup).toContain('class="ap-upicon"');
    expect(markup).not.toContain('ap-astro');
    expect(markup).toContain('3/8');
    expect(markup).toContain('Melhorar');
  });
});
