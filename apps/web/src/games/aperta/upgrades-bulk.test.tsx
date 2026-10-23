import { newSave, upgradeIndex, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UpgradesPage } from './UpgradesPage';
import { upgradeRows } from './upgrades-logic';

function withQueue(has: boolean): SaveState {
  const s = newSave('lote');
  const lv = s.run.upgradeLevels.slice();
  lv[upgradeIndex('satellite')] = 1;
  if (has) lv[upgradeIndex('queue')] = 1;
  return { ...s, tutorial: 'done', collapses: 2, run: { ...s.run, upgradeLevels: lv, dust: 1e7, dustLife: 1e7 } };
}

describe('comprar 10 (Fila de pedidos)', () => {
  it('sem a melhoria não há botão de lote; com ela mostra o preço total e os 5% de desconto', () => {
    const noop = () => true;
    const page = (s: SaveState) => renderToStaticMarkup(<UpgradesPage state={s} onBuy={noop} onBuyBatch={noop} seen={new Set()} onSeen={() => {}} />);
    // A aba padrão é a do toque; o lote mora na aba Geradores, então confere nas linhas e no cartão da aba.
    const rows = upgradeRows(withQueue(true), 'generators');
    const sat = rows.find((r) => r.id === 'satellite')!;
    expect(sat.bulkCost).not.toBeNull();
    expect(upgradeRows(withQueue(false), 'generators').find((r) => r.id === 'satellite')!.bulkCost).toBeNull();
    expect(page(withQueue(false))).not.toContain('Comprar 10');
  });
});
