import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { bolBotInput, newBolBotMemory } from './bots';
import {
  BOL_BALL_R,
  BOL_GOAL_H,
  BOL_COUNTDOWN,
  BOL_DT,
  BOL_FOX_R,
  BOL_GOAL_PAUSE,
  BOL_STILL_SEC,
} from './constants';
import { buildField } from './field';
import { BolWorld, type BolInfo, type BolInput } from './world';

const mk = (team: number, i: number, bot = false): BolInfo => ({
  id: `t${team}p${i}`,
  name: `T${team}P${i}`,
  color: 0xff7d26,
  team,
  bot,
});
const roster = (teams: number, per: number, bot = false): BolInfo[] =>
  Array.from({ length: teams }, (_, t) =>
    Array.from({ length: per }, (_, i) => mk(t, i, bot)),
  ).flat();
const run = (w: BolWorld, sec: number, inputs: Record<string, BolInput> = {}) => {
  for (let i = 0; i < Math.round(sec / BOL_DT); i++) w.step(BOL_DT, inputs);
};
/** Pula a contagem e deixa a partida em jogo. */
const startPlay = (w: BolWorld) => run(w, BOL_COUNTDOWN + 0.1);

describe('campo', () => {
  for (const teams of [2, 3, 4]) {
    for (const per of [1, 2, 3]) {
      it(`${teams} times, ${per} por time: convexo, um gol por time e saídas longe das paredes`, () => {
        const f = buildField(teams, per);
        expect(f.goals).toHaveLength(teams);
        f.goals.forEach((g, i) => {
          expect(g.team).toBe(i);
          expect(g.halfW * 2).toBeLessThan(g.edge.len);
        });
        for (let t = 0; t < teams; t++) {
          for (let i = 0; i < per; i++) {
            const s = f.spawn(t, i, per);
            expect(f.inside(s.x, s.z, BOL_FOX_R + 0.5)).toBe(true);
          }
        }
        // convexo: todo vértice está dentro das paredes
        for (const e of f.edges) expect(f.inside(e.ax - e.nx * 0, e.az, -1e-6)).toBe(true);
      });
    }
  }
  it('o verde só existe com 4 times', () => {
    expect(buildField(3, 2).goals).toHaveLength(3);
    expect(buildField(4, 2).goals).toHaveLength(4);
  });
  it('as raposas de um time nascem separadas', () => {
    const f = buildField(2, 3);
    const a = f.spawn(0, 0, 3);
    const b = f.spawn(0, 1, 3);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(BOL_FOX_R * 2);
  });
});

describe('partida', () => {
  it('começa com contagem de 3 s, sem relógio, e depois joga', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    expect(w.phase).toBe('countdown');
    run(w, 1);
    expect(w.clock).toBe(0);
    run(w, 2.2);
    expect(w.phase).toBe('play');
    run(w, 2);
    expect(w.clock).toBeGreaterThan(1.5);
  });

  it('na contagem ninguém sai do lugar', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    const p = w.players[0]!;
    const x0 = p.x;
    run(w, 2, { [p.id]: { mx: 1, mz: 0, jump: false } });
    expect(p.x).toBeCloseTo(x0, 5);
  });
});

describe('bola e toque', () => {
  it('sem encostar de verdade não há toque: a 1 cm do contato e parado', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const p = w.players[0]!;
    Object.assign(p, { x: 0, z: 0 });
    Object.assign(w.ball, {
      x: BOL_BALL_R + BOL_FOX_R + 0.01,
      y: BOL_BALL_R,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    run(w, 0.5);
    expect(w.lastTouch).toBeNull();
  });

  it('bola parada encostada numa raposa parada não conta como toque', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const p = w.players[0]!;
    Object.assign(p, { x: 0, z: 0 });
    Object.assign(w.ball, {
      x: BOL_BALL_R + BOL_FOX_R - 0.01,
      y: BOL_BALL_R,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    run(w, 0.5);
    expect(w.lastTouch).toBeNull();
  });

  it('andar na bola é toque real e a bola sai mais rápido que a raposa', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const p = w.players[0]!;
    Object.assign(p, { x: -3, z: 0, heading: Math.PI / 2 });
    Object.assign(w.ball, { x: 0, y: BOL_BALL_R, z: 0, vx: 0, vy: 0, vz: 0 });
    run(w, 1, { [p.id]: { mx: 1, mz: 0, jump: false } });
    expect(w.lastTouch?.id).toBe(p.id);
    expect(w.ball.vx).toBeGreaterThan(5);
  });

  it('a bola em velocidade máxima não atravessa a raposa', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const p = w.players[1]!;
    Object.assign(p, { x: 5, z: 0 });
    Object.assign(w.ball, { x: -5, y: BOL_BALL_R, z: 0, vx: 30, vy: 0, vz: 0 });
    let max = -99;
    for (let i = 0; i < 90; i++) {
      w.step(BOL_DT);
      max = Math.max(max, w.ball.x);
    }
    expect(max).toBeLessThan(5 - BOL_FOX_R);
  });

  it('o mortal chuta a bola na direção do pulo, uma vez só', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const p = w.players[0]!;
    Object.assign(p, { x: -2.2, z: 0 });
    Object.assign(w.ball, { x: 0, y: BOL_BALL_R, z: 0, vx: 0, vy: 0, vz: 0 });
    const dir = { mx: 1, mz: 0 };
    w.step(BOL_DT, { [p.id]: { ...dir, jump: true } });
    for (let i = 0; i < 4; i++) w.step(BOL_DT, { [p.id]: { ...dir, jump: false } });
    w.step(BOL_DT, { [p.id]: { ...dir, jump: true } });
    const kicks: number[] = [];
    let fastest = 0;
    for (let i = 0; i < 40; i++) {
      w.step(BOL_DT, { [p.id]: { ...dir, jump: false } });
      fastest = Math.max(fastest, w.ball.vx);
      for (const e of w.drainEvents())
        if (e.type === 'kick') {
          kicks.push(i);
          expect(w.lastTouch?.id).toBe(p.id);
        }
    }
    expect(kicks).toHaveLength(1);
    expect(fastest).toBeGreaterThan(10);
  });

  it('o pulo duplo sem direção só sobe, sem chutar', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const p = w.players[0]!;
    w.step(BOL_DT, { [p.id]: { mx: 0, mz: 0, jump: true } });
    run(w, 0.1);
    w.step(BOL_DT, { [p.id]: { mx: 0, mz: 0, jump: true } });
    expect(p.flipT).toBe(0);
    expect(p.airJumped).toBe(true);
  });

  it('o mortal sobe forte mesmo na queda e vira a raposa na direção apertada', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const p = w.players[0]!;
    w.step(BOL_DT, { [p.id]: { mx: 0, mz: 0, jump: true } });
    run(w, 0.45);
    expect(p.vy).toBeLessThan(0);
    w.step(BOL_DT, { [p.id]: { mx: 1, mz: 0, jump: true } });
    expect(p.flipT).toBeGreaterThan(0);
    expect(p.vy).toBeGreaterThanOrEqual(6);
    expect(p.vx).toBeGreaterThan(5);
  });

  it('a bola de mentira do cliente reage ao toque da raposa sem mexer na partida', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const p = w.players[0]!;
    w.drainEvents();
    const real = { ...w.ball };
    const g = { x: p.x + 0.9, y: 0.5, z: p.z, vx: 0, vy: 0, vz: 0 };
    p.vx = 8;
    let hit = false;
    for (let i = 0; i < 8; i++) hit = w.ghostBall(g, p, BOL_DT / 4) || hit;
    expect(hit).toBe(true);
    expect(g.vx).toBeGreaterThan(1);
    expect(w.ball).toEqual(real);
    expect(w.drainEvents()).toEqual([]);
    expect(p.stats.touches).toBe(0);
    expect(w.lastTouch).toBeNull();
  });

  it('a bola nunca sai do campo (chutes em todas as direções)', () => {
    for (const teams of [2, 3, 4]) {
      const w = new BolWorld(roster(teams, 1), { teams, perTeam: 1 });
      startPlay(w);
      const rng = createRng(`fuzz${teams}`);
      for (let k = 0; k < 60; k++) {
        const a = rng() * Math.PI * 2;
        const wasPlay = w.phase === 'play';
        if (wasPlay)
          Object.assign(w.ball, { vx: Math.cos(a) * 28, vz: Math.sin(a) * 28, vy: rng() * 8 });
        for (let i = 0; i < 90; i++) {
          w.step(BOL_DT);
          if (w.phase === 'play') {
            expect(
              w.field.inside(w.ball.x, w.ball.z, -0.001) ||
                w.field.goals.some(
                  (g) =>
                    Math.abs(
                      (w.ball.x - g.edge.mx) * g.edge.tx + (w.ball.z - g.edge.mz) * g.edge.tz,
                    ) <= g.halfW,
                ),
            ).toBe(true);
            expect(Number.isFinite(w.ball.x + w.ball.y + w.ball.z)).toBe(true);
          }
        }
        if (w.phase !== 'play') run(w, BOL_GOAL_PAUSE + BOL_COUNTDOWN + 0.2);
      }
    }
  });
});

describe('física da bola', () => {
  it('rolando no chão ela desacelera até parar, sem rolar para sempre', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    Object.assign(w.ball, { x: -5, z: 0, vx: 10, vy: 0, vz: 0 });
    const v = [] as number[];
    for (let i = 0; i < 60 * 12; i++) {
      w.step(BOL_DT);
      if (i % 60 === 59) v.push(Math.hypot(w.ball.vx, w.ball.vz));
    }
    expect(v[1]!).toBeLessThan(v[0]!);
    expect(v[2]!).toBeLessThan(v[1]!);
    expect(v[11]!).toBeLessThan(0.5);
  });

  it('quica cada vez menos até assentar no chão', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    Object.assign(w.ball, { x: 0, y: 8, z: 0, vx: 0, vy: 0, vz: 0 });
    let top = 0;
    let bounces = 0;
    let prev = 0;
    for (let i = 0; i < 60 * 8; i++) {
      w.step(BOL_DT);
      if (w.ball.vy > 0 && prev <= 0) bounces++;
      prev = w.ball.vy;
      if (i > 60 * 6) top = Math.max(top, w.ball.y);
    }
    expect(bounces).toBeGreaterThan(1);
    expect(top).toBeLessThan(BOL_BALL_R + 0.2);
  });

  it('andar na bola a empurra um pouco à frente da raposa, sem disparar', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const p = w.players[0]!;
    Object.assign(p, { x: -3, z: 0 });
    Object.assign(w.ball, { x: 0, y: BOL_BALL_R, z: 0, vx: 0, vy: 0, vz: 0 });
    run(w, 0.8, { [p.id]: { mx: 1, mz: 0, jump: false } });
    expect(w.ball.vx).toBeGreaterThan(7);
    expect(w.ball.vx).toBeLessThan(12);
  });
});

describe('gol', () => {
  const shoot = (w: BolWorld, team: number) => {
    const g = w.field.goals[team]!;
    Object.assign(w.ball, {
      x: g.edge.mx + g.edge.nx * 3,
      y: BOL_BALL_R,
      z: g.edge.mz + g.edge.nz * 3,
      vx: -g.edge.nx * 20,
      vy: 0,
      vz: -g.edge.nz * 20,
    });
  };

  it('vale para o time de quem tocou por último', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    w.lastTouch = { id: 't0p0', team: 0, t: 0 };
    shoot(w, 1);
    run(w, 0.5);
    expect(w.scores).toEqual([1, 0]);
    const goal = w.drainEvents().find((e) => e.type === 'goal');
    expect(goal).toMatchObject({ goalTeam: 1, scorerId: 't0p0', scorerTeam: 0, own: false });
  });

  it('gol contra: o ponto vai para o último time de fora que tocou na bola, nunca para o time que levou o gol', () => {
    const w = new BolWorld(roster(3, 1), { teams: 3, perTeam: 1 });
    startPlay(w);
    w.clock = 10;
    w.lastByTeam[2] = { id: 't2p0', team: 2, t: 8 };
    w.lastTouch = { id: 't0p0', team: 0, t: 9 };
    w.lastByTeam[0] = w.lastTouch;
    shoot(w, 0);
    run(w, 0.5);
    expect(w.scores).toEqual([0, 0, 1]);
    expect(w.drainEvents().find((e) => e.type === 'goal')).toMatchObject({
      goalTeam: 0,
      scorerTeam: 2,
      scorerId: null,
      ownerId: 't0p0',
      own: true,
    });
    expect(w.player('t0p0')!.stats.ownGoals).toBe(1);
  });

  it('gol contra com 2 times e sem toque do outro time: o ponto vai para o outro time', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    w.lastTouch = { id: 't0p0', team: 0, t: 0 };
    w.lastByTeam[0] = w.lastTouch;
    shoot(w, 0);
    run(w, 0.5);
    expect(w.scores).toEqual([0, 1]);
    expect(w.drainEvents().find((e) => e.type === 'goal')).toMatchObject({
      goalTeam: 0,
      scorerTeam: 1,
      ownerId: 't0p0',
      own: true,
    });
  });

  it('gol contra com 3 times e ninguém de fora tocou: sem gol, bola ao centro', () => {
    const w = new BolWorld(roster(3, 1), { teams: 3, perTeam: 1 });
    startPlay(w);
    w.lastTouch = { id: 't0p0', team: 0, t: 0 };
    w.lastByTeam[0] = w.lastTouch;
    shoot(w, 0);
    run(w, 0.3);
    expect(w.scores.every((x) => x === 0)).toBe(true);
    expect(w.drainEvents().find((e) => e.type === 'nogoal')).toMatchObject({ ownerId: 't0p0' });
    expect(w.phase).toBe('countdown');
  });

  it('o último toque de outro time vale gol normal para ele', () => {
    const w = new BolWorld(roster(3, 1), { teams: 3, perTeam: 1 });
    startPlay(w);
    w.lastTouch = { id: 't1p0', team: 1, t: 1 };
    w.lastByTeam[1] = w.lastTouch;
    shoot(w, 0);
    run(w, 0.5);
    expect(w.scores).toEqual([0, 1, 0]);
    expect(w.player('t1p0')!.stats.goals).toBe(1);
  });

  it('sem toque e com 2 times: gol contra do dono do gol, ponto para o outro time', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    shoot(w, 1);
    run(w, 0.5);
    expect(w.scores).toEqual([1, 0]);
    expect(w.drainEvents().find((e) => e.type === 'goal')).toMatchObject({
      goalTeam: 1,
      scorerTeam: 0,
      scorerId: null,
      own: true,
      noTouch: true,
    });
  });

  it('sem toque e com 3 ou 4 times: ninguém pontua e a bola volta ao centro com contagem', () => {
    for (const teams of [3, 4]) {
      const w = new BolWorld(roster(teams, 1), { teams, perTeam: 1 });
      startPlay(w);
      shoot(w, 1);
      run(w, 0.3);
      expect(w.scores.every((s) => s === 0)).toBe(true);
      expect(w.drainEvents().some((e) => e.type === 'nogoal')).toBe(true);
      expect(w.phase).toBe('countdown');
      expect(w.ball.x).toBe(0);
    }
  });

  it('encostar na beirada não é gol: a bola precisa passar inteira da linha', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    w.lastTouch = { id: 't0p0', team: 0, t: 0 };
    const g = w.field.goals[1]!;
    const e = g.edge;
    // centro da bola passou da linha, mas a bola ainda está meio para fora
    Object.assign(w.ball, {
      x: e.mx - e.nx * (BOL_BALL_R * 0.5),
      y: BOL_BALL_R,
      z: e.mz - e.nz * (BOL_BALL_R * 0.5),
      vx: 0,
      vy: 0,
      vz: 0,
    });
    run(w, 0.1);
    expect(w.scores).toEqual([0, 0]);
    // inteira para lá da linha: gol
    Object.assign(w.ball, {
      x: e.mx - e.nx * (BOL_BALL_R * 1.2),
      z: e.mz - e.nz * (BOL_BALL_R * 1.2),
      vx: 0,
      vz: 0,
    });
    run(w, 0.1);
    expect(w.scores).toEqual([1, 0]);
  });

  it('a bola na trave volta para o campo, sem gol', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    w.lastTouch = { id: 't0p0', team: 0, t: 0 };
    const g = w.field.goals[1]!;
    const e = g.edge;
    // mirada na trave: o centro da bola está na linha da trave
    Object.assign(w.ball, {
      x: e.mx + e.nx * 4 + e.tx * g.halfW,
      y: BOL_BALL_R,
      z: e.mz + e.nz * 4 + e.tz * g.halfW,
      vx: -e.nx * 20,
      vy: 0,
      vz: -e.nz * 20,
    });
    run(w, 1);
    expect(w.scores).toEqual([0, 0]);
  });

  it('a bola no travessão volta, sem gol', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    w.lastTouch = { id: 't0p0', team: 0, t: 0 };
    const e = w.field.goals[1]!.edge;
    Object.assign(w.ball, {
      x: e.mx + e.nx * 4,
      y: BOL_GOAL_H,
      z: e.mz + e.nz * 4,
      vx: -e.nx * 20,
      vy: 0,
      vz: -e.nz * 20,
    });
    run(w, 0.5);
    expect(w.scores).toEqual([0, 0]);
  });

  it('acima do travessão a bola quica e não é gol', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    w.lastTouch = { id: 't0p0', team: 0, t: 0 };
    const g = w.field.goals[1]!;
    Object.assign(w.ball, {
      x: g.edge.mx + g.edge.nx * 3,
      y: 5,
      z: g.edge.mz + g.edge.nz * 3,
      vx: -g.edge.nx * 20,
      vy: 0,
      vz: -g.edge.nz * 20,
    });
    run(w, 0.3);
    expect(w.scores).toEqual([0, 0]);
  });

  it('depois do gol: pausa, bola no centro, todos nas posições, contagem de 3 s e jogo', () => {
    const w = new BolWorld(roster(2, 2), { teams: 2, perTeam: 2 });
    startPlay(w);
    w.lastTouch = { id: 't0p0', team: 0, t: 0 };
    shoot(w, 1);
    run(w, 0.4);
    expect(w.phase).toBe('goal');
    Object.assign(w.players[0]!, { x: 3, z: 3 });
    run(w, BOL_GOAL_PAUSE + 0.2);
    expect(w.phase).toBe('countdown');
    expect(w.ball.x).toBe(0);
    expect(w.ball.z).toBe(0);
    const s = w.field.spawn(0, 0, 2);
    expect(w.players[0]!.x).toBeCloseTo(s.x, 3);
    expect(w.lastTouch).toBeNull();
    const clock = w.clock;
    run(w, 1);
    expect(w.clock).toBe(clock);
    run(w, 2.2);
    expect(w.phase).toBe('play');
  });
});

describe('estatísticas', () => {
  const shootInto = (w: BolWorld, team: number) => {
    const g = w.field.goals[team]!;
    Object.assign(w.ball, {
      x: g.edge.mx + g.edge.nx * 3,
      y: BOL_BALL_R,
      z: g.edge.mz + g.edge.nz * 3,
      vx: -g.edge.nx * 20,
      vy: 0,
      vz: -g.edge.nz * 20,
    });
  };

  it('gol conta para quem tocou por último e a assistência vai para o toque anterior do mesmo time', () => {
    const w = new BolWorld(roster(2, 2), { teams: 2, perTeam: 2 });
    startPlay(w);
    w.clock = 20;
    w.prevTouch = { id: 't0p1', team: 0, t: 18 };
    w.lastTouch = { id: 't0p0', team: 0, t: 19 };
    shootInto(w, 1);
    run(w, 0.4);
    expect(w.player('t0p0')!.stats.goals).toBe(1);
    expect(w.player('t0p1')!.stats.assists).toBe(1);
    expect(w.drainEvents().find((e) => e.type === 'goal')).toMatchObject({ assistId: 't0p1' });
  });

  it('sem assistência: toque anterior do outro time, antigo demais ou do próprio autor', () => {
    for (const prev of [
      { id: 't1p0', team: 1, t: 18 },
      { id: 't0p1', team: 0, t: 5 },
      { id: 't0p0', team: 0, t: 18 },
    ]) {
      const w = new BolWorld(roster(2, 2), { teams: 2, perTeam: 2 });
      startPlay(w);
      w.clock = 20;
      w.prevTouch = prev;
      w.lastTouch = { id: 't0p0', team: 0, t: 19 };
      shootInto(w, 1);
      run(w, 0.4);
      expect(w.players.every((p) => p.stats.assists === 0)).toBe(true);
    }
  });

  it('gol contra vai para os gols contra de quem tocou, sem assistência', () => {
    const w = new BolWorld(roster(2, 2), { teams: 2, perTeam: 2 });
    startPlay(w);
    w.clock = 20;
    w.prevTouch = { id: 't0p1', team: 0, t: 18 };
    w.lastTouch = { id: 't0p0', team: 0, t: 19 };
    shootInto(w, 0);
    run(w, 0.4);
    const p = w.player('t0p0')!;
    expect(p.stats.ownGoals).toBe(1);
    expect(p.stats.goals).toBe(0);
    expect(w.player('t0p1')!.stats.assists).toBe(0);
  });

  it('toques seguidos na mesma bola contam uma vez e a posse soma para o time do último toque', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const p = w.players[0]!;
    Object.assign(p, { x: -3, z: 0 });
    Object.assign(w.ball, { x: 0, y: BOL_BALL_R, z: 0, vx: 0, vy: 0, vz: 0 });
    run(w, 1, { [p.id]: { mx: 1, mz: 0, jump: false } });
    expect(p.stats.touches).toBeGreaterThanOrEqual(1);
    expect(p.stats.touches).toBeLessThan(6);
    run(w, 2);
    expect(w.possession[0]!).toBeGreaterThan(0.5);
    expect(w.possession[0]! + w.possession[1]!).toBeGreaterThan(1.5);
  });
});

describe('tempo', () => {
  it('bola parada por 30 s volta ao centro com contagem', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    Object.assign(w.ball, { x: 4, z: 2 });
    run(w, BOL_STILL_SEC + 0.5);
    expect(w.drainEvents().some((e) => e.type === 'ballreset')).toBe(true);
    expect(w.ball.x).toBe(0);
  });

  it('avisa 5 min e 1 min antes do fim', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    w.clock = w.durationSec - 301;
    run(w, 2);
    w.clock = w.durationSec - 61;
    run(w, 2);
    const warns = w.drainEvents().filter((e) => e.type === 'warn');
    expect(warns).toHaveLength(2);
  });

  it('no fim ganha quem tem mais gols', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    w.scores[1] = 2;
    w.clock = w.durationSec - 0.1;
    run(w, 0.5);
    expect(w.phase).toBe('over');
    expect(w.winner).toBe(1);
  });

  it('empate vai para o gol de ouro: bola ao centro, contagem e o primeiro gol decide', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    w.clock = w.durationSec - 0.1;
    run(w, 0.5);
    expect(w.golden).toBe(true);
    expect(w.phase).toBe('countdown');
    run(w, BOL_COUNTDOWN + 0.2);
    w.lastTouch = { id: 't1p0', team: 1, t: 0 };
    const g = w.field.goals[0]!;
    Object.assign(w.ball, {
      x: g.edge.mx + g.edge.nx * 3,
      y: BOL_BALL_R,
      z: g.edge.mz + g.edge.nz * 3,
      vx: -g.edge.nx * 20,
      vy: 0,
      vz: -g.edge.nz * 20,
    });
    run(w, 0.5);
    expect(w.phase).toBe('over');
    expect(w.winner).toBe(1);
  });

  it('o líder encerra com o placar de agora; empate fica -1', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    w.endNow();
    expect(w.phase).toBe('over');
    expect(w.winner).toBe(-1);
  });
});

describe('gente entrando e saindo', () => {
  it('uma pessoa assume o lugar do bot sem mexer no corpo', () => {
    const w = new BolWorld([mk(0, 0), mk(1, 0, true)], { teams: 2, perTeam: 1 });
    startPlay(w);
    const bot = w.players[1]!;
    Object.assign(bot, { x: 4, z: 1 });
    expect(w.takeOver(bot.id, { id: 'gente', name: 'Gente', color: 1, team: 1 })).toBe(true);
    expect(w.player('gente')?.x).toBe(4);
    expect(w.player('gente')?.bot).toBeFalsy();
    expect(w.takeOver('t0p0', { id: 'x', name: 'x', color: 1, team: 0 })).toBe(false);
  });

  it('troca de time leva a raposa para o ponto do novo time', () => {
    const w = new BolWorld(roster(2, 2), { teams: 2, perTeam: 2 });
    w.setTeam('t0p0', 1);
    expect(w.player('t0p0')?.team).toBe(1);
    const s = w.field.spawn(1, 2, 3);
    expect(Math.hypot(w.player('t0p0')!.x - s.x, w.player('t0p0')!.z - s.z)).toBeLessThan(6);
  });

  it('entrar e sair no meio da partida mantém o jogo de pé', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    w.addPlayer(mk(0, 5));
    run(w, 1);
    w.removePlayer('t0p5');
    run(w, 1);
    expect(w.players).toHaveLength(2);
  });
});

describe('bots', () => {
  const play = (seed: string, teams: number, per: number, sec: number) => {
    const w = new BolWorld(roster(teams, per, true), { teams, perTeam: per });
    const mem = new Map(
      w.players.map((p, i) => [p.id, newBolBotMemory((p.team + 1) % teams, 0.2 + (i % 3) * 0.05)]),
    );
    const rng = createRng(seed);
    let touches = 0;
    for (let i = 0; i < Math.round(sec / BOL_DT) && w.phase !== 'over'; i++) {
      const inputs: Record<string, BolInput> = {};
      for (const p of w.players) inputs[p.id] = bolBotInput(w, p, mem.get(p.id)!, rng);
      w.step(BOL_DT, inputs);
      for (const e of w.drainEvents()) if (e.type === 'touch') touches++;
      expect(Number.isFinite(w.ball.x + w.ball.z + w.players[0]!.x)).toBe(true);
    }
    return { w, touches };
  };

  it('2x2 de bots se tocam, a bola fica no campo e saem gols', () => {
    const { w, touches } = play('bots-a', 2, 2, 240);
    expect(touches).toBeGreaterThan(10);
    expect(w.scores[0]! + w.scores[1]!).toBeGreaterThan(0);
  });

  it('3 e 4 times de bots rodam sem quebrar', () => {
    for (const teams of [3, 4]) {
      const { touches } = play(`bots-${teams}`, teams, 1, 90);
      expect(touches).toBeGreaterThan(0);
    }
  });

  it('é determinístico: mesma seed, mesmo placar', () => {
    const a = play('same', 2, 2, 60).w;
    const b = play('same', 2, 2, 60).w;
    expect(a.scores).toEqual(b.scores);
    expect(a.ball.x).toBe(b.ball.x);
  });
});
