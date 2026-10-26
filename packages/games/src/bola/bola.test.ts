import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { bolBotInput, newBolBotMemory } from './bots';
import {
  BOL_BALL_R,
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

  it('gol contra: quem tocou por último leva o ponto para o próprio time', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    w.lastTouch = { id: 't0p0', team: 0, t: 0 };
    shoot(w, 0);
    run(w, 0.5);
    expect(w.scores).toEqual([1, 0]);
    expect(w.drainEvents().find((e) => e.type === 'goal')).toMatchObject({
      goalTeam: 0,
      scorerTeam: 0,
      own: true,
    });
  });

  it('sem toque ninguém pontua', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    shoot(w, 1);
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
