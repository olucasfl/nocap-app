import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { golfNewBall, golfStep, GolfLevel, GOLF_DT, type GolfLevelData } from './physics';

const load = (n: number) => new GolfLevel(JSON.parse(readFileSync(new URL(`./levels/level-${n}.json`, import.meta.url), 'utf8')) as GolfLevelData);

describe('Mini Golf: as 40 fases são jogáveis', () => {
  for (let n = 1; n <= 40; n++) {
    it(`fase ${n}: um buraco, geometria válida e a bola parada no início fica no chão`, () => {
      const lv = load(n);
      expect(lv.data.holes).toHaveLength(1);
      expect(lv.data.solid.t.every((v) => Number.isFinite(v))).toBe(true);
      const ball = golfNewBall(lv.data);
      const hole = lv.data.holes[0]!.p;
      // o buraco fica longe do início (nada de largar a bola em cima do copo)
      expect(Math.hypot(hole[0] - ball.pos[0], hole[2] - ball.pos[2])).toBeGreaterThan(5);
      let t = 0;
      for (let i = 0; i < 2 / GOLF_DT; i++) {
        golfStep(lv, ball, t);
        t += GOLF_DT;
      }
      expect(ball.outOfBounds || ball.inWater || ball.holed).toBe(false);
    });
  }
});
