import { GRIMOIRES, UPGRADES, buyUpgrade, newSave, press, type SaveState } from '@nocap/games';
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
  collapseView,
  comboView,
  createHoldLimiter,
  goalMissing,
  energyView,
  objectArt,
  createLaneBook,
  objectSlot,
  rewardText,
  signalView,
  togglePage,
} from './game-logic';
import { RARITIES } from './rarity';
import { formatNumber } from '@nocap/games';

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
    expect(energyView(fresh())).toMatchObject({ fill: 0, hot: false, label: '0/19', cap: 19 });
  });

  it('mostra inteiros e acende a partir de 85%', () => {
    const s = fresh();
    const at = (energy: number): SaveState => ({ ...s, run: { ...s.run, energy } });
    expect(energyView(at(12.9)).label).toBe('12/19');
    expect(energyView(at(19 * ENERGY_HOT_FROM - 0.5)).hot).toBe(false);
    expect(energyView(at(19 * ENERGY_HOT_FROM)).hot).toBe(true);
  });
});

describe('selo de Melhorias', () => {
  it('conta quantas dá para comprar com a poeira atual', () => {
    const s = fresh();
    expect(affordableCount(s)).toBe(0);
    const rich: SaveState = { ...s, run: { ...s.run, dust: 15, dustLife: 15 } };
    expect(affordableCount(rich)).toBe(1);
    expect(affordableCount(buyUpgrade(rich, UPGRADES.findIndex((u) => u.id === 'satellite')))).toBe(0);
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
    const rhythm = UPGRADES.findIndex((u) => u.id === 'rhythm');
    s = { ...s, run: { ...s.run, upgradeLevels: s.run.upgradeLevels.map((l, i) => (i === rhythm ? 1 : l)) } };
    for (let i = 0; i < 4; i++) s = press(s, 1 + i * 0.2);
    const live = comboView(s, 1.8);
    expect(live.points).toBeGreaterThan(0);
    expect(live.mult).toBeCloseTo(1 + 0.2 * live.points);
    expect(comboView(s, 30).points).toBe(0);
  });
});

describe('arte dos grimórios', () => {
  it('toda raridade do motor tem raridade no kit', () => {
    for (const r of ['common', 'rare', 'epic', 'legendary', 'forbidden']) expect(RARITIES).toContain(artRarity(r));
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
    const none = { dust: 0, energy: 0, boostMult: 0, boostSec: 0, frenzy: false, surgeSec: 0, freeReroll: false };
    expect(rewardText({ ...none, dust: 1200 })).toContain('poeira');
    expect(rewardText({ ...none, energy: 2 })).toBe('+2 energia');
    expect(rewardText({ ...none, boostMult: 2, boostSec: 8 })).toBe('Sinal forte x2 por 8 s');
    expect(rewardText({ ...none, freeReroll: true })).toBe('1 troca grátis');
    // Estrela Dourada: Frenesi, Chuva (poeira) e Surto dos geradores.
    expect(rewardText({ ...none, boostMult: 7, boostSec: 30, frenzy: true })).toBe('Frenesi x7 por 30 s');
    expect(rewardText({ ...none, surgeSec: 45 })).toBe('Geradores a todo vapor por 45 s');
  });

  it('o aviso concorda em gênero e o texto flutuante é curto', () => {
    expect(capturedTitle('comet')).toBe('Cometa capturado');
    expect(capturedTitle('shooting-star')).toBe('Estrela cadente capturada');
    expect(floatText({ dust: 0, energy: 0, boostMult: 2, boostSec: 8, frenzy: false, surgeSec: 0, freeReroll: false })).toBe('Sinal forte x2');
    expect(capturedTitle('golden')).toBe('Estrela Dourada capturada');
    expect(objectArt('golden')).toBe('golden');
  });

  it('a posição é fixa por id, fica nas faixas de cima e de baixo e alterna a faixa', () => {
    for (let id = 1; id < 200; id++) {
      const a = objectSlot(id);
      expect(a).toEqual(objectSlot(id));
      expect(a.x).toBeGreaterThanOrEqual(21);
      expect(a.x).toBeLessThanOrEqual(79);
      expect(a.y < 26 || a.y > 64).toBe(true);
    }
    expect(objectSlot(1).y > 50).not.toBe(objectSlot(2).y > 50);
  });

  it('quatro objetos seguidos ficam cada um num canto (nada se cobre)', () => {
    for (let id = 1; id < 100; id++) {
      const slots = [0, 1, 2, 3].map((i) => objectSlot(id + i));
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const a = slots[i]!;
          const b = slots[j]!;
          const sameBand = (a.y > 50) === (b.y > 50);
          // Na mesma faixa (cima ou baixo) um fica à esquerda e o outro à direita.
          if (sameBand) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(40);
          else expect(Math.abs(a.y - b.y)).toBeGreaterThan(40);
        }
      }
    }
  });

  it('ids que não são seguidos também pegam cantos diferentes (livro de vagas)', () => {
    const book = createLaneBook();
    book.sync([7, 9, 11, 14]);
    const slots = [7, 9, 11, 14].map((id) => book.slot(id));
    const corners = new Set(slots.map((s) => `${s.y > 50 ? 'b' : 't'}${s.x > 50 ? 'r' : 'l'}`));
    expect(corners.size).toBe(4);
  });

  it('o objeto guarda a vaga até sumir e o novo ocupa uma vaga livre', () => {
    const book = createLaneBook();
    book.sync([1, 2, 3]);
    const before = book.slot(2);
    book.sync([2, 3]);
    expect(book.slot(2)).toEqual(before);
    book.sync([2, 3, 5]);
    const taken = [2, 3].map((id) => book.slot(id));
    expect(taken.some((t) => t.x === book.slot(5).x && t.y === book.slot(5).y)).toBe(false);
  });

  it('do 5º objeto em diante usa a fileira de dentro, mais perto do botão', () => {
    const book = createLaneBook();
    book.sync([1, 2, 3, 4, 5]);
    const outer = [1, 2, 3, 4].map((id) => book.slot(id));
    const fifth = book.slot(5);
    const sameCorner = outer.find((o) => (o.y > 50) === (fifth.y > 50) && (o.x > 50) === (fifth.x > 50))!;
    expect(Math.abs(sameCorner.y - fifth.y)).toBeGreaterThanOrEqual(8);
  });

  it('o chip Sinal forte só existe enquanto o boost corre', () => {
    const s = fresh();
    expect(signalView(s, 1)).toBeNull();
    const boosted = { ...s, run: { ...s.run, boostMult: 2, boostUntil: 10 } };
    expect(signalView(boosted, 4)).toEqual({ mult: 2, remaining: 6 });
    expect(signalView(boosted, 10)).toBeNull();
  });
});

describe('botão de meta do HUD (só o que falta)', () => {
  const base = newSave('meta', 0);

  it('mostra só a poeira que falta, sem mais nada', () => {
    const view = collapseView(base);
    expect(goalMissing(view)).toBe(`faltam ${formatNumber(view.dustMissing)}`);
    expect(goalMissing(view)).not.toMatch(/meta|colapso|%/i);
  });

  it('com a poeira cumprida passa a dizer o que ainda falta (escolhas)', () => {
    const view = collapseView(base);
    const dustDone = { ...view, dustMissing: 0, requirements: view.requirements.map((r) => (r.id === 'dust' ? { ...r, done: true } : r)) };
    expect(goalMissing(dustDone)).toMatch(/^faltam .*escolha/);
  });

  it('pronta não mostra texto de falta (o botão vira Colapsar) e com a escolha aberta pede para terminá-la', () => {
    const view = collapseView(base);
    expect(goalMissing({ ...view, ready: true })).toBeNull();
    expect(goalMissing({ ...view, waitingChoice: true })).toBe('termine a escolha');
  });
});
