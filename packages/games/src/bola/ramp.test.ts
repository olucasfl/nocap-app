import { describe, expect, it } from 'vitest';
import { BOL_BALL_R, BOL_DT, BOL_FOX_R } from './constants';
import { buildField } from './field';
import { BolWorld, type BolInfo } from './world';

const roster = (teams: number, per: number): BolInfo[] => {
  const out: BolInfo[] = [];
  for (let t = 0; t < teams; t++)
    for (let i = 0; i < per; i++)
      out.push({ id: `t${t}p${i}`, name: `T${t}P${i}`, color: 0xffffff, team: t });
  return out;
};

const startPlay = (w: BolWorld) => {
  for (let i = 0; i < 300 && w.phase === 'countdown'; i++) w.step(BOL_DT, {});
};

describe('arena: cantos arredondados e rampa', () => {
  it.each([
    [2, 2],
    [3, 2],
    [4, 2],
  ])(
    '%i times: cantos viram arcos (muitas arestas pequenas) e todos os pontos ficam dentro',
    (teams, per) => {
      const f = buildField(teams, per);
      expect(f.edges.length).toBeGreaterThan(teams === 3 ? 12 : 16);
      for (const e of f.edges) expect(f.inside(e.mx, e.mz, -0.01)).toBe(true);
      // os gols continuam nas arestas retas, uma por time, e a boca cabe na parede
      expect(f.goals.filter(Boolean)).toHaveLength(teams);
      for (const g of f.goals) expect(g.halfW * 2).toBeLessThan(g.edge.len);
    },
  );

  it('o chão é plano no meio, sobe pela rampa junto da parede e não tem rampa na boca do gol', () => {
    const f = buildField(2, 2);
    expect(f.floorAt(0, 0)).toBe(0);
    const side = f.edges.find((e) => e.goal < 0 && e.len > 10) as (typeof f.edges)[number];
    // ponto a 0,5 m da parede, no meio do trecho
    const x = side.mx + side.nx * 0.5;
    const z = side.mz + side.nz * 0.5;
    expect(f.floorAt(x, z)).toBeGreaterThan(0.5);
    expect(f.floorAt(x, z)).toBeLessThanOrEqual(f.rampR + 1e-6);
    // longe da parede (a mais de um raio) é chão
    expect(
      f.floorAt(side.mx + side.nx * (f.rampR + 0.5), side.mz + side.nz * (f.rampR + 0.5)),
    ).toBe(0);
    const g = f.goals[0]!;
    expect(f.floorAt(g.edge.mx + g.edge.nx * 0.3, g.edge.mz + g.edge.nz * 0.3)).toBe(0);
  });
});

describe('arena: a bola sobe pela rampa', () => {
  it('bola rasteira contra a parede sobe pela rampa e volta; nunca sai do campo nem atravessa o chão', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const f = w.field;
    const side = f.edges.find((e) => e.goal < 0 && e.len > 10) as (typeof f.edges)[number];
    Object.assign(w.ball, {
      x: side.mx + side.nx * 6,
      y: BOL_BALL_R,
      z: side.mz + side.nz * 6,
      vx: -side.nx * 14,
      vy: 0,
      vz: -side.nz * 14,
    });
    let maxY = 0;
    for (let i = 0; i < 240; i++) {
      w.step(BOL_DT, {});
      maxY = Math.max(maxY, w.ball.y);
      expect(w.ball.y).toBeGreaterThanOrEqual(BOL_BALL_R - 1e-6);
      expect(f.inside(w.ball.x, w.ball.z, -0.001)).toBe(true);
    }
    // a bola subiu pela rampa (mais do que o raio) em vez de só bater e voltar rasteira
    expect(maxY).toBeGreaterThan(BOL_BALL_R + 0.8);
  });

  it('bola lançada de ponta no canto arredondado sai dele (não fica presa)', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const f = w.field;
    // o ponto mais ao canto: o vértice do arco mais longe do centro
    const corner = f.edges.reduce(
      (m, e) => (Math.hypot(e.ax, e.az) > Math.hypot(m.ax, m.az) ? e : m),
      f.edges[0]!,
    );
    const dir = Math.hypot(corner.ax, corner.az);
    Object.assign(w.ball, {
      x: corner.ax * 0.7,
      y: BOL_BALL_R,
      z: corner.az * 0.7,
      vx: (corner.ax / dir) * 10,
      vy: 0,
      vz: (corner.az / dir) * 10,
    });
    for (let i = 0; i < 360; i++) w.step(BOL_DT, {});
    const away = Math.hypot(w.ball.x - corner.ax, w.ball.z - corner.az);
    expect(away).toBeGreaterThan(2.5);
  });
});

describe('arena: a raposa na rampa', () => {
  it('sobe a rampa junto da parede e continua no chão (pode pular dali)', () => {
    const w = new BolWorld(roster(2, 1), { teams: 2, perTeam: 1 });
    startPlay(w);
    const f = w.field;
    const side = f.edges.find((e) => e.goal < 0 && e.len > 10) as (typeof f.edges)[number];
    const p = w.player('t0p0')!;
    Object.assign(p, {
      x: side.mx + side.nx * 4,
      z: side.mz + side.nz * 4,
      y: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      grounded: true,
    });
    let maxY = 0;
    for (let i = 0; i < 120; i++) {
      // devagar: abaixo de BOL_STICK_ENTRY_SPEED ela sobe a rampa sem colar na parede
      w.step(BOL_DT, { t0p0: { mx: -side.nx * 0.3, mz: -side.nz * 0.3, jump: false } });
      maxY = Math.max(maxY, p.y);
    }
    expect(maxY).toBeGreaterThan(0.4);
    expect(p.y).toBeLessThanOrEqual(f.floorAt(p.x, p.z) + 0.31);
    expect(p.grounded).toBe(true);
    // desce de volta ao chão ao se afastar
    for (let i = 0; i < 90; i++)
      w.step(BOL_DT, { t0p0: { mx: side.nx, mz: side.nz, jump: false } });
    expect(p.y).toBeLessThan(0.05);
    expect(p.grounded).toBe(true);
    expect(f.inside(p.x, p.z, BOL_FOX_R - 0.01)).toBe(true);
  });
});
