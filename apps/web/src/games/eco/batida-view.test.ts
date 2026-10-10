import { describe, expect, it } from 'vitest';
import { HIT, HORIZON, S_FAR, project } from './batida-view';

const W = 400;
const H = 500;

describe('perspectiva da pista do Eco Hero', () => {
  it('no instante de apertar a nota está no molde: tamanho cheio e na altura dele', () => {
    for (let lane = 0; lane < 5; lane++) {
      const p = project(0, lane, W, H);
      expect(p.scale).toBeCloseTo(1, 10);
      expect(p.y).toBeCloseTo(HIT * H, 6);
      // Centro de cada pista: a largura do campo dividida em 5.
      expect(p.x).toBeCloseTo((lane + 0.5) * (W / 5), 6);
      expect(p.opacity).toBe(1);
    }
  });

  it('lá no fundo ela é pequena, fica no horizonte e as pistas se juntam', () => {
    const left = project(1, 0, W, H);
    const right = project(1, 4, W, H);
    expect(left.scale).toBeCloseTo(S_FAR, 10);
    expect(left.y).toBeCloseTo(HORIZON * H, 6);
    // As cinco pistas ocupam só uma faixa estreita no meio, e simétrica.
    expect(right.x - left.x).toBeLessThan((W / 5) * 4 * 0.4);
    expect(left.x + right.x).toBeCloseTo(W, 6);
    // Surge devagar: bem transparente no fundo.
    expect(left.opacity).toBeCloseTo(0, 6);
  });

  it('desce de forma contínua e cada vez mais depressa (perspectiva de verdade)', () => {
    const ys = [1, 0.75, 0.5, 0.25, 0].map((z) => project(z, 2, W, H).y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
    const steps = ys.slice(1).map((y, i) => y - ys[i]!);
    for (let i = 1; i < steps.length; i++) expect(steps[i]!).toBeGreaterThan(steps[i - 1]!);
  });

  it('o tamanho cresce até o molde e depois de passar vai sumindo', () => {
    expect(project(0.5, 2, W, H).scale).toBeLessThan(project(0.1, 2, W, H).scale);
    expect(project(-0.1, 2, W, H).scale).toBeGreaterThan(1);
    expect(project(-0.1, 2, W, H).opacity).toBeCloseTo(0.5, 6);
    expect(project(-0.2, 2, W, H).opacity).toBe(0);
    // A escala não explode mesmo muito depois de passar.
    expect(project(-5, 2, W, H).scale).toBeLessThan(2.2);
  });
});
