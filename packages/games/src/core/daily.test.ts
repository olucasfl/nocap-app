import { describe, expect, it } from 'vitest';
import { dailyDate, dailySeed, dailyStreak } from './daily';

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

describe('dailyStreak', () => {
  const today = '2026-10-10';

  it('sem partidas não há sequência', () => {
    expect(dailyStreak([], today)).toEqual({ current: 0, best: 0 });
  });

  it('conta dias seguidos terminando hoje', () => {
    expect(dailyStreak(['2026-10-08', '2026-10-09', '2026-10-10'], today)).toEqual({
      current: 3,
      best: 3,
    });
  });

  it('continua viva se o último Daily foi ontem', () => {
    expect(dailyStreak(['2026-10-08', '2026-10-09'], today).current).toBe(2);
  });

  it('zera se passou um dia inteiro sem jogar, mas guarda o melhor', () => {
    expect(dailyStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-08'], today)).toEqual({
      current: 0,
      best: 3,
    });
  });

  it('ignora repetidos e ordem, e atravessa virada de mês e de ano', () => {
    expect(
      dailyStreak(['2026-01-01', '2025-12-31', '2026-01-01', '2025-12-30'], '2026-01-02'),
    ).toEqual({ current: 3, best: 3 });
  });
});
