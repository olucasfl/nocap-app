import { describe, expect, it } from 'vitest';
import { TowersGame, type TowersInput } from '@nocap/games';
import { FINALE_SECONDS, burst, createFx, drawFrame, finaleMoves, startFinale, stepFx } from './draw';

/** Um contexto de Canvas de mentira: aceita qualquer chamada, para pegar erros no desenho. */
function fakeCtx() {
  const store: Record<string, unknown> = {};
  return new Proxy(store, {
    get: (t, p: string) => (p in t ? t[p] : () => undefined),
    set: (t, p: string, v) => {
      t[p] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const DROP: TowersInput = { left: false, right: false, down: true };

describe('desenho do Block Towers', () => {
  it('desenha o jogo parado, em movimento, com magias e depois do fim sem lançar erro', () => {
    const g = new TowersGame('desenho');
    const fx = createFx();
    const ctx = fakeCtx();
    g.held.push('vinha');
    g.fx.nevoa = 2;
    g.fx.gelo = 1;
    for (let i = 0; i < 60 * 40 && !g.over; i++) {
      g.step(i % 200 < 60 ? { left: true, right: false, down: true } : DROP);
      if (i === 90) g.castSpell();
      if (i % 5 === 0) {
        burst(fx, 6, { x: 0, y: 0 }, { kind: 'leaf', color: '#33c27f' });
        stepFx(fx, 1 / 60);
        expect(() => drawFrame(ctx, 390, 780, g, fx, 1 / 60)).not.toThrow();
      }
    }
    fx.mood = 'faint';
    fx.dark = 1;
    for (const mood of ['idle', 'cheer', 'scared', 'faint'] as const) {
      fx.mood = mood;
      expect(() => drawFrame(ctx, 800, 500, g, fx, 1 / 60)).not.toThrow();
    }
  });

  it('a câmera sobe junto com a torre', () => {
    const g = new TowersGame('camera');
    const fx = createFx();
    const ctx = fakeCtx();
    for (let i = 0; i < 60 * 40; i++) {
      g.step(DROP);
      if (i % 4 === 0) drawFrame(ctx, 390, 780, g, fx, 1 / 15);
    }
    expect(fx.camY).toBeLessThanOrEqual(0);
  });
});

describe('final com a câmera (spec 025)', () => {
  it('torre baixa não move a câmera; torre alta afasta e desce até mostrar tudo', () => {
    const g = new TowersGame('final');
    expect(finaleMoves(g, 390, 780)).toBe(false);
    // Uma torre alta: o topo vai bem acima do que a tela mostra.
    g.towerTop = () => -40;
    expect(finaleMoves(g, 390, 780)).toBe(true);
  });

  it('o final termina com a câmera no chão e o desenho segue sem erro', () => {
    const g = new TowersGame('final2');
    g.towerTop = () => -40;
    const fx = createFx();
    fx.camY = -40;
    startFinale(fx);
    const ctx = fakeCtx();
    for (let t = 0; t < FINALE_SECONDS + 0.5; t += 1 / 60) {
      expect(() => drawFrame(ctx, 390, 780, g, fx, 1 / 60)).not.toThrow();
    }
    expect(fx.finale).toBe(1);
    expect(fx.camY).toBeCloseTo(0, 5);
  });
});
