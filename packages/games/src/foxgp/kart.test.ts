import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import {
  GP_ARC_BOOST,
  GP_ARC_CHARGE_SEC,
  GP_ARC_DRIFT_BOOST_SEC,
  GP_ARC_KERB_VMAX,
  GP_ARC_VMAX,
  GP_ARC_WALL_KEEP,
  GP_DT,
  GP_HALF_WIDTH,
  GP_QUALI_MAX_SEC,
} from './constants';
import { gpBotInput, gpBotProfile, newGpBotMemory } from './bots';
import { GP_TRACK_MARINA, GP_TRACK_TOCA, type GpTrackDef } from './track';
import { GpWorld, type GpCar, type GpInput } from './world';

/** Spec 081, Fase 5: o Arcade é o kart (drift que carrega o turbo em 3 níveis, sem vácuo, pneu, box nem DRS). */
const info = (n: number, bot = false) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: 0xff7d26, bot }));
const gas: GpInput = { throttle: 1, brake: 0, steer: 0 };

function put(w: GpWorld, c: GpCar, s: number, d = 0, speed = 0) {
  const p = w.track.pointAt(s, d);
  Object.assign(c, {
    x: p.x,
    z: p.z,
    h: p.h,
    speed,
    vx: Math.sin(p.h) * speed,
    vz: -Math.cos(p.h) * speed,
  });
  const pr = w.track.projectGlobal(c.x, c.z);
  Object.assign(c, { idx: pr.i, s: pr.s, d: pr.d, prog: s, surface: w.track.surface(pr), spin: 0 });
  c.lastValid = { x: c.x, z: c.z, h: c.h, prog: c.prog, idx: c.idx };
}

/** Um kart numa reta longa da Marina (a zona de DRS mais comprida), já na corrida. */
function kart(def: GpTrackDef = GP_TRACK_MARINA) {
  const w = new GpWorld('k', info(1), def, 'arcade');
  w.beginRace(['p0']);
  const z = [...w.track.drsZones].sort((a, b) => b.to - b.from - (a.to - a.from))[0]!;
  return { w, c: w.cars[0]!, from: z.from - 10 };
}
const sideways = (c: GpCar) =>
  Math.abs((c.vx - c.kx) * Math.cos(c.h) + (c.vz - c.kz) * Math.sin(c.h));

describe('kart (spec 081, Fase 5)', () => {
  it('acelera sem marchas até ~90 % da máxima em ~3,5 s', () => {
    const { w, c, from } = kart();
    put(w, c, from - 20, 0, 0);
    let t90 = 0;
    for (let t = 0; t < 6 && !t90; t += GP_DT) {
      w.step(GP_DT, { p0: gas });
      if (c.speed >= GP_ARC_VMAX * 0.9) t90 = t;
    }
    expect(t90).toBeGreaterThan(2.5);
    expect(t90).toBeLessThan(4.5);
    expect(c.gear).toBe(1);
  });

  it('curva leve não escorrega; virada brusca em alta escorrega (fumaça) sem perder muito', () => {
    const { w, c, from } = kart();
    put(w, c, from, -3, GP_ARC_VMAX);
    let side = 0;
    for (let k = 0; k < 0.3 / GP_DT; k++) {
      w.step(GP_DT, { p0: { throttle: 1, brake: 0, steer: 0.3 } });
      side = Math.max(side, c.skid);
    }
    expect(side).toBeLessThan(0.5);
    put(w, c, from, -3, GP_ARC_VMAX);
    side = 0;
    let lat = 0;
    for (let k = 0; k < 0.4 / GP_DT; k++) {
      w.step(GP_DT, { p0: { throttle: 1, brake: 0, steer: 1 } });
      side = Math.max(side, c.skid);
      lat = Math.max(lat, sideways(c));
    }
    // escorrega o bastante para soltar fumaça (o desenho usa skid > 2,2), mas nunca mais que 40 % da velocidade
    expect(side).toBeGreaterThan(2.2);
    expect(lat).toBeLessThan(0.45 * GP_ARC_VMAX);
    expect(c.speed).toBeGreaterThan(GP_ARC_VMAX * 0.93);
  });

  it('drift só liberado acima de 40 % da máxima, com o volante virado, no asfalto ou na zebra', () => {
    const { w, c, from } = kart();
    // devagar: não entra
    put(w, c, from, 0, GP_ARC_VMAX * 0.3);
    w.step(GP_DT, { p0: { ...gas, steer: 1, drift: true } });
    expect(c.driftDir).toBe(0);
    // rápido, mas sem volante: não entra
    put(w, c, from, 0, GP_ARC_VMAX * 0.8);
    c.driftHeld = false;
    w.step(GP_DT, { p0: { ...gas, steer: 0, drift: true } });
    expect(c.driftDir).toBe(0);
    // rápido e com volante: entra para o lado do volante, com o pulinho
    c.driftHeld = false;
    w.step(GP_DT, { p0: { ...gas, steer: -1, drift: true } });
    expect(c.driftDir).toBe(-1);
    expect(c.hop).toBeGreaterThan(0);
    expect(w.drainEvents().some((e) => e.type === 'drift')).toBe(true);
    // segurando, continua; soltando, sai
    w.step(GP_DT, { p0: { ...gas, steer: 0, drift: true } });
    expect(c.driftDir).toBe(-1);
    w.step(GP_DT, { p0: { ...gas, steer: 0 } });
    expect(c.driftDir).toBe(0);
    // na grama não entra
    put(w, c, from, GP_HALF_WIDTH + 4, GP_ARC_VMAX * 0.8);
    c.driftHeld = false;
    w.step(GP_DT, { p0: { ...gas, steer: 1, drift: true } });
    expect(c.surface).toBe('grass');
    expect(c.driftDir).toBe(0);
  });

  it('no drift o volante muda o raio: para dentro fecha, para fora abre', () => {
    const turn = (steer: number) => {
      const { w, c, from } = kart();
      put(w, c, from, 0, GP_ARC_VMAX * 0.8);
      w.step(GP_DT, { p0: { ...gas, steer: 1, drift: true } });
      const h0 = c.h;
      for (let k = 0; k < 10; k++) w.step(GP_DT, { p0: { ...gas, steer, drift: true } });
      return Math.abs(c.h - h0);
    };
    const inside = turn(1);
    const neutral = turn(0);
    const outside = turn(-1);
    expect(inside).toBeGreaterThan(neutral * 1.25);
    expect(outside).toBeLessThan(neutral * 0.8);
  });

  /** Faz um drift de `sec` segundos na reta e solta; devolve o que aconteceu. */
  function driftFor(sec: number) {
    const { w, c, from } = kart();
    put(w, c, from, 0, GP_ARC_VMAX);
    const ev: string[] = [];
    let levelAtRelease = 0;
    for (let k = 0; k < sec / GP_DT; k++) {
      // o drift faria o kart sair da reta: ele volta ao mesmo ponto a cada passo (a carga e o drift ficam)
      put(w, c, from, 0, GP_ARC_VMAX);
      w.step(GP_DT, { p0: { ...gas, steer: 1, drift: true } });
      for (const e of w.drainEvents()) ev.push(e.type);
      levelAtRelease = Math.floor(c.bar);
    }
    const driftingBefore = c.driftDir !== 0;
    put(w, c, from, 0, GP_ARC_VMAX);
    w.step(GP_DT, { p0: { ...gas, steer: 0, drift: false } });
    for (const e of w.drainEvents()) ev.push(e.type === 'turbo' ? `turbo${e.level}` : e.type);
    return { w, c, ev, driftingBefore, levelAtRelease };
  }

  it('a carga do drift começa em zero, sobe azul, laranja e rosa e só existe derrapando', () => {
    const { w, c, from } = kart();
    put(w, c, from, 0, GP_ARC_VMAX);
    // andando reto sem drift: nunca carrega
    for (let k = 0; k < 4 / GP_DT; k++) w.step(GP_DT, { p0: gas });
    expect(c.bar).toBe(0);
    // no drift: começa sem nada e passa os três níveis na ordem
    put(w, c, from, 0, GP_ARC_VMAX);
    w.step(GP_DT, { p0: { ...gas, steer: 1, drift: true } });
    expect(c.driftDir).not.toBe(0);
    expect(c.bar).toBeLessThan(0.1);
    const reach = [0, 0, 0];
    for (let k = 0; k < 6 / GP_DT && c.driftDir !== 0; k++) {
      put(w, c, from, 0, GP_ARC_VMAX);
      w.step(GP_DT, { p0: { ...gas, steer: 1, drift: true } });
      for (let l = 0; l < 3; l++) if (!reach[l] && c.bar >= l + 1) reach[l] = k * GP_DT;
    }
    expect(reach[0]).toBeGreaterThan(0.5);
    expect(reach[0]).toBeLessThan(1.3);
    expect(reach[1]).toBeGreaterThan(reach[0]!);
    expect(reach[2]).toBeGreaterThan(reach[1]!);
    expect(reach[2]).toBeLessThanOrEqual(GP_ARC_CHARGE_SEC + 0.2);
  });

  for (const level of [1, 2, 3] as const) {
    it(`soltar o drift no ${['azul', 'laranja', 'rosa'][level - 1]} solta o turbo ${level} automático, curto, e zera a carga`, () => {
      const sec = [1.4, 2.2, 3.2][level - 1]!;
      const { c, ev } = driftFor(sec);
      expect(ev).toContain(`turbo${level}`);
      expect(c.bar).toBe(0);
      expect(c.boostLevel).toBe(level);
      // dura bem menos que o turbo das placas e dos itens
      expect(c.boostT).toBeLessThanOrEqual(GP_ARC_DRIFT_BOOST_SEC[level - 1]! + 1e-9);
      expect(GP_ARC_DRIFT_BOOST_SEC[level - 1]!).toBeLessThan(GP_ARC_BOOST[level - 1]!.sec);
    });
  }

  it('drift que não chega ao azul solta nada', () => {
    const { c, ev } = driftFor(0.5);
    expect(ev.some((e) => e.startsWith('turbo'))).toBe(false);
    expect(c.boostT).toBe(0);
    expect(c.bar).toBe(0);
  });

  it('o botão de turbo não faz mais nada no kart', () => {
    const { w, c, from } = kart();
    put(w, c, from, 0, 20);
    c.bar = 2.5;
    w.step(GP_DT, { p0: { ...gas, turbo: true } });
    expect(c.boostT).toBe(0);
    expect(c.boostLevel).toBe(0);
  });

  it('perder o drift fora da pista perde a carga, sem turbo', () => {
    const { w, c, from } = kart();
    put(w, c, from, 0, GP_ARC_VMAX);
    for (let k = 0; k < 1.6 / GP_DT; k++) {
      put(w, c, from, 0, GP_ARC_VMAX);
      w.step(GP_DT, { p0: { ...gas, steer: 1, drift: true } });
    }
    expect(c.bar).toBeGreaterThan(1);
    c.surface = 'grass';
    w.step(GP_DT, { p0: { ...gas, steer: 1, drift: true } });
    expect(c.driftDir).toBe(0);
    expect(c.bar).toBe(0);
    expect(c.boostT).toBe(0);
  });

  it('sem desgaste de pneu, sem vácuo, sem box e sem DRS', () => {
    const w = new GpWorld('n', info(2), GP_TRACK_MARINA, 'arcade');
    w.beginRace(['p0', 'p1']);
    const [a, b] = w.cars as [GpCar, GpCar];
    const t = w.track;
    put(w, a, t.drsZones[0]!.from + 20, 0, 25);
    put(w, b, t.drsZones[0]!.from + 10, 0, 25);
    a.laps = [50_000];
    b.laps = [50_000];
    for (let k = 0; k < 3 / GP_DT; k++) w.step(GP_DT, { p0: gas, p1: { ...gas, drs: true } });
    expect(a.wear).toBe(0);
    expect(b.wear).toBe(0);
    expect(b.slip).toBe(0);
    expect(b.drsOpen).toBe(false);
    // atravessa a vaga do box sem parar
    put(w, a, t.pit!.box - 8, t.pitCenter(t.pit!.box - 8)!, 10);
    for (let k = 0; k < 2 / GP_DT; k++) w.step(GP_DT, { p0: { ...gas, throttle: 0.4 } });
    expect(a.pitStops).toBe(0);
    expect(a.pitHold).toBe(0);
  });

  it('zebra tira velocidade: a máxima nela é ~88 %', () => {
    const { w, c } = kart();
    const tr = w.track;
    const i = [...tr.kerb].findIndex((k, j) => k === 1 && Math.abs(tr.curv[j]!) < 1 / 200);
    const s = i >= 0 ? i * tr.ds : 0;
    put(w, c, s, GP_HALF_WIDTH + 0.6, GP_ARC_VMAX);
    w.step(GP_DT, { p0: gas });
    if (c.surface === 'kerb') expect(w.vmaxOf(c)).toBeCloseTo(GP_ARC_VMAX * GP_ARC_KERB_VMAX);
    expect(w.vmaxOf({ ...c, surface: 'kerb' })).toBeCloseTo(GP_ARC_VMAX * GP_ARC_KERB_VMAX);
  });

  it('muro de metal: batida normal (perde ~35 %) e cancela o drift', () => {
    const { w, c, from } = kart();
    put(w, c, from, 0, 24);
    c.h -= Math.PI / 2.2;
    c.driftDir = 1;
    let hit = 0;
    for (let k = 0; k < 2 / GP_DT && !hit; k++) {
      const before = c.speed;
      w.step(GP_DT, { p0: { throttle: 0, brake: 0, steer: 0, drift: true } });
      if (w.drainEvents().some((e) => e.type === 'wall' && e.kind === 'metal'))
        hit = c.speed / before;
    }
    expect(hit).toBeGreaterThan(GP_ARC_WALL_KEEP - 0.05);
    expect(hit).toBeLessThan(GP_ARC_WALL_KEEP + 0.05);
    expect(c.driftDir).toBe(0);
  });

  it('pilha de pneus: o kart quica para trás', () => {
    // a Toca com a barreira inteira de pneus dos dois lados
    const def: GpTrackDef = {
      ...GP_TRACK_TOCA,
      id: 'toca-pneus',
      tyreWalls: [
        { from: 0, to: GP_TRACK_TOCA.points.length - 1, side: 1 },
        { from: 0, to: GP_TRACK_TOCA.points.length - 1, side: -1 },
      ],
    };
    const w = new GpWorld('t', info(1), def, 'arcade');
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    put(w, c, -200, 0, 20);
    c.h -= Math.PI / 2;
    let back = 0;
    let hit = 0;
    for (let k = 0; k < 2 / GP_DT && !back; k++) {
      w.step(GP_DT, { p0: { throttle: 0, brake: 0, steer: 0 } });
      const e = w.drainEvents().find((x) => x.type === 'wall' && x.kind === 'tyres');
      if (e && e.type === 'wall') {
        back = c.speed;
        hit = e.speed;
      }
    }
    // a velocidade para a frente virou de volta, ~metade da de chegada
    expect(hit).toBeGreaterThan(5);
    expect(back).toBeLessThan(-0.4 * hit);
    expect(back).toBeGreaterThan(-0.6 * hit);
  });

  it('volta de bot do kart na Marina entre 38 e 55 s; os bots usam drift e soltam turbo', () => {
    const seed = 'v3-kart';
    const w = new GpWorld(seed, info(6, true), GP_TRACK_MARINA, 'arcade');
    const rng = createRng(`${seed}:bots`);
    const mem = new Map(w.cars.map((c, i) => [c.id, newGpBotMemory(gpBotProfile(seed, i))]));
    let drifts = 0;
    let turbos = 0;
    const drive = (sec: number, stop: () => boolean) => {
      for (let k = 0; k < sec / GP_DT && !stop(); k++) {
        const inputs: Record<string, GpInput> = {};
        for (const c of w.cars) inputs[c.id] = gpBotInput(w, c, mem.get(c.id)!, rng);
        w.step(GP_DT, inputs);
        for (const e of w.drainEvents()) {
          if (e.type === 'drift') drifts += 1;
          if (e.type === 'turbo') turbos += 1;
        }
      }
    };
    drive(GP_QUALI_MAX_SEC, () => w.qualiDone());
    w.beginRace(w.gridOrder());
    drive(400, () => w.ended);
    const best = w.cars.filter((c) => c.bestLap !== null).map((c) => c.bestLap! / 1000);
    expect(best.length).toBeGreaterThanOrEqual(5);
    for (const b of best) {
      expect(b).toBeGreaterThan(38);
      expect(b).toBeLessThan(55);
    }
    expect(drifts).toBeGreaterThan(10);
    expect(turbos).toBeGreaterThan(5);
  }, 60_000);

  it('pack/unpack devolve o mesmo kart (drift, barra e turbo)', () => {
    const { w, c, from } = kart();
    put(w, c, from, 0, 25);
    c.bar = 2.2;
    w.step(GP_DT, { p0: { ...gas, steer: 1, drift: true } });
    const packed = w.pack(c);
    const w2 = new GpWorld('k', info(1), GP_TRACK_MARINA, 'arcade');
    w2.beginRace(['p0']);
    const c2 = w2.cars[0]!;
    w2.unpack(c2, packed);
    expect(c2.driftDir).toBe(c.driftDir);
    expect(c2.bar).toBeCloseTo(c.bar, 9);
    expect(c2.hop).toBeCloseTo(c.hop, 9);
    expect(c2.speed).toBeCloseTo(c.speed, 9);
  });
});
