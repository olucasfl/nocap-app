import { describe, expect, it } from 'vitest';
import { formatDiff, formatSeconds, verdictWord } from './format';

describe('formatação do Tempo', () => {
  it('segundos com duas casas e vírgula', () => {
    expect(formatSeconds(8400)).toBe('8,40 s');
    expect(formatSeconds(5600)).toBe('5,60 s');
    expect(formatSeconds(12_345)).toBe('12,35 s');
  });

  it('diferença com sinal (menos tipográfico para parar antes)', () => {
    expect(formatDiff(310)).toBe('+0,31 s');
    expect(formatDiff(-120)).toBe('−0,12 s');
    expect(formatDiff(0)).toBe('±0,00 s');
  });

  it('palavra do carimbo por faixa de nota', () => {
    expect(verdictWord(9.6)).toBe('cravou');
    expect(verdictWord(8.4)).toBe('quase!');
    expect(verdictWord(5.1)).toBe('meh');
    expect(verdictWord(1)).toBe('errou');
  });
});
