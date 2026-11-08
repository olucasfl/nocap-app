import { describe, expect, it } from 'vitest';
import { FsNetSim, FS_NET_HZ } from './netsim';
import { fsMapDuna, fsPreloadMap } from './maps';
import { fsBoxesInRect } from './map';
import { fsBodyHeight, fsNewMover, fsStepMover } from './movement';

describe('mapa Duna', async () => {
  await fsPreloadMap('duna');
  const map = fsMapDuna();
  it('tem as duas bases, as duas bombas e nascimentos em chão andável', () => {
    expect(map.marks.map((m) => m.id).sort()).toEqual(['A', 'B', 'CT', 'T']);
    expect(map.spawns.filter((s) => s.zone === 'TR').length).toBeGreaterThan(8);
    expect(map.spawns.filter((s) => s.zone === 'open').length).toBeGreaterThan(60);
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
  it('bots jogam rounds na Duna (andam, plantam ou o round acaba)', () => {
    const sim = new FsNetSim({ minutes: 5, humans: [], bots: 10, botTeams: [5, 5], map: 'duna', bomb: { winRounds: 3, roundSec: 100, buySec: 5 } });
    const start = [...sim.players.values()].map((p) => ({ x: p.mover.x, z: p.mover.z }));
    let planted = false;
    for (let i = 0; i < FS_NET_HZ * 60 * 2 && !sim.over; i++) {
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

  it('andando e pulando sem rumo nunca entra em parede (física de corpo sólido)', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const sp = map.spawns;
    const bad: string[] = [];
    for (let run = 0; run < 24; run++) {
      const s0 = sp[Math.floor(rnd() * sp.length)]!;
      const m = fsNewMover(s0.x, s0.z);
      m.y = map.floorY(s0.x, s0.z);
      let yaw = rnd() * 360;
      for (let t = 0; t < 60 * 25; t++) {
        if (t % 40 === 0) yaw += (rnd() - 0.5) * 140;
        fsStepMover(m, { fwd: 1, strafe: rnd() < 0.2 ? 1 : 0, jump: rnd() < 0.03, yaw, speedMul: 1, crouch: rnd() < 0.05 }, 1 / 60, map.solids);
        const inside = fsBoxesInRect(map.solids, m.x - 0.5, m.z - 0.5, m.x + 0.5, m.z + 0.5).some((b) => m.x + 0.29 > b.min[0] && m.x - 0.29 < b.max[0] && m.z + 0.29 > b.min[2] && m.z - 0.29 < b.max[2] && m.y + fsBodyHeight(m) - 0.03 > b.min[1] && m.y + 0.02 < b.max[1]);
        if (inside) { bad.push(`run ${run} t ${t}: dentro de parede em ${m.x.toFixed(2)},${m.y.toFixed(2)},${m.z.toFixed(2)}`); break; }
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);

  it('todo nascimento fica de pé no chão e continua lá (ninguém cai do mapa nem fica enterrado)', () => {
    const bad: string[] = [];
    for (const sp of map.spawns) {
      const m = fsNewMover(sp.x, sp.z);
      m.y = sp.y;
      for (let t = 0; t < 60 * 8; t++) fsStepMover(m, { fwd: 0, strafe: 0, jump: false, yaw: 0, speedMul: 1, crouch: false }, 1 / 60, map.solids);
      if (Math.abs(m.y - sp.y) > 0.4) bad.push(`${sp.zone} ${sp.x.toFixed(1)},${sp.z.toFixed(1)} y ${sp.y.toFixed(2)} -> ${m.y.toFixed(2)}`);
    }
    expect(bad).toEqual([]);
  }, 120_000);

  it('previsão do cliente: refazer as entradas a partir do estado arredondado da rede quase nunca desvia (nada de teletransporte)', () => {
    const r4 = (n: number) => Math.round(n * 10000) / 10000;
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const errs: number[] = [];
    for (let run = 0; run < 12; run++) {
      const s0 = map.spawns[Math.floor(rnd() * map.spawns.length)]!;
      const srv = fsNewMover(s0.x, s0.z);
      srv.y = s0.y;
      const hist: { x: number; y: number; z: number; vx: number; vy: number; vz: number; onGround: boolean; crouchK: number }[] = [];
      const inputs: { fwd: number; strafe: number; jump: boolean; yaw: number }[] = [];
      let yaw = rnd() * 360;
      const step = (m: typeof srv, i: { fwd: number; strafe: number; jump: boolean; yaw: number }) => {
        for (let k = 0; k < 2; k++) fsStepMover(m, { ...i, jump: i.jump && k === 0, speedMul: 1, crouch: false }, 1 / 120, map.solids, [], map.ladders);
      };
      for (let t = 0; t < 60 * 15; t++) {
        if (t % 40 === 0) yaw += (rnd() - 0.5) * 140;
        const inp = { fwd: 1, strafe: rnd() < 0.2 ? 1 : 0, jump: rnd() < 0.03, yaw };
        step(srv, inp);
        hist.push({ ...srv });
        inputs.push(inp);
        if (t < 6) continue;
        const b = hist[t - 6]!;
        const m = { x: r4(b.x), y: r4(b.y), z: r4(b.z), vx: r4(b.vx), vy: r4(b.vy), vz: r4(b.vz), onGround: b.onGround, crouchK: b.crouchK };
        for (let k = t - 5; k <= t; k++) step(m, inputs[k]!);
        errs.push(Math.hypot(m.x - srv.x, m.y - srv.y, m.z - srv.z));
      }
    }
    errs.sort((a, b) => a - b);
    expect(errs[Math.floor(errs.length * 0.99)]!).toBeLessThan(0.05);
    expect(errs.filter((e) => e > 0.15).length / errs.length).toBeLessThan(0.005);
    expect(errs[errs.length - 1]!).toBeLessThan(3);
  }, 60_000);

  it('mata-mata: os nascimentos se espalham pelo mapa (não ficam amontoados nas bases)', () => {
    const sim = new FsNetSim({ minutes: 10, humans: [], bots: 10, map: 'duna' });
    const spawns: { x: number; z: number }[] = [];
    for (const p of sim.players.values()) spawns.push({ x: p.mover.x, z: p.mover.z });
    for (let i = 0; i < FS_NET_HZ * 60 * 3 && !sim.over; i++) {
      sim.step();
      for (const e of sim.drainEvents()) if (e.k === 'spawn') spawns.push({ x: e.x, z: e.z });
    }
    expect(spawns.length).toBeGreaterThan(40);
    const cells = new Set(spawns.map((s) => `${Math.floor(s.x / 12)},${Math.floor(s.z / 12)}`));
    expect(cells.size).toBeGreaterThanOrEqual(18);
    // nenhum pedaço de 12 x 12 m recebe mais de 12% dos nascimentos
    const count = new Map<string, number>();
    for (const s of spawns) count.set(`${Math.floor(s.x / 12)},${Math.floor(s.z / 12)}`, (count.get(`${Math.floor(s.x / 12)},${Math.floor(s.z / 12)}`) ?? 0) + 1);
    expect(Math.max(...count.values()) / spawns.length).toBeLessThan(0.12);
  }, 120_000);
});
