import { COST_GROWTH, UPGRADES, effectiveStats, newSave, nextUpgradeCost, type SaveState } from '@nocap/games';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameScreen } from './GameScreen';
import { UpgradesPage } from './UpgradesPage';
import { createGameController } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { buyLabel, upgradeRows } from './upgrades-logic';

const noop = () => {};
const rich = (dust: number, over: Partial<SaveState['run']> = {}): SaveState => {
  const s = newSave('teste', 0);
  return { ...s, run: { ...s.run, dust, ...over } };
};
const row = (state: SaveState, id: string) => upgradeRows(state).find((r) => r.id === id)!;

function setup(initial: SaveState) {
  const clock = { ms: 1000 };
  const ctl = createGameController({ initial, store: createMemoryGameStore(), slot: 1, perf: () => clock.ms });
  return { clock, ctl, state: () => ctl.getSnapshot().state };
}

describe('linhas da página de Melhorias', () => {
  it('no começo mostra as 7 do início e esconde as dos colapsos futuros', () => {
    const ids = upgradeRows(newSave('teste', 0)).map((r) => r.id);
    expect(ids).toEqual(['pulse', 'resonance', 'reactor', 'pleiades', 'kepler', 'hubble', 'voyager']);
  });

  it('as de liberação aparecem trancadas com a dica do motivo', () => {
    const s = newSave('teste', 0);
    expect(row(s, 'pleiades')).toMatchObject({ status: 'locked', lockHint: 'Compre Ressonância de Vênus primeiro' });
    expect(row(s, 'hubble')).toMatchObject({ status: 'locked', lockHint: 'Libera após 3 grimórios' });
    expect(row(s, 'voyager').lockHint).toBe('Libera após 8 grimórios');
  });

  it('a liberação segue as escolhas e a compra da Ressonância', () => {
    const picked = rich(0, { picks: 3 });
    expect(row(picked, 'hubble').status).toBe('short');
    expect(row(picked, 'voyager').status).toBe('locked');
    const bought = rich(0, { upgradeLevels: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(row(bought, 'pleiades').status).toBe('short');
  });

  it('o James Webb entra depois do 1º colapso', () => {
    const s = { ...newSave('teste', 0), collapses: 1 };
    expect(upgradeRows(s).map((r) => r.id)).toContain('webb');
    expect(upgradeRows(s).map((r) => r.id)).not.toContain('chandra');
  });

  it('o preço é o do motor: base x 1,65^nível', () => {
    for (let level = 0; level < 6; level++) {
      const levels = [level, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const s = rich(0, { upgradeLevels: levels });
      expect(row(s, 'pulse').cost).toBe(Math.round(1500 * Math.pow(COST_GROWTH, level)));
      expect(row(s, 'pulse').cost).toBe(nextUpgradeCost(s, 0));
    }
  });

  it('sem saldo mostra "Falta N"; com saldo mostra o preço; no máximo some o preço', () => {
    expect(buyLabel(row(rich(1000), 'pulse'))).toBe('Falta 500');
    expect(buyLabel(row(rich(1500), 'pulse'))).toBe('1,5 mil');
    const maxed = rich(1e9, { upgradeLevels: [UPGRADES[0]!.max, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(row(maxed, 'pulse')).toMatchObject({ status: 'maxed', cost: null, gain: null });
    expect(buyLabel(row(maxed, 'pulse'))).toBe('No máximo');
  });

  it('mostra o ganho da próxima compra lendo o motor', () => {
    expect(row(rich(0), 'pulse').gain).toBe('Poeira por toque: 1 -> 2');
    expect(row(rich(0), 'reactor').gain).toBe('Energia por toque: 0,25 -> 0,375');
    expect(row(rich(0), 'resonance').gain).toMatch(/^Liga o combo/);
    const lvl2 = rich(0, { upgradeLevels: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(row(lvl2, 'pulse').gain).toBe('Poeira por toque: 2 -> 3');
    expect(row(lvl2, 'resonance').gain).toBe('Janela do combo: 1,3 s -> 1,5 s');
  });
});

describe('página renderizada', () => {
  const html = (state: SaveState) => renderToStaticMarkup(<UpgradesPage state={state} onBuy={noop} />);

  it('um cartão por melhoria, com nome, nível e botão de compra', () => {
    const markup = html(rich(2000));
    expect(markup.match(/class="ap-up /g)).toHaveLength(7);
    expect(markup).toContain('Pulso Solar');
    expect(markup).toContain('Nível 0 de 30');
    expect(markup).toContain('Comprar Pulso Solar por 1,5 mil de poeira');
  });

  it('o que não dá para comprar fica com aria-disabled e "Falta N"', () => {
    const markup = html(rich(0));
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('Falta 1,5 mil');
    expect(markup).not.toContain('aria-disabled="false"><b>Falta');
  });

  it('a tela de jogo abre a página pelo selo e conta o que dá para comprar', () => {
    const initial = rich(6000);
    const ctl = createGameController({ initial, store: createMemoryGameStore(), slot: 1 });
    const markup = renderToStaticMarkup(<GameScreen controller={ctl} onExit={noop} />);
    expect(markup).toContain('Melhorias, 2 para comprar');
  });
});

describe('compra pelo controlador', () => {
  it('desconta o preço do motor e sobe o nível', () => {
    const t = setup(rich(2000));
    expect(t.ctl.buy(0)).toBe(true);
    expect(t.state().run.upgradeLevels[0]).toBe(1);
    expect(t.state().run.dust).toBe(500);
  });

  it('sem saldo, trancada ou índice inválido não compra', () => {
    const t = setup(rich(100));
    expect(t.ctl.buy(0)).toBe(false);
    expect(t.ctl.buy(3)).toBe(false);
    expect(t.ctl.buy(99)).toBe(false);
    expect(t.state().run.dust).toBe(100);
  });

  it('toque duplo em 250 ms compra uma vez só; depois do intervalo compra de novo', () => {
    const t = setup(rich(1e6));
    expect(t.ctl.buy(0)).toBe(true);
    t.clock.ms += 100;
    expect(t.ctl.buy(0)).toBe(false);
    expect(t.state().run.upgradeLevels[0]).toBe(1);
    t.clock.ms += 200;
    expect(t.ctl.buy(0)).toBe(true);
    expect(t.state().run.upgradeLevels[0]).toBe(2);
  });

  it('custos seguidos batem com base x 1,65^n', () => {
    const t = setup(rich(1e9));
    let spent = 0;
    for (let n = 0; n < 4; n++) {
      const before = t.state().run.dust;
      t.clock.ms += 300;
      expect(t.ctl.buy(0)).toBe(true);
      const paid = before - t.state().run.dust;
      expect(paid).toBe(Math.round(1500 * Math.pow(COST_GROWTH, n)));
      spent += paid;
    }
    expect(1e9 - t.state().run.dust).toBe(spent);
  });

  it('com a escolha de grimório aberta não compra', () => {
    const base = rich(1e6);
    const pending = { offers: ['moon', 'mercury', 'venus'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    const t = setup({ ...base, run: { ...base.run, pending } });
    expect(t.ctl.buy(0)).toBe(false);
  });

  it('o combo só liga depois de comprar a Ressonância de Vênus', () => {
    const t = setup(rich(1e6));
    expect(effectiveStats(t.state()).combo.enabled).toBe(false);
    for (let i = 0; i < 6; i++) {
      t.clock.ms += 300;
      t.ctl.press();
    }
    expect(t.state().run.combo).toBe(0);
    t.clock.ms += 300;
    expect(t.ctl.buy(1)).toBe(true);
    expect(effectiveStats(t.state()).combo.enabled).toBe(true);
    for (let i = 0; i < 3; i++) {
      t.clock.ms += 300;
      t.ctl.press();
    }
    expect(t.state().run.combo).toBeGreaterThan(0);
  });

  it('comprar o Pulso Solar sobe a poeira por toque', () => {
    const t = setup(rich(1e6));
    t.clock.ms += 300;
    t.ctl.press();
    expect(t.state().run.lastGain).toBe(1);
    t.ctl.buy(0);
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

  it('o botão de compra tem pelo menos 44 px e o texto quebra em vez de vazar', () => {
    expect(css).toMatch(/\.ap-up-buy \{[^}]*min-height:\s*(4[4-9]|[5-9]\d)px/);
    expect(css).toMatch(/\.ap-up-body p \{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/minmax\(0, 1fr\)/);
  });
});
