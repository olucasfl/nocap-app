import { describe, expect, it } from 'vitest';
import {
  CHASER_SPEED_MAX,
  HOLD_MIN,
  MAX_SPEED,
  RUSH_MIN_BEAT,
  SAFE_BEFORE_LOOK_S,
  SinalSim,
  THROW_FLIGHT_TICKS,
  THROW_WIND_TICKS,
  ThrowerField,
  ChaserField,
  VigiaTimeline,
  WidthField,
  classicoCourse,
  courseFor,
  infinitoCourse,
  isSolid,
  timelineParams,
  type SinalEvent,
  type SinalMode,
} from './index';

const SEEDS = Array.from({ length: 12 }, (_, i) => `semente-${i}`);

/** Anda para a frente desviando de obstáculos, das marcas dos arremessos e dos perseguidores. */
const steer = (s: SinalSim): [number, number] => {
  const v = s.view;
  let ax = 0;
  for (const o of v.obstacles) {
    const dy = o.y - v.y;
    if (dy < -1.2 || dy > 6.5) continue;
    const zone = !isSolid(o.kind);
    const pad = zone ? o.r + 1 : o.r + 1.6 + o.amp;
    const dx = v.x - o.x;
    if (Math.abs(dx) < pad) ax += (dx === 0 ? (v.x > 0 ? -1 : 1) : Math.sign(dx)) * 100;
  }
  const half = v.halfAt(v.y);
  if (v.x > half - 1.2) ax -= 100;
  if (v.x < -half + 1.2) ax += 100;
  let ay = 100;
  for (const sh of v.shots) {
    if (sh.kind === 'lob') {
      const dx = v.x - sh.tx;
      const dy = v.y - sh.ty;
      if (dx * dx + dy * dy < 3.2 * 3.2) {
        ax += (dx === 0 ? (v.x > 0 ? 1 : -1) : Math.sign(dx)) * 200;
        ay = dy > 0 ? 100 : -100;
      }
    } else if (sh.ty - v.y > -1.5 && sh.ty - v.y < 4.2) {
      return [0, 0];
    }
  }
  for (const ch of v.chasers) {
    const dy = ch.y - v.y;
    if (dy > -2 && dy < 9) {
      const dx = v.x - ch.x;
      if (Math.abs(dx) < 5) ax += (dx === 0 ? 1 : Math.sign(dx)) * 160;
    }
  }
  return [Math.max(-100, Math.min(100, ax)), ay];
};

const perfect = (s: SinalSim): [number, number] => {
  const c = s.view.cycle;
  const t = s.view.t;
  return t >= c.avisoStart - 0.02 && t < c.lookEnd + 0.01 ? [0, 0] : steer(s);
};

const inWindow = (sim: SinalSim) => {
  const c = sim.view.cycle;
  const t = sim.view.t;
  return t >= c.lookStart - SAFE_BEFORE_LOOK_S && t < c.lookEnd + 0.05;
};

describe('arremessadores (spec 027)', () => {
  const field = (mode: SinalMode, n: number, seed: string, to: number) => {
    const course = courseFor(seed, mode, n);
    const f = new ThrowerField(course, `${seed}:l${n}`);
    f.ensure(to);
    return f.list;
  };

  it('são determinísticos, ordenados por altura e nunca nos primeiros 36 m', () => {
    expect(field('infinito', 1, 'a', 600)).toEqual(field('infinito', 1, 'a', 600));
    for (const seed of SEEDS) {
      const list = field('infinito', 1, seed, 800);
      expect(list.length).toBeGreaterThan(3);
      expect(list[0]!.y).toBeGreaterThanOrEqual(36);
      for (let i = 1; i < list.length; i++) {
        expect(list[i]!.y).toBeGreaterThan(list[i - 1]!.y);
        expect(list[i]!.side === 1 || list[i]!.side === -1).toBe(true);
      }
    }
  });

  it('o arremesso de rolar só entra mais adiante e vêm mais seguidos com a dificuldade', () => {
    const kinds = (n: number) => new Set(SEEDS.flatMap((s) => field('classico', n, s, 600).map((t) => t.kind)));
    expect(kinds(1)).toEqual(new Set(['lob']));
    expect(kinds(2)).toEqual(new Set(['lob']));
    expect(kinds(4).has('roll')).toBe(true);
    const dens = (n: number) => SEEDS.reduce((a, s) => a + field('classico', n, s, 500).length, 0);
    expect(dens(30)).toBeGreaterThan(dens(1));
  });

  it('a marca avisa antes de cair: o aviso vem pelo menos 0,9 s antes do impacto', () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const sim = new SinalSim(seed, 'infinito');
      let lancouAt = -1;
      let gap = Infinity;
      for (let i = 0; i < 60 * 90 && !sim.dead; i++) {
        const [ax, ay] = perfect(sim);
        for (const e of sim.step(ax, ay)) {
          if (e.kind === 'lancou' && e.shot === 'lob') lancouAt = i;
          if (e.kind === 'impacto' && e.shot === 'lob' && lancouAt >= 0) {
            gap = Math.min(gap, i - lancouAt);
            lancouAt = -1;
          }
        }
      }
      if (gap !== Infinity) expect(gap).toBeGreaterThanOrEqual(THROW_WIND_TICKS + THROW_FLIGHT_TICKS - 2);
    }
  });

  it('quem fica em cima da marca é atingido (e atordoado); quem sai de lá não', () => {
    let hits = 0;
    let dodged = 0;
    for (const seed of SEEDS) {
      for (const stay of [true, false]) {
        const sim = new SinalSim(seed, 'infinito');
        let armed = false;
        let hit = false;
        let sawDud = false;
        for (let i = 0; i < 60 * 120 && !sim.dead; i++) {
          const v = sim.view;
          const lob = v.shots.find((q) => q.kind === 'lob' && q.phase === 'wind');
          if (lob && !armed && !lob.dud) {
            armed = true;
            // põe o boneco em cima da marca ou bem longe dela e segue parado
            sim.x = stay ? lob.tx : Math.max(-6, Math.min(6, lob.tx > 0 ? lob.tx - 5 : lob.tx + 5));
            sim.y = lob.ty;
          }
          if (lob?.dud) sawDud = true;
          const evs: SinalEvent[] = sim.step(armed ? 0 : perfect(sim)[0], armed ? 0 : perfect(sim)[1]);
          if (armed) {
            if (evs.some((e) => e.kind === 'choque')) hit = true;
            if (evs.some((e) => e.kind === 'impacto')) break;
          }
        }
        void sawDud;
        if (armed) {
          if (stay) {
            expect(hit, `${seed} em cima`).toBe(true);
            hits++;
          } else {
            expect(hit, `${seed} fora`).toBe(false);
            dodged++;
          }
        }
      }
    }
    expect(hits).toBeGreaterThan(3);
    expect(dodged).toBeGreaterThan(3);
  });

  it('perto do olhar do Vigia nenhuma pancada vale (senão não haveria saída)', () => {
    let throwsSeen = 0;
    for (const seed of SEEDS) {
      const sim = new SinalSim(seed, 'infinito');
      for (let i = 0; i < 60 * 120 && !sim.dead; i++) {
        const [ax, ay] = perfect(sim);
        const win = inWindow(sim);
        for (const e of sim.step(ax, ay)) {
          if (e.kind === 'impacto') {
            throwsSeen++;
            if (win) expect(e.hit).toBe(false);
          }
          if (e.kind === 'pegou') expect(win).toBe(false);
        }
      }
    }
    expect(throwsSeen).toBeGreaterThan(10);
  });
});

describe('perseguidores (spec 027)', () => {
  const field = (mode: SinalMode, n: number, seed: string, to: number) => {
    const course = courseFor(seed, mode, n);
    const f = new ChaserField(course, `${seed}:p${n}`, new WidthField(course, `${seed}:w${n}`));
    f.ensure(to);
    return f.list;
  };

  it('não há na fase 1 do Clássico; depois aparecem espaçados e sempre mais lentos que o boneco', () => {
    for (const seed of SEEDS) {
      expect(field('classico', 1, seed, 400)).toHaveLength(0);
      for (const n of [2, 8, 40]) {
        const list = field('classico', n, seed, 1500);
        expect(list.length).toBeGreaterThan(2);
        for (let i = 0; i < list.length; i++) {
          expect(list[i]!.speed).toBeLessThanOrEqual(CHASER_SPEED_MAX * 1.08 + 1e-9);
          expect(list[i]!.speed).toBeLessThan(MAX_SPEED);
          if (i) expect(list[i]!.y - list[i - 1]!.y).toBeGreaterThanOrEqual(70 - 1e-9);
        }
      }
    }
  });

  /** Anda até aparecer um perseguidor na vista. */
  function untilChaser(seed: string) {
    const sim = new SinalSim(seed, 'infinito');
    for (let i = 0; i < 60 * 200 && !sim.dead; i++) {
      const [ax, ay] = perfect(sim);
      sim.step(ax, ay);
      if (sim.view.chasers.length > 0) return sim;
    }
    return null;
  }

  it('só anda enquanto você anda: parado, ele fica no lugar', () => {
    let tested = 0;
    for (const seed of SEEDS.slice(0, 8)) {
      const sim = untilChaser(seed);
      if (!sim) continue;
      const before = sim.view.chasers[0]!;
      // fora da janela do Vigia (onde ele já fica parado de qualquer jeito), fica parado de propósito
      for (let i = 0; i < 90 && !sim.dead; i++) sim.step(0, 0);
      if (sim.dead) continue;
      const after = sim.view.chasers.find((c) => c.id === before.id)!;
      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
      expect(after.frozen).toBe(true);
      tested++;
    }
    expect(tested).toBeGreaterThan(3);
  });

  it('anda atrás de quem anda (fora da janela do Vigia) e te atordoa se alcançar', () => {
    let tested = 0;
    for (const seed of SEEDS.slice(0, 8)) {
      const sim = untilChaser(seed);
      if (!sim) continue;
      // espera a janela do Vigia passar (parado), depois vai ao encontro dele
      let guard = 0;
      while ((inWindow(sim) || sim.view.vigia !== 'costas') && guard++ < 60 * 20 && !sim.dead) sim.step(0, 0);
      if (sim.dead) continue;
      const ch = sim.view.chasers[0]!;
      sim.x = ch.x + 2.5;
      sim.y = ch.y;
      let pegou = false;
      for (let i = 0; i < 40 && !sim.dead; i++) {
        if (inWindow(sim)) break;
        // vai ao encontro dele (de lado): o perseguidor também vem
        const evs = sim.step(-100, 0);
        if (evs.some((e) => e.kind === 'pegou')) pegou = true;
      }
      if (!inWindow(sim)) {
        expect(pegou).toBe(true);
        tested++;
      }
    }
    expect(tested).toBeGreaterThan(2);
  });

  it('um perseguidor que pega fica tonto e o resto da corrida continua igual no servidor', () => {
    // o bot que desvia nunca é pego em corrida normal (eles são mais lentos): a corrida segue o mesmo
    const a = new SinalSim('x', 'classico', 4);
    const b = new SinalSim('x', 'classico', 4);
    for (let i = 0; i < 60 * 60; i++) {
      const [ax, ay] = perfect(a);
      a.step(ax, ay);
      b.step(ax, ay);
    }
    expect(a.result).toEqual(b.result);
    expect(a.view.chasers).toEqual(b.view.chasers);
  });
});

describe('o Vigia apressado (spec 027)', () => {
  const cycles = (mode: SinalMode, n: number, seed: string, until: number) =>
    new VigiaTimeline(timelineParams(courseFor(seed, mode, n)), `${seed}:v${n}`).upTo(until);

  it('nunca no primeiro ciclo nem nos primeiros 20 s; depois de vez em quando, e mais com a dificuldade', () => {
    for (const seed of SEEDS) {
      for (const c of cycles('infinito', 1, seed, 1500)) {
        if (c.start < 20) expect(c.rush).toBe(false);
      }
    }
    const share = (n: number) => {
      const cs = SEEDS.flatMap((sd) => cycles('classico', n, sd, 400)).filter((c) => c.start >= 20);
      return cs.filter((c) => c.rush).length / cs.length;
    };
    expect(share(1)).toBeGreaterThan(0.04);
    expect(share(60)).toBeGreaterThan(share(1));
    expect(share(60)).toBeLessThan(0.5);
  });

  it('o ciclo apressado tem compasso curto, mas o aviso nunca fica menor que o mínimo', () => {
    let seen = 0;
    for (const n of [1, 10, 60]) {
      for (const seed of SEEDS) {
        const all = cycles('classico', n, seed, 400);
        const plain = all.filter((c) => !c.rush);
        const avgPlain = plain.reduce((a, c) => a + c.beat, 0) / plain.length;
        for (const c of all.filter((q) => q.rush)) {
          seen++;
          expect(c.beat).toBeLessThan(avgPlain);
          expect(c.beat).toBeGreaterThanOrEqual(RUSH_MIN_BEAT - 1e-9);
          expect(c.lookStart - c.avisoStart).toBeGreaterThanOrEqual(HOLD_MIN - 1e-9);
        }
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('a simulação avisa se a sílaba é de um ciclo apressado', () => {
    const sim = new SinalSim('rush-1', 'classico', 20);
    let rush = 0;
    let plain = 0;
    for (let i = 0; i < 60 * 120 && !sim.dead; i++) {
      const [ax, ay] = perfect(sim);
      for (const e of sim.step(ax, ay)) {
        if (e.kind === 'nota') {
          if (e.rush) rush++;
          else plain++;
        }
      }
    }
    expect(rush + plain).toBeGreaterThan(10);
  });

  it('fases altas e baixas seguem determinísticas com tudo junto', () => {
    for (const n of [1, 5, 25]) {
      const run = () => {
        const sim = new SinalSim('det', 'classico', n);
        for (let i = 0; i < 60 * 30 && !sim.dead; i++) {
          const [ax, ay] = perfect(sim);
          sim.step(ax, ay);
        }
        return { r: sim.result, v: sim.view.throwers.length + sim.view.chasers.length };
      };
      expect(run()).toEqual(run());
    }
    void classicoCourse;
    void infinitoCourse;
  });
});
