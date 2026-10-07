import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit';

function setup() {
  let t = 1_000;
  const clock = { advance: (ms: number) => (t += ms) };
  return { limiter: new RateLimiter(() => t), clock };
}

describe('RateLimiter', () => {
  it('deixa passar até o limite e barra a seguinte, dizendo quanto esperar', () => {
    const { limiter, clock } = setup();
    for (let i = 0; i < 3; i++) expect(limiter.hit('a', 3, 60_000).ok).toBe(true);
    clock.advance(10_000);
    const blocked = limiter.hit('a', 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(50_000);
  });

  it('a janela anda: depois do prazo volta a liberar', () => {
    const { limiter, clock } = setup();
    for (let i = 0; i < 3; i++) limiter.hit('a', 3, 60_000);
    expect(limiter.hit('a', 3, 60_000).ok).toBe(false);
    clock.advance(60_001);
    expect(limiter.hit('a', 3, 60_000).ok).toBe(true);
  });

  it('cada chave tem o seu contador (pessoas e rotas diferentes não se afetam)', () => {
    const { limiter } = setup();
    for (let i = 0; i < 3; i++) limiter.hit('ana|POST /matches', 3, 60_000);
    expect(limiter.hit('ana|POST /matches', 3, 60_000).ok).toBe(false);
    expect(limiter.hit('bia|POST /matches', 3, 60_000).ok).toBe(true);
    expect(limiter.hit('ana|GET /friends', 3, 60_000).ok).toBe(true);
  });

  it('tentativa barrada não prolonga o bloqueio', () => {
    const { limiter, clock } = setup();
    for (let i = 0; i < 2; i++) limiter.hit('a', 2, 10_000);
    for (let i = 0; i < 5; i++) limiter.hit('a', 2, 10_000); // barradas
    clock.advance(10_001);
    expect(limiter.hit('a', 2, 10_000).ok).toBe(true);
  });
});
