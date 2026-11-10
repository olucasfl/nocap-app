import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import {
  GP_DNF_SEC,
  GP_DT,
  GP_HALF_WIDTH,
  GP_KERB_W,
  GP_LAPS,
  GP_LIMIT,
  GP_PIT_BOX,
  GP_PIT_STOP_SEC,
  GP_TURBO_GAIN,
  GP_TURBO_SEC,
  GP_VMAX,
  gpGear,
  gpKmh,
} from './constants';
import { gpBotInput, newGpBotMemory } from './bots';
import { gpTrack } from './track';
import { GP_IDLE, GpWorld, gpGridOrder, type GpCar, type GpInput } from './world';

const info = (n: number, bot = false) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: 0xff7d26, bot }));

const full: GpInput = { throttle: 1, brake: 0, steer: 0, turbo: false };

/** Põe o carro parado num ponto da pista, olhando para a frente. */
function put(w: GpWorld, c: GpCar, s: number, d = 0) {
  const p = w.track.pointAt(s, d);
  c.x = p.x;
  c.z = p.z;
  c.h = p.h;
  c.vx = 0;
  c.vz = 0;
  c.speed = 0;
  const pr = w.track.projectGlobal(c.x, c.z);
  c.idx = pr.i;
  c.s = pr.s;
  c.d = pr.d;
  c.prog = s;
  c.surface = w.track.surface(pr);
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

describe('pista', () => {
  const t = gpTrack();

  it('é fechada, contínua e tem cerca de 1,2 km', () => {
    expect(t.length).toBeGreaterThan(1000);
    expect(t.length).toBeLessThan(1400);
    for (let i = 0; i < t.n; i++) {
      const j = (i + 1) % t.n;
      const step = Math.hypot(t.x[j]! - t.x[i]!, t.z[j]! - t.z[i]!);
      expect(step).toBeGreaterThan(t.ds * 0.6);
      expect(step).toBeLessThan(t.ds * 1.4);
    }
  });

  it('trechos que não são vizinhos ficam longe o bastante para as barreiras não se cruzarem', () => {
    let min = Infinity;
    for (let i = 0; i < t.n; i += 3) {
      for (let j = i + 3; j < t.n; j += 3) {
        const along = Math.min(j - i, t.n - (j - i)) * t.ds;
        if (along < 110) continue;
        min = Math.min(min, Math.hypot(t.x[i]! - t.x[j]!, t.z[i]! - t.z[j]!));
      }
    }
    expect(min).toBeGreaterThan(GP_LIMIT * 2 + 4);
  });

  it('a linha de chegada está na reta, apontando para leste', () => {
    const p = t.pointAt(0);
    expect(Math.abs(p.x)).toBeLessThan(1);
    expect(Math.abs(p.z)).toBeLessThan(1);
    expect(Math.sin(p.h)).toBeCloseTo(1, 2);
  });

  it('superfícies: asfalto no meio, zebra na curva, grama fora, brita do lado de fora das curvas, box na faixa', () => {
    const at = (s: number, d: number) => {
      const p = t.pointAt(s, d);
      return t.surface(t.project(p.x, p.z, t.index(s)));
    };
    expect(at(100, 0)).toBe('asphalt');
    expect(at(100, GP_HALF_WIDTH - 0.5)).toBe('asphalt');
    // o meio de um trecho de zebra
    const curvy = [...t.kerb].findIndex((_, i) => [...Array(20).keys()].every((o) => t.kerb[i + o] === 1)) + 10;
    expect(curvy).toBeGreaterThan(0);
    expect(at(curvy * t.ds, -(GP_HALF_WIDTH + GP_KERB_W / 2))).toBe('kerb');
    expect(at(300, GP_HALF_WIDTH + 6)).not.toBe('asphalt');
    expect([...t.gravel].some((g) => g !== 0)).toBe(true);
    const box = t.pitCenter(GP_PIT_BOX)!;
    expect(box).toBeGreaterThan(GP_HALF_WIDTH);
    expect(at(GP_PIT_BOX, box)).toBe('pit');
    expect(t.inBox(t.wrap(GP_PIT_BOX), box)).toBe(true);
    // na reta, fora do box, o lado do box é grama
    expect(at(200, GP_HALF_WIDTH + 6)).toBe('grass');
  });

  it('tem um trecho sem corte (a chicane)', () => {
    expect([...t.noCut].some((v) => v === 1)).toBe(true);
  });
});

describe('carro', () => {
  it('acelera até perto da máxima na reta e freia até parar', () => {
    const w = new GpWorld('a', info(1));
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    // começo da reta grande: são uns 260 m de reta até a curva 1
    put(w, c, -150, 0);
    for (let i = 0; i < 8 / GP_DT; i++) w.step(GP_DT, { p0: full });
    expect(c.speed).toBeGreaterThan(GP_VMAX * 0.85);
    expect(c.speed).toBeLessThanOrEqual(GP_VMAX + 1e-6);
    // freando forte, para em menos de 2 s (depois disso o freio vira ré)
    let t = 0;
    while (c.speed > 0.6 && t < 3) {
      w.step(GP_DT, { p0: { ...GP_IDLE, brake: 1 } });
      t += GP_DT;
    }
    expect(t).toBeLessThan(2);
  });

  it('na grama a máxima cai para 60 % e na brita para 40 %', () => {
    const w = new GpWorld('a', info(1));
    const c = w.cars[0]!;
    c.surface = 'grass';
    expect(w.vmaxOf(c)).toBeCloseTo(GP_VMAX * 0.6);
    c.surface = 'gravel';
    expect(w.vmaxOf(c)).toBeCloseTo(GP_VMAX * 0.4);
    c.surface = 'kerb';
    expect(w.vmaxOf(c)).toBeCloseTo(GP_VMAX);
  });

  it('ré quando para e continua freando', () => {
    const w = new GpWorld('a', info(1));
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    for (let i = 0; i < 2 / GP_DT; i++) w.step(GP_DT, { p0: { ...GP_IDLE, brake: 1 } });
    expect(c.speed).toBeLessThan(-1);
    expect(gpGear(c.speed)).toBe(0);
  });

  it('pneu gasta andando e a aderência cai, sem nunca chegar a zero', () => {
    const w = new GpWorld('a', info(1));
    const c = w.cars[0]!;
    const fresh = w.gripOf(c);
    c.wear = 1;
    const worn = w.gripOf(c);
    expect(worn).toBeLessThan(fresh);
    expect(worn).toBeGreaterThan(0.3);
    const w2 = new GpWorld('b', info(1));
    w2.beginRace(['p0']);
    for (let i = 0; i < 5 / GP_DT; i++) w2.step(GP_DT, { p0: full });
    expect(w2.cars[0]!.wear).toBeGreaterThan(0);
  });

  it('a barreira de pneus segura o carro', () => {
    const w = new GpWorld('a', info(1));
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    put(w, c, -200, 0);
    // vira para a esquerda (para fora da reta, longe do box) e acelera
    c.h -= Math.PI / 2;
    for (let i = 0; i < 6 / GP_DT; i++) w.step(GP_DT, { p0: full });
    expect(Math.abs(c.d)).toBeLessThanOrEqual(GP_LIMIT + 0.5);
  });

  it('cortar a chicane devolve o carro ao último ponto válido', () => {
    const w = new GpWorld('a', info(1));
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    const t = w.track;
    const i0 = [...t.noCut].findIndex((v) => v === 1);
    const s0 = i0 * t.ds;
    put(w, c, s0 - 20, 0);
    c.prog = s0 - 20;
    // anda um pouco na pista para gravar o ponto válido
    for (let i = 0; i < 0.6 / GP_DT; i++) w.step(GP_DT, { p0: { ...full, throttle: 0.4 } });
    w.drainEvents();
    // e aparece bem fora da pista dentro da chicane
    const off = t.pointAt(s0 + 8, GP_HALF_WIDTH + GP_KERB_W + 6);
    c.x = off.x;
    c.z = off.z;
    w.step(GP_DT, { p0: GP_IDLE });
    expect(w.drainEvents().some((e) => e.type === 'cut')).toBe(true);
    expect(Math.abs(c.d)).toBeLessThanOrEqual(GP_HALF_WIDTH + GP_KERB_W);
    expect(c.speed).toBe(0);
  });

  it('atalho por fora da pista para outro trecho também volta', () => {
    const w = new GpWorld('a', info(1));
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

describe('box', () => {
  it('parar na vaga segura o carro 3 s e devolve pneu novo', () => {
    const w = new GpWorld('a', info(1));
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    const t = w.track;
    c.wear = 0.9;
    put(w, c, GP_PIT_BOX - 8, t.pitCenter(GP_PIT_BOX - 8)!);
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

  it('na faixa do box a velocidade é limitada', () => {
    const w = new GpWorld('a', info(1));
    const c = w.cars[0]!;
    c.surface = 'pit';
    expect(w.vmaxOf(c)).toBeLessThan(GP_VMAX * 0.7);
    c.turbo = 1;
    expect(w.vmaxOf(c)).toBeLessThan(GP_VMAX * 0.7);
  });
});

describe('vácuo e turbo da cauda', () => {
  /** Dois carros na reta, um logo atrás do outro, os dois a 25 m/s. */
  function pair() {
    const w = new GpWorld('a', info(2));
    w.beginRace(['p0', 'p1']);
    const [a, b] = w.cars as [GpCar, GpCar];
    put(w, a, -150, 0);
    put(w, b, -158, 0);
    for (const c of [a, b]) {
      c.vx = Math.sin(c.h) * 25;
      c.vz = -Math.cos(c.h) * 25;
      c.speed = 25;
    }
    w.step(GP_DT, {});
    return { w, a, b };
  }

  it('enche no vácuo de quem está na frente; o líder não enche', () => {
    const { w, a, b } = pair();
    for (let i = 0; i < 1.5 / GP_DT; i++) w.step(GP_DT, { p0: full, p1: full });
    expect(b.bar).toBeGreaterThan(0.2);
    expect(a.bar).toBe(0);
    expect(b.slip).toBeGreaterThan(0);
  });

  it('mais perto enche mais rápido', () => {
    const near = pair();
    const far = pair();
    put(far.w, far.b, -170, 0);
    far.b.vx = Math.sin(far.b.h) * 25;
    far.b.vz = -Math.cos(far.b.h) * 25;
    for (let i = 0; i < 20; i++) {
      near.w.step(GP_DT, { p0: full, p1: full });
      far.w.step(GP_DT, { p0: full, p1: full });
    }
    expect(near.b.bar).toBeGreaterThan(far.b.bar);
  });

  it('turbo só com a barra cheia, esvazia toda, dura 2,5 s e dá +15 % na máxima', () => {
    const { w, b } = pair();
    b.bar = 0.9;
    w.step(GP_DT, { p1: { ...full, turbo: true } });
    expect(b.turbo).toBe(0);
    b.bar = 1;
    w.step(GP_DT, { p1: { ...full, turbo: true } });
    expect(b.turbo).toBeGreaterThan(GP_TURBO_SEC - 0.1);
    expect(b.bar).toBe(0);
    expect(w.vmaxOf(b)).toBeCloseTo(GP_VMAX * (1 + GP_TURBO_GAIN));
    // não acumula: apertar de novo não renova nem enche
    const left = b.turbo;
    w.step(GP_DT, { p1: { ...full, turbo: true } });
    expect(b.turbo).toBeLessThan(left);
    for (let i = 0; i < GP_TURBO_SEC / GP_DT + 5; i++) w.step(GP_DT, { p1: full });
    expect(b.turbo).toBe(0);
  });

  it('a barra não enche durante o turbo', () => {
    const { w, b } = pair();
    b.bar = 1;
    w.step(GP_DT, { p1: { ...full, turbo: true } });
    for (let i = 0; i < 60; i++) w.step(GP_DT, { p0: full, p1: full });
    expect(b.bar).toBe(0);
  });
});

describe('batida', () => {
  it('carros se empurram e não ficam um dentro do outro', () => {
    const w = new GpWorld('a', info(2));
    w.beginRace(['p0', 'p1']);
    const [a, b] = w.cars as [GpCar, GpCar];
    put(w, a, -150, 0);
    put(w, b, -151.5, 0.3);
    w.step(GP_DT, {});
    const dist = Math.hypot(a.x - b.x, a.z - b.z);
    expect(dist).toBeGreaterThan(1.2);
    expect(Math.cos(a.h - w.track.pointAt(-150).h)).toBeGreaterThan(0.99);
  });

  it('na classificação os carros são fantasmas', () => {
    const w = new GpWorld('a', info(2));
    const [a, b] = w.cars as [GpCar, GpCar];
    expect(a.x).toBeCloseTo(b.x);
    w.step(GP_DT, {});
    expect(a.x).toBeCloseTo(b.x);
  });
});

describe('voltas, classificação e chegada', () => {
  it('volta só conta passando a linha para a frente', () => {
    const w = new GpWorld('a', info(1));
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    put(w, c, 5, 0);
    c.h += Math.PI;
    for (let i = 0; i < 3 / GP_DT; i++) w.step(GP_DT, { p0: full });
    expect(c.prog).toBeLessThan(0);
    expect(c.laps.length).toBe(0);
  });

  it('a classificação marca o tempo da volta lançada, e o grid segue os tempos', () => {
    const w = new GpWorld('q', info(4, true));
    runBots(w, 70, () => w.qualiDone(), 'q');
    expect(w.qualiDone()).toBe(true);
    const times = w.cars.map((c) => c.qualiMs);
    expect(times.every((ms) => ms !== null && ms > 25_000 && ms < 60_000)).toBe(true);
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

  it('o tempo da classificação esgota em 60 s', () => {
    const w = new GpWorld('q', info(2));
    for (let i = 0; i < 61 / GP_DT; i++) w.step(GP_DT, {});
    expect(w.qualiDone()).toBe(true);
    expect(w.gridOrder()).toEqual(['p0', 'p1']);
  });

  it('corrida completa com bots: todos terminam, com 3 voltas cada, em cerca de 2 minutos', () => {
    const w = new GpWorld('r', info(6, true));
    runBots(w, 70, () => w.qualiDone(), 'r');
    w.beginRace(w.gridOrder());
    runBots(w, 400, () => w.ended, 'r');
    expect(w.ended).toBe(true);
    const st = w.standings();
    expect(st.filter((r) => r.car.finished).length).toBeGreaterThanOrEqual(5);
    for (const r of st) if (r.car.finished) expect(r.car.laps.length).toBe(GP_LAPS);
    expect(w.firstFinishT!).toBeGreaterThan(100);
    expect(w.firstFinishT!).toBeLessThan(170);
    // a ordem bate com a chegada
    const fin = st.filter((r) => r.car.finished).map((r) => r.car.finishMs!);
    expect([...fin].sort((a, b) => a - b)).toEqual(fin);
    expect(w.fastest).not.toBeNull();
    // o pneu de quem não parou chega perto do limite no fim
    const noPit = st.filter((r) => r.car.pitStops === 0 && r.car.finished);
    expect(noPit.length).toBeGreaterThan(0);
    for (const r of noPit) expect(r.car.wear).toBeGreaterThan(0.6);
  });

  it('30 s depois do primeiro, quem não terminou é DNF, na ordem da distância', () => {
    const w = new GpWorld('d', info(3));
    w.beginRace(['p0', 'p1', 'p2']);
    const [a, b, c] = w.cars as [GpCar, GpCar, GpCar];
    // a quase terminando; b e c parados em pontos diferentes
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
    const w = new GpWorld('g', info(3));
    w.goOnline('p0');
    w.beginRace(['p0', 'p1', 'p2']);
    w.markGone('p1');
    expect(w.standings().at(-1)!.car.id).toBe('p1');
    expect(w.car('p1')!.dnf).toBe(true);
  });

  it('mesma seed e mesmas entradas, mesma corrida', () => {
    const run = () => {
      const w = new GpWorld('same', info(4, true));
      runBots(w, 70, () => w.qualiDone(), 'same');
      w.beginRace(w.gridOrder());
      runBots(w, 60, () => w.ended, 'same');
      return w.cars.map((c) => [c.x.toFixed(4), c.z.toFixed(4), c.wear.toFixed(5), c.bar.toFixed(5)]);
    };
    expect(run()).toEqual(run());
  });
});

describe('tela', () => {
  it('km/h e marcha', () => {
    expect(gpKmh(32)).toBe(320);
    expect(gpGear(0)).toBe(1);
    expect(gpGear(GP_VMAX)).toBeGreaterThanOrEqual(7);
  });
});
