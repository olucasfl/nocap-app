import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import {
  GP_CAR_LEN,
  GP_CAR_WID,
  GP_DNF_SEC,
  GP_DT,
  GP_GEARS,
  GP_HALF_WIDTH,
  GP_KERB_W,
  GP_LAPS,
  GP_ARC_VMAX,
  GP_PIT_LIMIT,
  GP_PIT_STOP_SEC,
  GP_REAL_VMAX,
  GP_DRS_DRAG,
  GP_QUALI_HOLD_SEC,
  GP_QUALI_MAX_SEC,
  GP_VMAX,
  gpGear,
  gpKmh,
} from './constants';
import { gpBotInput, newGpBotMemory } from './bots';
import { GP_TRACK_MARINA, GP_TRACK_TOCA, GpTrack, gpTrack } from './track';
import { GP_IDLE, GpWorld, gpAutoGear, gpGridOrder, gpTorque, type GpCar, type GpInput } from './world';

const info = (n: number, bot = false) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: 0xff7d26, bot }));

const full: GpInput = { throttle: 1, brake: 0, steer: 0 };

/** A maior parte dos testes de física usa a pista antiga (reta longa e conhecida); a pista do jogo tem os seus. */
const toca = (seed: string, n: number, bot = false, mode: 'arcade' | 'real' = 'arcade') =>
  new GpWorld(seed, info(n, bot), GP_TRACK_TOCA, mode);

/** Põe o carro num ponto da pista, olhando para a frente, na velocidade dada. */
function put(w: GpWorld, c: GpCar, s: number, d = 0, speed = 0) {
  const p = w.track.pointAt(s, d);
  c.x = p.x;
  c.z = p.z;
  c.h = p.h;
  c.vx = Math.sin(p.h) * speed;
  c.vz = -Math.cos(p.h) * speed;
  c.spin = 0;
  c.speed = speed;
  const pr = w.track.projectGlobal(c.x, c.z);
  c.idx = pr.i;
  c.s = pr.s;
  c.d = pr.d;
  c.prog = s;
  c.surface = w.track.surface(pr);
  c.pitServed = false;
  c.lastValid = { x: c.x, z: c.z, h: c.h, prog: c.prog, idx: c.idx };
}

/** Roda a simulação com os bots dirigindo todos os carros. */
function runBots(w: GpWorld, seconds: number, stop: () => boolean, seed = 's') {
  const rng = createRng(`${seed}:bots`);
  const mem = new Map(w.cars.map((c, i) => [c.id, newGpBotMemory(0.82 + i * 0.02)]));
  for (let n = 0; n < seconds / GP_DT && !stop(); n++) {
    const inputs: Record<string, GpInput> = {};
    for (const c of w.cars) inputs[c.id] = gpBotInput(w, c, mem.get(c.id)!, rng);
    w.step(GP_DT, inputs);
  }
}

describe('pistas', () => {
  for (const def of [GP_TRACK_TOCA, GP_TRACK_MARINA]) {
    describe(def.name, () => {
      const t = new GpTrack(def);

      it('é fechada e contínua', () => {
        expect(t.length).toBeGreaterThan(1000);
        expect(t.length).toBeLessThan(1700);
        for (let i = 0; i < t.n; i++) {
          const j = (i + 1) % t.n;
          const step = Math.hypot(t.x[j]! - t.x[i]!, t.z[j]! - t.z[i]!);
          expect(step).toBeGreaterThan(t.ds * 0.5);
          expect(step).toBeLessThan(t.ds * 1.5);
        }
      });

      it('nenhuma curva é fechada demais para o carro', () => {
        let min = Infinity;
        for (let i = 0; i < t.n; i++) min = Math.min(min, 1 / Math.abs(t.curv[i]!));
        expect(min).toBeGreaterThan(9);
      });

      it('a barreira nunca invade a zebra, e onde dois trechos passam perto ela fica no meio do caminho', () => {
        for (let i = 0; i < t.n; i++) {
          expect(t.wallL[i]!).toBeGreaterThan(GP_HALF_WIDTH + GP_KERB_W);
          expect(t.wallR[i]!).toBeGreaterThan(GP_HALF_WIDTH + GP_KERB_W);
        }
        // a barreira de um trecho nunca fica dentro da pista de outro
        for (let i = 0; i < t.n; i += 7) {
          for (const side of [-1, 1]) {
            const w = t.wallAt(i, side);
            if (w === Infinity) continue;
            const nx = -t.tz[i]! * side;
            const nz = t.tx[i]! * side;
            const p = t.projectGlobal(t.x[i]! + nx * w, t.z[i]! + nz * w);
            expect(p.dist).toBeGreaterThan(GP_HALF_WIDTH + GP_KERB_W - 0.5);
          }
        }
      });

      it('a linha de chegada é a amostra 0 e os setores vêm em ordem', () => {
        expect(t.sectorS[0]).toBeGreaterThan(0);
        expect(t.sectorS[1]).toBeGreaterThan(t.sectorS[0]);
        expect(t.sectorS[1]).toBeLessThan(t.length);
        expect(t.sector(1)).toBe(0);
        expect(t.sector(t.length - 1)).toBe(2);
      });

      it('superfícies: asfalto no meio, zebra na curva, box na faixa', () => {
        const at = (s: number, d: number) => {
          const p = t.pointAt(s, d);
          return t.surface(t.project(p.x, p.z, t.index(s)));
        };
        expect(at(t.length / 2, 0)).toBe('asphalt');
        const curvy =
          [...t.kerb].findIndex((_, i) => [...Array(20).keys()].every((o) => t.kerb[i + o] === 1)) + 10;
        expect(at(curvy * t.ds, -(GP_HALF_WIDTH + GP_KERB_W / 2))).toBe('kerb');
        expect([...t.gravel].some((g) => g !== 0)).toBe(true);
        const box = t.pitCenter(t.pit!.box)!;
        expect(Math.abs(box)).toBeGreaterThan(GP_HALF_WIDTH);
        expect(at(t.pit!.box, box)).toBe('pit');
        expect(t.inBox(t.wrap(t.pit!.box), box)).toBe(true);
        // a faixa do box fica dentro da barreira
        expect(t.wallAt(t.index(t.pit!.box), box)).toBeGreaterThan(Math.abs(box) + 2);
      });

      it('tem um trecho sem corte (a chicane)', () => {
        expect([...t.noCut].some((v) => v === 1)).toBe(true);
      });
    });
  }

  it('a pista do jogo é a Marina, com a reta norte como a maior reta', () => {
    const t = gpTrack();
    expect(t.def.id).toBe('marina');
    let run = 0;
    let best = 0;
    for (let i = 0; i < t.n * 2; i++) {
      run = Math.abs(t.curv[i % t.n]!) < 1 / 400 ? run + t.ds : 0;
      best = Math.max(best, run);
    }
    expect(best).toBeGreaterThan(100);
  });
});

describe('motor, câmbio e freio', () => {
  it('curva de torque forte embaixo, pico no meio, e câmbio que sobe e desce com folga', () => {
    expect(gpTorque(0.5)).toBeGreaterThan(gpTorque(0.05));
    expect(gpTorque(0.5)).toBeGreaterThan(gpTorque(1));
    expect(gpAutoGear(1, 0)).toBe(1);
    expect(gpAutoGear(1, 20)).toBeGreaterThan(3);
    expect(gpAutoGear(8, 32)).toBe(8);
    const up = gpAutoGear(3, 16.5);
    expect(gpAutoGear(up, 16)).toBe(up);
  });

  // spec 081: o Arcade virou kart (kart.test.ts); os testes de F1 daqui valem para o Realista (aceleração e freada de
  // F1 em realista.test.ts)
  it('Realista: o freio para o carro e depois vira ré', () => {
    const w = toca('a', 1, false, 'real');
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    put(w, c, -150, 0, 20);
    let t = 0;
    while (c.speed > 0.6 && t < 6) {
      w.step(GP_DT, { p0: { ...GP_IDLE, brake: 1 } });
      t += GP_DT;
    }
    expect(t).toBeLessThan(4);
    for (let i = 0; i < 3 / GP_DT; i++) w.step(GP_DT, { p0: { ...GP_IDLE, brake: 1 } });
    expect(c.speed).toBeLessThan(-1);
    expect(gpGear(c.speed)).toBe(0);
  });

  it('Realista: sem acelerar o carro perde velocidade aos poucos (arrasto e rolagem) e para', () => {
    const w = toca('a', 1, false, 'real');
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    put(w, c, -150, 0, 20);
    w.step(GP_DT, { p0: GP_IDLE });
    expect(c.speed).toBeLessThan(20);
    expect(c.speed).toBeGreaterThan(19.9);
    for (let i = 0; i < 120 / GP_DT && c.speed !== 0; i++) w.step(GP_DT, { p0: GP_IDLE });
    expect(c.speed).toBe(0);
  });

  it('superfícies: no Realista grama 60 % e brita 40 %; no kart zebra 88 %, grama 55 % e brita 40 %', () => {
    const w = toca('a', 1, false, 'real');
    const c = w.cars[0]!;
    c.surface = 'grass';
    expect(w.vmaxOf(c)).toBeCloseTo(GP_REAL_VMAX * 0.6);
    c.surface = 'gravel';
    expect(w.vmaxOf(c)).toBeCloseTo(GP_REAL_VMAX * 0.4);
    c.surface = 'kerb';
    expect(w.vmaxOf(c)).toBeCloseTo(GP_REAL_VMAX);
    const k = toca('a', 1);
    const kc = k.cars[0]!;
    kc.surface = 'kerb';
    expect(k.vmaxOf(kc)).toBeCloseTo(GP_ARC_VMAX * 0.88);
    kc.surface = 'grass';
    expect(k.vmaxOf(kc)).toBeCloseTo(GP_ARC_VMAX * 0.55);
    kc.surface = 'gravel';
    expect(k.vmaxOf(kc)).toBeCloseTo(GP_ARC_VMAX * 0.4);
  });

  it('Realista: pneu gasta andando e a aderência cai, sem nunca chegar a zero', () => {
    const w = toca('a', 1, false, 'real');
    const c = w.cars[0]!;
    const fresh = w.gripOf(c);
    c.wear = 1;
    const worn = w.gripOf(c);
    expect(worn).toBeLessThan(fresh);
    expect(worn).toBeGreaterThan(0.3);
    const w2 = toca('b', 1, false, 'real');
    w2.beginRace(['p0']);
    for (let i = 0; i < 5 / GP_DT; i++) w2.step(GP_DT, { p0: full });
    expect(w2.cars[0]!.wear).toBeGreaterThan(0);
  });
});

describe('barreira e corte', () => {
  it('a barreira segura o carro de frente', () => {
    const w = toca('a', 1);
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    put(w, c, -200, 0, 25);
    c.h -= Math.PI / 2;
    c.vx = Math.sin(c.h) * 25;
    c.vz = -Math.cos(c.h) * 25;
    let wall = false;
    for (let i = 0; i < 4 / GP_DT; i++) {
      w.step(GP_DT, { p0: full });
      expect(Math.abs(c.d)).toBeLessThanOrEqual(w.track.wallAt(c.idx, c.d) + 0.2);
      if (w.drainEvents().some((e) => e.type === 'wall')) wall = true;
    }
    expect(wall).toBe(true);
  });

  it('cortar a chicane devolve o carro ao último ponto válido', () => {
    const w = toca('a', 1);
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    const t = w.track;
    const i0 = [...t.noCut].findIndex((v) => v === 1);
    const s0 = i0 * t.ds;
    put(w, c, s0 - 20, 0);
    for (let i = 0; i < 0.6 / GP_DT; i++) w.step(GP_DT, { p0: { ...full, throttle: 0.4 } });
    w.drainEvents();
    const off = t.pointAt(s0 + 8, GP_HALF_WIDTH + GP_KERB_W + 6);
    c.x = off.x;
    c.z = off.z;
    w.step(GP_DT, { p0: GP_IDLE });
    expect(w.drainEvents().some((e) => e.type === 'cut')).toBe(true);
    expect(Math.abs(c.d)).toBeLessThanOrEqual(GP_HALF_WIDTH + GP_KERB_W);
    expect(c.speed).toBe(0);
  });

  it('atalho por fora da pista para outro trecho também volta', () => {
    const w = toca('a', 1);
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    put(w, c, 200, 0);
    for (let i = 0; i < 0.5 / GP_DT; i++) w.step(GP_DT, { p0: { ...full, throttle: 0.3 } });
    w.drainEvents();
    const far = w.track.pointAt(600, 0);
    c.x = far.x;
    c.z = far.z;
    for (let i = 0; i < 13; i++) w.step(GP_DT, { p0: GP_IDLE });
    expect(w.drainEvents().some((e) => e.type === 'cut')).toBe(true);
    expect(c.prog).toBeLessThan(260);
  });
});

describe('batida entre carros (spec 081, Fase 13.3: impulso uma vez por contato)', () => {
  function pair(mode: 'arcade' | 'real', gap: number, d2: number, va: number, vb: number, turnB = 0) {
    const w = new GpWorld('a', info(2), GP_TRACK_TOCA, mode);
    w.beginRace(['p0', 'p1']);
    const [a, b] = w.cars as [GpCar, GpCar];
    put(w, a, -150, 0, va);
    put(w, b, -150 + gap, d2, vb);
    if (turnB) {
      b.h += turnB;
      b.vx = Math.sin(b.h) * vb;
      b.vz = -Math.cos(b.h) * vb;
    }
    return { w, a, b };
  }
  const collide = (w: GpWorld) => (w as unknown as { collide(): void }).collide();
  const bumps = (w: GpWorld) => w.drainEvents().filter((e) => e.type === 'bump').length;

  for (const mode of ['arcade', 'real'] as const) {
    describe(mode, () => {
      it('traseira com 8 m/s de diferença: quem bate perde uma parte, o da frente é empurrado, ninguém atravessa', () => {
        const { w, a, b } = pair(mode, GP_CAR_LEN + 0.15, 0, 25, 17);
        const keep = { throttle: 0.55, brake: 0, steer: 0 };
        let minDist = Infinity;
        let aMin = Infinity;
        let bMax = 0;
        for (let i = 0; i < 20; i++) {
          w.step(GP_DT, { p0: keep, p1: keep });
          minDist = Math.min(minDist, Math.hypot(a.x - b.x, a.z - b.z));
          aMin = Math.min(aMin, a.speed);
          bMax = Math.max(bMax, b.speed);
        }
        // quem bate perde ~3 m/s uma vez (não "quase para"), o da frente ganha
        expect(25 - aMin).toBeGreaterThan(1.5);
        expect(25 - aMin).toBeLessThan(3.6);
        expect(bMax - 17).toBeGreaterThan(1.5);
        expect(minDist).toBeGreaterThan(GP_CAR_LEN * 0.85);
        expect(a.prog).toBeLessThan(b.prog);
        // 1 s depois quem bateu já acelera de novo
        const v0 = a.speed;
        for (let i = 0; i < 1 / GP_DT; i++) w.step(GP_DT, { p0: full, p1: keep });
        expect(a.speed).toBeGreaterThan(v0);
      });

      it('a perda não se acumula: 3 ou 12 passos de contato dão a mesma velocidade', () => {
        const run = (n: number) => {
          const { w, a, b } = pair(mode, GP_CAR_LEN - 0.2, 0, 24, 16);
          for (let i = 0; i < n; i++) collide(w);
          return [a.speed, b.speed];
        };
        const [a3, b3] = run(3);
        const [a12, b12] = run(12);
        expect(a12).toBeCloseTo(a3!, 6);
        expect(b12).toBeCloseTo(b3!, 6);
        expect(a3).toBeGreaterThan(20);
      });

      it('raspada de lado a 30 m/s: nenhum carro cai abaixo de 85 %', () => {
        const { w, a, b } = pair(mode, 1, GP_CAR_WID - 0.05, 30, 30, -0.04);
        b.vx = Math.sin(b.h) * 30;
        b.vz = -Math.cos(b.h) * 30;
        let low = Infinity;
        for (let i = 0; i < 30; i++) {
          w.step(GP_DT, { p0: full, p1: full });
          low = Math.min(low, a.speed, b.speed);
        }
        expect(low).toBeGreaterThan(30 * 0.85);
      });

      it('de frente a 20 m/s cada: os dois perdem uma vez e não param sozinhos em 3 passos', () => {
        const { w, a, b } = pair(mode, GP_CAR_LEN + 0.2, 0, 20, 20, Math.PI);
        w.drainEvents();
        for (let i = 0; i < 3; i++) w.step(GP_DT, {});
        expect(bumps(w)).toBe(1);
        expect(Math.abs(a.speed)).toBeLessThan(15);
        expect(Math.abs(b.speed)).toBeLessThan(15);
        expect(Math.abs(a.speed)).toBeGreaterThan(1);
        expect(Math.abs(b.speed)).toBeGreaterThan(1);
      });

      it('a quantidade de movimento se conserva na batida (massas iguais)', () => {
        const { w, a, b } = pair(mode, GP_CAR_LEN - 0.1, 0.8, 22, 9, 0.3);
        const before = { x: a.vx + b.vx, z: a.vz + b.vz };
        collide(w);
        expect(a.vx + b.vx).toBeCloseTo(before.x, 5);
        expect(a.vz + b.vz).toBeCloseTo(before.z, 5);
      });

      it('batida de lado gira pouco (limitado) e o giro some', () => {
        const { w, a, b } = pair(mode, 1.5, -(GP_CAR_LEN + GP_CAR_WID) / 2 + 0.2, 2, 12, Math.PI / 2);
        let spin = 0;
        for (let i = 0; i < 12; i++) {
          w.step(GP_DT, {});
          spin = Math.max(spin, Math.abs(a.spin), Math.abs(b.spin));
        }
        expect(spin).toBeGreaterThan(0.05);
        expect(spin).toBeLessThanOrEqual(0.6 * 1.5);
        if (mode === 'real') {
          for (let i = 0; i < 0.8 / GP_DT; i++) w.step(GP_DT, {});
          expect(Math.abs(a.spin) + Math.abs(b.spin)).toBeLessThan(0.05);
        }
      });
    });
  }

  it('na classificação os carros são fantasmas', () => {
    const w = toca('a', 2);
    const [a, b] = w.cars as [GpCar, GpCar];
    expect(a.x).toBeCloseTo(b.x);
    w.step(GP_DT, {});
    expect(a.x).toBeCloseTo(b.x);
  });

  it('online: o carro do outro é obstáculo (não se mexe aqui), o meu é empurrado', () => {
    const w = toca('a', 2);
    w.goOnline('p0');
    w.beginRace(['p0', 'p1']);
    const [a, b] = w.cars as [GpCar, GpCar];
    put(w, a, -150, 0, 20);
    put(w, b, -147, 0, 0);
    const bx = b.x;
    for (let i = 0; i < 10; i++) w.step(GP_DT, { p0: full });
    expect(b.x).toBe(bx);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(1.4);
  });
});

describe('box', () => {
  it('Realista: parar na vaga segura o carro 3 s e devolve pneu novo', () => {
    const w = toca('a', 1, false, 'real');
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    const t = w.track;
    put(w, c, t.pit!.box - 8, t.pitCenter(t.pit!.box - 8)!);
    c.wear = 0.9;
    let held = 0;
    for (let i = 0; i < 6 / GP_DT; i++) {
      w.step(GP_DT, { p0: { ...full, throttle: 0.5 } });
      if (c.pitHold > 0) held += GP_DT;
    }
    const ev = w.drainEvents().map((e) => e.type);
    expect(ev).toContain('pitin');
    expect(ev).toContain('pitout');
    expect(held).toBeGreaterThan(GP_PIT_STOP_SEC - 0.1);
    expect(held).toBeLessThan(GP_PIT_STOP_SEC + 0.1);
    expect(c.wear).toBeLessThan(0.05);
    expect(c.pitStops).toBe(1);
  });

  it('Realista: na faixa do box a velocidade é limitada (140 km/h na tela)', () => {
    const w = toca('a', 1, false, 'real');
    const c = w.cars[0]!;
    c.surface = 'pit';
    expect(w.vmaxOf(c)).toBe(GP_PIT_LIMIT);
    expect(gpKmh(GP_PIT_LIMIT)).toBe(140);
  });
});

describe('vácuo e DRS', () => {
  function pair(mode: 'arcade' | 'real' = 'real') {
    const w = new GpWorld('a', info(2), GP_TRACK_TOCA, mode);
    w.beginRace(['p0', 'p1']);
    const [a, b] = w.cars as [GpCar, GpCar];
    put(w, a, -150, 0, 25);
    put(w, b, -158, 0, 25);
    w.step(GP_DT, {});
    return { w, a, b };
  }

  it('no vácuo de quem está na frente o arrasto cai; quem está na frente não ganha', () => {
    const { w, a, b } = pair();
    for (let i = 0; i < 30; i++) w.step(GP_DT, { p0: full, p1: full });
    expect(b.slip).toBeGreaterThan(0.3);
    expect(a.slip).toBe(0);
    expect(w.dragOf(b)).toBeLessThan(1);
    expect(w.dragOf(a)).toBe(1);
  });

  it('mais perto, mais vácuo', () => {
    const near = pair();
    const far = pair();
    put(far.w, far.b, -170, 0, 25);
    for (let i = 0; i < 5; i++) {
      near.w.step(GP_DT, { p0: full, p1: full });
      far.w.step(GP_DT, { p0: full, p1: full });
    }
    expect(near.b.slip).toBeGreaterThan(far.b.slip);
  });

  for (const mode of ['real'] as const) {
    it(`${mode}: atrás de outro carro na reta o ganho de velocidade é perceptível`, () => {
      // dois carros na reta longa: um sozinho, outro colado no vácuo de um carro mais lento
      const solo = new GpWorld('v', info(1), GP_TRACK_TOCA, mode);
      solo.beginRace(['p0']);
      const s0 = solo.cars[0]!;
      put(solo, s0, -300, 0, 26);
      const duo = pair(mode);
      put(duo.w, duo.a, -286, 0, 26);
      put(duo.w, duo.b, -300, 0, 26);
      // 1,8 s: com o motor mais forte (13/11/2026), em 2,5 s os carros já chegavam ao fim da reta
      for (let i = 0; i < 1.8 / GP_DT; i++) {
        solo.step(GP_DT, { p0: full });
        duo.w.step(GP_DT, { p0: { ...full, throttle: 0.8 }, p1: full });
      }
      expect(duo.b.speed).toBeGreaterThan(s0.speed + 0.3);
    });
  }

  it('kart: sem vácuo (o arrasto nunca muda)', () => {
    const { w, a, b } = pair('arcade');
    for (let i = 0; i < 30; i++) w.step(GP_DT, { p0: full, p1: full });
    expect(b.slip).toBe(0);
    expect(a.slip).toBe(0);
  });
});

describe('DRS', () => {
  const zoneS = (w: GpWorld) => w.track.drsZones[0]!.from + 30;
  function racer(mode: 'arcade' | 'real' = 'real', n = 2) {
    const w = new GpWorld('drs', info(n), GP_TRACK_MARINA, mode);
    w.beginRace(info(n).map((i) => i.id));
    return w;
  }

  it('a Marina tem zona de DRS, e nenhuma em curva', () => {
    const tr = gpTrack();
    expect(tr.drsZones.length).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < tr.n; i++) if (tr.drsAt[i]) expect(Math.abs(tr.curv[i]!)).toBeLessThan(1 / 150);
    const total = tr.drsZones.reduce((a, z) => a + z.to - z.from, 0);
    expect(total).toBeGreaterThan(150);
  });

  it('na corrida: só depois da 1ª volta, só na zona, nunca para quem está em 1º', () => {
    const w = racer();
    const [a, b] = w.cars as [GpCar, GpCar];
    // 2º colocado, na zona, mas ainda na 1ª volta: não abre
    put(w, a, zoneS(w) + 20, 0, 25);
    put(w, b, zoneS(w), 0, 25);
    w.step(GP_DT, { p0: full, p1: { ...full, drs: true } });
    expect(b.drsAvail).toBe(false);
    expect(b.drsOpen).toBe(false);
    // com uma volta completa: abre
    a.laps = [60_000];
    b.laps = [60_000];
    a.prog += w.track.length;
    b.prog += w.track.length;
    w.step(GP_DT, { p0: full, p1: { ...full, drs: true } });
    expect(b.drsAvail).toBe(true);
    expect(b.drsOpen).toBe(true);
    expect(w.dragOf(b)).toBeLessThanOrEqual(1 - GP_DRS_DRAG + 1e-9);
    // o 1º nunca
    w.step(GP_DT, { p0: { ...full, drs: true }, p1: full });
    expect(a.drsAvail).toBe(false);
    expect(a.drsOpen).toBe(false);
  });

  it('frear fecha; sair da zona fecha', () => {
    const w = racer();
    const [a, b] = w.cars as [GpCar, GpCar];
    a.laps = [60_000];
    b.laps = [60_000];
    put(w, a, w.track.length + zoneS(w) + 30, 0, 25);
    put(w, b, w.track.length + zoneS(w), 0, 25);
    w.step(GP_DT, { p1: { ...full, drs: true } });
    expect(b.drsOpen).toBe(true);
    w.step(GP_DT, { p1: { throttle: 0, brake: 1, steer: 0, drs: true } });
    expect(b.drsOpen).toBe(false);
    w.step(GP_DT, { p1: { ...full, drs: true } });
    expect(b.drsOpen).toBe(true);
    const zone = w.track.drsZones[0]!;
    put(w, b, w.track.length + zone.to + 15, 0, 25);
    w.step(GP_DT, { p1: { ...full, drs: true } });
    w.step(GP_DT, { p1: { ...full, drs: true } });
    expect(b.drsOpen).toBe(false);
  });

  it('na classificação o DRS fica liberado nas zonas para todos', () => {
    const w = new GpWorld('drsq', info(1), undefined, 'real');
    const c = w.cars[0]!;
    put(w, c, zoneS(w), 0, 25);
    w.step(GP_DT, { p0: { ...full, drs: true } });
    expect(c.drsAvail).toBe(true);
    expect(c.drsOpen).toBe(true);
  });

  it('kart: o DRS é ignorado', () => {
    const w = racer('arcade');
    const [a, b] = w.cars as [GpCar, GpCar];
    a.laps = [60_000];
    b.laps = [60_000];
    put(w, a, w.track.length + zoneS(w) + 30, 0, 25);
    put(w, b, w.track.length + zoneS(w), 0, 25);
    w.step(GP_DT, { p1: { ...full, drs: true } });
    expect(b.drsAvail).toBe(false);
    expect(b.drsOpen).toBe(false);
  });

  for (const mode of ['real'] as const) {
    it(`${mode}: a asa aberta dá mais velocidade na reta`, () => {
      const go = (drs: boolean) => {
        const w = new GpWorld('drsv', info(1), undefined, mode);
        const c = w.cars[0]!;
        put(w, c, w.track.drsZones[0]!.from + 1, 0, 24);
        for (let i = 0; i < 4 / GP_DT; i++) w.step(GP_DT, { p0: { ...full, drs } });
        return c.speed;
      };
      expect(go(true)).toBeGreaterThan(go(false) + 0.2);
    });
  }
});

describe('classificação individual', () => {
  it('todos saem do box; a volta lançada só começa pelo botão: o carro vai para a largada, conta e larga', () => {
    const w = toca('q', 2);
    const [a] = w.cars as [GpCar];
    expect(a.surface).toBe('pit');
    expect(a.qualiStartT).toBeNull();
    // andando livre, sem tempo correndo
    put(w, a, 300, 0, 20);
    for (let i = 0; i < 30; i++) w.step(GP_DT, { p0: full });
    expect(a.qualiStartT).toBeNull();
    // apertou: vai para a largada, parado e alinhado com a pista
    w.step(GP_DT, { p0: { ...full, lap: true } });
    expect(w.drainEvents().some((e) => e.type === 'qready' && e.id === 'p0')).toBe(true);
    const line = w.track.pointAt(0, 0);
    expect(Math.hypot(a.x - line.x, a.z - line.z)).toBeLessThan(0.5);
    expect(a.speed).toBe(0);
    expect(a.h).toBeCloseTo(line.h, 5);
    // durante a contagem não anda nem com o pé no fundo, e o tempo não corre
    for (let i = 0; i < (GP_QUALI_HOLD_SEC - 0.2) / GP_DT; i++) w.step(GP_DT, { p0: full });
    expect(a.speed).toBe(0);
    expect(a.qualiStartT).toBeNull();
    for (let i = 0; i < 0.3 / GP_DT; i++) w.step(GP_DT, { p0: full });
    expect(a.qualiStartT).not.toBeNull();
    expect(a.speed).toBeGreaterThan(0);
    expect(w.drainEvents().some((e) => e.type === 'qstart' && e.id === 'p0')).toBe(true);
    // e acaba depois de exatamente uma volta inteira a partir da linha
    a.prog = a.qualiStartProg + w.track.length - 0.3;
    for (let i = 0; i < 30 && a.qualiMs === null; i++) w.step(GP_DT, { p0: full });
    expect(a.qualiMs).not.toBeNull();
    expect(w.drainEvents().some((e) => e.type === 'qtime')).toBe(true);
    // depois do tempo o carro continua andando livre, e não dá para começar outra volta
    w.step(GP_DT, { p0: { ...full, lap: true } });
    expect(a.qualiHold).toBe(0);
  });

  it('cruzar a linha não começa a volta sozinho (só o botão)', () => {
    const w = toca('q', 1);
    const c = w.cars[0]!;
    put(w, c, w.track.length - 10, 0, 20);
    for (let i = 0; i < 2 / GP_DT; i++) w.step(GP_DT, { p0: full });
    expect(c.prog).toBeGreaterThan(w.track.length);
    expect(c.qualiStartT).toBeNull();
  });

  it('com bots na pista do jogo: todos marcam tempo, com setores, e o grid segue os tempos', () => {
    const w = new GpWorld('q', info(4, true));
    runBots(w, GP_QUALI_MAX_SEC + 5, () => w.qualiDone(), 'q');
    expect(w.qualiDone()).toBe(true);
    const times = w.cars.map((c) => c.qualiMs);
    expect(times.every((ms) => ms !== null && ms > 35_000 && ms < 90_000)).toBe(true);
    expect(w.cars.every((c) => c.bestSectors.every((s) => s !== null))).toBe(true);
    const order = w.gridOrder();
    const sorted = [...w.cars].sort((a, b) => a.qualiMs! - b.qualiMs!).map((c) => c.id);
    expect(order).toEqual(sorted);
  });

  it('grid: menor tempo na frente, empate para quem marcou antes, sem tempo no fim', () => {
    expect(
      gpGridOrder([
        { id: 'a', slot: 0, ms: null, at: null },
        { id: 'b', slot: 1, ms: 41_000, at: 50 },
        { id: 'c', slot: 2, ms: 40_000, at: 48 },
        { id: 'd', slot: 3, ms: 41_000, at: 46 },
        { id: 'e', slot: 4, ms: null, at: null },
      ]),
    ).toEqual(['c', 'd', 'b', 'a', 'e']);
  });

  it('o tempo da classificação esgota em 5 minutos', () => {
    const w = toca('q', 2);
    for (let i = 0; i < (GP_QUALI_MAX_SEC + 1) / GP_DT; i++) w.step(GP_DT, {});
    expect(w.qualiDone()).toBe(true);
    expect(w.gridOrder()).toEqual(['p0', 'p1']);
  });
});

describe('corrida e chegada', () => {
  it('volta só conta passando a linha para a frente', () => {
    const w = toca('a', 1);
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    put(w, c, 5, 0);
    c.h += Math.PI;
    for (let i = 0; i < 3 / GP_DT; i++) w.step(GP_DT, { p0: full });
    expect(c.prog).toBeLessThan(0);
    expect(c.laps.length).toBe(0);
  });

  it('Realista: corrida completa com bots na pista do jogo: 3 voltas em ~4 min e pneu perto do fim', () => {
    const w = new GpWorld('r', info(6, true), undefined, 'real');
    runBots(w, GP_QUALI_MAX_SEC + 5, () => w.qualiDone(), 'r');
    w.beginRace(w.gridOrder());
    runBots(w, 500, () => w.ended, 'r');
    expect(w.ended).toBe(true);
    const st = w.standings();
    expect(st.filter((r) => r.car.finished).length).toBeGreaterThanOrEqual(5);
    for (const r of st) if (r.car.finished) expect(r.car.laps.length).toBe(GP_LAPS);
    expect(w.firstFinishT!).toBeGreaterThan(180);
    expect(w.firstFinishT!).toBeLessThan(280);
    const fin = st.filter((r) => r.car.finished).map((r) => r.car.finishMs!);
    expect([...fin].sort((a, b) => a - b)).toEqual(fin);
    expect(w.fastest).not.toBeNull();
    const noPit = st.filter((r) => r.car.pitStops === 0 && r.car.finished);
    expect(noPit.length).toBeGreaterThan(0);
    for (const r of noPit) {
      expect(r.car.wear).toBeGreaterThan(0.6);
      expect(r.car.wear).toBeLessThan(1);
    }
  });

  it('30 s depois do primeiro, quem não terminou é DNF, na ordem da distância', () => {
    const w = toca('d', 3);
    w.beginRace(['p0', 'p1', 'p2']);
    const [a, b, c] = w.cars as [GpCar, GpCar, GpCar];
    put(w, a, 3 * w.track.length - 30, 0);
    a.laps = [40_000, 40_000];
    put(w, b, 500, 0);
    put(w, c, 800, 0);
    let t = 0;
    while (!a.finished && t < 10) {
      w.step(GP_DT, { p0: full });
      t += GP_DT;
    }
    expect(a.finished).toBe(true);
    expect(w.ended).toBe(false);
    for (let i = 0; i < (GP_DNF_SEC + 1) / GP_DT && !w.ended; i++) w.step(GP_DT, {});
    expect(w.ended).toBe(true);
    expect(b.dnf).toBe(true);
    expect(c.dnf).toBe(true);
    expect(w.standings().map((r) => r.car.id)).toEqual(['p0', 'p2', 'p1']);
  });

  it('quem sai (desconectou) vai para o fim e é DNF', () => {
    const w = toca('g', 3);
    w.goOnline('p0');
    w.beginRace(['p0', 'p1', 'p2']);
    w.markGone('p1');
    expect(w.standings().at(-1)!.car.id).toBe('p1');
    expect(w.car('p1')!.dnf).toBe(true);
  });

  it('mesma seed e mesmas entradas, mesma corrida', () => {
    const run = () => {
      const w = new GpWorld('same', info(4, true));
      runBots(w, GP_QUALI_MAX_SEC + 5, () => w.qualiDone(), 'same');
      w.beginRace(w.gridOrder());
      runBots(w, 60, () => w.ended, 'same');
      return w.cars.map((c) => [c.x.toFixed(4), c.z.toFixed(4), c.wear.toFixed(5), c.slip.toFixed(5)]);
    };
    expect(run()).toEqual(run());
  });

  it('pack/unpack devolve o mesmo estado físico', () => {
    const w = toca('p', 2);
    w.beginRace(['p0', 'p1']);
    const [a, b] = w.cars as [GpCar, GpCar];
    for (let i = 0; i < 90; i++) w.step(GP_DT, { p0: { ...full, steer: 0.3 } });
    b.wear = 0;
    w.unpack(b, w.pack(a));
    for (const k of ['x', 'z', 'h', 'vx', 'vz', 'spin', 'prog', 'wear', 'gear'] as const)
      expect(b[k]).toBeCloseTo(a[k] as number, 6);
  });
});

describe('tela', () => {
  it('km/h e marcha', () => {
    // ×7 na tela (13/11/2026): 52 m/s do Realista = 364 km/h
    expect(gpKmh(52)).toBe(364);
    expect(gpGear(0)).toBe(1);
    expect(gpGear(GP_VMAX)).toBeGreaterThanOrEqual(7);
    expect(GP_GEARS.length).toBe(8);
  });
});
