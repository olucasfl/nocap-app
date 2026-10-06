import { describe, expect, it } from 'vitest';
import { dailyDate, dailySeed } from './daily';

describe('daily', () => {
  it('usa o fuso de São Paulo (UTC-3), não UTC', () => {
    // 02:30 UTC ainda é o dia anterior em São Paulo
    expect(dailyDate(new Date('2026-03-10T02:30:00Z'))).toBe('2026-03-09');
    expect(dailyDate(new Date('2026-03-10T03:00:00Z'))).toBe('2026-03-10');
  });

  it('monta a seed como <jogo>:<data>', () => {
    expect(dailySeed('color', new Date('2026-03-10T15:00:00Z'))).toBe('color:2026-03-10');
  });
});
