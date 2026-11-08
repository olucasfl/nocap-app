import { describe, expect, it } from 'vitest';
import { FsBombMatch } from './bomb';
import { fsMapPvp } from './maps';
import { fsBodyHeight, fsNewMover, fsStepMover } from './movement';
import { FsNetSim, FS_NET_HZ } from './netsim';

describe('modo PvP: regras', () => {
  const mk = (cfg = {}) => {
    const m = new FsBombMatch({ pvp: true, winRounds: 3, ...cfg });
    for (const id of ['a', 'b']) m.addPlayer(id, 'tr');
    for (const id of ['c', 'd']) m.addPlayer(id, 'ct');
    m.startRound();
    return m;
  };
  it('a compra do primeiro round dura 5 s', () => {
    expect(mk().time).toBe(5);
  });
  it('compra de graça e sem limite; sem bomba', () => {
    const m = mk();
    expect(m.carrier).toBeNull();
    expect(m.buy('a', 5000, true)).toBe(true);
    expect(m.buy('a', 5000, true)).toBe(true);
    expect(m.players.get('a')!.money).toBeGreaterThan(50_000);
    expect(m.buy('a', 5000, false)).toBe(false);
  });
  it('compra a qualquer hora do round, mas só na base e só vivo', () => {
    const m = mk();
    m.step(m.cfg.buySec + 0.1);
    expect(m.phase).toBe('live');
    expect(m.buyOpen).toBe(true);
    expect(m.buy('a', 900, true)).toBe(true);
    expect(m.buy('a', 900, false)).toBe(false);
    m.kill('c', 'a', 'ak');
    expect(m.buy('a', 900, true)).toBe(false);
  });
  it('o round acaba quando um time inteiro cai e o ponto vai para o outro', () => {
    const m = mk();
    m.step(m.cfg.buySec + 0.1);
    expect(m.phase).toBe('live');
    m.kill('c', 'a', 'ak');
    expect(m.phase).toBe('live');
    m.kill('c', 'b', 'ak');
    expect(m.phase).toBe('end');
    expect(m.lastRound).toEqual({ winner: 'ct', reason: 'elim' });
    expect(m.score.ct).toBe(1);
  });
  it('depois do primeiro round a compra é só a contagem de 3 s, e o placar fecha no limite escolhido', () => {
    const m = mk({ winRounds: 2 });
    m.step(m.cfg.buySec + 0.1);
    m.kill('c', 'a', 'ak'); m.kill('c', 'b', 'ak');
    m.nextRound();
    expect(m.phase).toBe('buy');
    expect(m.time).toBe(3);
    m.step(3.1);
    m.kill('c', 'a', 'ak'); m.kill('c', 'b', 'ak');
    expect(m.phase).toBe('over');
    expect(m.winner).toBe('ct');
  });
  it('tempo esgotado: vence quem tem mais vivos; empate, o desempate decide', () => {
    const m = mk({ roundSec: 30 });
    m.step(m.cfg.buySec + 0.1);
    m.kill('a', 'c', 'ak');
    m.step(31);
    expect(m.lastRound).toEqual({ winner: 'tr', reason: 'time' });
    const n = mk({ roundSec: 30 });
    n.tiebreak = () => 'tr';
    n.step(n.cfg.buySec + 0.1);
    n.step(31);
    expect(n.lastRound).toEqual({ winner: 'tr', reason: 'time' });
  });
  it('a faixa do líder é larga: 1 a 30 pontos e round de 30 a 300 s', () => {
    expect(new FsBombMatch({ pvp: true, winRounds: 99, roundSec: 999 }).cfg).toMatchObject({ winRounds: 30, roundSec: 300 });
    expect(new FsBombMatch({ pvp: true, winRounds: 0, roundSec: 1 }).cfg).toMatchObject({ winRounds: 1, roundSec: 30 });
  });
});

describe('modo PvP: mapa e partida', () => {
  const map = fsMapPvp();
  it('tem as duas pontas de nascimento, em chão andável e frente a frente', () => {
    const tr = map.spawns.filter((s) => s.zone === 'TR');
    const ct = map.spawns.filter((s) => s.zone === 'CT');
    expect(tr.length).toBeGreaterThanOrEqual(8);
    expect(ct.length).toBeGreaterThanOrEqual(8);
    expect(map.marks.some((m) => m.kind === 'site')).toBe(false);
    for (const s of map.spawns) expect(map.walkable(map.col(s.x), map.row(s.z)), `${s.zone} ${s.x},${s.z}`).toBe(true);
    const mz = (l: typeof tr) => l.reduce((a, s) => a + s.z, 0) / l.length;
    expect(Math.abs(mz(tr) - mz(ct))).toBeGreaterThan(25);
  });
  it('cada base tem duas saídas, uma de cada lado do muro', () => {
    // as faixas abertas ficam a ~10,5 m do centro, a ~16 m do meio da arena
    for (const [x, z] of [[10.5, -15.9], [-10.5, -15.9], [10.5, 15.9], [-10.5, 15.9]] as const) {
      expect(map.walkable(map.col(x), map.row(z)), `saída em ${x},${z}`).toBe(true);
    }
  });
  it('dá para andar de uma ponta à outra com a física do jogo', () => {
    const a = map.spawns.find((s) => s.zone === 'TR')!;
    const b = map.spawns.find((s) => s.zone === 'CT')!;
    const m = fsNewMover(a.x, a.z);
    m.y = a.y;
    const wps = map.path(a.x, a.z, b.x, b.z);
    let wi = 0, stuck = 0, lx = m.x, lz = m.z;
    for (let t = 0; t < 60 * 120 && wi < wps.length; t++) {
      const [wx, wz] = wps[wi]!;
      if (Math.hypot(wx - m.x, wz - m.z) < 0.6) { wi++; continue; }
      const yaw = (Math.atan2(-(wx - m.x), -(wz - m.z)) * 180) / Math.PI;
      const jump = stuck > 10;
      fsStepMover(m, { fwd: 1, strafe: 0, jump, yaw, speedMul: 1, crouch: jump && !m.onGround }, 1 / 60, map.solids);
      if (t % 20 === 0) { stuck = Math.hypot(m.x - lx, m.z - lz) < 0.2 ? stuck + 20 : 0; lx = m.x; lz = m.z; }
    }
    expect(wi, `parou em ${m.x.toFixed(1)}, ${m.z.toFixed(1)}`).toBe(wps.length);
  }, 60_000);
  it('bots 2 contra 2 jogam rounds até alguém marcar, sem bomba', () => {
    const sim = new FsNetSim({ minutes: 5, humans: [], bots: 4, botTeams: [2, 2], bomb: { pvp: true, winRounds: 3, roundSec: 40, buySec: 5 } });
    expect(sim.map.id).toBe('pvp');
    for (let t = 0; t < FS_NET_HZ * 150; t++) sim.step();
    const bm = sim.bm!;
    expect(bm.score.tr + bm.score.ct).toBeGreaterThan(0);
    expect(bm.carrier).toBeNull();
  }, 120_000);

  it('andando e pulando sem rumo ninguém entra em bloco, e todo nascimento fica de pé no chão', () => {
    let seed = 4242;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const bad: string[] = [];
    for (let run = 0; run < 12; run++) {
      const s0 = map.spawns[Math.floor(rnd() * map.spawns.length)]!;
      const m = fsNewMover(s0.x, s0.z);
      m.y = s0.y;
      let yaw = rnd() * 360;
      for (let t = 0; t < 60 * 20; t++) {
        if (t % 40 === 0) yaw += (rnd() - 0.5) * 140;
        fsStepMover(m, { fwd: 1, strafe: rnd() < 0.2 ? 1 : 0, jump: rnd() < 0.03, yaw, speedMul: 1, crouch: rnd() < 0.05 }, 1 / 60, map.solids);
        const inside = map.solids.some((b) => m.x + 0.29 > b.min[0] && m.x - 0.29 < b.max[0] && m.z + 0.29 > b.min[2] && m.z - 0.29 < b.max[2] && m.y + fsBodyHeight(m) - 0.03 > b.min[1] && m.y + 0.02 < b.max[1]);
        if (inside) { bad.push(`run ${run} t ${t}: dentro de bloco em ${m.x.toFixed(2)},${m.y.toFixed(2)},${m.z.toFixed(2)}`); break; }
      }
    }
    expect(bad).toEqual([]);
    for (const sp of map.spawns) {
      const m = fsNewMover(sp.x, sp.z);
      m.y = sp.y;
      for (let t = 0; t < 60 * 6; t++) fsStepMover(m, { fwd: 0, strafe: 0, jump: false, yaw: 0, speedMul: 1, crouch: false }, 1 / 60, map.solids);
      expect(Math.abs(m.y - sp.y), `${sp.zone} ${sp.x},${sp.z}`).toBeLessThan(0.4);
    }
  }, 120_000);

  it('escada de mão das duas torres: andar para o muro sobe e fica no topo, andar para o lado oposto desce, pular no topo sai da escada', () => {
    expect(map.ladders.length).toBe(2);
    for (const l of map.ladders) {
      const cz = (l.min[2] + l.max[2]) / 2;
      const mv = fsNewMover(l.dir[0] < 0 ? l.min[0] + 0.62 : l.max[0] - 0.62, cz);
      mv.y = l.min[1] + 0.01;
      const yaw = l.dir[0] < 0 ? 90 : 270; // a frente (-sen, -cos) aponta para o muro
      const run = (secs: number, fwd: number, jump = false) => {
        for (let t = 0; t < 60 * secs; t++) fsStepMover(mv, { fwd, strafe: 0, jump: jump && t === 0, yaw, speedMul: 1, crouch: false }, 1 / 60, map.solids, [], map.ladders);
      };
      run(0.6, 1);
      expect(mv.y, 'subindo').toBeGreaterThan(l.min[1] + 1);
      run(6, 1);
      expect(mv.y, 'chegou no topo').toBeGreaterThan(l.max[1] - 0.1);
      run(2, 0);
      expect(mv.y, 'parado segura').toBeGreaterThan(l.max[1] - 0.1);
      run(1, -1);
      expect(mv.y, 'descendo').toBeLessThan(l.max[1] - 1.5);
      run(8, -1);
      expect(mv.y, 'chegou embaixo').toBeLessThan(l.min[1] + 0.1);
      run(0.1, 0, true); // pula no meio da escada (antes jogava o corpo para fora do mapa)
      run(2, 0);
      expect(Math.abs(mv.x), 'meio: não saiu do mapa').toBeLessThan(14);
      expect(Math.abs(mv.z), 'meio: não saiu do mapa').toBeLessThan(22);
      expect(mv.y, 'meio: não caiu do mapa').toBeGreaterThan(-0.1);
      run(6, 1);
      expect(mv.y, 'de novo no topo').toBeGreaterThan(l.max[1] - 0.1);
      run(0.1, 0, true); // pula no topo: sobe na plataforma e sai da escada
      run(2, 0);
      expect(mv.y, 'em cima da torre').toBeGreaterThan(l.max[1] - 0.1);
      expect(mv.onGround, 'de pé').toBe(true);
      expect(Math.abs(mv.x - (l.dir[0] < 0 ? l.min[0] : l.max[0])), 'não saiu do mapa').toBeLessThan(3);
      expect(map.ladders.some((q) => mv.x > q.min[0] && mv.x < q.max[0] && mv.z > q.min[2] && mv.z < q.max[2] && mv.y < q.max[1] - 0.2), 'fora da zona da escada').toBe(false);
    }
  });
});
