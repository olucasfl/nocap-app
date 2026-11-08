import { describe, expect, it } from 'vitest';
import { FsNetSim, FS_NET_HZ } from './netsim';
import { fsMapCidade } from './maps';

describe('mapa Cidade', () => {
  const map = fsMapCidade();
  it('tem as duas bases, as duas bombas e nascimentos em chão andável', () => {
    expect(map.marks.map((m) => m.id).sort()).toEqual(['A', 'B', 'CT', 'T']);
    expect(map.spawns.filter((s) => s.zone === 'TR').length).toBeGreaterThan(8);
    expect(map.spawns.filter((s) => s.zone === 'CT').length).toBeGreaterThan(8);
    for (const s of map.spawns) expect(map.walkable(map.col(s.x), map.row(s.z))).toBe(true);
    expect(map.solids.length).toBeGreaterThan(100);
  });
  it('dá para ir de cada base a cada bomba', () => {
    const base = (id: string) => map.marks.find((m) => m.id === id)!;
    for (const from of ['T', 'CT']) {
      for (const to of ['A', 'B']) {
        const p = map.path(base(from).x, base(from).z, base(to).x, base(to).z);
        expect(p.length, `${from} -> ${to}`).toBeGreaterThan(0);
        const last = p[p.length - 1]!;
        expect(Math.hypot(last[0] - base(to).x, last[1] - base(to).z)).toBeLessThan(2.5);
      }
    }
  });
  it('bots jogam rounds na Cidade (andam, plantam ou o round acaba)', () => {
    const sim = new FsNetSim({ minutes: 5, humans: [], bots: 10, botTeams: [5, 5], map: 'cidade', bomb: { winRounds: 3, roundSec: 100, buySec: 5 } });
    const start = [...sim.players.values()].map((p) => ({ x: p.mover.x, z: p.mover.z }));
    let planted = false;
    for (let i = 0; i < FS_NET_HZ * 60 * 3 && !sim.over; i++) {
      sim.step();
      if (sim.bm!.phase === 'planted') planted = true;
    }
    const moved = [...sim.players.values()].filter((p, i) => Math.hypot(p.mover.x - start[i]!.x, p.mover.z - start[i]!.z) > 5).length;
    expect(moved).toBeGreaterThanOrEqual(5);
    expect(planted || sim.bm!.round > 1).toBe(true);
  }, 120_000);
});
