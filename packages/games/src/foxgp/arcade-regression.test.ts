import { describe, expect, it } from 'vitest';
import { gpRegressionRun } from './regression-scenario';
import { GP_ARCADE_BASELINE } from './regression.fixture';

/**
 * Regressão do modo Arcade (spec 080, Fase 0): a física de hoje não pode mudar sem querer. O cenário tem um carro por vez
 * (sem vácuo, que a v2 muda de propósito) e uma batida abaixo da velocidade do vácuo.
 */
describe('regressão do Arcade', () => {
  const now = gpRegressionRun('arcade');
  const close = (a: readonly number[], b: readonly number[]) => {
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) expect(Math.abs(a[i]! - b[i]!), `índice ${i}`).toBeLessThan(1e-5);
  };
  it('classificação: mesmo trajeto', () => close(now.qualiTrace as number[], GP_ARCADE_BASELINE.qualiTrace));
  it('corrida de um carro: mesmo trajeto e mesmas voltas', () => {
    close(now.raceTrace as number[], GP_ARCADE_BASELINE.raceTrace);
    expect(now.raceLaps).toEqual(GP_ARCADE_BASELINE.raceLaps);
  });
  it('barreira: mesma batida', () => close(now.wallTrace as number[], GP_ARCADE_BASELINE.wallTrace));
  it('batida entre carros: colisão segura velocidade abaixo do vácuo', () => {
    expect(now.bumpMaxSpeed as number).toBeLessThan(12);
  });
});
