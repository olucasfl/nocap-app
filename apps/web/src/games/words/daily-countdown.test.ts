import { describe, expect, it } from 'vitest';
import { formatCountdown, secondsToBrasiliaMidnight } from './ClassicLanding';

describe('contador do Daily (meia-noite de Brasília)', () => {
  it('00:00 em Brasília (03:00 UTC) começa um dia inteiro', () => {
    expect(secondsToBrasiliaMidnight(Date.parse('2026-11-09T03:00:00Z'))).toBe(86400);
  });
  it('um segundo antes da meia-noite falta 1 segundo', () => {
    expect(secondsToBrasiliaMidnight(Date.parse('2026-11-09T02:59:59Z'))).toBe(1);
  });
  it('20:35:53 em Brasília falta 3h24m07s', () => {
    const s = secondsToBrasiliaMidnight(Date.parse('2026-11-09T23:35:53Z'));
    expect(s).toBe(3 * 3600 + 24 * 60 + 7);
    expect(formatCountdown(s)).toBe('03:24:07');
  });
  it('formata com zeros à esquerda', () => {
    expect(formatCountdown(4 * 3600 + 24 * 60 + 7)).toBe('04:24:07');
    expect(formatCountdown(59)).toBe('00:00:59');
  });
});
