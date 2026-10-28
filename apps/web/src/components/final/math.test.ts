import { describe, expect, it } from 'vitest';
import { clock, pace, places } from './math';

describe('contas das telas de fim', () => {
  it('mostra o tempo em m:ss', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(83.4)).toBe('1:23');
    expect(clock(-5)).toBe('0:00');
  });
  it('empate divide a posição', () => {
    expect(places([9, 9, 5, 5, 1], (a, b) => a === b)).toEqual([1, 1, 3, 3, 5]);
  });
  it('linhas por minuto', () => {
    expect(pace(30, 60)).toBe(30);
    expect(pace(10, 0)).toBe(0);
    expect(pace(7, 40)).toBe(10.5);
  });
});
