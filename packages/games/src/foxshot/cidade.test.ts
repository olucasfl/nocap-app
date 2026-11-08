import { describe, expect, it } from 'vitest';
import { FsNetSim, FS_NET_HZ } from './netsim';
import { fsMapCidade } from './maps';
import { fsNewMover, fsStepMover } from './movement';

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

  it('um jogador de verdade consegue andar (com a física do jogo) das bases até as bombas seguindo o caminho', () => {
    const mark = (id: string) => map.marks.find((m) => m.id === id)!;
    for (const [from, to] of [['T', 'A'], ['T', 'B'], ['CT', 'A'], ['CT', 'B']] as const) {
      const a = mark(from);
      const b = mark(to);
      const m = fsNewMover(a.x, a.z);
      m.y = map.floorY(a.x, a.z);
      const wps = map.path(a.x, a.z, b.x, b.z);
      let wi = 0;
      let t = 0;
      let stuck = 0;
      let lx = m.x;
      let lz = m.z;
      for (; t < 60 * 120 && wi < wps.length; t++) {
        const [wx, wz] = wps[wi]!;
        if (Math.hypot(wx - m.x, wz - m.z) < 0.5) {
          wi++;
          continue;
        }
        const yaw = (Math.atan2(-(wx - m.x), -(wz - m.z)) * 180) / Math.PI;
        // pula se travar (caixa, degrau alto)
        const jump = stuck > 20;
        fsStepMover(m, { fwd: 1, strafe: 0, jump, yaw, speedMul: 1, crouch: jump && !m.onGround }, 1 / 60, map.solids);
        if (t % 30 === 0) {
          stuck = Math.hypot(m.x - lx, m.z - lz) < 0.3 ? stuck + 30 : 0;
          lx = m.x;
          lz = m.z;
        }
      }
      expect(wi, `${from} -> ${to} (parou em ${m.x.toFixed(1)}, ${m.z.toFixed(1)})`).toBe(wps.length);
    }
  }, 60_000);
});
