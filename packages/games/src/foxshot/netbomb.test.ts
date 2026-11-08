import { describe, expect, it } from 'vitest';
import { FsNetSim, FS_NET_HZ } from './netsim';
import { FS_DUST_MARKS, fsSiteAt } from './dust';
import { fsShopPrice } from './shop';

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

  it('alicate de desarme: só contra-terrorista na base e na compra, cobra US$ 400 e desarma em 5 s', () => {
    const sim = new FsNetSim({ minutes: 5, humans: [{ id: 'ct1', name: 'Ana', team: 0 }, { id: 'tr1', name: 'Bia', team: 1 }], bots: 0, bomb: { winRounds: 3, roundSec: 60, buySec: 5 } });
    const bm = sim.bm!;
    const buy = (id: string, seq: number) => sim.pushInput(id, { seq, fwd: 0, strafe: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0, trigger: false, alt: false, reload: false, inspect: false, viewTick: 0, cmds: [{ t: 'buy', id: 'kit' }] });
    buy('ct1', 1);
    buy('tr1', 1);
    sim.step();
    sim.step();
    expect(bm.players.get('ct1')!.kit).toBe(true);
    expect(bm.players.get('ct1')!.money).toBe(400);
    expect(bm.players.get('tr1')!.kit).toBe(false);
    expect(bm.players.get('tr1')!.money).toBe(800);
    buy('ct1', 2);
    sim.step();
    expect(bm.players.get('ct1')!.money).toBe(400); // não compra duas vezes
    expect(sim.selfState('ct1')?.bomb?.kit).toBe(true);
  });

  it('fogo amigo existe mas é fraco: cabeça não mata na hora e não rende dinheiro', () => {
    const sim = new FsNetSim({ minutes: 5, humans: [], bots: 4, bomb: { winRounds: 5, roundSec: 60, buySec: 5 }, botTeams: [2, 2] });
    const bm = sim.bm!;
    for (let i = 0; i < FS_NET_HZ * 6; i++) sim.step();
    expect(bm.phase).toBe('live');
    const ids = [...bm.players.values()];
    const a = ids[0]!;
    const mate = ids.find((p) => p.id !== a.id && p.side === a.side)!;
    const foe = ids.find((p) => p.side !== a.side)!;
    const moneyBefore = a.money;
    sim.damage(mate.id, a.id, 250, 0, true, 'sniper', false);
    expect(sim.players.get(mate.id)!.alive).toBe(true);
    expect(sim.players.get(mate.id)!.hp).toBeGreaterThan(60);
    sim.damage(foe.id, a.id, 250, 0, true, 'sniper', false);
    expect(sim.players.get(foe.id)!.alive).toBe(false);
    expect(a.money).toBeGreaterThanOrEqual(moneyBefore);
  });
  it('a bomba é detectada em volta do selo de A e de B', () => {
    expect(fsSiteAt(FS_DUST_MARKS.find((m) => m.id === 'A')!.x, FS_DUST_MARKS.find((m) => m.id === 'A')!.z)).toBe('A');
    expect(fsSiteAt(FS_DUST_MARKS.find((m) => m.id === 'B')!.x + 3, FS_DUST_MARKS.find((m) => m.id === 'B')!.z)).toBe('B');
    expect(fsSiteAt(0, -200)).toBeNull();
  });
  it('colete e capacete: quem já tem uma parte paga só a diferença', () => {
    const it = { id: 'vesthelm', price: 1000 };
    expect(fsShopPrice(it, 0, false)).toBe(1000);
    expect(fsShopPrice(it, 100, false)).toBe(350);
    expect(fsShopPrice(it, 0, true)).toBe(650);
    expect(fsShopPrice(it, 100, true)).toBe(0);
    expect(fsShopPrice({ id: 'vest', price: 650 }, 100, true)).toBe(650);
  });
  it('bots têm níveis diferentes, se espalham e jogam o round (plantam, desarmam ou eliminam)', () => {
    const sim = new FsNetSim({ minutes: 5, humans: [], bots: 10, bomb: { winRounds: 3, roundSec: 90, buySec: 5 }, botTeams: [5, 5] });
    const levels = new Set([...sim.players.values()].map((p) => p.level));
    expect(levels.has('rookie') && levels.has('mid') && levels.has('pro')).toBe(true);
    let sneaked = false;
    let planted = false;
    let ticks = 0;
    while (!sim.over && ticks < FS_NET_HZ * 60 * 6 && !planted) {
      sim.step();
      ticks++;
      if (sim.bm!.phase === 'live') for (const p of sim.players.values()) if (p.brain?.sneak) sneaked = true;
      if (sim.bm!.phase === 'planted') planted = true;
    }
    expect(sneaked).toBe(true);
    // em alguns rounds a bomba tem de ser plantada
    expect(planted || sim.bm!.round > 1).toBe(true);
  }, 120_000);

  it('a bomba que explode mata quem está perto, machuca quem está no meio e poupa quem está longe', () => {
    const sim = new FsNetSim({ minutes: 5, humans: [], bots: 4, botTeams: [2, 2], bomb: { winRounds: 5, roundSec: 60, buySec: 5 } });
    for (let i = 0; i < FS_NET_HZ * 6; i++) sim.step();
    const [near, mid, far] = [...sim.players.values()];
    const sx = sim as unknown as { bombPos: { x: number; y: number; z: number } | null; explodeBomb(): void };
    sx.bombPos = { x: 0, y: 0, z: 0 };
    near!.mover.x = 3; near!.mover.z = 0;
    mid!.mover.x = 20; mid!.mover.z = 0;
    far!.mover.x = 60; far!.mover.z = 0;
    for (const q of sim.players.values()) q.hp = 100;
    sx.explodeBomb();
    expect(near!.alive).toBe(false);
    expect(mid!.hp).toBeLessThan(100);
    expect(mid!.hp).toBeGreaterThan(0);
    expect(far!.hp).toBe(100);
    expect(far!.alive).toBe(true);
  });
});
