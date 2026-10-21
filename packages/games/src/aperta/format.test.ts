import { describe, expect, it } from 'vitest';
import { formatDecimal, formatDuration, formatNumber, formatPercent } from './format';

describe('formatNumber', () => {
  it('mostra inteiros até 999', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(12.9)).toBe('12');
  });

  it('usa mil, mi, bi e tri com vírgula decimal', () => {
    expect(formatNumber(1000)).toBe('1 mil');
    expect(formatNumber(1500)).toBe('1,5 mil');
    expect(formatNumber(12_345)).toBe('12,3 mil');
    expect(formatNumber(123_456)).toBe('123 mil');
    expect(formatNumber(2_000_000)).toBe('2 mi');
    expect(formatNumber(3.25e9)).toBe('3,25 bi');
    expect(formatNumber(7e12)).toBe('7 tri');
  });

  it('promove para a unidade de cima quando arredonda para 1000', () => {
    expect(formatNumber(999_900)).toBe('1 mi');
    expect(formatNumber(999_900_000)).toBe('1 bi');
  });

  it('vai para notação científica a partir de 1e15', () => {
    expect(formatNumber(1e15)).toBe('1e15');
    expect(formatNumber(1.5e20)).toBe('1,5e20');
    expect(formatNumber(9.999e20)).toBe('1e21');
    expect(formatNumber(999_900_000_000_000)).toBe('1e15');
  });

  it('aguenta valores inválidos e o teto', () => {
    expect(formatNumber(Number.NaN)).toBe('0');
    expect(formatNumber(Infinity)).toBe('1e300');
    expect(formatNumber(1e300)).toBe('1e300');
    expect(formatNumber(-1500)).toBe('-1,5 mil');
  });
});

describe('formatDecimal e formatPercent', () => {
  it('troca ponto por vírgula e corta zeros', () => {
    expect(formatDecimal(1.6, 2)).toBe('1,6');
    expect(formatDecimal(0.125, 3)).toBe('0,125');
    expect(formatDecimal(3, 2)).toBe('3');
    expect(formatDecimal(Number.NaN)).toBe('0');
    expect(formatPercent(25)).toBe('25%');
    expect(formatPercent(12.5)).toBe('12,5%');
  });
});

describe('formatDuration', () => {
  it('escolhe a unidade', () => {
    expect(formatDuration(30)).toBe('30 s');
    expect(formatDuration(600)).toBe('10 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(8 * 3600 + 12 * 60 + 5)).toBe('8 h 12 min');
    expect(formatDuration(-4)).toBe('0 s');
    expect(formatDuration(Number.NaN)).toBe('0 s');
  });
});
