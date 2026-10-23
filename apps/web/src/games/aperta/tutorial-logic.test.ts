import { TUTORIAL, newSave, type SaveState } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { HINT_PAGE, arrowSide, arrowX, cardSide, coachView, padRect } from './tutorial-logic';

const at = (tutorial: SaveState['tutorial'], patch: Partial<SaveState['run']> = {}): SaveState => {
  const s = newSave('coach', 0);
  return { ...s, tutorial, run: { ...s.run, ...patch } };
};
const pending = { offers: ['moon'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };

describe('dica de cada momento', () => {
  it('passo 1: só a etiqueta no botão, sem cartão', () => {
    expect(coachView(at(TUTORIAL.TOUCH), null)).toMatchObject({
      target: 'press',
      label: 'Toque aqui para ganhar poeira',
      title: null,
      dismiss: null,
    });
  });

  it('passo 2: aponta para Melhorias; com a página aberta, para o preço', () => {
    expect(coachView(at(TUTORIAL.UPGRADE), null)).toMatchObject({ target: 'dock-upgrades', title: 'Parabéns!' });
    expect(coachView(at(TUTORIAL.UPGRADE), null)?.text).toMatch(/primeira melhoria/);
    expect(coachView(at(TUTORIAL.UPGRADE), 'upgrades')).toMatchObject({ target: 'buy-first', place: 'bottom' });
  });

  it('passo 3: com a página aberta manda voltar, apontando para o X', () => {
    expect(coachView(at(TUTORIAL.BACK), 'upgrades')).toMatchObject({ target: 'page-close', place: 'bottom' });
    expect(coachView(at(TUTORIAL.BACK), null)).toBeNull();
  });

  it('passo 4: explica a barra de energia no botão', () => {
    expect(coachView(at(TUTORIAL.FILL), null)).toMatchObject({ target: 'press', title: 'Encha a barra de energia' });
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
    const last = { ...free, achievements: ['tap-1', 'tap-100'], ui: { unlocked: [], hints: ['achievements', 'objects'] as SaveState['ui']['hints'] } };
    // Sem Cintila ainda o cartão da árvore espera; com a 1ª Cintila ele diz "Você ganhou sua primeira Cintila".
    expect(coachView({ ...last, achievements: [] }, null)).toBeNull();
    expect(coachView(last, null)).toMatchObject({ dismiss: 'tree', target: 'tree', title: 'Você ganhou sua primeira Cintila!' });
    expect(HINT_PAGE.tree).toBe('tree');
    expect(HINT_PAGE.achievements).toBe('achievements');
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
