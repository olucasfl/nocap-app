import { describe, expect, it } from 'vitest';
import { GOLF_BALL_RADIUS, golfNewBall } from './physics';
import { GOLF_ROOM_DEFAULTS, GolfHoleSim, golfBallCollide, golfPickLevels } from './online';
import { GOLF_TIERS } from './rules';
import { golfServerLevel } from './server-levels';

describe('Mini Golf online', () => {
  it('sorteia as fases pela seed, sem repetir e na dificuldade escolhida', () => {
    const a = golfPickLevels('abc', 9, 'mix');
    expect(a).toEqual(golfPickLevels('abc', 9, 'mix'));
    expect(new Set(a).size).toBe(9);
    expect(golfPickLevels('outra', 9, 'mix')).not.toEqual(a);
    const easy = golfPickLevels('abc', 30, 'easy');
    expect([...easy].sort((x, y) => x - y)).toEqual([...GOLF_TIERS.easy].sort((x, y) => x - y));
    expect(golfPickLevels('abc', 30, 'mix')).toHaveLength(30);
  });

  it('duas bolas que se encontram trocam velocidade e se separam', () => {
    const lv = golfServerLevel(1);
    const a = golfNewBall(lv), b = golfNewBall(lv);
    a.pos = [0, 0.12, 0];
    b.pos = [GOLF_BALL_RADIUS * 1.8, 0.12, 0];
    a.vel = [4, 0, 0];
    a.moving = true;
    const f = golfBallCollide(a, b);
    expect(f).toBeGreaterThan(3);
    expect(b.vel[0]).toBeGreaterThan(3);
    expect(a.vel[0]).toBeLessThan(1);
    expect(b.moving).toBe(true);
    expect(Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2])).toBeGreaterThanOrEqual(GOLF_BALL_RADIUS * 2 - 1e-9);
  });

  it('a tacada só vale com a bola parada, e conta tacadas', () => {
    const sim = new GolfHoleSim(golfServerLevel(1), ['a', 'b'], { collide: true, seconds: 60 });
    expect(sim.shoot('a', [0, -1], 0.3)).toBe(true);
    expect(sim.shoot('a', [0, -1], 0.3)).toBe(false); // ainda rolando
    expect(sim.shoot('x', [0, -1], 0.3)).toBe(false); // não está na partida
    expect(sim.shoot('b', [0, 0], 0.3)).toBe(false); // direção nula
    expect(sim.players.get('a')!.strokes).toBe(1);
    expect(sim.events.some((e) => e.type === 'hit' && e.id === 'a')).toBe(true);
  });

  it('a bola para, volta a mirar e o buraco fecha quando o tempo acaba (conta 18)', () => {
    const sim = new GolfHoleSim(golfServerLevel(1), ['a'], { collide: false, seconds: 5 });
    sim.shoot('a', [0, -1], 0.2);
    for (let i = 0; i < 120 * 4; i++) sim.step();
    expect(sim.players.get('a')!.status).toBe('aim');
    for (let i = 0; i < 120 * 2; i++) sim.step();
    expect(sim.players.get('a')!.status).toBe('failed');
    expect(sim.finished).toBe(true);
    expect(sim.counted('a')).toBe(18);
  });

  it('a bola que cai no copo vale o acerto e libera o buraco', () => {
    const data = golfServerLevel(21);
    const sim = new GolfHoleSim(data, ['a'], { collide: false, seconds: 60 });
    const h = data.holes[0]!.p;
    const p = sim.players.get('a')!;
    // põe a bola perto do buraco, rolando devagar para ele
    p.ball.pos = [h[0], h[1] + 0.12, h[2] + 1.0];
    p.start = [...p.ball.pos] as [number, number, number];
    expect(sim.shoot('a', [0, -1], 0.05)).toBe(true);
    for (let i = 0; i < 120 * 12 && !sim.finished; i++) sim.step();
    expect(sim.finished).toBe(true);
    expect(sim.counted('a')).toBeLessThanOrEqual(2);
    expect(GOLF_ROOM_DEFAULTS.holes).toBe(9);
  });
});
