import { describe, expect, it } from 'vitest';
import { bluish, gapText, hexNum, lapClock, raceClock } from './format';

describe('formatos do Fox GP', () => {
  it('tempo de volta com milésimos', () => {
    expect(lapClock(41234)).toBe('0:41.234');
    expect(lapClock(61005)).toBe('1:01.005');
    expect(lapClock(-5)).toBe('0:00.000');
  });

  it('tempo de corrida com décimo', () => {
    expect(raceClock(62300)).toBe('1:02.3');
    expect(raceClock(999)).toBe('0:00.9');
  });

  it('diferença para o líder', () => {
    expect(gapText(1.2345)).toBe('+1.234');
    expect(gapText(12.34)).toBe('+12.3');
    expect(gapText(null)).toBe('—');
  });

  it('cor e regra do boné', () => {
    expect(hexNum('#ff7d26')).toBe(0xff7d26);
    expect(hexNum(undefined)).toBe(0xff7d26);
    expect(bluish(0x4fc3f7)).toBe(true);
    expect(bluish(0xff7d26)).toBe(false);
    expect(bluish(0xf5f5f5)).toBe(false);
  });
});
