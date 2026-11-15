import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { golfHit, golfNewBall, golfStep, GolfLevel, GOLF_DT, type GolfBall, type GolfLevelData } from './physics';

/**
 * Robô que joga (spec 082): procura uma sequência de tacadas que encaçapa, para provar que cada fase nova tem solução.
 * Busca melhor-primeiro: de cada ponto de parada tenta ângulos x forças e segue pelos que ficaram mais perto do buraco.
 */
const DIR = process.env.GOLF_DIR; // pasta alternativa (fases ainda fora da campanha)
const load = (n: number) => new GolfLevel(JSON.parse(readFileSync(DIR ? `${DIR}/level-${n}.json` : new URL(`./levels/level-${n}.json`, import.meta.url), 'utf8')) as GolfLevelData);

function run(lv: GolfLevel, from: [number, number, number], angle: number, power: number, t0: number) {
  const b: GolfBall = golfNewBall(lv.data);
  b.pos = [...from];
  golfHit(b, [Math.cos(angle), Math.sin(angle)], power);
  let t = t0;
  for (let i = 0; i < 9 / GOLF_DT; i++) {
    golfStep(lv, b, t);
    t += GOLF_DT;
    if (b.holed) return { holed: true, pos: b.pos };
    if (b.outOfBounds || b.inWater) return { holed: false, pos: null };
    if (!b.moving && i > 30) return { holed: false, pos: [...b.pos] as [number, number, number] };
  }
  return { holed: false, pos: null };
}

const FINE = !!process.env.GOLF_FINE;
const ANG = FINE ? 96 : 48;
const POWERS = FINE ? [0.12, 0.2, 0.28, 0.36, 0.44, 0.5, 0.56, 0.62, 0.7, 0.8, 0.9, 1] : [0.1, 0.18, 0.28, 0.4, 0.5, 0.58, 0.62, 0.66, 0.7, 0.8, 0.9, 1];

export function solve(lv: GolfLevel, maxStrokes: number): number | null {
  const h = lv.data.holes[0]!.p;
  const start = golfNewBall(lv.data).pos;
  let frontier: { pos: [number, number, number]; strokes: number }[] = [{ pos: start, strokes: 0 }];
  const seen = new Set<string>();
  for (let depth = 1; depth <= maxStrokes; depth++) {
    const next: { pos: [number, number, number]; d: number }[] = [];
    for (const s of frontier) {
      for (let a = 0; a < ANG; a++) {
        const ang = (a / ANG) * Math.PI * 2;
        for (const p of POWERS) {
          // as peças móveis mudam com o tempo: testa duas fases do relógio
          for (const t0 of [0, 1.7]) {
            const r = run(lv, s.pos, ang, p, t0);
            if (r.holed) return depth;
            if (r.pos) {
              const key = `${Math.round(r.pos[0] / 0.5)},${Math.round(r.pos[2] / 0.5)}`;
              if (!seen.has(key)) {
                seen.add(key);
                next.push({ pos: r.pos, d: Math.hypot(r.pos[0] - h[0], r.pos[2] - h[2]) });
              }
            }
          }
        }
      }
    }
    next.sort((x, y) => x.d - y.d);
    frontier = next.slice(0, 8).map((n) => ({ pos: n.pos, strokes: depth }));
  }
  return null;
}

const ONLY = (process.env.GOLF_ONLY ?? '').split(',').filter(Boolean).map(Number);
const ALL: [number, number][] = Array.from({ length: 21 }, (_, i) => [i + 1, 8] as [number, number]);
const NEW_LEVELS = DIR && ONLY.length ? ONLY.map((n) => [n, 8] as [number, number]) : ONLY.length ? ALL.filter(([n]) => ONLY.includes(n)) : ALL;

describe('Mini Golf: as fases novas têm solução', () => {
  for (const [n, limit] of NEW_LEVELS) {
    it(`fase ${n} se resolve em até ${limit} tacadas`, () => {
      const best = solve(load(n), limit);
      console.log(`fase ${n}: melhor ${best}`);
      expect(best).not.toBeNull();
    }, 600_000);
  }
});
