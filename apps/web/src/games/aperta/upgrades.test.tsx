import { UPGRADES, effectiveStats, newSave, upgradeCost, type SaveState } from '@nocap/games';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GamePage } from './GamePage';
import { GameScreen } from './GameScreen';
import { UpgradesPage } from './UpgradesPage';
import { createGameController } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { effectLine, generatorRows, itemsView, powers, tabBadge, upgradeBadge } from './upgrades-logic';

const noop = () => {};
const idx = (id: string) => UPGRADES.findIndex((u) => u.id === id);
const rich = (dust: number, over: Partial<SaveState['run']> = {}): SaveState => {
  const s = newSave('teste', 0);
  return { ...s, tutorial: 'done', run: { ...s.run, dust, dustLife: dust, ...over } };
};
const owning = (s: SaveState, ids: string[]): SaveState => {
  const upgradeLevels = s.run.upgradeLevels.slice();
  for (const id of ids) upgradeLevels[idx(id)] = 1;
  return { ...s, run: { ...s.run, upgradeLevels } };
};

function setup(initial: SaveState) {
  const clock = { ms: 1000 };
  const ctl = createGameController({ initial, store: createMemoryGameStore(), slot: 1, perf: () => clock.ms });
  return { clock, ctl, state: () => ctl.getSnapshot().state };
}

describe('Itens: a fila', () => {
  it('no começo o próximo é a Lente Polida, com os dois seguintes esmaecidos e nenhum comprado', () => {
    const v = itemsView(newSave('teste', 0));
    expect(v.next?.id).toBe('lens');
    expect(v.upcoming.map((r) => r.id)).toEqual(['gloves', 'charged']);
    expect(v.bought).toBe(0);
    expect(v.total).toBe(24);
    expect(v.owned).toEqual([]);
  });

  it('comprar o de cima anda a fila e o item vai para Comprados (o mais novo primeiro)', () => {
    const v = itemsView(owning(newSave('teste', 0), ['lens', 'gloves']));
    expect(v.next?.id).toBe('charged');
    expect(v.upcoming[0]?.id).toBe('solar');
    expect(v.owned.map((r) => r.id)).toEqual(['gloves', 'lens']);
    expect(v.bought).toBe(2);
  });

  it('quando acaba a fila da vida, avisa em que colapso vêm mais itens', () => {
    const all = UPGRADES.filter((u) => u.kind === 'item' && u.unlockedAtCollapse === 0).map((u) => u.id);
    const v = itemsView(owning(newSave('teste', 0), all));
    expect(v.next).toBeNull();
    expect(v.moreAt).toBe(1);
  });

  it('o efeito mostra o TOTAL de quem joga, antes e depois (nunca só o "+4")', () => {
    const base = newSave('teste', 0);
    expect(effectLine(base, idx('lens'))).toMatchObject({ label: 'Seu toque', before: '1', after: '2', idle: false });
    const withLens = owning(base, ['lens']);
    // Luvas somam +2 antes de multiplicar: (1 + 2) x 2 = 6.
    expect(effectLine(withLens, idx('gloves'))).toMatchObject({ label: 'Seu toque', before: '2', after: '4' });
    const energy = effectLine(base, idx('charged'))!;
    expect(energy.label).toBe('Energia por toque');
    expect(Number(energy.after.replace(',', '.'))).toBeCloseTo(Number(energy.before.replace(',', '.')) * 2, 5);
  });

  it('bônus de gerador sem gerador não muda nada ainda e a tela diz isso', () => {
    const line = effectLine(newSave('teste', 0), idx('solar'))!;
    expect(line.idle).toBe(true);
    const withGen = owning(newSave('teste', 0), ['satellite']);
    const withLevels = { ...withGen, run: { ...withGen.run, upgradeLevels: withGen.run.upgradeLevels.map((l, i) => (i === idx('satellite') ? 4 : l)) } };
    const after = effectLine(withLevels, idx('solar'))!;
    expect(after.idle).toBe(false);
    expect(after.label).toBe('Geradores de poeira');
  });

  it('Seus poderes lê o motor: toque, energia por toque e o que cai por segundo', () => {
    const p = powers(newSave('teste', 0));
    expect(p.touch).toBe('1');
    expect(p.dustSec).toBe('0');
    expect(effectiveStats(newSave('teste', 0)).energyPerTouch).toBeGreaterThan(0);
  });
});

describe('Geradores: explicados', () => {
  it('no começo há um gerador de poeira e um de energia, com o que rendem', () => {
    const rows = generatorRows(rich(5000));
    expect(rows.map((r) => r.id)).toEqual(['satellite', 'antenna']);
    const sat = rows[0]!;
    expect(sat.status).toBe('affordable');
    expect(sat.gain).toMatch(/^Seus geradores de poeira: 0\/s -> 0,2\/s$/);
    expect(sat.payback).toMatch(/^se paga em/);
    expect(rows[1]!.gain).toContain('Seus geradores de energia');
  });

  it('o preço do gerador é o do motor e sobe a cada compra', () => {
    const t = setup(rich(1e9));
    let spent = 0;
    for (let n = 0; n < 4; n++) {
      const before = t.state().run.dust;
      t.clock.ms += 300;
      expect(t.ctl.buy(idx('satellite'))).toBe(true);
      const paid = before - t.state().run.dust;
      expect(paid).toBe(upgradeCost(UPGRADES[idx('satellite')]!, n));
      spent += paid;
    }
    expect(1e9 - t.state().run.dust).toBe(spent);
  });

  it('o Completar compra os níveis que faltam pelo preço cheio, sem desconto', () => {
    const rows = generatorRows(rich(1e9));
    const sat = rows[0]!;
    expect(sat.bulkLevels).toBe(8);
    let sum = 0;
    for (let n = 0; n < 8; n++) sum += upgradeCost(UPGRADES[idx('satellite')]!, n);
    expect(sat.bulkCost).toBeCloseTo(sum, 6);
  });
});

describe('selo de Melhorias', () => {
  it('conta o próximo item quando dá para comprar e os geradores que dá para melhorar', () => {
    const s = rich(6000);
    expect(tabBadge(s, 'items', new Set())).toBe(1);
    expect(tabBadge(rich(10), 'items', new Set())).toBe(0);
    expect(upgradeBadge(s, new Set(['satellite', 'antenna']))).toBe(3);
  });

  it('a tela de jogo mostra o selo com o que há para ver', () => {
    const ctl = createGameController({ initial: rich(6000), store: createMemoryGameStore(), slot: 1 });
    const markup = renderToStaticMarkup(<GameScreen controller={ctl} onExit={noop} />);
    expect(markup).toContain('Melhorias, 3 para ver');
  });
});

describe('página renderizada', () => {
  const html = (state: SaveState, seen: ReadonlySet<string> = new Set()) =>
    renderToStaticMarkup(<UpgradesPage state={state} onBuy={noop} seen={seen} onSeen={noop} />);

  it('abre em Itens com Seus poderes, o próximo item com o total antes e depois e os dois seguintes', () => {
    const markup = html(rich(150));
    expect(markup).toContain('Seus poderes');
    expect(markup).toContain('Próximo item');
    expect(markup).toContain('Lente Polida');
    expect(markup).toContain('Seu toque');
    expect(markup).toContain('Comprar Lente Polida por 100 de poeira');
    expect(markup).toContain('Em seguida');
    expect(markup).toContain('Luvas de Astronauta');
    expect(markup).toContain('Pulso Carregado');
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('Os itens que você comprar aparecem aqui');
  });

  it('sem poeira suficiente o botão diz quanto falta, sem comprar', () => {
    const markup = html(rich(40));
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('falta 60 de poeira');
  });

  it('depois de comprar aparece a tira de Comprados', () => {
    expect(html(owning(rich(150), ['lens']))).toContain('Itens comprados');
  });
});

describe('compra pelo controlador', () => {
  it('compra o item da vez, desconta o preço e a poeira por toque dobra', () => {
    const t = setup(rich(1000));
    t.clock.ms += 300;
    t.ctl.press();
    expect(t.state().run.lastGain).toBe(1);
    const before = t.state().run.dust;
    t.clock.ms += 300;
    expect(t.ctl.buy(idx('lens'))).toBe(true);
    expect(before - t.state().run.dust).toBe(100);
    t.clock.ms += 300;
    t.ctl.press();
    expect(t.state().run.lastGain).toBe(2);
  });

  it('item fora da ordem, sem saldo ou índice inválido não compra', () => {
    const t = setup(rich(1e9));
    expect(t.ctl.buy(idx('solar'))).toBe(false);
    expect(t.ctl.buy(99999)).toBe(false);
    const poor = setup(rich(10));
    expect(poor.ctl.buy(idx('lens'))).toBe(false);
    expect(poor.state().run.dust).toBe(10);
  });

  it('toque duplo em 250 ms compra uma vez só; depois do intervalo compra o seguinte', () => {
    const t = setup(rich(1e6));
    expect(t.ctl.buy(idx('lens'))).toBe(true);
    t.clock.ms += 100;
    expect(t.ctl.buy(idx('gloves'))).toBe(false);
    t.clock.ms += 200;
    expect(t.ctl.buy(idx('gloves'))).toBe(true);
  });

  it('com a escolha de grimório aberta não compra', () => {
    const base = rich(1e6);
    const pending = { offers: ['moon', 'mercury', 'venus'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    const t = setup({ ...base, run: { ...base.run, pending } });
    expect(t.ctl.buy(idx('lens'))).toBe(false);
  });
});

describe('CSS das Melhorias', () => {
  const css = readFileSync(join(__dirname, 'upgrades.css'), 'utf8');

  it('só anima transform e opacity, sem transition, e respeita reduced-motion', () => {
    for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)) {
      for (const [, p] of body!.matchAll(/([a-z-]+)\s*:/g)) expect(['transform', 'opacity']).toContain(p);
    }
    expect(css).not.toMatch(/transition\s*:/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it('o botão de compra e as abas têm pelo menos 44 px e o texto quebra em vez de vazar', () => {
    expect(css).toMatch(/\.ap-up-buy \{[^}]*min-height:\s*(4[4-9]|[5-9]\d)px/);
    expect(css).toMatch(/\.ap-uptab \{[^}]*min-height:\s*(4[4-9]|[5-9]\d)px/);
    expect(css).toMatch(/\.ap-up-body p \{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/minmax\(0, 1fr\)/);
  });
});

describe('poeira no cabeçalho das Melhorias', () => {
  it('a página mostra quanta poeira a pessoa tem (e só a página que decide compra)', () => {
    const withDust = renderToStaticMarkup(<GamePage name="upgrades" notice="x" onClose={() => {}} dust="1,5 mil" />);
    expect(withDust).toContain('ap-shead-dust');
    expect(withDust).toContain('1,5 mil');
    expect(withDust).toContain('Você tem 1,5 mil de poeira');
    expect(renderToStaticMarkup(<GamePage name="grimoires" notice="x" onClose={() => {}} />)).not.toContain('ap-shead-dust');
  });
});
