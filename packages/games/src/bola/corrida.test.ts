import { describe, expect, it } from 'vitest';
import { BolPredictor, type BodyEvent } from './body';
import {
  BOL_DT,
  BOL_RUN_SPEED,
  BOL_SPEED,
  BOL_STAM_HOLD,
  BOL_STAM_MAX,
  BOL_STAM_MIN,
  BOL_STAM_TIRED_HOLD,
} from './constants';
import { buildField } from './field';
import type { BolInput } from './world';

const mk = () => new BolPredictor(buildField(2, 1));
const go = (
  pr: BolPredictor,
  sec: number,
  input: Partial<BolInput>,
  ev?: (e: BodyEvent) => void,
) => {
  for (let i = 0; i < Math.round(sec / BOL_DT); i++) {
    // fica no meio do campo: o teste é do fôlego, não da parede
    pr.body.x = 0;
    pr.body.z = 0;
    pr.step(BOL_DT, { mx: 1, mz: 0, jump: false, ...input }, ev);
  }
};
const speed = (pr: BolPredictor) => Math.hypot(pr.body.vx, pr.body.vz);

describe('corrida e fôlego', () => {
  it('correndo vai mais rápido que andando, e só com direção', () => {
    const a = mk();
    go(a, 2, {});
    expect(speed(a)).toBeCloseTo(BOL_SPEED, 1);
    const b = mk();
    go(b, 2, { run: true });
    expect(speed(b)).toBeCloseTo(BOL_RUN_SPEED, 1);
    // parada, segurar correr não gasta fôlego
    const c = mk();
    go(c, 2, { run: true, mx: 0, mz: 0 });
    expect(c.body.stam).toBe(BOL_STAM_MAX);
    expect(c.body.running).toBe(false);
  });

  it('correndo acelera mais devagar que andando', () => {
    const walk = mk();
    const run = mk();
    go(walk, 0.15, {});
    go(run, 0.15, { run: true });
    expect(speed(run)).toBeLessThan(speed(walk));
  });

  it('o fôlego acaba em cerca de 2,8 s; esgotada, volta a andar e só corre de novo com o mínimo', () => {
    const pr = mk();
    go(pr, 2.4, { run: true });
    expect(pr.body.stam).toBeGreaterThan(5);
    expect(pr.body.running).toBe(true);
    go(pr, 1, { run: true });
    expect(pr.body.stam).toBe(0);
    expect(pr.body.tired).toBe(true);
    expect(pr.body.running).toBe(false);
    go(pr, 1, { run: true });
    expect(speed(pr)).toBeCloseTo(BOL_SPEED, 1);
    // solta e espera: a recarga só começa depois da pausa do esgotamento e ela volta a correr só ao passar do mínimo
    let t = 0;
    while (pr.body.tired && t < 10) {
      go(pr, BOL_DT, {});
      t += BOL_DT;
    }
    expect(t).toBeGreaterThan(BOL_STAM_TIRED_HOLD - 1.1);
    expect(pr.body.stam).toBeGreaterThanOrEqual(BOL_STAM_MIN);
    go(pr, 0.1, { run: true });
    expect(pr.body.running).toBe(true);
  });

  it('parou antes de esgotar: o nível fica congelado por um tempo e só depois recarrega devagar', () => {
    const pr = mk();
    go(pr, 1.5, { run: true });
    const level = pr.body.stam;
    expect(level).toBeLessThan(BOL_STAM_MAX - 20);
    go(pr, BOL_STAM_HOLD - 0.2, {});
    expect(pr.body.stam).toBeCloseTo(level, 5);
    go(pr, 0.6, {});
    expect(pr.body.stam).toBeGreaterThan(level);
    go(pr, 1, {});
    // devagar: um segundo recarrega bem menos do que um segundo corrido gasta
    expect(pr.body.stam - level).toBeLessThan(20);
  });

  it('esgotada, apertar correr avisa ("tired") uma vez por aperto, não a cada passo', () => {
    const pr = mk();
    go(pr, 4.5, { run: true });
    expect(pr.body.tired).toBe(true);
    let nopes = 0;
    go(pr, 1, { run: true }, (e) => e === 'tired' && nopes++);
    expect(nopes).toBe(0);
    go(pr, 0.2, {});
    go(pr, 0.5, { run: true }, (e) => e === 'tired' && nopes++);
    expect(nopes).toBe(1);
  });

  it('no meio do mortal não corre', () => {
    const pr = mk();
    go(pr, 0.5, { run: true });
    pr.body.flipT = 0.3;
    go(pr, BOL_DT, { run: true });
    expect(pr.body.running).toBe(false);
  });
});
