import { describe, expect, it } from 'vitest';
import { FsLoadout } from './gun';
import { fsBuy } from './shop';
import { FS_GRENADES, FS_GRENADE_IDS, FS_SMOKE, fsGrenadeLaunch, fsGrenadeStep, fsSmoked, fsSmokeRadius, type FsSmoke } from './grenades';
import { fsDmNew, fsDmStep } from './dm';
import { FsNetSim, FS_NET_HZ } from './netsim';

const cloud = (x: number, z: number, t0 = 0): FsSmoke => ({ id: 1, x, y: 0, z, t0, t1: t0 + FS_SMOKE.lifeSec });

describe('granada de fumaça', () => {
  it('só se carrega 1 de cada granada, em qualquer modo', () => {
    for (const k of FS_GRENADE_IDS) expect(FS_GRENADES[k].max).toBe(1);
    const lo = new FsLoadout('ak', 'pistol');
    for (const id of ['flash', 'frag', 'smoke']) {
      expect(fsBuy(lo, id).ok).toBe(true);
      expect(fsBuy(lo, id).ok).toBe(false); // a segunda não entra
    }
    expect(lo.grenades).toEqual({ frag: 1, flash: 1, smoke: 1 });
  });

  it('regras do CS: 3,6 m de raio, cresce em 1 s e dura 18 s', () => {
    const s = cloud(0, 0);
    expect(FS_SMOKE.radius).toBe(3.6);
    expect(FS_SMOKE.lifeSec).toBe(18);
    expect(fsSmokeRadius(s, 0.1)).toBeLessThan(fsSmokeRadius(s, 1.5));
    expect(fsSmokeRadius(s, 5)).toBeGreaterThan(3);
    expect(fsSmokeRadius(s, 18.01)).toBe(0);
  });

  it('tapa a visão (linha que atravessa a nuvem) mas não quem passa ao lado', () => {
    const s = cloud(10, 0, 0);
    expect(fsSmoked([s], [0, 1.6, 0], [20, 1.6, 0], 5)).toBe(true); // pelo meio
    expect(fsSmoked([s], [0, 1.6, 12], [20, 1.6, 12], 5)).toBe(false); // longe
    expect(fsSmoked([s], [0, 1.6, 0], [6, 1.6, 0], 5)).toBe(false); // antes da nuvem
    expect(fsSmoked([s], [0, 1.6, 0], [20, 1.6, 0], 19)).toBe(false); // acabou
  });

  it('estoura quando para de quicar (ou no tempo máximo)', () => {
    const g = fsGrenadeLaunch('smoke', [0, 1.5, 0], [1, 0, 0], 0.3);
    let t = 0;
    let boom = false;
    while (!boom && t < 5) {
      boom = fsGrenadeStep(g, 1 / 120, []);
      t += 1 / 120;
    }
    expect(boom).toBe(true);
    expect(t).toBeLessThanOrEqual(FS_GRENADES.smoke.fuse + 0.05);
  });

  it('bot não enxerga ninguém através da fumaça, mas enxerga sem ela', () => {
    const rng = () => 0.5;
    const mk = () => fsDmNew('b', 0, 0, 90, 'ak', rng, 0, 'pro');
    const foe = { id: 'f', x: -20, y: 0, z: 0, crouch: 0, noisy: false } as never;
    const run = (smokes: FsSmoke[]) => {
      const b = mk();
      b.yaw = 90; // olha para -x
      for (let i = 0; i < 40; i++) fsDmStep(b, { now: 5 + i * 0.05, dt: 0.05, rng, boxes: [], foes: [foe], smokes });
      return b.target;
    };
    expect(run([])).toBe('f');
    expect(run([cloud(-8, 0, 0)])).toBe(null);
  });

  it('na partida: a granada de fumaça vira nuvem no quadro e some depois de 18 s; ninguém é impedido de andar', () => {
    const sim = new FsNetSim({ minutes: 5, humans: [{ id: 'a', name: 'A' }], bots: 0, map: 'pvp' });
    const P = (sim as unknown as { players: Map<string, { loadout: FsLoadout; mover: { x: number; y: number; z: number } }> }).players;
    const a = P.get('a')!;
    (sim as unknown as { throwNade(p: unknown, k: string, o: number[], d: number[], pw: number): void }).throwNade(a, 'smoke', [a.mover.x, a.mover.y + 1.5, a.mover.z], [0, 0, -1], 0.3);
    let seen = false;
    for (let i = 0; i < FS_NET_HZ * 6; i++) {
      sim.step();
      if (sim.frame().sm?.length) seen = true;
    }
    expect(seen).toBe(true);
    for (let i = 0; i < FS_NET_HZ * 20; i++) sim.step();
    expect(sim.frame().sm).toBeUndefined();
  });
});
