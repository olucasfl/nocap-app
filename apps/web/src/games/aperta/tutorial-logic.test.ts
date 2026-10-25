import { TUTORIAL, newSave, type SaveState } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { HINT_PAGE, arrowBox, arrowPlacement, arrowSide, arrowX, cardSide, coachView, inflate, padRect, placeCard } from './tutorial-logic';

const at = (tutorial: SaveState['tutorial'], patch: Partial<SaveState['run']> = {}): SaveState => {
  const s = newSave('coach', 0);
  return { ...s, tutorial, run: { ...s.run, ...patch } };
};
const pending = { offers: ['moon'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };

describe('dica de cada momento', () => {
  it('passo 1: etiqueta no botão e cartão de boas-vindas; nos primeiros toques acende a poeira', () => {
    expect(coachView(at(TUTORIAL.TOUCH), null)).toMatchObject({
      target: 'press',
      glow: null,
      step: 'Passo 1 de 6',
      label: 'Toque aqui para ganhar poeira',
      title: 'Bem-vindo à Perigeu',
      dismiss: null,
    });
    // Com 3 toques o contador de poeira acende (a seta passa a apontar para ele) e o botão segue livre.
    expect(coachView(at(TUTORIAL.TOUCH, { clicks: 3 }), null)).toMatchObject({ target: 'press', glow: 'dust', arrowOn: 'glow', label: 'Sua poeira' });
    expect(coachView(at(TUTORIAL.TOUCH, { clicks: 6 }), null)).toMatchObject({ target: 'press', glow: null, label: 'Continue tocando' });
  });

  it('passo 2: aponta para Melhorias; com a página aberta, para o preço', () => {
    expect(coachView(at(TUTORIAL.UPGRADE), null)).toMatchObject({ target: 'dock-upgrades', title: 'Parabéns!' });
    expect(coachView(at(TUTORIAL.UPGRADE), null)?.text).toMatch(/primeiro item/);
    expect(coachView(at(TUTORIAL.UPGRADE), 'upgrades')).toMatchObject({ target: 'buy-first', place: 'bottom' });
  });

  it('passo 3: com a página aberta manda voltar, apontando para o X', () => {
    expect(coachView(at(TUTORIAL.BACK), 'upgrades')).toMatchObject({ target: 'page-close', place: 'bottom' });
    expect(coachView(at(TUTORIAL.BACK), null)).toBeNull();
  });

  it('passo 4: o botão segue livre e a barra de energia acende com a seta', () => {
    expect(coachView(at(TUTORIAL.FILL), null)).toMatchObject({ target: 'press', glow: 'energy', label: null, title: 'Encha a barra de energia' });
    expect(coachView(at(TUTORIAL.FILL), 'upgrades')).toBeNull();
  });

  it('passo 5: o cartão vai dentro do modal de escolha e fala do bloqueio de 1,6 s', () => {
    const v = coachView(at(TUTORIAL.CHOOSE, { pending }), null);
    expect(v).toMatchObject({ inline: true, target: null, title: 'Você ganhou seu primeiro grimório!' });
    expect(v?.text).toContain('1,6 s');
    expect(coachView(at(TUTORIAL.CHOOSE), null)).toBeNull();
  });

  it('passo 6: aponta para Grimórios', () => {
    expect(coachView(at(TUTORIAL.GRIMOIRES), null)).toMatchObject({ target: 'dock-grimoires' });
    expect(coachView(at(TUTORIAL.GRIMOIRES), 'grimoires')).toBeNull();
  });

  it('jogo livre: cartão só com o gatilho, e a árvore por último', () => {
    const free = at(TUTORIAL.FREE);
    expect(coachView(free, null)).toBeNull();
    const withObject = { ...free, run: { ...free.run, objects: [{ id: 1, kind: 'comet' as const, bornAt: 0, expiresAt: 9 }] } };
    expect(coachView(withObject, null)).toMatchObject({ dismiss: null, target: 'first-object', label: 'Pegue aqui' });
    const twoAch = { ...free, achievements: ['tap-1', 'tap-100'] };
    expect(coachView(twoAch, null)).toMatchObject({ dismiss: 'achievements', target: 'dock-achievements' });
    const last = { ...free, achievements: ['tap-1', 'tap-100'], ui: { unlocked: [], hints: ['achievements', 'objects', 'generators', 'collapse'] as SaveState['ui']['hints'] } };
    // Sem Cintila ainda o cartão da árvore espera; com a 1ª Cintila ele diz "Você ganhou sua primeira Cintila".
    expect(coachView({ ...last, achievements: [] }, null)).toBeNull();
    expect(coachView(last, null)).toMatchObject({ dismiss: 'tree', target: 'tree', title: 'Você ganhou sua primeira Cintila!' });
    // O colapso aparece cedo (2 grimórios) e aponta a meta.
    const twoPicks = { ...free, run: { ...free.run, picks: 2 }, ui: { unlocked: [], hints: ['achievements', 'objects', 'generators'] as SaveState['ui']['hints'] } };
    const goal = coachView(twoPicks, null);
    expect(goal).toMatchObject({ dismiss: 'collapse', target: 'goal', title: 'O colapso da estrela' });
    expect(goal!.text).toContain('poeira');
    expect(goal!.text).toContain('escolhas de grimório');
    expect(HINT_PAGE.tree).toBe('tree');
    expect(HINT_PAGE.achievements).toBe('achievements');
    expect(HINT_PAGE.generators).toBe('upgrades');
  });

  it('jogo livre: com um gerador ao alcance da poeira, o cartão de Geradores aponta para Melhorias', () => {
    const rich = { ...at(TUTORIAL.FREE, { dust: 1e9, dustLife: 1e9 }) };
    expect(coachView(rich, null)).toMatchObject({ dismiss: 'generators', target: 'dock-upgrades', title: 'Poeira sem tocar', step: 'Dica' });
  });

  it('todo passo guiado diz em que passo está e tem alvo ou cartão', () => {
    for (const [step, page] of [[1, null], [2, null], [2, 'upgrades'], [3, 'upgrades'], [4, null], [6, null]] as const) {
      const v = coachView(at(step), page)!;
      expect(v.step, `${step}/${page}`).toBe(`Passo ${step === 3 ? 3 : step} de 6`);
      expect(v.target, `${step}/${page}`).not.toBeNull();
    }
  });

  it('nada flutua com página aberta, janela por cima ou tutorial concluído', () => {
    const twoAch = { ...at(TUTORIAL.FREE), achievements: ['tap-1', 'tap-100'] };
    expect(coachView(twoAch, 'grimoires')).toBeNull();
    expect(coachView(twoAch, null, true)).toBeNull();
    expect(coachView(at('done'), null)).toBeNull();
    expect(coachView(at(TUTORIAL.TOUCH), null, true)).toBeNull();
  });

  it('o botão de dispensar só existe nos cartões do jogo livre', () => {
    for (const step of [1, 2, 3, 4, 6]) expect(coachView(at(step), step === 3 ? 'upgrades' : null)?.dismiss ?? null).toBeNull();
  });
});

describe('posições', () => {
  const bounds = { w: 400, h: 800 };

  it('o respiro não sai da tela', () => {
    expect(padRect({ x: 2, y: 790, w: 396, h: 10 }, 6, bounds)).toEqual({ x: 0, y: 784, w: 400, h: 16 });
  });

  it('cartão e seta ficam do lado oposto ao alvo', () => {
    const low = { x: 10, y: 700, w: 100, h: 60 };
    const high = { x: 10, y: 150, w: 100, h: 60 };
    expect(cardSide(low, 800)).toBe('top');
    expect(cardSide(high, 800)).toBe('bottom');
    expect(cardSide(null, 800)).toBe('top');
    expect(arrowSide(low, 800)).toBe('above');
    expect(arrowSide(high, 800)).toBe('below');
  });

  it('a seta foge do cartão: sem espaço acima do alvo, vai para baixo', () => {
    const mid = { x: 10, y: 230, w: 100, h: 200 };
    expect(arrowSide(mid, 600)).toBe('above');
    expect(arrowSide(mid, 600, 190)).toBe('below');
    expect(arrowSide({ x: 10, y: 300, w: 100, h: 280 }, 600, 0, 0)).toBe('above');
    expect(arrowSide({ x: 10, y: 20, w: 100, h: 200 }, 600, 0, 0)).toBe('below');
  });

  it('a seta não passa das bordas', () => {
    expect(arrowX({ x: 0, y: 0, w: 20, h: 20 }, 320, 60)).toBe(68);
    expect(arrowX({ x: 300, y: 0, w: 20, h: 20 }, 320, 60)).toBe(252);
    expect(arrowX({ x: 100, y: 0, w: 100, h: 20 }, 320, 60)).toBe(150);
  });
});

describe('onde fica o cartão', () => {
  const bounds = { w: 568, h: 320 };
  const card = { w: 220, h: 110 };
  const hits = (a: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
    a.x < b.x + b.w && a.x + card.w > b.x && a.y < b.y + b.h && a.y + card.h > b.y;

  it('fica na âncora quando nada atrapalha', () => {
    expect(placeCard(card, bounds, [], { x: 100, y: 120 })).toEqual({ x: 100, y: 120 });
    expect(placeCard(card, bounds, [], { x: 3, y: 2 })).toEqual({ x: 8, y: 8 });
  });

  it('desvia do alvo e do botão do jogo, sem sair da tela', () => {
    const stage = { x: 236, y: 52, w: 220, h: 206 };
    const avoid = [inflate(stage, 6)];
    const p = placeCard(card, bounds, avoid, { x: 300, y: 120 });
    expect(hits(p, avoid[0]!)).toBe(false);
    expect(p.x).toBeGreaterThanOrEqual(8);
    expect(p.y).toBeGreaterThanOrEqual(8);
    expect(p.x + card.w).toBeLessThanOrEqual(bounds.w - 8);
    expect(p.y + card.h).toBeLessThanOrEqual(bounds.h - 8);
  });

  it('sem lugar livre, escolhe o que cobre menos e não lança', () => {
    const all = [{ x: 0, y: 0, w: 568, h: 320 }];
    const p = placeCard(card, bounds, all, { x: 10, y: 10 });
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });

  it('cartão maior que a tela fica no canto, sem valores negativos', () => {
    const p = placeCard({ w: 700, h: 400 }, bounds, [], { x: 50, y: 50 });
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
  });
});

describe('posição da seta', () => {
  const bounds = { w: 568, h: 320 };

  it('alvo normal: acima ou abaixo, como antes', () => {
    expect(arrowPlacement({ x: 100, y: 250, w: 100, h: 50 }, bounds)).toBe('above');
    expect(arrowPlacement({ x: 100, y: 10, w: 100, h: 50 }, bounds)).toBe('below');
  });

  it('coluna alta e estreita (barra de energia): seta ao lado, do lado de dentro da tela', () => {
    expect(arrowPlacement({ x: 470, y: 40, w: 80, h: 220 }, bounds)).toBe('left');
    expect(arrowPlacement({ x: 6, y: 40, w: 60, h: 220 }, bounds)).toBe('right');
  });

  it('sem altura livre em cima nem embaixo, vai para o lado', () => {
    expect(arrowPlacement({ x: 100, y: 20, w: 300, h: 290 }, bounds)).toBe('right');
  });

  it('a caixa da seta fica colada no alvo do lado certo', () => {
    const hole = { x: 470, y: 40, w: 80, h: 220 };
    const box = arrowBox(hole, bounds, 'left');
    expect(box.x + box.w).toBe(hole.x);
    const above = arrowBox({ x: 100, y: 250, w: 100, h: 50 }, bounds, 'above');
    expect(above.y + above.h).toBe(250);
  });
});
