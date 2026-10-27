import { describe, expect, it } from 'vitest';
import { BOL_BALL_R, BOL_CEILING, BOL_DT } from './constants';
import { buildField } from './field';
import { BolWorld, type BolInfo } from './world';

const roster: BolInfo[] = [
  { id: 'a', name: 'A', color: 0xffffff, team: 0 },
  { id: 'b', name: 'B', color: 0xffffff, team: 1 },
];

const play = () => {
  const w = new BolWorld(roster, { teams: 2, perTeam: 1 });
  for (let i = 0; i < 300 && w.phase === 'countdown'; i++) w.step(BOL_DT, {});
  return w;
};

const longWall = (w: BolWorld) =>
  w.field.edges.find((e) => e.goal < 0 && e.len > 10) as (typeof w.field.edges)[number];

describe('arena: curva entre a parede e o teto', () => {
  it('o teto desce junto da parede como o chão sobe, e é reto no meio', () => {
    const f = buildField(2, 1);
    const e = f.edges.find((x) => x.goal < 0 && x.len > 10) as (typeof f.edges)[number];
    expect(f.ceilDrop(0, 0)).toBe(0);
    const near = f.ceilDrop(e.mx + e.nx * 0.5, e.mz + e.nz * 0.5);
    expect(near).toBeGreaterThan(0.5);
    expect(near).toBeCloseTo(f.floorAt(e.mx + e.nx * 0.5, e.mz + e.nz * 0.5), 6);
    // sobre a boca do gol há muro, então o teto também curva ali (o chão não)
    const g = f.goals[0]!;
    expect(f.floorAt(g.edge.mx + g.edge.nx * 0.3, g.edge.mz + g.edge.nz * 0.3)).toBe(0);
    expect(f.ceilDrop(g.edge.mx + g.edge.nx * 0.3, g.edge.mz + g.edge.nz * 0.3)).toBeGreaterThan(1);
  });

  it('bola subindo reto na parede curva no teto e volta; nunca passa do teto', () => {
    const w = play();
    const e = longWall(w);
    Object.assign(w.ball, {
      x: e.mx + e.nx * 1.5,
      y: BOL_CEILING - 3,
      z: e.mz + e.nz * 1.5,
      vx: -e.nx * 6,
      vy: 8,
      vz: -e.nz * 6,
    });
    let maxY = 0;
    for (let i = 0; i < 180; i++) {
      w.step(BOL_DT, {});
      maxY = Math.max(maxY, w.ball.y);
      expect(w.ball.y).toBeLessThanOrEqual(BOL_CEILING - BOL_BALL_R + 1e-6);
    }
    expect(maxY).toBeGreaterThan(BOL_CEILING - 2.5);
  });
});

describe('arena: atrito da bola na parede e na rampa', () => {
  it('batida de lado perde a velocidade que corre ao longo da parede', () => {
    const w = play();
    const e = longWall(w);
    const t0 = 8;
    Object.assign(w.ball, {
      x: e.mx + e.nx * 6,
      y: 5,
      z: e.mz + e.nz * 6,
      vx: -e.nx * 10 + e.tx * t0,
      vy: 0,
      vz: -e.nz * 10 + e.tz * t0,
    });
    let before = t0;
    let after = t0;
    for (let i = 0; i < 120; i++) {
      const vtBefore = w.ball.vx * e.tx + w.ball.vz * e.tz;
      const vnBefore = w.ball.vx * e.nx + w.ball.vz * e.nz;
      w.step(BOL_DT, {});
      const vnAfter = w.ball.vx * e.nx + w.ball.vz * e.nz;
      if (vnBefore < -3 && vnAfter > 0) {
        before = vtBefore;
        after = w.ball.vx * e.tx + w.ball.vz * e.tz;
        break;
      }
    }
    expect(Math.abs(after)).toBeLessThan(Math.abs(before) * 0.8);
  });

  it('rolando pela rampa a bola freia: não corre sem atrito até o fim', () => {
    const w = play();
    const e = longWall(w);
    // rente à parede, rolando ao longo dela
    Object.assign(w.ball, {
      x: e.mx + e.nx * 0.5,
      y: BOL_BALL_R + 1,
      z: e.mz + e.nz * 0.5,
      vx: e.tx * 12,
      vy: 0,
      vz: e.tz * 12,
    });
    for (let i = 0; i < 90; i++) w.step(BOL_DT, {});
    expect(Math.hypot(w.ball.vx, w.ball.vz)).toBeLessThan(8);
  });
});
