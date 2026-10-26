import { newSave, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TreePanel } from './TreePanel';
import { describeLevel, treeView } from './tree-logic';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const noop = () => {};

function open(over: Partial<SaveState> = {}, sparks = 10): SaveState {
  return {
    ...newSave('p'),
    tutorial: 'done',
    collapses: 1,
    regionId: 'asteroid-belt',
    sparks: { legacy: sparks, spent: 0 },
    ...over,
  };
}

const rowOf = (s: SaveState, id: string) =>
  treeView(s)
    .branches.flatMap((b) => b.nodes)
    .find((n) => n.id === id)!;

describe('painel do nó', () => {
  it('sem nó escolhido, convida a tocar numa estrela', () => {
    expect(html(<TreePanel row={null} onBuy={noop} onClose={noop} />)).toContain(
      'Toque numa estrela',
    );
  });

  it('nó comprável: nome, ramo, tier, custo, efeito e botão Comprar ligado', () => {
    const out = html(<TreePanel row={rowOf(open(), 'co-02')} onBuy={noop} onClose={noop} />);
    expect(out).toContain('Sintonia');
    expect(out).toContain('Cosmos · tier 1');
    expect(out).toContain('Nível</dt><dd>0 de 2');
    expect(out).toContain('1 Cintila');
    expect(out).toContain('Ao comprar:');
    expect(out).toMatch(/<button[^>]*class="ap-tp-buy"[^>]*>Comprar · 1/);
    expect(out).not.toMatch(/class="ap-tp-buy"[^>]*disabled/);
  });

  it('comprado em parte mostra o que vale agora e o que muda no próximo nível', () => {
    const s = open({ tree: { 'co-02': 1 }, sparks: { legacy: 10, spent: 1 } });
    const out = html(<TreePanel row={rowOf(s, 'co-02')} onBuy={noop} onClose={noop} />);
    expect(out).toContain('Agora:');
    expect(out).toContain('No próximo nível:');
    expect(describeLevel({ effect: { params: { add: [0.1, 0.2] } } }, 2)).toBe('soma 0,2');
  });

  it('bloqueado mostra o pré-requisito que falta; sem Cintilas mostra quanto falta', () => {
    const blocked = html(<TreePanel row={rowOf(open(), 'co-05')} onBuy={noop} onClose={noop} />);
    expect(blocked).toContain('Compre antes: Sintonia.');
    expect(blocked).toContain('Sintonia (falta)');
    expect(blocked).toMatch(/class="ap-tp-buy"[^>]*disabled/);
    const poor = html(<TreePanel row={rowOf(open({}, 0), 'co-01')} onBuy={noop} onClose={noop} />);
    expect(poor).toContain('Faltam 1 Cintila.');
    expect(poor).toMatch(/>Falta 1</);
  });

  it('nenhum nó espera mecânica futura (o Observatório foi aposentado), então nenhum painel diz "Em breve"', () => {
    const rows = treeView(open()).branches.flatMap((b) => b.nodes);
    expect(rows.some((n) => n.status === 'soon')).toBe(false);
    expect(
      html(<TreePanel row={rowOf(open(), 'ex-01')} onBuy={noop} onClose={noop} />),
    ).not.toContain('Chega com');
  });

  it('estado de cada nó da página: abertura, bloqueio, falta e fechado até o 1º colapso', () => {
    const v = treeView(open());
    const st = (id: string) => v.branches.flatMap((b) => b.nodes).find((n) => n.id === id)!.status;
    expect(st('co-01')).toBe('buyable');
    expect(st('co-05')).toBe('blocked');
    expect(v.branches.flatMap((b) => b.nodes).some((n) => n.status === 'soon')).toBe(false);
    expect(st('au-01')).toBe('buyable');
    expect(
      treeView(open({}, 0))
        .branches.flatMap((b) => b.nodes)
        .find((n) => n.id === 'co-01')!.status,
    ).toBe('short');
    expect(
      treeView({ ...open(), collapses: 0 })
        .branches.flatMap((b) => b.nodes)
        .every((n) => n.status === 'closed' || n.status === 'soon'),
    ).toBe(true);
  });

  it('refazer só liga fora de uma vida em andamento', () => {
    const bought = open({ tree: { 'co-02': 1 }, sparks: { legacy: 10, spent: 1 } });
    expect(treeView(bought).respec.can).toBe(true);
    const playing = { ...bought, run: { ...bought.run, clicks: 30, picks: 3 } };
    expect(treeView(playing).respec).toMatchObject({ can: false, refund: 0, spent: 1 });
  });
});
