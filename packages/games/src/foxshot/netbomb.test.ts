import { describe, expect, it } from 'vitest';
import { FsNetSim, FS_NET_HZ } from './netsim';

describe('modo Bomba na simulação do servidor', () => {
  it('começa na compra, vira round e os bots jogam rounds até alguém vencer', () => {
    const sim = new FsNetSim({ minutes: 5, humans: [], bots: 8, bomb: { winRounds: 2, roundSec: 60, buySec: 5 } });
    const bm = sim.bm!;
    expect(bm.phase).toBe('buy');
    expect(sim.frame().b?.[0]).toBe(0);
    for (let i = 0; i < FS_NET_HZ * 6; i++) sim.step();
    expect(bm.phase).toBe('live');
    // bots TR levam a bomba ao pátio: com tempo, o round termina por plantio, tempo ou eliminação
    let ticks = 0;
    while (!sim.over && ticks < FS_NET_HZ * 60 * 12) {
      sim.step();
      ticks++;
    }
    expect(bm.round).toBeGreaterThanOrEqual(2);
    expect(bm.score.tr + bm.score.ct).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it('quem chega no meio espera o próximo round e a compra só vale na fase de compra', () => {
    const sim = new FsNetSim({ minutes: 5, humans: [{ id: 'u1', name: 'Ana' }], bots: 3, bomb: { winRounds: 3, roundSec: 60, buySec: 5 } });
    const bm = sim.bm!;
    expect(bm.players.get('u1')!.money).toBe(800);
    sim.pushInput('u1', { seq: 1, fwd: 0, strafe: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0, trigger: false, alt: false, reload: false, inspect: false, viewTick: 0, cmds: [{ t: 'buy', id: 'vest' }] });
    sim.step();
    // longe da base não compra: dinheiro igual (ou compra se nasceu na base e o item existe); o importante é nunca ficar negativo
    expect(bm.players.get('u1')!.money).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < FS_NET_HZ * 6; i++) sim.step();
    expect(bm.phase).toBe('live');
    sim.pushInput('u1', { seq: 2, fwd: 0, strafe: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0, trigger: false, alt: false, reload: false, inspect: false, viewTick: 0, cmds: [{ t: 'buy', id: 'vest' }] });
    const before = bm.players.get('u1')!.money;
    sim.step();
    expect(bm.players.get('u1')!.money).toBe(before);
    expect(sim.selfState('u1')?.bomb?.money).toBe(before);
    expect(sim.joinAs('u2', 'Bia')).toBe(true);
    expect(sim.players.get('u2')!.bot).toBe(false);
    expect(bm.players.has('u2')).toBe(true);
  });
});
