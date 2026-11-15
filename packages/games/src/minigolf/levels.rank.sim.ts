import { readFileSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { golfHit, golfNewBall, golfStep, GolfLevel, GOLF_DT, type GolfLevelData } from './physics';
import { solve } from './levels.sim';

/** Mede a dificuldade de cada fase (spec 082): chance de encaçapar de primeira, tacadas do robô e peças móveis. Saída em /tmp/golf-rank.json. */
const load = (n: number) => new GolfLevel(JSON.parse(readFileSync(new URL(`./levels/level-${n}.json`, import.meta.url), 'utf8')) as GolfLevelData);

function aceFraction(lv: GolfLevel) {
  let ok = 0, n = 0;
  const h = lv.data.holes[0]!.p;
  for (let a = 0; a < 72; a++) for (const p of [0.18, 0.3, 0.45, 0.6, 0.8, 1]) for (const t0 of [0, 1.7]) {
    n++;
    const b = golfNewBall(lv.data);
    golfHit(b, [Math.cos((a / 72) * Math.PI * 2), Math.sin((a / 72) * Math.PI * 2)], p);
    let t = t0;
    for (let i = 0; i < 8 / GOLF_DT; i++) {
      golfStep(lv, b, t);
      t += GOLF_DT;
      if (b.holed) { ok++; break; }
      if (b.outOfBounds || b.inWater) break;
      if (!b.moving && i > 30) break;
    }
  }
  void h;
  return ok / n;
}

const out: Record<number, unknown> = {};
describe('ranking de dificuldade', () => {
  const [LO, HI] = (process.env.GOLF_RANGE ?? '1-25').split('-').map(Number) as [number, number];
  for (let n = LO; n <= HI; n++) {
    it(`fase ${n}`, () => {
      const lv = load(n);
      const ace = aceFraction(lv);
      const best = ace > 0 ? 1 : solve(lv, 5);
      const d = lv.data;
      out[n] = { ace: +ace.toFixed(4), best, movers: d.moving.length, tris: d.solid.m.length, water: d.solid.f.filter((f) => f & 2).length };
      console.log(`rank ${n} ${JSON.stringify(out[n])}`);
      writeFileSync(`/tmp/golf-rank-${LO}.json`, JSON.stringify(out));
    }, 900_000);
  }
});
