import { UPGRADES, effectiveStats, newSave, nextUpgradeCost, upgradeCost, type SaveState } from '@nocap/games';
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
  // A poeira da vida nunca é menor que a que sobra: é ela que libera as melhorias.
  return { ...s, tutorial: 'done', run: { ...s.run, dust, dustLife: dust, ...over } };
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

  it('só a 1ª melhoria está liberada no começo; as outras aparecem em breve com a condição', () => {
    const s = newSave('teste', 0);
    expect(upgradeRows(s).filter((r) => r.status !== 'locked').map((r) => r.id)).toEqual(['pulse']);
    expect(row(s, 'pleiades')).toMatchObject({ status: 'locked', lockHint: 'Compre Ressonância de Vênus primeiro' });
    expect(row(s, 'resonance')).toMatchObject({
      status: 'locked',
      lockHint: 'Em breve: libera com 100 de poeira ganha ou Pulso Solar no nível 4',
    });
    expect(row(s, 'hubble').lockHint).toBe('Em breve: libera com 600 de poeira ganha ou Pulso Solar no nível 10');
    expect(row(s, 'voyager').lockHint).toBe('Em breve: libera com 8 mil de poeira ganha ou Sonda Kepler no nível 2');
  });

  it('a liberação segue a poeira ganha na vida, o nível da anterior e a compra da Ressonância', () => {
    expect(row(rich(0, { dustLife: 100 }), 'resonance').status).toBe('short');
    expect(row(rich(0, { dustLife: 99 }), 'resonance').status).toBe('locked');
    expect(row(rich(0, { dustLife: 600 }), 'hubble').status).toBe('short');
    expect(row(rich(0, { dustLife: 600 }), 'voyager').status).toBe('locked');
    const byLevel = rich(0, { dustLife: 0, upgradeLevels: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(row(byLevel, 'resonance').status).toBe('short');
    const bought = rich(0, { dustLife: 1000, upgradeLevels: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(row(bought, 'pleiades').status).toBe('short');
  });

  it('uma melhoria liberada pode estar cara: mostra o quanto falta para alcançá-la', () => {
    const s = rich(40, { dustLife: 8000 });
    expect(row(s, 'voyager')).toMatchObject({ status: 'short', cost: 12000, missing: 11960 });
    expect(buyLabel(row(s, 'voyager'))).toBe('Falta 12 mil');
  });

  it('o James Webb entra depois do 1º colapso', () => {
    const s = { ...newSave('teste', 0), collapses: 1 };
    expect(upgradeRows(s).map((r) => r.id)).toContain('webb');
    expect(upgradeRows(s).map((r) => r.id)).not.toContain('chandra');
  });

  it('o preço é o do motor e sobe a cada compra: 25, 28, 31...', () => {
    const costs: number[] = [];
    for (let level = 0; level < 6; level++) {
      const levels = [level, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const s = rich(0, { upgradeLevels: levels });
      costs.push(row(s, 'pulse').cost as number);
      expect(row(s, 'pulse').cost).toBe(upgradeCost(UPGRADES[0]!, level));
      expect(row(s, 'pulse').cost).toBe(nextUpgradeCost(s, 0));
    }
    expect(costs.slice(0, 3)).toEqual([25, 28, 31]);
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
  });

  it('sem saldo mostra "Falta N"; com saldo mostra o preço; no máximo some o preço', () => {
    expect(buyLabel(row(rich(10), 'pulse'))).toBe('Falta 15');
    expect(buyLabel(row(rich(25), 'pulse'))).toBe('25');
    const maxed = rich(1e9, { upgradeLevels: [UPGRADES[0]!.max, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(row(maxed, 'pulse')).toMatchObject({ status: 'maxed', cost: null, gain: null });
    expect(buyLabel(row(maxed, 'pulse'))).toBe('No máximo');
  });

  it('mostra o ganho da próxima compra lendo o motor', () => {
    expect(row(rich(0), 'pulse').gain).toBe('Poeira por toque: 1 -> 2');
    const open = rich(0, { dustLife: 1000 });
    expect(row(open, 'reactor').gain).toBe('Energia por toque: 1 -> 1,25');
    expect(row(open, 'hubble').gain).toBe('Poeira por segundo: 0 -> 1');
    expect(row(open, 'resonance').gain).toMatch(/^Liga o combo/);
    const lvl2 = rich(0, { dustLife: 1000, upgradeLevels: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(row(lvl2, 'pulse').gain).toBe('Poeira por toque: 2 -> 3');
    expect(row(lvl2, 'resonance').gain).toMatch(/^Valor de cada ponto de combo: \+0,2 -> \+0,25/);
    // Melhoria em breve não promete ganho.
    expect(row(rich(0), 'reactor').gain).toBeNull();
  });
});

describe('página renderizada', () => {
  const html = (state: SaveState) => renderToStaticMarkup(<UpgradesPage state={state} onBuy={noop} />);

  it('um cartão por melhoria, com nome, nível e botão de compra', () => {
    const markup = html(rich(2000));
    expect(markup.match(/class="ap-up /g)).toHaveLength(7);
    expect(markup).toContain('Pulso Solar');
    expect(markup).toContain('Nível 0 de 40');
    expect(markup).toContain('Comprar Pulso Solar por 25 de poeira');
  });

  it('o que não dá para comprar fica com aria-disabled e "Falta N"', () => {
    const markup = html(rich(0));
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('Falta 25');
    expect(markup).toContain('Em breve: libera com 100 de poeira ganha ou Pulso Solar no nível 4');
    expect(markup).not.toContain('aria-disabled="false"><b>Falta');
  });

  it('a tela de jogo abre a página pelo selo e conta o que dá para comprar', () => {
    const initial = rich(6000);
    const ctl = createGameController({ initial, store: createMemoryGameStore(), slot: 1 });
    const markup = renderToStaticMarkup(<GameScreen controller={ctl} onExit={noop} />);
    expect(markup).toContain('Melhorias, 5 para comprar');
  });
});

describe('compra pelo controlador', () => {
  it('desconta o preço do motor e sobe o nível', () => {
    const t = setup(rich(2000));
    expect(t.ctl.buy(0)).toBe(true);
    expect(t.state().run.upgradeLevels[0]).toBe(1);
    expect(t.state().run.dust).toBe(1975);
  });

  it('sem saldo, trancada ou índice inválido não compra', () => {
    const t = setup(rich(10));
    expect(t.ctl.buy(0)).toBe(false);
    expect(t.ctl.buy(3)).toBe(false);
    expect(t.ctl.buy(99)).toBe(false);
    expect(t.state().run.dust).toBe(10);
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

  it('custos seguidos batem com a tabela do motor (25, 28, 31...)', () => {
    const t = setup(rich(1e9));
    let spent = 0;
    for (let n = 0; n < 4; n++) {
      const before = t.state().run.dust;
      t.clock.ms += 300;
      expect(t.ctl.buy(0)).toBe(true);
      const paid = before - t.state().run.dust;
      expect(paid).toBe(upgradeCost(UPGRADES[0]!, n));
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
