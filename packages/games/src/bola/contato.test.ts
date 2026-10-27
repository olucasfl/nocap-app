import { describe, expect, it } from 'vitest';
import { BOL_BALL_MAX, BOL_BALL_R, BOL_DT, BOL_FOX_H, BOL_FLOOR_E, BOL_GRAVITY } from './constants';
import { BolWorld, type BolInfo } from './world';

const roster = (): BolInfo[] => [
  { id: 'a', name: 'A', color: 0xffffff, team: 0 },
  { id: 'b', name: 'B', color: 0xffffff, team: 1 },
];

/** Mundo em jogo, as duas raposas longe do meio e a bola no ar sobre o ponto pedido. */
function arena() {
  const w = new BolWorld(roster(), { teams: 2, perTeam: 1 });
  for (let i = 0; i < 300 && w.phase === 'countdown'; i++) w.step(BOL_DT, {});
  const a = w.player('a')!;
  const b = w.player('b')!;
  Object.assign(b, { x: 0, z: -12, y: 0, vx: 0, vy: 0, vz: 0 });
  Object.assign(a, {
    x: 0,
    z: 0,
    y: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    flipT: 0,
    airJumped: false,
  });
  return { w, a };
}

describe('contato raposa-bola: equilíbrio em cima e peso do chute', () => {
  it('a bola que cai sobre a cabeça da raposa parada fica em cima (não rola para o chão)', () => {
    const { w, a } = arena();
    Object.assign(w.ball, {
      x: a.x + 0.05,
      y: BOL_FOX_H + BOL_BALL_R + 2,
      z: a.z,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    for (let i = 0; i < 180; i++) w.step(BOL_DT, {});
    expect(w.ball.y).toBeGreaterThan(BOL_FOX_H);
    expect(Math.hypot(w.ball.x - a.x, w.ball.z - a.z)).toBeLessThan(0.9);
    // sem tremer: a velocidade vertical de repouso é pequena
    expect(Math.abs(w.ball.vy)).toBeLessThan(0.6);
  });

  it('a raposa que anda devagar leva a bola em cima da cabeça', () => {
    const { w, a } = arena();
    Object.assign(w.ball, { x: a.x, y: BOL_FOX_H + BOL_BALL_R + 0.3, z: a.z, vx: 0, vy: 0, vz: 0 });
    for (let i = 0; i < 60; i++) w.step(BOL_DT, {});
    for (let i = 0; i < 90; i++) w.step(BOL_DT, { a: { mx: 0.2, mz: 0, jump: false } });
    expect(w.ball.y).toBeGreaterThan(BOL_FOX_H);
    expect(Math.hypot(w.ball.x - a.x, w.ball.z - a.z)).toBeLessThan(1.1);
  });

  it('quanto mais rápida a raposa, mais forte o chute (e nunca passa do teto da bola)', () => {
    const hit = (speed: number) => {
      const { w, a } = arena();
      Object.assign(a, { x: -3, z: 0, vx: speed, vz: 0, heading: Math.PI / 2 });
      Object.assign(w.ball, { x: 0, y: BOL_BALL_R, z: 0, vx: 0, vy: 0, vz: 0 });
      let best = 0;
      for (let i = 0; i < 40; i++) {
        w.step(BOL_DT, { a: { mx: speed / 8, mz: 0, jump: false } });
        best = Math.max(best, Math.hypot(w.ball.vx, w.ball.vz));
      }
      return best;
    };
    const slow = hit(3);
    const fast = hit(8);
    expect(fast).toBeGreaterThan(slow * 1.5);
    expect(fast).toBeLessThanOrEqual(BOL_BALL_MAX + 1e-6);
    // proporcional: a bola não sai muito mais rápida que a raposa
    expect(fast).toBeLessThan(8 * 2.2);
  });

  it('a bola quica no chão com restituição do jogo (cai de 5 m e sobe ~ restituição ao quadrado)', () => {
    const { w } = arena();
    Object.assign(w.ball, { x: 10, y: 5, z: 6, vx: 0, vy: 0, vz: 0 });
    let hitFloor = false;
    let peak = 0;
    for (let i = 0; i < 400; i++) {
      const before = w.ball.vy;
      w.step(BOL_DT, {});
      if (!hitFloor && before < 0 && w.ball.vy > 0) hitFloor = true;
      if (hitFloor) peak = Math.max(peak, w.ball.y);
      if (hitFloor && w.ball.vy < 0) break;
    }
    const expected =
      BOL_BALL_R +
      (BOL_FLOOR_E * BOL_FLOOR_E * (2 * BOL_GRAVITY * (5 - BOL_BALL_R))) / (2 * BOL_GRAVITY);
    expect(peak).toBeGreaterThan(expected * 0.8);
    expect(peak).toBeLessThan(expected * 1.2);
  });
});
