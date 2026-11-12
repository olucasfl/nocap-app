import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import {
  GP_CAR_R,
  GP_DT,
  GP_HALF_WIDTH,
  GP_LAPS,
  GP_MAX_PLAYERS,
  GP_QUALI_MAX_SEC,
  GP_REAL_WHEELBASE,
  GP_REAL_VMAX,
  gpRealLatMax,
  type GpPhysicsMode,
} from './constants';
import { GP_BOT_ARCHETYPES, gpBotInput, gpBotProfile, newGpBotMemory } from './bots';
import { GpHost, gpSnapshotFor } from './net';
import { GP_TRACK_TOCA } from './track';
import { GP_PACK_LEN, GpWorld, gpGridSpot, type GpCar, type GpInput } from './world';

/** Testes da v2 (spec 080): dois modos de física, bots com perfil e rede enxuta (12 carros desde a spec 081). */

const info = (n: number, bot = false) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: 0xff7d26, bot }));
const full: GpInput = { throttle: 1, brake: 0, steer: 0 };

function put(w: GpWorld, c: GpCar, s: number, d = 0, speed = 0) {
  const p = w.track.pointAt(s, d);
  c.x = p.x;
  c.z = p.z;
  c.h = p.h;
  c.vx = Math.sin(p.h) * speed;
  c.vz = -Math.cos(p.h) * speed;
  c.speed = speed;
  c.spin = 0;
  const pr = w.track.projectGlobal(c.x, c.z);
  c.idx = pr.i;
  c.s = pr.s;
  c.d = pr.d;
  c.prog = s;
  c.surface = w.track.surface(pr);
  c.pitServed = false;
  c.lastValid = { x: c.x, z: c.z, h: c.h, prog: c.prog, idx: c.idx };
}

/** Velocidade de lado (perpendicular ao nariz). */
const sideways = (c: GpCar) => Math.abs(c.vx * Math.cos(c.h) + c.vz * Math.sin(c.h));

/** Partida inteira com bots de perfil (classificação e corrida); devolve o mundo e amostras para os testes. */
function botRace(mode: GpPhysicsMode, n: number, seed: string) {
  const w = new GpWorld(seed, info(n, true), undefined, mode);
  const rng = createRng(`${seed}:bots`);
  const mem = new Map(w.cars.map((c, i) => [c.id, newGpBotMemory(gpBotProfile(seed, i))]));
  const drive = (seconds: number, stop: () => boolean, each?: () => void) => {
    for (let k = 0; k < seconds / GP_DT && !stop(); k++) {
      const inputs: Record<string, GpInput> = {};
      for (const c of w.cars) inputs[c.id] = gpBotInput(w, c, mem.get(c.id)!, rng);
      w.step(GP_DT, inputs);
      if (each && k % 30 === 0) each();
    }
  };
  drive(GP_QUALI_MAX_SEC + 5, () => w.qualiDone());
  const qualiDone = w.qualiDone();
  w.beginRace(w.gridOrder());
  for (const m of mem.values()) {
    m.pitDecided = false;
    m.pit = false;
  }
  const orders: string[] = [];
  const lat = new Map<string, number[]>();
  let maxSkid = 0;
  drive(
    420,
    () => w.ended,
    () => {
      orders.push(w.standings().map((r) => r.car.id).join(','));
      for (const c of w.cars) {
        maxSkid = Math.max(maxSkid, c.skid);
        if (Math.abs(w.track.curv[c.idx]!) < 1 / 300 && c.prog > 0) {
          const l = lat.get(c.id) ?? [];
          l.push(c.d);
          lat.set(c.id, l);
        }
      }
    },
  );
  return { w, qualiDone, orders, lat, maxSkid };
}

describe('dois modos de física', () => {
  it('o modo escolhido chega ao mundo; o padrão é o Arcade', () => {
    expect(new GpWorld('m', info(1)).mode).toBe('arcade');
    expect(new GpWorld('m', info(1), undefined, 'real').mode).toBe('real');
  });

  it('Realista: segurando a curva no máximo o carro nunca fica de lado; abre e perde velocidade', () => {
    const w = new GpWorld('r', info(1), GP_TRACK_TOCA, 'real');
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    put(w, c, -300, 0, 28);
    let worst = 0;
    const v0 = c.speed;
    for (let k = 0; k < 0.8 / GP_DT; k++) {
      w.step(GP_DT, { p0: { throttle: 1, brake: 0, steer: 1 } });
      worst = Math.max(worst, sideways(c), c.skid);
    }
    expect(worst).toBeLessThan(1e-9);
    expect(c.speed).toBeLessThan(v0 - 1);
  });

  it('Arcade: a mesma manobra escorrega (como antes)', () => {
    const w = new GpWorld('a', info(1), GP_TRACK_TOCA, 'arcade');
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    put(w, c, -300, 0, 28);
    let worst = 0;
    for (let k = 0; k < 0.8 / GP_DT; k++) {
      w.step(GP_DT, { p0: { throttle: 1, brake: 0, steer: 1 } });
      worst = Math.max(worst, c.skid);
    }
    expect(worst).toBeGreaterThan(0.5);
  });

  it('Realista: a curva nunca passa do que o pneu aguenta', () => {
    const w = new GpWorld('r', info(1), GP_TRACK_TOCA, 'real');
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    put(w, c, -300, 0, 25);
    let prevH = c.h;
    for (let k = 0; k < 30; k++) {
      w.step(GP_DT, { p0: { throttle: 1, brake: 0, steer: 1 } });
      const yaw = (c.h - prevH) / GP_DT;
      prevH = c.h;
      expect(Math.abs(yaw * c.speed)).toBeLessThanOrEqual(gpRealLatMax(Math.abs(c.speed)) * w.gripOf(c) * 1.05 + 1);
    }
  });

  it('Realista: curva lenta exige frear; curva rápida dá para fazer cheia', () => {
    // raio que o carro consegue a 25 m/s com o volante todo: maior que o grampo da Marina (~10 m)
    const sa = 0.6 / (1 + 25 / 9);
    const radius = GP_REAL_WHEELBASE / Math.tan(sa);
    const lat = (25 * 25) / radius;
    const r25 = lat > gpRealLatMax(25) ? (25 * 25) / gpRealLatMax(25) : radius;
    expect(r25).toBeGreaterThan(15);
    // curva de 100 m de raio a 30 m/s: cabe na aderência (a asa ajuda)
    expect((30 * 30) / 100).toBeLessThan(gpRealLatMax(30));
    // grampo de 10 m: só bem devagar
    expect(Math.sqrt(gpRealLatMax(14) * 10)).toBeLessThan(16);
  });

  it('Realista: a máxima em reta fica perto de 340 km/h (limitador da 8ª, spec 081)', () => {
    // na maior reta da Marina, já embalado na 8ª: o limitador segura a máxima
    const w = new GpWorld('t', info(1), undefined, 'real');
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    put(w, c, w.track.drsZones[0]!.from - 10, 0, GP_REAL_VMAX - 1);
    c.rThr = 1;
    c.gear = 8;
    for (let k = 0; k < 90; k++) w.step(GP_DT, { p0: full });
    expect(c.surface).toBe('asphalt');
    expect(c.speed).toBeGreaterThan(GP_REAL_VMAX - 1.5);
    expect(c.speed).toBeLessThan(GP_REAL_VMAX + 0.5);
  });

  it('Realista: batida de traseira troca velocidade sem giro solto e sem atravessar', () => {
    const w = new GpWorld('b', info(2), GP_TRACK_TOCA, 'real');
    w.beginRace(['p0', 'p1']);
    const [a, b] = w.cars as [GpCar, GpCar];
    put(w, a, -300, 0, 10);
    put(w, b, -303.5, 0, 22);
    for (let k = 0; k < 20; k++) w.step(GP_DT, { p0: { ...full, throttle: 0.3 }, p1: full });
    expect(a.speed).toBeGreaterThan(12);
    expect(b.speed).toBeGreaterThan(15);
    expect(Math.abs(a.spin)).toBeLessThan(0.05);
    expect(Math.abs(b.spin)).toBeLessThan(0.05);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(GP_CAR_R * 2.5);
  });

  it('pack/unpack devolve o mesmo estado no Realista (com as entradas suavizadas)', () => {
    const w = new GpWorld('p', info(2), GP_TRACK_TOCA, 'real');
    w.beginRace(['p0', 'p1']);
    const [a, b] = w.cars as [GpCar, GpCar];
    for (let i = 0; i < 90; i++) w.step(GP_DT, { p0: { ...full, steer: 0.3 } });
    expect(w.pack(a).length).toBe(GP_PACK_LEN);
    w.unpack(b, w.pack(a));
    for (const k of ['x', 'z', 'h', 'speed', 'rThr', 'rBrk', 'rSteer', 'prog', 'gear'] as const)
      expect(b[k]).toBeCloseTo(a[k] as number, 6);
  });
});

describe('12 carros e bots diferentes (nos dois modos)', () => {
  it('perfis pela seed: sempre os mesmos e com os cinco arquétipos no grid', () => {
    const a = Array.from({ length: 11 }, (_, i) => gpBotProfile('s1', i));
    const b = Array.from({ length: 11 }, (_, i) => gpBotProfile('s1', i));
    expect(a).toEqual(b);
    expect(new Set(a.map((p) => p.archetype)).size).toBe(GP_BOT_ARCHETYPES.length);
    expect(gpBotProfile('s2', 0)).not.toEqual(a[0]);
  });

  it('grid para 12: lugares separados, no asfalto, em fila dupla', () => {
    const w = new GpWorld('g', info(GP_MAX_PLAYERS));
    const spots = Array.from({ length: GP_MAX_PLAYERS }, (_, i) => gpGridSpot(w.track, i));
    for (let i = 0; i < spots.length; i++) {
      const p = w.track.projectGlobal(spots[i]!.x, spots[i]!.z);
      expect(Math.abs(p.d)).toBeLessThan(GP_HALF_WIDTH);
      for (let j = i + 1; j < spots.length; j++)
        expect(Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.z - spots[j]!.z)).toBeGreaterThan(GP_CAR_R * 3);
    }
    w.beginRace(w.cars.map((c) => c.id));
    expect(w.cars.every((c) => c.prog < 0)).toBe(true);
  });

  const results: Record<string, number[]> = {};
  for (const mode of ['arcade', 'real'] as const) {
    it(`${mode}: 11 bots e 3 voltas: a ordem muda, os tempos diferem e eles não andam na mesma faixa`, () => {
      const { w, qualiDone, orders, lat, maxSkid } = botRace(mode, GP_MAX_PLAYERS, `v2-${mode}`);
      expect(qualiDone).toBe(true);
      expect(w.cars.every((c) => c.qualiMs !== null)).toBe(true);
      expect(w.ended).toBe(true);
      const fin = w.cars.filter((c) => c.finished);
      expect(fin.length).toBeGreaterThanOrEqual(GP_MAX_PLAYERS - 4);
      for (const c of fin) expect(c.laps.length).toBe(GP_LAPS);
      // a ordem muda ao longo da corrida
      expect(new Set(orders).size).toBeGreaterThan(5);
      // os tempos de volta diferem entre bots
      const best = fin.map((c) => c.bestLap!).sort((a, b) => a - b);
      expect(best.at(-1)! - best[0]!).toBeGreaterThan(500);
      // cada um na sua faixa: a média de afastamento nas retas varia entre eles
      const means = [...lat.values()].filter((l) => l.length > 10).map((l) => l.reduce((a, b) => a + b, 0) / l.length);
      const avg = means.reduce((a, b) => a + b, 0) / means.length;
      const sd = Math.sqrt(means.reduce((a, b) => a + (b - avg) ** 2, 0) / means.length);
      expect(sd).toBeGreaterThan(0.3);
      // o Realista não escorrega de lado
      if (mode === 'real') expect(maxSkid).toBe(0);
      results[mode] = best;
    }, 60_000);
  }

  it('melhor volta mediana dos bots em cada modo (anotada na spec)', () => {
    const a = results.arcade;
    const r = results.real;
    if (!a || !r) return;
    const med = (l: number[]) => l[Math.floor(l.length / 2)]!;
    // spec 081: os modos deixam de ter a mesma faixa (o Realista é de F1, o Arcade vira kart em outra pista)
    test_note(`melhor volta mediana dos bots: arcade ${med(a)} ms, realista ${med(r)} ms`);
    expect(med(r)).toBeGreaterThan(0);
  });
});

describe('rede com o grid cheio', () => {
  it('estado enxuto: todos os carros cabem em poucos KB, e o estado completo vai só para o dono', () => {
    const infos = info(GP_MAX_PLAYERS).map((p, i) => ({ ...p, bot: i >= 6 }));
    const w = new GpWorld('n20', infos, undefined, 'real');
    w.beginRace(infos.map((p) => p.id));
    const host = new GpHost(w, 'p0');
    for (let i = 0; i < 30; i++) host.step(full, Object.fromEntries(infos.slice(1).map((p) => [p.id, full])));
    const snap = host.snapshot();
    expect(snap.cars.length).toBe(GP_MAX_PLAYERS);
    // estado completo só de quem é gente e não é o líder (5 pessoas)
    expect(snap.full.length).toBe(5);
    const forOne = gpSnapshotFor(snap, [3]);
    expect(forOne.full.map((r) => r[0])).toEqual([3]);
    const bytes = JSON.stringify(forOne).length;
    test_note(`estado para um aparelho com o grid cheio: ${bytes} bytes`);
    expect(bytes).toBeLessThan(2400);
  });
});

/** Anota um número no relatório do teste (aparece com --reporter=verbose). */
function test_note(msg: string) {
  if (process.env.GP_NOTES) console.log(msg);
}
