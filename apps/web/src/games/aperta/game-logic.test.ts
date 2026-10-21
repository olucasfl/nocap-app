import { GRIMOIRES, buyUpgrade, newSave, press, type SaveState } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { ASTROS } from './astros';
import {
  ENERGY_HOT_FROM,
  HOLD_TOUCHES_PER_SEC,
  affordableCount,
  artRarity,
  capturedTitle,
  floatText,
  astroFor,
  comboView,
  createHoldLimiter,
  energyView,
  objectArt,
  objectSlot,
  rewardText,
  signalView,
  togglePage,
} from './game-logic';
import { RARITIES } from './rarity';

const fresh = () => newSave('teste', 0);

describe('páginas da dock', () => {
  it('tocar de novo no mesmo botão fecha a página', () => {
    expect(togglePage(null, 'upgrades')).toBe('upgrades');
    expect(togglePage('upgrades', 'upgrades')).toBeNull();
  });

  it('tocar em outro botão troca de página', () => {
    expect(togglePage('upgrades', 'grimoires')).toBe('grimoires');
  });
});

describe('repetição por tecla', () => {
  it('o primeiro toque sempre vale', () => {
    expect(createHoldLimiter().allow(false, 0)).toBe(true);
  });

  it('segurar a tecla passa no máximo 6 toques por segundo', () => {
    const limiter = createHoldLimiter();
    let accepted = 0;
    // O sistema repete a ~30/s: um evento a cada 33 ms durante 2 s.
    for (let t = 0; t < 2000; t += 33) if (limiter.allow(t > 0, t)) accepted += 1;
    expect(accepted).toBeLessThanOrEqual(2 * HOLD_TOUCHES_PER_SEC + 1);
    expect(accepted).toBeGreaterThanOrEqual(2 * HOLD_TOUCHES_PER_SEC - 2);
  });

  it('um novo aperto (sem repeat) não espera o intervalo', () => {
    const limiter = createHoldLimiter();
    limiter.allow(false, 0);
    expect(limiter.allow(false, 10)).toBe(true);
  });
});

describe('barra de energia', () => {
  it('começa vazia, com o teto do primeiro passo', () => {
    expect(energyView(fresh())).toMatchObject({ fill: 0, hot: false, label: '0/60', cap: 60 });
  });

  it('mostra inteiros e acende a partir de 85%', () => {
    const s = fresh();
    const at = (energy: number): SaveState => ({ ...s, run: { ...s.run, energy } });
    expect(energyView(at(12.9)).label).toBe('12/60');
    expect(energyView(at(60 * ENERGY_HOT_FROM - 0.5)).hot).toBe(false);
    expect(energyView(at(60 * ENERGY_HOT_FROM)).hot).toBe(true);
  });
});

describe('selo de Melhorias', () => {
  it('conta quantas dá para comprar com a poeira atual', () => {
    const s = fresh();
    expect(affordableCount(s)).toBe(0);
    const rich: SaveState = { ...s, run: { ...s.run, dust: 1500 } };
    expect(affordableCount(rich)).toBe(1);
    expect(affordableCount(buyUpgrade(rich, 0))).toBe(0);
  });
});

describe('combo na tela', () => {
  it('não existe antes da Ressonância de Vênus, mesmo tocando seguido', () => {
    let s = fresh();
    for (let i = 0; i < 6; i++) s = press(s, i * 0.2);
    expect(comboView(s, 1.2).points).toBe(0);
  });

  it('depois da melhoria aparece e some quando a janela passa', () => {
    let s: SaveState = fresh();
    s = { ...s, run: { ...s.run, dust: 100000 } };
    s = buyUpgrade(s, 1);
    expect(s.run.upgradeLevels[1]).toBe(1);
    for (let i = 0; i < 4; i++) s = press(s, 1 + i * 0.2);
    const live = comboView(s, 1.8);
    expect(live.points).toBeGreaterThan(0);
    expect(live.mult).toBeCloseTo(1 + 0.2 * live.points);
    expect(comboView(s, 30).points).toBe(0);
  });
});

describe('arte dos grimórios', () => {
  it('toda raridade do motor tem raridade no kit', () => {
    for (const g of GRIMOIRES) expect(RARITIES).toContain(artRarity(g.rarity));
  });

  it('todo grimório do catálogo tem uma medalha válida', () => {
    for (const g of GRIMOIRES) expect(ASTROS).toContain(astroFor(g.id, g.family));
  });

  it('a Lua usa a medalha da Lua', () => {
    expect(astroFor('moon', 'moons')).toBe('moon');
  });
});

describe('objetos no espaço', () => {
  it('a estrela cadente do motor usa a arte do meteoro', () => {
    expect(objectArt('shooting-star')).toBe('meteor');
    expect(objectArt('comet')).toBe('comet');
  });

  it('a etiqueta diz a recompensa de cada objeto', () => {
    const none = { dust: 0, energy: 0, boostMult: 0, boostSec: 0, freeReroll: false };
    expect(rewardText({ ...none, dust: 1200 })).toContain('poeira');
    expect(rewardText({ ...none, energy: 2 })).toBe('+2 energia');
    expect(rewardText({ ...none, boostMult: 2, boostSec: 8 })).toBe('Sinal forte x2 por 8 s');
    expect(rewardText({ ...none, freeReroll: true })).toBe('1 troca grátis');
  });

  it('o aviso concorda em gênero e o texto flutuante é curto', () => {
    expect(capturedTitle('comet')).toBe('Cometa capturado');
    expect(capturedTitle('shooting-star')).toBe('Estrela cadente capturada');
    expect(floatText({ dust: 0, energy: 0, boostMult: 2, boostSec: 8, freeReroll: false })).toBe('Sinal forte x2');
  });

  it('a posição é fixa por id, fica nas faixas de cima e de baixo e alterna a faixa', () => {
    for (let id = 1; id < 200; id++) {
      const a = objectSlot(id);
      expect(a).toEqual(objectSlot(id));
      expect(a.x).toBeGreaterThanOrEqual(25);
      expect(a.x).toBeLessThanOrEqual(75);
      expect(a.y < 20 || a.y > 78).toBe(true);
    }
    expect(objectSlot(1).y > 50).not.toBe(objectSlot(2).y > 50);
  });

  it('o chip Sinal forte só existe enquanto o boost corre', () => {
    const s = fresh();
    expect(signalView(s, 1)).toBeNull();
    const boosted = { ...s, run: { ...s.run, boostMult: 2, boostUntil: 10 } };
    expect(signalView(boosted, 4)).toEqual({ mult: 2, remaining: 6 });
    expect(signalView(boosted, 10)).toBeNull();
  });
});
