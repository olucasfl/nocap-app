import { describe, expect, it } from 'vitest';
import { GP_CAR_LEN, GP_CAR_SIDE_GAP, GP_CAR_WID, GP_HALF_WIDTH } from './constants';
import { GP_TRACK_MARINA } from './track';
import { GpWorld, gpGridSpot, type GpCar } from './world';

/** Spec 081, Fase 3: carros ~2× maiores; na pista de 14 m cabem 3 lado a lado e 4 não. */
const info = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: 0xff7d26 }));
const touching = (w: GpWorld) =>
  (w as unknown as { testCarObb(a: GpCar, b: GpCar): unknown }).testCarObb.bind(w);

/** Uma reta da Marina (a de largada). */
const S = -200;

describe('tamanho dos carros (spec 081, Fase 3)', () => {
  it('a caixa do carro tem ~3,6 × 6,5 m', () => {
    expect(GP_CAR_WID).toBeCloseTo(3.6, 1);
    expect(GP_CAR_LEN).toBeCloseTo(6.5, 1);
  });

  it('3 carros lado a lado cabem no asfalto, sem encostar um no outro', () => {
    const w = new GpWorld('s', info(3), GP_TRACK_MARINA);
    const step = GP_CAR_WID + GP_CAR_SIDE_GAP;
    const ds = [-step, 0, step];
    w.cars.forEach((c, i) => Object.assign(c, w.track.pointAt(S, ds[i]!)));
    // o carro inteiro no asfalto (a borda de fora não passa da borda da pista)
    for (const d of ds) expect(Math.abs(d) + GP_CAR_WID / 2).toBeLessThanOrEqual(GP_HALF_WIDTH);
    const hit = touching(w);
    expect(hit(w.cars[0]!, w.cars[1]!)).toBeNull();
    expect(hit(w.cars[1]!, w.cars[2]!)).toBeNull();
  });

  it('4 não cabem: espalhados de borda a borda, eles se encostam', () => {
    const w = new GpWorld('s', info(4), GP_TRACK_MARINA);
    const outer = GP_HALF_WIDTH - GP_CAR_WID / 2;
    const ds = [-outer, -outer / 3, outer / 3, outer];
    w.cars.forEach((c, i) => Object.assign(c, w.track.pointAt(S, ds[i]!)));
    expect(touching(w)(w.cars[0]!, w.cars[1]!)).not.toBeNull();
  });

  it('o grid de 12 tem os carros inteiros no asfalto e sem encostar', () => {
    const w = new GpWorld('g', info(12), GP_TRACK_MARINA);
    w.beginRace(w.cars.map((c) => c.id));
    for (let i = 0; i < 12; i++) {
      const sp = gpGridSpot(w.track, i);
      expect(Math.abs(sp.d) + GP_CAR_WID / 2).toBeLessThanOrEqual(GP_HALF_WIDTH);
    }
    const hit = touching(w);
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) expect(hit(w.cars[i]!, w.cars[j]!)).toBeNull();
  });
});
