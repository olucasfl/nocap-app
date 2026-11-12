import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { GP_DT, GP_QUALI_MAX_SEC, GP_REAL_VMAX, gpKmh, gpRealLatMax } from './constants';
import { gpBotInput, gpBotProfile, newGpBotMemory } from './bots';
import { GP_TRACK_MARINA } from './track';
import { GpWorld, type GpCar, type GpInput } from './world';

/** Spec 081, Fase 4: o Realista com física de F1 (curva limitada pelo pneu, freada que se sente, câmbio de verdade). */
const info = (n: number, bot = false) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: 0xff7d26, bot }));

function put(w: GpWorld, c: GpCar, s: number, speed: number) {
  const p = w.track.pointAt(s, 0);
  Object.assign(c, { x: p.x, z: p.z, h: p.h, speed, vx: Math.sin(p.h) * speed, vz: -Math.cos(p.h) * speed });
  const pr = w.track.projectGlobal(c.x, c.z);
  Object.assign(c, { idx: pr.i, s: pr.s, d: pr.d, prog: s, surface: w.track.surface(pr), spin: 0 });
  c.lastValid = { x: c.x, z: c.z, h: c.h, prog: c.prog, idx: c.idx };
}

/** A reta de largada da Marina (a zona de DRS mais longa). */
function straight() {
  const w = new GpWorld('r', info(1), GP_TRACK_MARINA, 'real');
  w.beginRace(['p0']);
  const z = [...w.track.drsZones].sort((a, b) => b.to - b.from - (a.to - a.from))[0]!;
  return { w, c: w.cars[0]!, from: z.from - 40 };
}

/** Raio da curva que o carro faz com o volante todo virado, mantendo a velocidade (no asfalto). */
function turnRadius(v: number) {
  const { w, c, from } = straight();
  put(w, c, from, v);
  c.rSteer = 1;
  c.rThr = 0.6;
  const h0 = c.h;
  const n = Math.round(0.25 / GP_DT);
  let lost = 0;
  for (let k = 0; k < n; k++) {
    const before = c.speed;
    w.step(GP_DT, { p0: { throttle: 0.6, brake: 0, steer: 1 } });
    lost += Math.max(0, before - c.speed);
  }
  const yaw = Math.abs(c.h - h0) / (n * GP_DT);
  return { r: v / yaw, lost };
}

describe('Realista de F1 (spec 081, Fase 4)', () => {
  it('a aderência dá as velocidades-alvo de cada curva', () => {
    const vMax = (r: number) => {
      let v = 1;
      while (gpRealLatMax(v + 0.05) >= ((v + 0.05) * (v + 0.05)) / r) v += 0.05;
      return v;
    };
    expect(vMax(15)).toBeGreaterThan(10.5);
    expect(vMax(15)).toBeLessThan(12.5);
    expect(vMax(25)).toBeGreaterThan(14);
    expect(vMax(25)).toBeLessThan(16.5);
    expect(vMax(60)).toBeGreaterThan(22.5);
    expect(vMax(60)).toBeLessThan(26);
    expect(vMax(130)).toBeGreaterThan(33);
  });

  it('uma curva de raio ~25 m não passa a 25 m/s (abre e perde velocidade) e passa a 15 m/s', () => {
    const fast = turnRadius(25);
    expect(fast.r).toBeGreaterThan(40);
    expect(fast.lost).toBeGreaterThan(0.3);
    const slow = turnRadius(15);
    expect(slow.r).toBeLessThan(25.5);
  });

  it('freada cheia de 40 a 12 m/s: no máximo 4,2 s e ~85 m; de 25 a 12 em até 35 m', () => {
    const brake = (v0: number) => {
      const { w, c, from } = straight();
      put(w, c, from, v0);
      c.gear = 8;
      const p0 = c.prog;
      let t = 0;
      while (c.speed > 12 && t < 10) {
        w.step(GP_DT, { p0: { throttle: 0, brake: 1, steer: 0 } });
        t += GP_DT;
      }
      return { t, d: c.prog - p0 };
    };
    const hi = brake(40);
    expect(hi.t).toBeLessThanOrEqual(4.2);
    expect(hi.d).toBeGreaterThan(65);
    expect(hi.d).toBeLessThan(100);
    expect(brake(25).d).toBeLessThanOrEqual(35);
  });

  it('acelera com marchas: 0→15 m/s em até 2,4 s, 15→30 em até 4 s; a troca aparece no giro; máxima ~40 m/s', () => {
    const { w, c, from } = straight();
    put(w, c, from + 40, 0);
    let t = 0;
    let t15: number | null = null;
    let t30: number | null = null;
    let drops = 0;
    let lastRpm = 0;
    let maxGear = 1;
    const gas: GpInput = { throttle: 1, brake: 0, steer: 0 };
    while (t < 6 && t30 === null) {
      w.step(GP_DT, { p0: gas });
      t += GP_DT;
      if (c.rpm < lastRpm - 0.15) drops += 1;
      lastRpm = c.rpm;
      maxGear = Math.max(maxGear, c.gear);
      if (t15 === null && c.speed >= 15) t15 = t;
      if (t30 === null && c.speed >= 30) t30 = t;
    }
    expect(t15).not.toBeNull();
    expect(t30).not.toBeNull();
    expect(t15!).toBeLessThanOrEqual(2.4);
    expect(t30! - t15!).toBeLessThanOrEqual(4);
    // trocou de marcha várias vezes e o giro caiu em cada troca
    expect(maxGear).toBeGreaterThanOrEqual(5);
    expect(drops).toBeGreaterThanOrEqual(4);
    // na tela, a máxima é ~340 km/h
    expect(gpKmh(GP_REAL_VMAX)).toBeGreaterThan(330);
    expect(gpKmh(GP_REAL_VMAX)).toBeLessThan(350);
  });

  it('volta de bot na Marina entre 60 e 80 s', () => {
    const seed = 'v3-real';
    const w = new GpWorld(seed, info(6, true), GP_TRACK_MARINA, 'real');
    const rng = createRng(`${seed}:bots`);
    const mem = new Map(w.cars.map((c, i) => [c.id, newGpBotMemory(gpBotProfile(seed, i))]));
    const drive = (sec: number, stop: () => boolean) => {
      for (let k = 0; k < sec / GP_DT && !stop(); k++) {
        const inputs: Record<string, GpInput> = {};
        for (const c of w.cars) inputs[c.id] = gpBotInput(w, c, mem.get(c.id)!, rng);
        w.step(GP_DT, inputs);
      }
    };
    drive(GP_QUALI_MAX_SEC, () => w.qualiDone());
    w.beginRace(w.gridOrder());
    drive(500, () => w.ended);
    const best = w.cars.filter((c) => c.bestLap !== null).map((c) => c.bestLap! / 1000);
    expect(best.length).toBeGreaterThanOrEqual(5);
    for (const b of best) {
      expect(b).toBeGreaterThan(60);
      expect(b).toBeLessThan(80);
    }
  }, 60_000);
});
