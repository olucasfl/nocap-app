import { describe, expect, it } from 'vitest';
import { GOLF_BALL_COLORS, GOLF_BALL_DEFAULT, GOLF_FINISHES, GOLF_TRAILS, parseGolfBall } from './ball';

describe('Mini Golf: a bola', () => {
  it('tem 12 cores, 12 acabamentos e 9 rastros', () => {
    expect(GOLF_BALL_COLORS).toHaveLength(12);
    expect(GOLF_FINISHES).toHaveLength(12);
    expect(GOLF_TRAILS).toHaveLength(9);
  });
  it('lê valores válidos e troca os inválidos pelo padrão, campo a campo', () => {
    expect(parseGolfBall({ color: 0x2f5bff, finish: 'estrela', trail: 'fogo' })).toEqual({ color: 0x2f5bff, finish: 'estrela', trail: 'fogo' });
    expect(parseGolfBall({ color: -1, finish: 'inexistente', trail: 'fogo' })).toEqual({ ...GOLF_BALL_DEFAULT, trail: 'fogo' });
    expect(parseGolfBall({ color: 0x1000000 })).toEqual(GOLF_BALL_DEFAULT);
    expect(parseGolfBall(null)).toEqual(GOLF_BALL_DEFAULT);
    expect(parseGolfBall('x')).toEqual(GOLF_BALL_DEFAULT);
  });
  it('lê a cor secundária só quando vale', () => {
    expect(parseGolfBall({ color: 1, color2: 0xff0000 }).color2).toBe(0xff0000);
    expect(parseGolfBall({ color: 1, color2: -4 }).color2).toBeUndefined();
    expect(parseGolfBall({ color: 1 })).not.toHaveProperty('color2');
  });
});
