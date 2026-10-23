import { UPGRADES, effectiveStats, newSave, nextUpgradeCost, upgradeCost, type SaveState } from '@nocap/games';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameScreen } from './GameScreen';
import { UpgradesPage } from './UpgradesPage';
import { createGameController } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { buyLabel, buyRows, ownedRows, tabBadge, upgradeBadge, upgradeRows } from './upgrades-logic';

const noop = () => {};
const idx = (id: string) => UPGRADES.findIndex((u) => u.id === id);
const rich = (dust: number, over: Partial<SaveState['run']> = {}): SaveState => {
  const s = newSave('teste', 0);
  // A poeira da vida nunca é menor que a que sobra: é ela que revela as melhorias escondidas.
  return { ...s, tutorial: 'done', run: { ...s.run, dust, dustLife: dust, ...over } };
};
const owning = (s: SaveState, ids: string[]): SaveState => {
  const upgradeLevels = s.run.upgradeLevels.slice();
  for (const id of ids) upgradeLevels[idx(id)] = 1;
  return { ...s, run: { ...s.run, upgradeLevels } };
};
const row = (state: SaveState, id: string) => upgradeRows(state).find((r) => r.id === id)!;

function setup(initial: SaveState) {
  const clock = { ms: 1000 };
  const ctl = createGameController({ initial, store: createMemoryGameStore(), slot: 1, perf: () => clock.ms });
  return { clock, ctl, state: () => ctl.getSnapshot().state };
}

describe('linhas da página de Melhorias', () => {
  it('no começo cada aba mostra a 1ª melhoria e uma escondida', () => {
    const s = newSave('teste', 0);
    expect(upgradeRows(s, 'touch').map((r) => r.id)).toEqual(['lens', 'gloves']);
    // Geradores: um de poeira e um de energia por vez (spec 041); o próximo só depois de completar o atual.
    expect(upgradeRows(s, 'generators').map((r) => r.id)).toEqual(['satellite', 'antenna']);
    expect(row(s, 'lens').status).toBe('short');
    expect(row(s, 'gloves').status).toBe('mystery');
    expect(row(s, 'trained')).toBeUndefined();
  });

  it('a escondida mostra "???" e só o preço', () => {
    const r = row(newSave('teste', 0), 'gloves');
    expect(r).toMatchObject({ name: '???', text: 'Ainda não descoberta', status: 'mystery', cost: 225, gain: null, astro: 'lock' });
    expect(r.lockHint).toBe('Descubra juntando 70% do preço');
    expect(buyLabel(r)).toBe('225');
  });

  it('revela nome e efeito com 70% do preço juntado na vida', () => {
    expect(row(rich(0, { dustLife: 157 }), 'gloves').status).toBe('mystery');
    expect(row(rich(0, { dustLife: 158 }), 'gloves')).toMatchObject({ status: 'short', name: 'Luvas de Astronauta' });
  });

  it('comprar uma traz a próxima escondida, só com o valor', () => {
    const s = owning(rich(0), ['lens']);
    expect(upgradeRows(s, 'touch').map((r) => r.id)).toEqual(['lens', 'gloves', 'trained']);
    expect(row(s, 'trained')).toMatchObject({ status: 'mystery', cost: 500, name: '???' });
    expect(row(s, 'lens')).toMatchObject({ status: 'maxed' });
    expect(buyLabel(row(s, 'lens'))).toBe('Comprada');
  });

  it('uma melhoria à vista pode estar cara: mostra o quanto falta', () => {
    const poor = rich(0, { dust: 5, dustLife: 100 });
    expect(row(poor, 'satellite')).toMatchObject({ status: 'short', cost: 15, missing: 10 });
    expect(buyLabel(row(poor, 'satellite'))).toBe('Falta 10');
  });

  it('Webb e as de colapso futuro só entram depois do colapso e com a fila andada', () => {
    const early = ['lens', 'gloves', 'trained', 'rhythm', 'magnet', 'hands', 'charged', 'luck', 'cadence', 'kepler', 'voyager', 'echo', 'lens2'];
    const s = { ...owning(newSave('teste', 0), early), collapses: 1 };
    const ids = upgradeRows(s).map((r) => r.id);
    expect(ids).toContain('webb');
    expect(ids).not.toContain('chandra');
    expect(upgradeRows({ ...s, collapses: 0 }).map((r) => r.id)).not.toContain('webb');
  });

  it('o preço do gerador é o do motor e sobe a cada compra: 15, 17, 20...', () => {
    const costs: number[] = [];
    for (let level = 0; level < 6; level++) {
      const levels = UPGRADES.map(() => 0);
      levels[idx('satellite')] = level;
      const s = rich(0, { upgradeLevels: levels });
      costs.push(row(s, 'satellite').cost as number);
      expect(row(s, 'satellite').cost).toBe(upgradeCost(UPGRADES[idx('satellite')]!, level));
      expect(row(s, 'satellite').cost).toBe(nextUpgradeCost(s, idx('satellite')));
    }
    expect(costs.slice(0, 3)).toEqual([15, 17, 20]);
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
  });

  it('sem saldo mostra "Falta N"; com saldo mostra o preço', () => {
    expect(buyLabel(row(rich(10), 'satellite'))).toBe('Falta 5');
    expect(buyLabel(row(rich(15), 'satellite'))).toBe('15');
  });

  it('mostra o ganho da próxima compra lendo o motor', () => {
    expect(row(rich(0), 'lens').gain).toBe('Poeira por toque: 1 -> 2');
    expect(row(rich(0), 'satellite').gain).toBe('Poeira por segundo (tocando): 0 -> 0,2');
    expect(row(rich(0), 'antenna').gain).toBe('Energia por segundo (tocando): 0 -> 0,04');
    const open = owning(rich(0, { dustLife: 1e6 }), ['lens', 'gloves']);
    expect(row(open, 'trained').gain).toBe('A cada 25 toques, o toque rende x5');
    expect(row(open, 'rhythm').gain).toMatch(/^Combo: tocar de novo em até 1,3 s/);
    // Escondida não promete ganho.
    expect(row(rich(0), 'gloves').gain).toBeNull();
  });

  it('o gerador mostra N/M (0/8) e vai para Comprados quando completa', () => {
    const r0 = row(rich(0), 'satellite');
    expect([r0.level, r0.max]).toEqual([0, 8]);
    const levels = UPGRADES.map(() => 0);
    levels[idx('satellite')] = 8;
    const done = rich(0, { upgradeLevels: levels });
    // Completou o 1º gerador: o próximo aparece e as melhorias de gerador (a 1ª e uma escondida) entram na fila.
    expect(buyRows(done, 'generators').map((r) => r.id)).toEqual(['probe', 'antenna', 'network', 'lure']);
    expect(ownedRows(done).map((r) => r.id)).toEqual(['satellite']);
    expect(row(done, 'satellite').status).toBe('maxed');
    // Toque: comprada vai para Comprados também.
    const bought = owning(rich(0), ['lens']);
    expect(ownedRows(bought).map((r) => r.id)).toContain('lens');
    expect(buyRows(bought, 'touch').map((r) => r.id)).not.toContain('lens');
  });

  it('o selo conta o que dá para comprar e o que foi descoberto e ainda não visto', () => {
    const s = rich(0);
    expect(tabBadge(s, 'touch', new Set())).toBe(1);
    expect(tabBadge(s, 'touch', new Set(['lens']))).toBe(0);
    // Ao juntar 70% do preço da escondida, ela aparece e vira "coisa para ver".
    const found = rich(0, { dustLife: 158 });
    expect(tabBadge(found, 'touch', new Set(['lens']))).toBe(1);
    expect(upgradeBadge(rich(6000), new Set())).toBeGreaterThan(0);
  });
});

describe('página renderizada', () => {
  const html = (state: SaveState, seen: ReadonlySet<string> = new Set()) =>
    renderToStaticMarkup(<UpgradesPage state={state} onBuy={noop} seen={seen} onSeen={noop} />);

  it('abre na aba da melhoria mais barata que cabe na poeira, com um cartão por melhoria', () => {
    const markup = html(rich(2000));
    // Um gerador de poeira e um de energia por vez (spec 041), com o limite 0/8 e o botão "Melhorar".
    expect(markup.match(/class="ap-up /g)).toHaveLength(2);
    expect(markup).toContain('Satélite');
    expect(markup).toContain('0/8');
    expect(markup).not.toContain('dobra com');
    expect(markup).toContain('Melhorar Satélite por 15 de poeira');
    expect(markup).toContain('Comprados');
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('Geradores por segundo'.slice(0, 9));
  });

  it('o que não dá para comprar fica com aria-disabled, "Falta N" e a escondida em "???"', () => {
    const markup = html(rich(0));
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('Falta 100');
    expect(markup).toContain('???');
    expect(markup).toContain('Descubra juntando 70% do preço');
  });

  it('a tela de jogo mostra o selo de Melhorias com o que há para ver', () => {
    const initial = rich(6000);
    const ctl = createGameController({ initial, store: createMemoryGameStore(), slot: 1 });
    const markup = renderToStaticMarkup(<GameScreen controller={ctl} onExit={noop} />);
    // Lente, Luvas, Satélite e Antena cabem em 6000.
    expect(markup).toContain('Melhorias, 4 para ver');
  });
});

describe('compra pelo controlador', () => {
  it('desconta o preço do motor e sobe o nível', () => {
    const t = setup(rich(2000));
    expect(t.ctl.buy(idx('satellite'))).toBe(true);
    expect(t.state().run.upgradeLevels[idx('satellite')]).toBe(1);
    expect(t.state().run.dust).toBe(1985);
  });

  it('sem saldo, escondida ou índice inválido não compra', () => {
    const t = setup(rich(10));
    expect(t.ctl.buy(idx('satellite'))).toBe(false);
    expect(t.ctl.buy(idx('gloves'))).toBe(false);
    expect(t.ctl.buy(99)).toBe(false);
    expect(t.state().run.dust).toBe(10);
  });

  it('toque duplo em 250 ms compra uma vez só; depois do intervalo compra de novo', () => {
    const t = setup(rich(1e6));
    expect(t.ctl.buy(idx('satellite'))).toBe(true);
    t.clock.ms += 100;
    expect(t.ctl.buy(idx('satellite'))).toBe(false);
    expect(t.state().run.upgradeLevels[idx('satellite')]).toBe(1);
    t.clock.ms += 200;
    expect(t.ctl.buy(idx('satellite'))).toBe(true);
    expect(t.state().run.upgradeLevels[idx('satellite')]).toBe(2);
  });

  it('custos seguidos batem com a tabela do motor (15, 17, 20...)', () => {
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

  it('com a escolha de grimório aberta não compra', () => {
    const base = rich(1e6);
    const pending = { offers: ['moon', 'mercury', 'venus'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    const t = setup({ ...base, run: { ...base.run, pending } });
    expect(t.ctl.buy(idx('satellite'))).toBe(false);
  });

  it('o combo só liga depois de comprar o Ritmo Firme', () => {
    const t = setup(rich(1e6));
    expect(effectiveStats(t.state()).combo.enabled).toBe(false);
    for (const id of ['lens', 'gloves']) {
      t.clock.ms += 300;
      expect(t.ctl.buy(idx(id))).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      t.clock.ms += 300;
      t.ctl.press();
    }
    expect(t.state().run.combo).toBe(0);
    t.clock.ms += 300;
    expect(t.ctl.buy(idx('rhythm'))).toBe(true);
    expect(effectiveStats(t.state()).combo.enabled).toBe(true);
    for (let i = 0; i < 3; i++) {
      t.clock.ms += 300;
      t.ctl.press();
    }
    expect(t.state().run.combo).toBeGreaterThan(0);
  });

  it('comprar a Lente Polida dobra a poeira por toque', () => {
    const t = setup(rich(1e6));
    t.clock.ms += 300;
    t.ctl.press();
    expect(t.state().run.lastGain).toBe(1);
    t.ctl.buy(idx('lens'));
    t.clock.ms += 300;
    t.ctl.press();
    expect(t.state().run.lastGain).toBe(2);
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
