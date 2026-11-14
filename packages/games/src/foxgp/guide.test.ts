import { describe, expect, it } from 'vitest';
import { GP_HALF_WIDTH, GP_REAL_VMAX } from './constants';
import { GP_GUIDE_GREEN, GP_GUIDE_RED, GP_GUIDE_YELLOW, gpGuide } from './guide';
import { GP_TRACK_INTERLAGOS, GP_TRACK_MARINA, gpTrack } from './track';

describe('linha de guia do Realista (14/11/2026)', () => {
  for (const def of [GP_TRACK_MARINA, GP_TRACK_INTERLAGOS]) {
    it(`${def.name}: tem verde, amarelo e vermelho, e a rota fica no asfalto`, () => {
      const g = gpGuide(gpTrack(def));
      const count = [0, 0, 0];
      for (const k of g.kind) count[k]!++;
      expect(count[GP_GUIDE_GREEN]).toBeGreaterThan(g.kind.length * 0.15);
      expect(count[GP_GUIDE_YELLOW]).toBeGreaterThan(g.kind.length * 0.03);
      expect(count[GP_GUIDE_RED]).toBeGreaterThan(g.kind.length * 0.03);
      for (const l of g.lat) expect(Math.abs(l)).toBeLessThan(GP_HALF_WIDTH - 1);
      for (const v of g.speed) {
        expect(v).toBeGreaterThan(3);
        expect(v).toBeLessThanOrEqual(GP_REAL_VMAX);
      }
    });
  }
  it('a frenagem é possível: a velocidade ideal nunca cai mais rápido do que o freio', () => {
    const g = gpGuide(gpTrack(GP_TRACK_MARINA));
    for (let i = 0; i < g.speed.length; i++) {
      const a = g.speed[i]!;
      const b = g.speed[(i + 1) % g.speed.length]!;
      expect((a * a - b * b) / (2 * g.step)).toBeLessThan(26);
    }
  });
});
