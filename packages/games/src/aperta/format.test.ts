import { describe, expect, it } from 'vitest';
import { MAX_NUMBER as MAX } from './economy';
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

describe('formatNumber: números grandes sem teto (spec 040)', () => {
  it('mi, bi e tri até 999 tri, depois científica', () => {
    expect(formatNumber(2e6)).toBe('2 mi');
    expect(formatNumber(9.6e12)).toBe('9,6 tri');
    expect(formatNumber(999e12)).toBe('999 tri');
    expect(formatNumber(1e15)).toBe('1e15');
    expect(formatNumber(2.5e47)).toBe('2,5e47');
  });

  it('toda potência de 10 até o guarda de 1e300 vira texto curto, sem NaN nem undefined', () => {
    for (let e = 0; e <= 300; e++) {
      const text = formatNumber(Math.pow(10, e));
      expect(text, `1e${e}`).not.toMatch(/NaN|undefined|Infinity/);
      expect(text.length, `1e${e}: ${text}`).toBeLessThanOrEqual(9);
    }
    expect(formatNumber(1e299)).toBe('1e299');
    expect(formatNumber(9.99e299)).toBe('9,99e299');
    expect(formatNumber(MAX)).toBe('1e300');
  });

  it('acima do guarda ou infinito mostra 1e300 e negativo ganha sinal', () => {
    expect(formatNumber(1e301)).toBe('1e301');
    expect(formatNumber(Infinity)).toBe('1e300');
    expect(formatNumber(-Infinity)).toBe('-1e300');
    expect(formatNumber(-3.2e30)).toBe('-3,2e30');
  });

  it('cresce com o número: nunca mostra um texto "menor" para um valor maior na mesma escala', () => {
    const scale = (text: string) => (text.includes('e') ? 1000 + Number(text.split('e')[1]) : text.endsWith(' tri') ? 12 : text.endsWith(' bi') ? 9 : text.endsWith(' mi') ? 6 : text.endsWith(' mil') ? 3 : 0);
    let prev = -1;
    for (let e = 0; e <= 300; e += 1) {
      const s = scale(formatNumber(Math.pow(10, e) * 1.5));
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
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
