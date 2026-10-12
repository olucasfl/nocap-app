import { describe, expect, it } from 'vitest';
import {
  BOSS_POWERS,
  OWN_POWERS,
  CoverField,
  DARK_CAP,
  DT,
  HALF,
  MAX_SPEED,
  PHASES_PER_MAP,
  POWER_AVISO_MARGIN_S,
  POWER_RECOVERY_S,
  POWER_SPECS,
  SINAL_MAPS,
  SinalSim,
  VigiaTimeline,
  classicoCourse,
  courseFor,
  darkSpeed,
  evaluateSinal,
  infinitoCourse,
  isSinalMode,
  mapOrder,
  phaseDifficulty,
  sinalMode,
  timelineParams,
  validateSinalInputs,
  type SinalEvent,
  type SinalMode,
} from './index';

const SEEDS = Array.from({ length: 12 }, (_, i) => `semente-${i}`);

/** Roda a corrida com uma política que decide o analógico a cada passo. */
function run(sim: SinalSim, policy: (s: SinalSim) => [number, number], maxTicks: number) {
  const events: SinalEvent[] = [];
  for (let i = 0; i < maxTicks && !sim.dead; i++) {
    const [ax, ay] = policy(sim);
    events.push(...sim.step(ax, ay));
  }
  return events;
}

/** Anda para a frente desviando dos obstáculos que estão logo adiante. */
const steer = (s: SinalSim): [number, number] => {
  const v = s.view;
  let ax = 0;
  for (const o of v.obstacles) {
    const dy = o.y - v.y;
    if (dy > -0.5 && dy < 5) {
      const dx = v.x - o.x;
      if (Math.abs(dx) < o.r + 1.2) ax += (dx === 0 ? (v.x > 0 ? -1 : 1) : Math.sign(dx)) * 100;
    }
  }
  return [Math.max(-100, Math.min(100, ax)), 100];
};

/** Quem sabe o ciclo do Vigia: para quando o aviso começa (inclusive o do olhar duplo) e anda no resto. */
const perfect = (s: SinalSim): [number, number] => {
  const t = s.view.t;
  const c = s.vigiaTimeline.cycleAt(t);
  const a = c.again;
  const stop =
    (t >= c.avisoStart - 0.02 && t < c.lookEnd + 0.01) ||
    (!!a && t >= a.avisoStart - 0.02 && t < a.lookEnd + 0.01);
  return stop ? [0, 0] : steer(s);
};

describe('modos e ids', () => {
  it('dois modos, guardados como sinal-infinito e sinal-classico', () => {
    expect(isSinalMode('infinito')).toBe(true);
    expect(isSinalMode('classico')).toBe(true);
    expect(isSinalMode('outro')).toBe(false);
    expect(sinalMode('infinito')).toBe('sinal-infinito');
    expect(sinalMode('classico')).toBe('sinal-classico');
  });
});

describe('o Vigia', () => {
  it('é determinístico: a mesma seed dá o mesmo ciclo, outra seed dá outro', () => {
    for (const mode of ['infinito', 'classico'] as SinalMode[]) {
      const mk = (seed: string) =>
        new VigiaTimeline(timelineParams(courseFor(seed, mode, 3)), `${seed}:vigia`).upTo(120);
      expect(mk('a')).toEqual(mk('a'));
      expect(mk('a')).not.toEqual(mk('b'));
    }
  });

  it('tem os quatro estados em ordem e o primeiro ciclo só começa depois da pessoa se situar', () => {
    const tl = new VigiaTimeline(timelineParams(infinitoCourse('x')), 'x');
    const c = tl.cycleAt(0);
    expect(c.start).toBeGreaterThanOrEqual(2);
    expect(c.avisoStart).toBeGreaterThan(c.start);
    expect(c.lookStart).toBeGreaterThan(c.avisoStart);
    expect(c.lookEnd).toBeGreaterThan(c.lookStart);
    expect(c.end).toBeGreaterThan(c.lookEnd);
  });

  it('fica mais ligeiro com o tempo (Infinito) e com a fase (Clássico)', () => {
    const slow = new VigiaTimeline(timelineParams(infinitoCourse('x')), 'x').upTo(60);
    const fast = new VigiaTimeline(timelineParams(infinitoCourse('x')), 'x').upTo(1200);
    const avg = (cs: typeof slow) => cs.reduce((s, c) => s + (c.avisoStart - c.start), 0) / cs.length;
    const early = slow.slice(0, 3);
    const late = fast.slice(-6);
    expect(avg(late)).toBeLessThan(avg(early));
    const dur = (n: number) => {
      const cs = new VigiaTimeline(timelineParams(classicoCourse('x', n)), `x${n}`).upTo(120);
      return cs.reduce((s, c) => s + (c.avisoStart - c.start), 0) / cs.length;
    };
    expect(dur(1)).toBeGreaterThan(dur(12));
  });

  it('o aviso fica mais curto que antes de olhar, mas nunca some', () => {
    for (const n of [1, 8, 40]) {
      const tl = new VigiaTimeline(timelineParams(classicoCourse('s', n)), `s${n}`);
      for (const c of tl.upTo(90)) expect(c.lookStart - c.avisoStart).toBeGreaterThanOrEqual(0.3 - 1e-9);
    }
  });

  it('falso aviso: nunca no começo, e depois de vez em quando', () => {
    // Infinito: nenhum falso aviso no primeiro minuto
    for (const seed of SEEDS) {
      const early = new VigiaTimeline(timelineParams(infinitoCourse(seed)), seed).upTo(44);
      expect(early.some((c) => c.fake)).toBe(false);
    }
    const later = SEEDS.flatMap((seed) =>
      new VigiaTimeline(timelineParams(infinitoCourse(seed)), seed).upTo(900),
    );
    expect(later.some((c) => c.fake)).toBe(true);
    // Clássico: nenhum na fase 1, alguns da fase 2 em diante
    const phase = (n: number) =>
      SEEDS.flatMap((seed) =>
        new VigiaTimeline(timelineParams(classicoCourse(seed, n)), `${seed}${n}`).upTo(200),
      );
    expect(phase(1).some((c) => c.fake)).toBe(false);
    expect(phase(4).some((c) => c.fake)).toBe(true);
    // Raro: é uma minoria dos ciclos
    const p4 = phase(4);
    expect(p4.filter((c) => c.fake).length / p4.length).toBeLessThan(0.4);
  });
});

describe('poderes: equidade', () => {
  const timelines = () => {
    const out: { label: string; cycles: ReturnType<VigiaTimeline['upTo']> }[] = [];
    for (const seed of SEEDS) {
      out.push({ label: `inf ${seed}`, cycles: new VigiaTimeline(timelineParams(infinitoCourse(seed)), seed).upTo(900) });
      for (const n of [1, 2, 3, 5, 6, 10, 15, 25, 60]) {
        out.push({
          label: `cla ${seed} ${n}`,
          cycles: new VigiaTimeline(timelineParams(classicoCourse(seed, n)), `${seed}${n}`).upTo(300),
        });
      }
    }
    return out;
  };

  it('só no período de costas, avisados antes e terminando bem antes do próximo olhar', () => {
    let total = 0;
    for (const { label, cycles } of timelines()) {
      for (const c of cycles) {
        let prevEnd = c.start;
        for (const p of c.powers) {
          total++;
          const spec = POWER_SPECS[p.kind];
          expect(p.effectStart - p.teleStart, label).toBeCloseTo(spec.tele, 6);
          expect(p.effectEnd - p.effectStart, label).toBeCloseTo(spec.effect, 6);
          expect(p.teleStart, label).toBeGreaterThanOrEqual(c.start);
          // termina com pelo menos 1,2 s de folga antes do olhar e antes do aviso começar
          expect(p.effectEnd, label).toBeLessThanOrEqual(c.lookStart - POWER_RECOVERY_S + 1e-9);
          expect(p.effectEnd, label).toBeLessThanOrEqual(c.avisoStart - POWER_AVISO_MARGIN_S + 1e-9);
          // um poder por vez
          expect(p.teleStart, label).toBeGreaterThanOrEqual(prevEnd - 1e-9);
          prevEnd = p.effectEnd;
          // efeito curto
          expect(spec.effect).toBeLessThanOrEqual(3);
        }
      }
    }
    expect(total).toBeGreaterThan(200);
  });

  it('o intervalo entre poderes respeita o mínimo do Vigia comum', () => {
    for (const seed of SEEDS) {
      const cs = new VigiaTimeline(timelineParams(classicoCourse(seed, 2)), seed).upTo(600);
      const ends = cs.flatMap((c) => c.powers.map((p) => [p.teleStart, p.effectEnd] as const));
      for (let i = 1; i < ends.length; i++) expect(ends[i]![0] - ends[i - 1]![1]).toBeGreaterThanOrEqual(2.5 - 1e-9);
    }
  });

  it('cada Vigia comum solta só os seus poderes, e o chefe solta vários, até dois seguidos', () => {
    for (const seed of SEEDS) {
      for (const n of [2, 3, 4, 7, 8, 9]) {
        const course = classicoCourse(seed, n);
        const cs = new VigiaTimeline(timelineParams(course), `${seed}${n}`).upTo(400);
        for (const p of cs.flatMap((c) => c.powers)) expect(OWN_POWERS[course.map]).toContain(p.kind);
      }
    }
    const kinds = new Set<string>();
    let chained = 0;
    for (const seed of SEEDS) {
      for (const n of [5, 10, 15]) {
        const course = classicoCourse(seed, n);
        expect(course.boss).toBe(true);
        for (const c of new VigiaTimeline(timelineParams(course), `${seed}${n}`).upTo(400)) {
          c.powers.forEach((p) => kinds.add(p.kind));
          if (c.powers.length === 2) chained++;
        }
      }
    }
    for (const k of BOSS_POWERS) expect(kinds.has(k)).toBe(true);
    expect(chained).toBeGreaterThan(0);
  });

  it('o Infinito começa só com os poderes do mapa e a reserva vai crescendo com o tempo', () => {
    const late = new Set<string>();
    for (const seed of SEEDS) {
      const c = infinitoCourse(seed);
      for (const cy of new VigiaTimeline(timelineParams(c), seed).upTo(1500)) {
        for (const p of cy.powers) {
          if (cy.start < 45) expect(OWN_POWERS[c.map]).toContain(p.kind);
          else late.add(p.kind);
        }
      }
    }
    expect(late.size).toBeGreaterThan(8);
  });

  it('há poder já no começo do Infinito e do Clássico, e os ciclos do Vigia são variados', () => {
    let early = 0;
    const kinds = new Set<string>();
    for (const seed of SEEDS) {
      const inf = new VigiaTimeline(timelineParams(infinitoCourse(seed)), seed).upTo(40);
      early += inf.reduce((n, c) => n + c.powers.length, 0);
      const cla = new VigiaTimeline(timelineParams(classicoCourse(seed, 1)), seed + 'c').upTo(60);
      early += cla.reduce((n, c) => n + c.powers.length, 0);
      for (const c of cla) kinds.add(c.kind);
      for (const c of new VigiaTimeline(timelineParams(classicoCourse(seed, 6)), seed + 'd').upTo(200)) kinds.add(c.kind);
    }
    expect(early).toBeGreaterThan(20);
    expect([...kinds].sort()).toEqual(['duplo', 'espia', 'longo', 'normal', 'rapido']);
  });

  it('os intervalos e as durações não são lineares: variam bastante de um ciclo para o outro', () => {
    for (const seed of SEEDS) {
      const cs = new VigiaTimeline(timelineParams(classicoCourse(seed, 3)), seed).upTo(300);
      const costas = cs.map((c) => c.avisoStart - c.start);
      const avisos = cs.map((c) => c.lookStart - c.avisoStart);
      const spread = (xs: number[]) => Math.max(...xs) / Math.min(...xs);
      expect(spread(costas)).toBeGreaterThan(2);
      expect(spread(avisos)).toBeGreaterThan(1.5);
    }
  });

  it('um jogador que reage ao aviso nunca perde por causa de um poder (nem do Vigia)', () => {
    for (const seed of SEEDS) {
      const sim = new SinalSim(seed, 'infinito');
      run(sim, perfect, 60 * 600);
      expect(sim.result.ended === null || sim.result.ended === 'escuridao', seed).toBe(true);
    }
    // e no Clássico, até o chefe da primeira rodada
    for (const seed of SEEDS) {
      const sim = new SinalSim(seed, 'classico');
      run(sim, perfect, 60 * 600);
      expect(sim.result.ended === null || sim.result.ended === 'escuridao', seed).toBe(true);
    }
  });
});

describe('a simulação', () => {
  it('é determinística: os mesmos movimentos dão o mesmo resultado', () => {
    const inputs = Array.from({ length: 50 }, (_, i) => ({ tick: i * 40, x: (i * 37) % 100, y: (i * 53) % 100 - 20 }));
    for (const mode of ['infinito', 'classico'] as SinalMode[]) {
      expect(evaluateSinal('s', mode, inputs)).toEqual(evaluateSinal('s', mode, inputs));
    }
  });

  it('o servidor refaz exatamente a corrida do jogo (mesmos passos, mesmo resultado)', () => {
    for (const mode of ['infinito', 'classico'] as SinalMode[]) {
      const sim = new SinalSim('x', mode);
      const inputs: { tick: number; x: number; y: number }[] = [];
      let last = ['', ''];
      for (let i = 0; i < 60 * 300 && !sim.dead; i++) {
        const [ax, ay] = perfect(sim);
        const key = [String(ax), String(ay)];
        if (key[0] !== last[0] || key[1] !== last[1]) {
          inputs.push({ tick: i, x: ax, y: ay });
          last = key;
        }
        sim.step(ax, ay);
      }
      const redone = evaluateSinal('x', mode, inputs, 60 * 300);
      expect(redone).toEqual(sim.result);
    }
  });

  it('quem corre sem parar é pego pelo Vigia', () => {
    for (const seed of SEEDS) {
      const sim = new SinalSim(seed, 'infinito');
      run(sim, () => [0, 100], 60 * 120);
      expect(sim.result.ended, seed).toBe('vigia');
      expect(sim.result.endedTick / 60).toBeLessThan(25);
    }
  });

  it('quem anda só quando é seguro vai longe, e a nota é a distância', () => {
    const sim = new SinalSim('x', 'infinito');
    run(sim, perfect, 60 * 120);
    expect(sim.result.meters).toBeGreaterThan(150);
    expect(sim.result.tenths).toBe(Math.round(sim.result.meters * 10));
  });

  it('o analógico mexe o boneco na direção certa, com zona morta e limite de velocidade', () => {
    const sim = new SinalSim('x', 'infinito');
    for (let i = 0; i < 30; i++) sim.step(5, 5); // dentro da zona morta
    expect(sim.x).toBe(0);
    expect(sim.y).toBe(0);
    const t0 = sim.y;
    for (let i = 0; i < 60; i++) sim.step(0, 100);
    expect(sim.y - t0).toBeCloseTo(MAX_SPEED, 3);
    // na diagonal não anda mais rápido que o máximo
    const a = new SinalSim('x', 'infinito');
    for (let i = 0; i < 30; i++) a.step(100, 100);
    expect(Math.sqrt(a.x * a.x + a.y * a.y)).toBeCloseTo(MAX_SPEED * 0.5, 2);
  });

  it('o corredor tem paredes dos lados', () => {
    const sim = new SinalSim('x', 'infinito');
    for (let i = 0; i < 300; i++) sim.step(100, 0);
    expect(sim.x).toBeLessThanOrEqual(HALF);
    expect(sim.x).toBeGreaterThan(HALF - 1);
  });

  it('o Vigia só pega quem se mexe depois da folga, e parado ninguém é pego', () => {
    // parado: nunca pego pelo Vigia
    const still = new SinalSim('x', 'infinito');
    run(still, () => [0, 0], 60 * 20);
    expect(still.result.ended).not.toBe('vigia');
  });

  it('o falso aviso não pega ninguém: andar nele é seguro', () => {
    let tested = 0;
    for (const seed of SEEDS) {
      const sim = new SinalSim(seed, 'infinito');
      const fake = sim.vigiaTimeline.upTo(900).find((c) => c.fake);
      if (!fake) continue;
      tested++;
      // anda sempre, menos nos ciclos de verdade; no falso aviso continua andando
      const ev = run(
        sim,
        (s) => {
          const t = s.view.t;
          const c = s.vigiaTimeline.cycleAt(t);
          const a = c.again;
          const stop =
            (!c.fake && t >= c.avisoStart - 0.02 && t < c.lookEnd + 0.01) ||
            (!!a && t >= a.avisoStart - 0.02 && t < a.lookEnd + 0.01);
          return stop ? [0, 0] : steer(s);
        },
        Math.round((fake.lookEnd + 1) * 60),
      );
      expect(ev.some((e) => e.kind === 'fim' && e.reason === 'vigia'), seed).toBe(false);
    }
    expect(tested).toBeGreaterThan(0);
  });
});

describe('esconderijos', () => {
  const coverOf = (sim: SinalSim) => sim.view.covers[0]!.def;

  it('dentro da zona dá para se mexer mesmo com o Vigia olhando; fora, não', () => {
    const sim = new SinalSim('x', 'infinito');
    const c = coverOf(sim);
    const cyc = sim.vigiaTimeline.cycleAt(0);
    // espera o aviso, teleporta para dentro do esconderijo e mexe durante todo o olhar
    let dead = false;
    for (let i = 0; i < 60 * (cyc.lookEnd + 1) && !dead; i++) {
      const t = i * DT;
      if (t >= cyc.avisoStart - 0.1) {
        sim.x = c.x;
        sim.y = c.y;
      }
      const wiggle = i % 2 ? 100 : -100;
      const ev = sim.step(t >= cyc.avisoStart - 0.1 ? wiggle * 0.2 : 0, 0);
      if (ev.some((e) => e.kind === 'fim')) dead = true;
    }
    expect(dead).toBe(false);

    const out = new SinalSim('x', 'infinito');
    let caught = false;
    for (let i = 0; i < 60 * (cyc.lookEnd + 1) && !caught; i++) {
      const ev = out.step(0, 100); // anda o tempo todo, longe de qualquer esconderijo
      if (ev.some((e) => e.kind === 'fim' && e.reason === 'vigia')) caught = true;
    }
    expect(caught).toBe(true);
  });

  it('o esconderijo quebra depois de uns 4,5 s dentro e a pessoa fica exposta', () => {
    const sim = new SinalSim('x', 'infinito');
    const c = sim.view.covers.find((v) => !v.def.fragile)!.def;
    sim.x = c.x;
    sim.y = c.y;
    let broke = -1;
    let tick = 0;
    for (; tick < 60 * 6 && broke < 0; tick++) {
      sim.x = c.x;
      sim.y = c.y;
      const ev = sim.step(0, 0);
      if (ev.some((e) => e.kind === 'quebrou')) broke = tick;
      if (sim.dead) break;
    }
    expect(broke / 60).toBeGreaterThan(4.3);
    expect(broke / 60).toBeLessThan(4.8);
    expect(sim.view.covers.find((v) => v.def.id === c.id)!.broken).toBe(true);
    expect(sim.view.hidden).toBe(false);
  });

  it('o esconderijo frágil aguenta menos', () => {
    let found = false;
    for (let i = 0; i < 60 && !found; i++) {
      const course = classicoCourse(`f${i}`, 12);
      const f = new CoverField(course, `f${i}`);
      f.ensure(1500);
      const frag = f.list.find((c) => c.fragile);
      if (frag) {
        found = true;
        expect(frag.max).toBeLessThan(f.list.find((c) => !c.fragile)?.max ?? Infinity);
      }
    }
    expect(found).toBe(true);
  });

  it('são espaçados, trocam de lado e nunca formam fila; o espaço cresce com a dificuldade', () => {
    for (const seed of SEEDS) {
      const f = new CoverField(infinitoCourse(seed), seed);
      f.ensure(4000);
      for (let i = 1; i < f.list.length; i++) {
        const a = f.list[i - 1]!;
        const b = f.list[i]!;
        expect(b.y - a.y).toBeGreaterThanOrEqual(22 - 1e-9);
        expect(Math.abs(b.x - a.x)).toBeGreaterThanOrEqual(3.5);
        expect(Math.abs(b.x)).toBeLessThanOrEqual(HALF - 1.6);
      }
      const gaps = f.list.slice(1).map((c, i) => c.y - f.list[i]!.y);
      const near = gaps.slice(0, 5).reduce((s, g) => s + g, 0) / 5;
      const far = gaps.slice(-5).reduce((s, g) => s + g, 0) / 5;
      expect(far).toBeGreaterThan(near * 0.9);
    }
    const f = new CoverField(infinitoCourse('m'), 'm');
    f.ensure(6000);
    const gaps = f.list.slice(1).map((c, i) => c.y - f.list[i]!.y);
    const avg = (xs: number[]) => xs.reduce((s, g) => s + g, 0) / xs.length;
    expect(avg(gaps.slice(-8))).toBeGreaterThan(avg(gaps.slice(0, 8)));
  });
});

describe('a escuridão: nunca mais rápida que o boneco', () => {
  it('em nenhuma fase, tempo ou nível de parada a velocidade passa do teto de 92%', () => {
    expect(DARK_CAP).toBeCloseTo(MAX_SPEED * 0.92, 9);
    expect(DARK_CAP).toBeLessThan(MAX_SPEED);
    for (let n = 1; n <= 120; n++) {
      const course = classicoCourse('x', n);
      for (const t of [0, 10, 60, 300, 3000]) {
        for (const idle of [0, 0.5, 1]) {
          expect(darkSpeed(course, t, idle), `n=${n} t=${t}`).toBeLessThanOrEqual(DARK_CAP);
        }
      }
    }
    const inf = infinitoCourse('x');
    for (const t of [0, 60, 300, 3000, 30000]) {
      for (const idle of [0, 1]) expect(darkSpeed(inf, t, idle)).toBeLessThanOrEqual(DARK_CAP);
    }
  });

  it('no começo quase não se nota e depois fica mais rápida', () => {
    const inf = infinitoCourse('x');
    expect(darkSpeed(inf, 0, 0)).toBeLessThan(0.3);
    expect(darkSpeed(inf, 200, 0)).toBeGreaterThan(darkSpeed(inf, 0, 0) * 5);
    expect(darkSpeed(classicoCourse('x', 12), 0, 0)).toBeGreaterThan(darkSpeed(classicoCourse('x', 1), 0, 0));
  });

  it('fica mais rápida quando a pessoa fica parada', () => {
    const inf = infinitoCourse('x');
    expect(darkSpeed(inf, 30, 1)).toBeGreaterThan(darkSpeed(inf, 30, 0) * 3);
  });

  it('na simulação, a escuridão nunca anda mais que o teto por passo e pega quem fica parado', () => {
    const sim = new SinalSim('x', 'infinito');
    let prev = sim.view.darkY;
    let maxStep = 0;
    for (let i = 0; i < 60 * 300 && !sim.dead; i++) {
      sim.step(0, 0);
      const d = sim.view.darkY;
      maxStep = Math.max(maxStep, d - prev);
      prev = d;
    }
    expect(sim.result.ended).toBe('escuridao');
    expect(maxStep).toBeLessThanOrEqual(DARK_CAP * DT + 1e-9);
    expect(sim.result.endedTick / 60).toBeLessThan(120);
  });

  it('quem corre sem parar nunca é alcançado pela escuridão, mesmo em fases avançadas', () => {
    // a escuridão é mais lenta que o boneco: com o Vigia fora da conta (ele não olha), ninguém é pego
    for (const n of [1, 6, 11, 40, 100]) {
      const course = classicoCourse('x', n);
      const idle = 0;
      let gap = course.darkStart;
      for (let t = 0; t < 600; t += DT) gap += (MAX_SPEED - darkSpeed(course, t, idle)) * DT;
      expect(gap).toBeGreaterThan(course.darkStart);
    }
  });
});

describe('o Clássico: rodadas de mapas, fases e chefe', () => {
  it('a ordem dos mapas tem os três, sem repetir, e depois volta ao primeiro', () => {
    for (const seed of SEEDS) {
      const order = mapOrder(seed);
      expect(new Set(order).size).toBe(3);
      expect([...order].sort()).toEqual([...SINAL_MAPS].sort());
      for (let r = 0; r < 7; r++) {
        const n = r * PHASES_PER_MAP + 1;
        expect(classicoCourse(seed, n).map).toBe(order[r % 3]);
      }
    }
    expect(new Set(SEEDS.map((s) => mapOrder(s)[0])).size).toBeGreaterThan(1);
  });

  it('cada rodada tem 4 fases normais e o chefe na quinta', () => {
    for (let n = 1; n <= 30; n++) {
      expect(classicoCourse('x', n).boss).toBe(n % 5 === 0);
    }
    // as quatro fases e o chefe ficam no mesmo mapa
    for (let r = 0; r < 6; r++) {
      const maps = Array.from({ length: 5 }, (_, i) => classicoCourse('x', r * 5 + i + 1).map);
      expect(new Set(maps).size).toBe(1);
    }
  });

  it('as fases ficam mais longas e mais difíceis, e o chefe é maior que a fase normal', () => {
    let prev = 0;
    for (let n = 1; n <= 40; n++) {
      const c = classicoCourse('x', n);
      expect(c.length).toBeGreaterThan(prev - (c.boss ? 0 : 0));
      if (!c.boss) prev = c.length;
      expect(phaseDifficulty(n, c.boss)).toBeLessThan(1);
    }
    expect(phaseDifficulty(20, false)).toBeGreaterThan(phaseDifficulty(2, false));
    expect(classicoCourse('x', 5).length).toBeGreaterThan(classicoCourse('x', 4).length * 1.4);
    // a fase 6 (primeira do mapa novo) é mais difícil que a 5, mesmo sendo outro mapa
    expect(phaseDifficulty(6, false)).toBeGreaterThan(phaseDifficulty(4, false));
  });

  it('o Infinito sorteia um mapa e fica nele, sem linha de chegada', () => {
    const c = infinitoCourse('x');
    expect(c.length).toBe(Infinity);
    expect(c.boss).toBe(false);
    expect(new Set(SEEDS.map((s) => infinitoCourse(s).map)).size).toBeGreaterThan(1);
  });

  it('cumprir a fase leva à próxima, soma a distância e troca de mapa só depois do chefe', () => {
    const sim = new SinalSim('x', 'classico');
    const ev = run(sim, perfect, 60 * 120);
    const fase = ev.filter((e) => e.kind === 'fase');
    expect(fase.length).toBeGreaterThan(0);
    const first = fase[0] as Extract<SinalEvent, { kind: 'fase' }>;
    expect(first.n).toBe(2);
    expect(first.mapChanged).toBe(false);
    expect(sim.result.phases).toBeGreaterThanOrEqual(1);
    // a distância é a soma das fases cumpridas mais o que andou na atual
    expect(sim.result.meters).toBeGreaterThanOrEqual(classicoCourse('x', 1).length);
    expect(sim.result.tenths).toBeGreaterThanOrEqual(classicoCourse('x', 1).length * 10);
  });

  it('a escuridão e o Vigia recomeçam a cada fase (largada nova, escuridão atrás)', () => {
    const sim = new SinalSim('x', 'classico');
    let started = false;
    for (let i = 0; i < 60 * 200 && !sim.dead; i++) {
      const ev = sim.step(...perfect(sim));
      if (ev.some((e) => e.kind === 'fase')) {
        started = true;
        expect(sim.y).toBe(0);
        expect(sim.view.darkY).toBeCloseTo(-sim.course.darkStart, 6);
        break;
      }
    }
    expect(started).toBe(true);
  });

  it('a nota respeita o teto de 16 bits', () => {
    const sim = new SinalSim('x', 'infinito');
    sim.y = 100000;
    (sim as unknown as { maxY: number }).maxY = 100000;
    expect(sim.result.tenths).toBe(32767);
  });
});

describe('os poderes mexem no boneco (quando ele está exposto)', () => {
  /** Roda até o poder `kind` entrar em efeito num ciclo do chefe e devolve o sim parado nesse instante. */
  function until(kind: string, seedBase: string) {
    for (let k = 0; k < 40; k++) {
      const seed = `${seedBase}${k}`;
      const sim = new SinalSim(seed, 'classico');
      // força a fase do chefe (5): joga as quatro primeiras com o bot perfeito
      let guard = 0;
      while (sim.course.n < 5 && !sim.dead && guard++ < 60 * 900) sim.step(...perfect(sim));
      if (sim.dead || sim.course.n < 5) continue;
      let t = 0;
      for (let i = 0; i < 60 * 80 && !sim.dead; i++) {
        const ev = sim.step(0, 0);
        t++;
        if (ev.some((e) => e.kind === 'poder' && e.power === kind)) return { sim, seed, t };
      }
    }
    return null;
  }

  it('invertido troca os controles, lama deixa devagar, rajada empurra de lado', () => {
    const inv = until('invertido', 'a');
    expect(inv).not.toBeNull();
    const y0 = inv!.sim.y;
    for (let i = 0; i < 20; i++) inv!.sim.step(0, 100);
    expect(inv!.sim.y).toBeLessThan(y0); // mandou para a frente e foi para trás

    const lama = until('lama', 'b');
    expect(lama).not.toBeNull();
    const l0 = lama!.sim.y;
    for (let i = 0; i < 30; i++) lama!.sim.step(0, 100);
    expect(lama!.sim.y - l0).toBeLessThan(MAX_SPEED * 0.5 * 0.6);

    const raj = until('rajada', 'c');
    expect(raj).not.toBeNull();
    const x0 = raj!.sim.x;
    for (let i = 0; i < 40; i++) raj!.sim.step(0, 0);
    expect(Math.abs(raj!.sim.x - x0)).toBeGreaterThan(0.5);
  });

  it('escondido, o poder passa sem efeito; exposto, atinge', () => {
    let evaded = 0;
    let hitHidden = 0;
    let hitExposed = 0;
    for (let k = 0; k < 30; k++) {
      for (const hide of [true, false]) {
        const sim = new SinalSim(`e${k}`, 'classico');
        while (sim.course.n < 5 && !sim.dead) sim.step(...perfect(sim));
        if (sim.dead) continue;
        let warned = false;
        let done = false;
        for (let i = 0; i < 60 * 60 && !sim.dead && !done; i++) {
          if (warned && hide) {
            // entra num esconderijo novo durante o aviso do poder e fica lá
            const c = sim.view.covers.find((v) => !v.broken && v.dur >= v.def.max - 1e-9)?.def;
            if (c) {
              sim.x = c.x;
              sim.y = c.y;
            }
          }
          for (const e of sim.step(0, 0)) {
            if (e.kind === 'poder-aviso') warned = true;
            if (warned && e.kind === 'poder-evitado') {
              if (hide) evaded++;
              done = true;
            }
            if (warned && e.kind === 'poder') {
              if (hide) hitHidden++;
              else hitExposed++;
              done = true;
            }
          }
        }
      }
    }
    expect(evaded).toBeGreaterThan(0);
    expect(hitHidden).toBe(0);
    expect(hitExposed).toBeGreaterThan(0);
  });
});

describe('validar os movimentos', () => {
  it('aceita movimentos bem formados e recusa os estragados', () => {
    expect(validateSinalInputs([{ tick: 0, x: 0, y: 100 }, { tick: 5, x: -100, y: 0 }])).toBeNull();
    expect(validateSinalInputs([{ tick: 5, x: 0, y: 0 }, { tick: 5, x: 0, y: 0 }])).toMatch(/ordem/);
    expect(validateSinalInputs([{ tick: -1, x: 0, y: 0 }])).toMatch(/Instante/);
    expect(validateSinalInputs([{ tick: 1, x: 0.5, y: 0 }])).toMatch(/Direção/);
    expect(validateSinalInputs([{ tick: 1, x: 101, y: 0 }])).toMatch(/faixa/);
    expect(validateSinalInputs(Array.from({ length: 50_000 }, (_, i) => ({ tick: i, x: 0, y: 0 })))).toMatch(/demais/);
  });
});
