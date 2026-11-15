import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { GP_DT } from './constants';
import {
  GP_BOMB_RADIUS,
  GP_BOX_RADIUS,
  GP_HIT_KEEP,
  GP_STAR_SEC,
  GpItemSystem,
  gpItemBoxes,
  gpItemCount,
  gpItemKind,
  gpItemTier,
  gpRollItem,
  type GpItemId,
} from './items';
import { GpWorld, type GpCar } from './world';

const info = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    color: 0xff7d26,
    bot: false,
  }));

function race(n = 3) {
  const w = new GpWorld('it', info(n), undefined, 'arcade');
  w.beginRace(w.cars.map((c) => c.id));
  const sys = new GpItemSystem(w);
  return { w, sys };
}
function put(w: GpWorld, c: GpCar, s: number, d = 0, speed = 20) {
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
  Object.assign(c, { idx: pr.i, s: pr.s, d: pr.d, prog: s, spin: 0 });
}
const run = (w: GpWorld, sys: GpItemSystem, sec: number, use: Record<string, boolean> = {}) => {
  for (let t = 0; t < sec; t += GP_DT) {
    // mantém os carros no lugar: o teste mede só o sistema de itens
    sys.step(GP_DT, use);
    use = {};
  }
};

describe('item pela posição (spec 085)', () => {
  it('faixas: líder na frente, último atrás, meio no meio', () => {
    expect(gpItemTier(1, 8)).toBe(0);
    expect(gpItemTier(4, 8)).toBe(1);
    expect(gpItemTier(8, 8)).toBe(2);
    expect(gpItemTier(1, 1)).toBe(0);
  });

  it('o líder nunca recebe Cometa azul nem Superfox; o último nunca recebe casca simples', () => {
    const rng = createRng('roll');
    for (let i = 0; i < 2000; i++) {
      const front = gpRollItem(1, 8, rng);
      expect(['bolt', 'star', 'seeker3', 'nitro3']).not.toContain(front);
      const back = gpRollItem(8, 8, rng);
      expect(['peel', 'ball']).not.toContain(back);
    }
  });

  it('quem está atrás vê Cometa azul e Superfox; a distribuição é determinística', () => {
    const seen = new Set<GpItemId>();
    const rng = createRng('roll2');
    for (let i = 0; i < 400; i++) seen.add(gpRollItem(8, 8, rng));
    expect(seen.has('bolt')).toBe(true);
    expect(seen.has('star')).toBe(true);
    const a = createRng('x');
    const b = createRng('x');
    for (let i = 0; i < 50; i++) expect(gpRollItem(5, 8, a)).toBe(gpRollItem(5, 8, b));
  });

  it('triplo conta 3 e o tipo é o do item base', () => {
    expect(gpItemCount('ball3')).toBe(3);
    expect(gpItemCount('bomb')).toBe(1);
    expect(gpItemKind('seeker3')).toBe('seeker');
  });
});

describe('caixas e uso (spec 085)', () => {
  it('as caixas ficam dentro da pista, em fileiras de 3', () => {
    const { w } = race();
    const boxes = gpItemBoxes(w);
    expect(boxes.length % 3).toBe(0);
    expect(boxes.length).toBeGreaterThanOrEqual(9);
    for (const b of boxes) expect(Math.abs(w.track.projectGlobal(b.x, b.z).d)).toBeLessThan(7);
  });

  it('pegar a caixa dá um item e a caixa some e volta', () => {
    const { w, sys } = race();
    const c = w.cars[0]!;
    const b = sys.boxes[0]!;
    c.x = b.x;
    c.z = b.z;
    run(w, sys, GP_DT);
    expect(sys.state(c.id).id).not.toBeNull();
    expect(b.cd).toBeGreaterThan(0);
    expect(sys.drainEvents().some((e) => e.type === 'pickup')).toBe(true);
    run(w, sys, 4);
    expect(b.cd).toBe(0);
  });

  it('quem já tem item não pega outro; a caixa continua ali', () => {
    const { w, sys } = race();
    const c = w.cars[0]!;
    sys.give(c.id, 'peel');
    const b = sys.boxes[0]!;
    c.x = b.x;
    c.z = b.z;
    run(w, sys, GP_DT);
    expect(sys.state(c.id).id).toBe('peel');
    expect(b.cd).toBe(0);
    expect(GP_BOX_RADIUS).toBeGreaterThan(0);
  });

  it('o triplo gasta um por vez, com espera entre os usos', () => {
    const { w, sys } = race(1);
    const c = w.cars[0]!;
    sys.give(c.id, 'ball3');
    run(w, sys, GP_DT, { p0: true });
    expect(sys.state(c.id).left).toBe(2);
    run(w, sys, GP_DT, { p0: true });
    expect(sys.state(c.id).left).toBe(2);
    run(w, sys, 0.6);
    run(w, sys, GP_DT, { p0: true });
    expect(sys.state(c.id).left).toBe(1);
    expect(sys.shots.length).toBeGreaterThanOrEqual(1);
  });
});

describe('efeitos (spec 085)', () => {
  it('casca: quem pisa roda e perde velocidade; o dono não pisa na própria logo ao largar', () => {
    const { w, sys } = race(2);
    const [a, b] = w.cars as [GpCar, GpCar];
    put(w, a, 400, 0, 25);
    put(w, b, 380, 0, 25);
    sys.give(a.id, 'peel');
    run(w, sys, GP_DT, { p0: true });
    expect(sys.traps).toHaveLength(1);
    const t = sys.traps[0]!;
    expect(sys.drainEvents().some((e) => e.type === 'hit')).toBe(false);
    b.x = t.x;
    b.z = t.z;
    const before = b.speed;
    run(w, sys, GP_DT);
    expect(sys.state(b.id).stun).toBeGreaterThan(0);
    expect(b.speed).toBeLessThan(before * (GP_HIT_KEEP + 0.05));
    expect(Math.abs(b.spin)).toBeGreaterThan(3);
    expect(sys.traps).toHaveLength(0);
  });

  it('depois de acertado fica imune um tempo (não toma duas seguidas)', () => {
    const { w, sys } = race(2);
    const [a, b] = w.cars as [GpCar, GpCar];
    put(w, a, 400, 0, 25);
    put(w, b, 380, 0, 25);
    expect(sys.hit(b, a.id, 'peel')).toBe(true);
    expect(sys.hit(b, a.id, 'peel')).toBe(false);
  });

  it('Superfox: invencível, bloqueia acertos e dura o tempo certo', () => {
    const { w, sys } = race(2);
    const [a, b] = w.cars as [GpCar, GpCar];
    put(w, a, 400, 0, 25);
    sys.give(a.id, 'star');
    run(w, sys, GP_DT, { p0: true });
    expect(sys.state(a.id).star).toBeGreaterThan(GP_STAR_SEC - 0.1);
    expect(a.boostLevel).toBeGreaterThanOrEqual(1);
    expect(sys.hit(a, b.id, 'ball')).toBe(false);
    run(w, sys, GP_STAR_SEC + 0.2);
    expect(sys.state(a.id).star).toBe(0);
  });

  it('turbo dá o impulso do kart', () => {
    const { w, sys } = race(1);
    const c = w.cars[0]!;
    sys.give(c.id, 'nitro');
    run(w, sys, GP_DT, { p0: true });
    expect(c.boostT).toBeGreaterThan(1);
    expect(c.boostLevel).toBe(2);
  });

  it('bomba explode em área depois do pavio e acerta quem está perto, não quem está longe', () => {
    const { w, sys } = race(3);
    const [a, b, far] = w.cars as [GpCar, GpCar, GpCar];
    put(w, a, 400, 0, 0);
    sys.give(a.id, 'bomb');
    run(w, sys, GP_DT, { p0: true });
    const bomb = sys.traps[0]!;
    put(w, b, 400, 0, 0);
    b.x = bomb.x + 3;
    b.z = bomb.z;
    far.x = bomb.x + GP_BOMB_RADIUS + 20;
    far.z = bomb.z;
    sys.drainEvents();
    run(w, sys, 3);
    const ev = sys.drainEvents();
    expect(ev.some((e) => e.type === 'boom')).toBe(true);
    expect(ev.some((e) => e.type === 'hit' && e.id === b.id)).toBe(true);
    expect(ev.some((e) => e.type === 'hit' && e.id === far.id)).toBe(false);
    expect(sys.traps).toHaveLength(0);
  });

  it('bola vai reta, quica na parede e some depois de quicar demais', () => {
    const { w, sys } = race(2);
    const [a] = w.cars as [GpCar, GpCar];
    put(w, a, 300, 0, 0);
    w.cars[1]!.gone = true;
    sys.give(a.id, 'ball');
    run(w, sys, GP_DT, { p0: true });
    expect(sys.shots).toHaveLength(1);
    let maxD = 0;
    for (let t = 0; t < 14; t += GP_DT) {
      sys.step(GP_DT);
      for (const s of sys.shots) maxD = Math.max(maxD, Math.abs(w.track.projectGlobal(s.x, s.z).d));
    }
    expect(maxD).toBeLessThan(8);
    expect(sys.shots).toHaveLength(0);
  });

  it('cometa persegue o carro da frente e o acerta', () => {
    const { w, sys } = race(2);
    const [a, b] = w.cars as [GpCar, GpCar];
    put(w, a, 300, 0, 0);
    put(w, b, 420, 3, 0);
    sys.give(a.id, 'seeker');
    run(w, sys, GP_DT, { p0: true });
    expect(sys.shots[0]!.target).toBe(b.id);
    sys.drainEvents();
    run(w, sys, 8);
    expect(
      sys.drainEvents().some((e) => e.type === 'hit' && e.id === b.id && e.kind === 'seeker'),
    ).toBe(true);
  });

  it('cometa azul vai atrás do líder, nunca do dono', () => {
    const { w, sys } = race(3);
    const [a, b, lead] = w.cars as [GpCar, GpCar, GpCar];
    put(w, a, 200, 0, 0);
    put(w, b, 300, 0, 0);
    put(w, lead, 500, 0, 0);
    sys.give(a.id, 'bolt');
    run(w, sys, GP_DT, { p0: true });
    expect(sys.shots[0]!.target).toBe(lead.id);
    sys.drainEvents();
    run(w, sys, 10);
    const ev = sys.drainEvents();
    expect(ev.some((e) => e.type === 'hit' && e.id === lead.id && e.kind === 'bolt')).toBe(true);
    expect(ev.some((e) => e.type === 'hit' && e.id === b.id)).toBe(false);
  });

  it('é determinístico: mesma seed, mesmos itens', () => {
    const run1 = () => {
      const { w, sys } = race(3);
      for (let i = 0; i < 6; i++) {
        const c = w.cars[i % 3]!;
        const b = sys.boxes[i * 2]!;
        c.x = b.x;
        c.z = b.z;
        c.prog = 100 * i;
        sys.step(GP_DT);
      }
      return w.cars.map((c) => sys.state(c.id).id).join(',');
    };
    expect(run1()).toBe(run1());
  });
});
