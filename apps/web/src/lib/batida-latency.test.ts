import { describe, expect, it } from 'vitest';
import { BATIDA_LATENCY_LIMIT_MS, estimateLatency } from './batida-latency';

describe('ajuste de atraso do Batida', () => {
  it('a mediana dos desvios é o atraso', () => {
    expect(estimateLatency([40, 50, 60, 55, 45])).toBe(50);
    expect(estimateLatency([30, 50, 70, 90])).toBe(60);
  });

  it('um toque fora da curva não estraga o ajuste', () => {
    expect(estimateLatency([48, 52, 50, 49, 51, 400])).toBe(51);
  });

  it('com poucos toques não ajusta nada', () => {
    expect(estimateLatency([50, 60, 70])).toBeNull();
    expect(estimateLatency([])).toBeNull();
  });

  it('o atraso fica dentro do limite (para os dois lados)', () => {
    expect(estimateLatency([900, 900, 900, 900])).toBe(BATIDA_LATENCY_LIMIT_MS);
    expect(estimateLatency([-900, -900, -900, -900])).toBe(-BATIDA_LATENCY_LIMIT_MS);
    expect(estimateLatency([-30, -20, -40, -10])).toBe(-25);
  });
});
