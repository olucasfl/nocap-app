import { describe, expect, it } from 'vitest';
import { BOL_CEILING, BOL_DT, BOL_FOX_H, BOL_FOX_R, BOL_STICK_MAX } from './constants';
import { BolWorld, type BolInfo, type BolPlayer } from './world';

const roster = (): BolInfo[] => [
  { id: 'a', name: 'A', color: 0xffffff, team: 0 },
  { id: 'b', name: 'B', color: 0xffffff, team: 1, bot: true },
];

/** Mundo em jogo; a raposa `a` a `dist` metros de um muro comprido, de frente para ele. */
function setup(dist = 5) {
  const w = new BolWorld(roster(), { teams: 2, perTeam: 1 });
  for (let i = 0; i < 300 && w.phase === 'countdown'; i++) w.step(BOL_DT, {});
  const f = w.field;
  const side = f.edges.find((e) => e.goal < 0 && e.len > 10) as (typeof f.edges)[number];
  const a = w.player('a') as BolPlayer;
  Object.assign(w.player('b')!, { x: 0, z: 0 });
  Object.assign(a, {
    x: side.mx + side.nx * dist,
    z: side.mz + side.nz * dist,
    y: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    surf: 0,
    stick: BOL_STICK_MAX,
  });
  // a bola longe para não atrapalhar
  Object.assign(w.ball, { x: -side.nx * 3, y: 0.9, z: -side.nz * 3, vx: 0, vy: 0, vz: 0 });
  return { w, a, side, f };
}

const into = (side: { nx: number; nz: number }, k = 1) => ({
  mx: -side.nx * k,
  mz: -side.nz * k,
  jump: false,
});

describe('parede e teto', () => {
  it('correndo contra o muro pela rampa a raposa cola, sobe, chega ao teto e anda lá', () => {
    const { w, a, side } = setup();
    let wall = false;
    let ceil = false;
    let maxY = 0;
    for (let i = 0; i < 160; i++) {
      w.step(BOL_DT, { a: into(side) });
      if (a.surf === 1) wall = true;
      if (a.surf === 2) ceil = true;
      maxY = Math.max(maxY, a.y);
      expect(a.y + BOL_FOX_H).toBeLessThanOrEqual(BOL_CEILING + 1e-6);
      expect(w.field.inside(a.x, a.z, BOL_FOX_R - 0.05)).toBe(true);
    }
    expect(wall).toBe(true);
    expect(ceil).toBe(true);
    expect(maxY).toBeGreaterThan(BOL_CEILING - BOL_FOX_H - 0.01);
  });

  it('o grude acaba: ela cai da parede ou do teto, pousa no chão e o grude recarrega', () => {
    const { w, a, side } = setup();
    for (let i = 0; i < 60 * 8; i++) w.step(BOL_DT, { a: into(side) });
    expect(a.surf).toBe(0);
    // depois de cair e andar mais um pouco para a parede ela já pode colar de novo, mas nunca fica presa para sempre
    let everSurface = 0;
    for (let i = 0; i < 60 * 12; i++) {
      w.step(BOL_DT, { a: { mx: 0, mz: 0, jump: false } });
      if (a.surf !== 0) everSurface++;
    }
    expect(everSurface).toBe(0);
    expect(a.grounded).toBe(true);
    // pousou junto do muro, em cima da rampa
    expect(a.y).toBeLessThan(w.field.floorAt(a.x, a.z) + 0.05);
    expect(a.stick).toBeGreaterThan(BOL_STICK_MAX - 0.05);
  });

  it('encostar devagar na parede não gruda', () => {
    const { w, a, side } = setup(3);
    for (let i = 0; i < 120; i++) w.step(BOL_DT, { a: into(side, 0.25) });
    expect(a.surf).toBe(0);
  });

  it('bot não cola na parede', () => {
    const { w, side } = setup();
    const b = w.player('b') as BolPlayer;
    Object.assign(b, { x: side.mx + side.nx * 5, z: side.mz + side.nz * 5, vx: 0, vz: 0 });
    for (let i = 0; i < 120; i++) w.step(BOL_DT, { b: into(side) });
    expect(b.surf).toBe(0);
  });

  it('pular na parede solta e empurra para longe dela', () => {
    const { w, a, side } = setup();
    for (let i = 0; i < 70 && a.surf !== 1; i++) w.step(BOL_DT, { a: into(side) });
    expect(a.surf).toBe(1);
    w.step(BOL_DT, { a: { ...into(side), jump: true } });
    expect(a.surf).toBe(0);
    expect(a.vx * side.nx + a.vz * side.nz).toBeGreaterThan(3);
  });

  it('na parede, pedir para o lado anda ao longo dela e pedir para trás desce até o chão', () => {
    const { w, a, side } = setup();
    for (let i = 0; i < 70 && a.surf !== 1; i++) w.step(BOL_DT, { a: into(side) });
    expect(a.surf).toBe(1);
    const x0 = a.x;
    const z0 = a.z;
    const t = { mx: -side.nz, mz: side.nx };
    for (let i = 0; i < 20; i++) w.step(BOL_DT, { a: { mx: t.mx, mz: t.mz, jump: false } });
    expect(Math.hypot(a.x - x0, a.z - z0)).toBeGreaterThan(1);
    expect(a.surf).toBe(1);
    for (let i = 0; i < 120 && a.surf === 1; i++)
      w.step(BOL_DT, { a: { mx: side.nx, mz: side.nz, jump: false } });
    expect(a.surf).toBe(0);
    expect(a.y).toBeLessThan(1.5);
  });
});
