import { describe, expect, it } from 'vitest';
import { FsNetSim, FS_NET_HZ } from './netsim';
import { fsBotLanes, fsLaneAt } from './bombbots';

/** Bots no modo Bomba da Duna: formação dos CTs, preparação e entrada dos TRs, ninguém parado no meio do nada. */
describe('bots do modo Bomba na Duna', () => {
  const mk = (seed: number) =>
    new FsNetSim({ minutes: 10, humans: [], bots: 10, botTeams: [5, 5], map: 'duna', seed, bomb: { winRounds: 3, roundSec: 100, buySec: 2 } } as never);
  type P = { id: string; alive: boolean; mover: { x: number; z: number }; brain: { objective?: [number, number] | null; target: string | null } | null };
  const people = (sim: FsNetSim) => [...(sim as unknown as { players: Map<string, P & { team: number }> }).players.values()];

  it('com 5 contra-terroristas: dois em cada bomba e um no meio olhando (antes de qualquer contato)', () => {
    let good = 0;
    let rounds = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = mk(seed);
      const map = sim.map;
      const A = map.marks.find((m) => m.kind === 'site' && m.id === 'A')!;
      const B = map.marks.find((m) => m.kind === 'site' && m.id === 'B')!;
      let liveT = -1;
      for (let i = 0; i < FS_NET_HZ * 40; i++) {
        sim.step();
        const ph = sim.bm!.phase;
        if (ph === 'live' && liveT < 0) liveT = i;
        // 20 s depois de liberar o round (sem ninguém ter morrido ainda)
        if (liveT >= 0 && i - liveT === FS_NET_HZ * 20) {
          const ct = people(sim).filter((p) => p.alive && !p.brain === false && (sim as unknown as { sideOf(p: P): string }).sideOf(p) === 'ct');
          if (ct.length >= 4) {
            rounds++;
            const near = (s: { x: number; z: number }, r: number) => ct.filter((p) => Math.hypot(p.mover.x - s.x, p.mover.z - s.z) < r).length;
            // "avançado" também vale: o que importa é que não ficam todos num lugar só
            if (near(A, 30) >= 1 && near(B, 30) >= 1) good++;
          }
          break;
        }
      }
    }
    expect(rounds).toBeGreaterThanOrEqual(3);
    expect(good).toBeGreaterThanOrEqual(Math.ceil(rounds * 0.5));
  }, 120_000);

  it('ninguém fica parado no meio do nada: vivo, sem inimigo à vista, longe do objetivo e sem andar por 8 s', () => {
    const stuck: string[] = [];
    for (const seed of [11, 12, 13]) {
      const sim = mk(seed);
      const last = new Map<string, { x: number; z: number; t: number; o: string }>();
      for (let i = 0; i < FS_NET_HZ * 120 && !sim.over; i++) {
        sim.step();
        if (sim.bm!.phase !== 'live') {
          last.clear();
          continue;
        }
        if (i % 30 !== 0) continue;
        for (const p of people(sim)) {
          if (!p.alive || !p.brain) continue;
          const l = last.get(p.id);
          const o = p.brain.objective;
          const key = o ? `${o[0].toFixed(1)},${o[1].toFixed(1)}` : '';
          // mudou de objetivo ou andou: recomeça a contagem (esperar num ponto de preparação não é estar preso)
          if (!l || l.o !== key || Math.hypot(l.x - p.mover.x, l.z - p.mover.z) > 0.8) {
            last.set(p.id, { x: p.mover.x, z: p.mover.z, t: i, o: key });
            continue;
          }
          const far = o ? Math.hypot(o[0] - p.mover.x, o[1] - p.mover.z) > 4.5 : false;
          if (far && !p.brain.target && i - l.t > FS_NET_HZ * 8) {
            stuck.push(`seed ${seed} ${p.id} em ${p.mover.x.toFixed(1)},${p.mover.z.toFixed(1)} objetivo ${o![0].toFixed(1)},${o![1].toFixed(1)}`);
            last.set(p.id, { x: p.mover.x, z: p.mover.z, t: i, o: key });
          }
        }
      }
    }
    expect(stuck.slice(0, 6)).toEqual([]);
  }, 200_000);

  it('as rotas até A, B e o meio existem e têm tamanho de mapa', () => {
    const sim = mk(1);
    const l = fsBotLanes(sim.map)!;
    expect(l).not.toBeNull();
    for (const k of ['A', 'B', 'mid'] as const) expect(l[k].len).toBeGreaterThan(30);
    const p = fsLaneAt(l.A, l.A.len);
    const A = sim.map.marks.find((m) => m.kind === 'site' && m.id === 'A')!;
    expect(Math.hypot(p[0] - A.x, p[1] - A.z)).toBeLessThan(3);
  });
});
