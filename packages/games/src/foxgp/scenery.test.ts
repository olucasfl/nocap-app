import { describe, expect, it } from 'vitest';
import { GP_HALF_WIDTH, GP_KERB_W, GP_PIT_HALF } from './constants';
import {
  gpGarageSlots,
  gpStandFootprint,
  gpStandSlots,
  gpTowerSlots,
  gpBoardSlots,
  type GpFootprint,
} from './scenery';
import { GP_TRACK_MARINA, GP_TRACK_TOCA, gpTrack, type GpTrack } from './track';

/** Verificador independente: distância do ponto até a linha central mais perto (todas as amostras, sem atalho). */
function minCenterDist(tr: GpTrack, x: number, z: number) {
  let best = Infinity;
  for (let j = 0; j < tr.n; j++) best = Math.min(best, Math.hypot(x - tr.x[j]!, z - tr.z[j]!));
  return best;
}
function inPitLane(tr: GpTrack, x: number, z: number) {
  const g = tr.projectGlobal(x, z);
  const pc = tr.pitCenter(tr.rel(g.s));
  return pc !== null && Math.abs(g.d - pc) < GP_PIT_HALF;
}
function points(tr: GpTrack, f: GpFootprint) {
  const out: { x: number; z: number }[] = [];
  const lo = Math.min(f.from, f.to);
  const hi = Math.max(f.from, f.to);
  for (let a = 0; a <= 8; a++)
    for (let b = 0; b <= 4; b++) out.push(tr.pointAt(f.s - f.halfLen + (a / 8) * f.halfLen * 2, lo + ((hi - lo) * b) / 4));
  return out;
}
const road = GP_HALF_WIDTH + GP_KERB_W;

describe('cenário fora da pista (spec 081, Fase 13.4)', () => {
  for (const def of [GP_TRACK_MARINA, GP_TRACK_TOCA]) {
    const tr = gpTrack(def);
    it(`${def.name}: nenhuma arquibancada (degraus e telhado) em cima do asfalto, da zebra ou do box`, () => {
      const slots = gpStandSlots(tr);
      if ((def.stands ?? []).length) expect(slots.length).toBeGreaterThan(5);
      for (const sl of slots) {
        const parts = [...Array.from({ length: sl.rows }, (_, r) => r), ...(sl.roof ? [-1] : [])];
        for (const r of parts)
          for (const p of points(tr, gpStandFootprint(sl, r))) {
            expect(minCenterDist(tr, p.x, p.z)).toBeGreaterThan(road);
            expect(inPitLane(tr, p.x, p.z)).toBe(false);
          }
      }
    });

    it(`${def.name}: garagens, torres e placas também fora`, () => {
      for (const g of gpGarageSlots(tr))
        for (const p of points(tr, g)) {
          expect(minCenterDist(tr, p.x, p.z)).toBeGreaterThan(road);
          expect(inPitLane(tr, p.x, p.z)).toBe(false);
        }
      for (const t of [...gpTowerSlots(tr), ...gpBoardSlots(tr)]) {
        const q = tr.pointAt(t.s, t.d);
        expect(minCenterDist(tr, q.x, q.z)).toBeGreaterThan(road);
      }
      expect(gpGarageSlots(tr).length).toBeGreaterThan(2);
    });
  }

  it('a causa do bug: o posicionamento antigo (só pela barreira do próprio trecho) caía no asfalto da Marina', () => {
    const tr = gpTrack(GP_TRACK_MARINA);
    let onRoad = 0;
    for (const st of GP_TRACK_MARINA.stands ?? []) {
      const s0 = tr.cpS[st.from] ?? 0;
      let s1 = tr.cpS[st.to] ?? s0 + 40;
      if (s1 < s0) s1 += tr.length;
      for (let s = s0; s <= s1; s += 12) {
        const wall = Math.min(tr.wallAt(tr.index(s), st.side), tr.limit);
        for (const r of [0, 1, 2, -1])
          for (const p of points(tr, gpStandFootprint({ s, side: st.side, wall }, r)))
            if (minCenterDist(tr, p.x, p.z) <= road) onRoad++;
      }
    }
    expect(onRoad).toBeGreaterThan(0);
  });
});
