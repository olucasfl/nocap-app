import { describe, expect, it } from 'vitest';
import { SinalSim, type SinalMode } from '@nocap/games';
import { makeLayout } from './camera';
import { drawScene } from './draw-scene';
import type { Ctx } from './art/gfx';

/**
 * Um contexto de Canvas de mentira que recusa o que o navegador recusa: raio negativo ou não numérico
 * em arco, elipse e gradiente radial, cantos negativos em roundRect, cor inválida em gradiente,
 * e save/restore fora de equilíbrio. Uma exceção no meio do desenho deixaria o quadro pela metade
 * (o jogo continua por baixo) e o estado do canvas vazaria para os quadros seguintes.
 */
function strictCtx() {
  const state: Record<string, unknown> = {};
  let depth = 0;
  const bad = (n: number) => !Number.isFinite(n);
  const colorOk = (c: string) => /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%-]+\))$/i.test(c);
  const gradient = () => ({
    addColorStop(_o: number, color: string) {
      if (!colorOk(color)) throw new SyntaxError(`cor inválida no gradiente: ${color}`);
    },
  });
  const fns: Record<string, (...a: number[]) => unknown> = {
    save: () => void depth++,
    restore: () => {
      if (depth === 0) throw new Error('restore sem save');
      depth--;
    },
    arc: (_x, _y, r) => {
      if (bad(r!) || r! < 0) throw new RangeError(`arc com raio ${r}`);
    },
    ellipse: (_x, _y, rx, ry) => {
      if (bad(rx!) || bad(ry!) || rx! < 0 || ry! < 0) throw new RangeError(`ellipse com raios ${rx}, ${ry}`);
    },
    roundRect: (...a) => {
      const radii = a.slice(4);
      if (radii.some((r) => r < 0 || bad(r))) throw new RangeError(`roundRect com canto ${radii}`);
    },
    createRadialGradient: (...a) => {
      if (a.some(bad) || a[2]! < 0 || a[5]! < 0) throw new RangeError(`gradiente radial inválido ${a}`);
      return gradient();
    },
    createLinearGradient: (...a) => {
      if (a.some(bad)) throw new TypeError('gradiente linear não numérico');
      return gradient();
    },
    createPattern: () => ({}),
    measureText: () => ({ width: 40 }),
    setLineDash: () => undefined,
  };
  const ctx = new Proxy(state, {
    get: (t, p: string) => {
      if (p === 'canvas') return { width: 800, height: 600 };
      if (p in fns) return fns[p];
      if (p in t) return t[p];
      return () => undefined;
    },
    set: (t, p: string, v) => {
      if (p === 'fillStyle' || p === 'strokeStyle') {
        // atribuir cor inválida é ignorado pelo navegador (não lança), mas é sinal de bug
        if (typeof v === 'string' && !colorOk(v) && !/^(transparent|[a-z]+)$/i.test(v)) {
          throw new SyntaxError(`cor inválida: ${v}`);
        }
      }
      t[p] = v;
      return true;
    },
  }) as unknown as Ctx;
  return { ctx, depth: () => depth };
}

// As texturas do cenário são desenhadas em canvases à parte: no teste, um de mentira também.
(globalThis as unknown as { document: unknown }).document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => strictCtx().ctx }),
};

function playAndDraw(seed: string, mode: SinalMode, phase: number, seconds: number, online: boolean) {
  const sim = new SinalSim(seed, mode, phase, online);
  const { ctx, depth } = strictCtx();
  let held = 0;
  for (let i = 0; i < 60 * seconds && !sim.dead; i++) {
    const v = sim.view;
    const c = v.cycle;
    const stop = v.t >= c.avisoStart - 0.02 && v.t < c.lookEnd + 0.01;
    // anda em zigue-zague para passar perto de tudo (obstáculos, esconderijos, marcas)
    const ax = stop ? 0 : Math.round(Math.sin(i / 70) * 100);
    sim.step(ax, stop ? 0 : 100, sim.held !== null && i % 40 === 0);
    if (i % 3 === 0) {
      const view = sim.view;
      const layout = makeLayout(i % 2 ? 1893 : 375, i % 2 ? 1030 : 812, i % 2 === 0);
      expect(() =>
        drawScene(ctx, {
          layout,
          view,
          t: i / 60,
          face: view.vigia === 'olhando' ? 1 : 0,
          warn: view.vigia === 'aviso' ? 0.8 : 0,
          walking: true,
          joy: { show: i % 2 === 0, dx: 0.2, dy: -0.4, active: true },
          keysHint: i % 2 === 1,
          best: 120,
          notices: [{ text: 'TESTE', color: '#ff6a2b' }],
          jolt: view.knock,
          others: online
            ? [{ id: 'x', x: view.x + 2, y: view.y + 3, hidden: i % 5 === 0, stunned: i % 7 === 0, color: '#2f5bff', name: 'beto' }]
            : undefined,
          powerTarget: online ? 'x' : null,
          death: view.vigia === 'olhando' && i % 4 === 0 ? { reason: 'vigia', age: 0.5 } : null,
          pushFx: i % 11 === 0 ? { age: 0.4, dx: 1, dy: 0 } : null,
        }),
      ).not.toThrow();
      // cada quadro termina com a pilha de estados equilibrada (nada vaza para o seguinte)
      expect(depth()).toBe(0);
      held++;
    }
  }
  return held;
}

describe('drawScene não lança nem deixa o canvas torto', () => {
  it('em todos os mapas, solo e sala, por vários minutos de jogo simulado', () => {
    let frames = 0;
    for (const seed of ['d-1', 'd-2', 'd-3', 'd-4']) {
      frames += playAndDraw(seed, 'infinito', 1, 90, false);
      frames += playAndDraw(seed, 'classico', 6, 60, true);
    }
    expect(frames).toBeGreaterThan(1000);
  });

  it('nas fases avançadas, com perseguidores, arremessadores e os três mapas', () => {
    let frames = 0;
    for (const phase of [2, 3, 7, 12, 25]) {
      for (const seed of ['p-1', 'p-2']) frames += playAndDraw(seed, 'classico', phase, 45, phase % 2 === 0);
    }
    expect(frames).toBeGreaterThan(500);
  });
});
