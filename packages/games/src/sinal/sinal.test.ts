import { describe, expect, it } from 'vitest';
import {
  isSolid,
  MOVER_KINDS,
  obstaclePos,
  ObstacleField,
  CoverField,
  WidthField,
  DARK_CAP,
  DT,
  HALF,
  HALF_MAX,
  HALF_MIN,
  HOLD_MAX,
  HOLD_MIN,
  MAX_SPEED,
  MIN_GAP,
  PHASES_PER_MAP,
  PLAYER_R,
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
  noteAt,
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

/**
 * Anda para a frente desviando dos obstáculos que estão logo adiante. Bater em qualquer sólido joga
 * o boneco para trás e qualquer deslocamento conta para o Vigia, então desvia com folga, dá a volta
 * por inteiro nos que andam (toda a faixa que eles varrem) e fica longe das zonas de chão.
 */
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
  // longe das paredes também
  const half = v.halfAt(v.y);
  if (v.x > half - 1.2) ax -= 100;
  if (v.x < -half + 1.2) ax += 100;
  return [Math.max(-100, Math.min(100, ax)), 100];
};

/**
 * Roda com o bot e diz como acabou. Quem reage ao aviso nunca é visto por causa de um poder; o que
 * ainda pode pegá-lo é o chão: uma pancada (ou um obstáculo que se mexe) ou uma zona que empurra.
 */
function runWatched(sim: SinalSim, policy: (s: SinalSim) => [number, number], maxTicks: number) {
  let lastChoque = -99;
  let envKill = false;
  for (let i = 0; i < maxTicks && !sim.dead; i++) {
    const [ax, ay] = policy(sim);
    for (const e of sim.step(ax, ay)) if (e.kind === 'choque') lastChoque = sim.view.t;
    if (sim.dead && sim.result.ended === 'vigia') {
      const v = sim.view;
      const inZone = v.obstacles.some((o) => !isSolid(o.kind) && (v.x - o.x) ** 2 + (v.y - o.y) ** 2 <= o.r * o.r);
      const nearMover = v.obstacles.some((o) => MOVER_KINDS.includes(o.kind) && (v.x - o.x) ** 2 + (v.y - o.y) ** 2 < (o.r + 1.5) ** 2);
      envKill = v.t - lastChoque < 2 || inZone || nearMover;
    }
  }
  return { ended: sim.result.ended, envKill };
}

/** Quem sabe o ciclo do Vigia: para quando o LHO esticado começa e anda no resto. */
const perfect = (s: SinalSim): [number, number] => {
  const t = s.view.t;
  const c = s.vigiaTimeline.cycleAt(t);
  const stop = t >= c.avisoStart - 0.02 && t < c.lookEnd + 0.01;
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

  it('o esconderijo quebra depois de uns 5,5 s dentro e a pessoa fica exposta', () => {
    // uma moita simples e firme (não a comprida nem a frágil)
    let found: { sim: SinalSim; c: { id: number; x: number; y: number } } | null = null;
    for (let k = 0; k < 80 && !found; k++) {
      const s2 = new SinalSim(`qb${k}`, 'infinito');
      const cv = s2.view.covers.find((v) => !v.def.fragile && v.def.len === 0)?.def;
      if (cv) found = { sim: s2, c: cv };
    }
    const sim = found!.sim;
    const c = found!.c;
    sim.x = c.x;
    sim.y = c.y;
    let broke = -1;
    let tick = 0;
    for (; tick < 60 * 7 && broke < 0; tick++) {
      sim.x = c.x;
      sim.y = c.y;
      const ev = sim.step(0, 0);
      if (ev.some((e) => e.kind === 'quebrou')) broke = tick;
      if (sim.dead) break;
    }
    expect(broke / 60).toBeGreaterThan(5.3);
    expect(broke / 60).toBeLessThan(5.8);
    expect(sim.view.covers.find((v) => v.def.id === c.id)!.broken).toBe(true);
    expect(sim.view.hidden).toBe(false);
  });

  it('o esconderijo frágil aguenta menos', () => {
    let found = false;
    for (let i = 0; i < 60 && !found; i++) {
      const course = classicoCourse(`f${i}`, 12);
      const f = new CoverField(course, `f${i}`, new WidthField(course, `f${i}:w`));
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
      const course = infinitoCourse(seed);
      const f = new CoverField(course, seed, new WidthField(course, `${seed}:w`));
      f.ensure(4000);
      for (let i = 1; i < f.list.length; i++) {
        const a = f.list[i - 1]!;
        const b = f.list[i]!;
        // o espaço conta depois do fim da moita comprida
        expect(b.y - (a.y + a.len)).toBeGreaterThanOrEqual(16 - 1e-9);
        expect(Math.abs(b.x - a.x)).toBeGreaterThanOrEqual(3.5);
        expect(Math.abs(b.x)).toBeLessThanOrEqual(Math.max(1.9, HALF_MAX - 1.6));
      }
      const gaps = f.list.slice(1).map((c, i) => c.y - f.list[i]!.y);
      const near = gaps.slice(0, 5).reduce((s, g) => s + g, 0) / 5;
      const far = gaps.slice(-5).reduce((s, g) => s + g, 0) / 5;
      expect(far).toBeGreaterThan(near * 0.9);
    }
    const mc = infinitoCourse('m');
    const f = new CoverField(mc, 'm', new WidthField(mc, 'm:w'));
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

  it('no começo anda devagar (mas aparece) e depois fica mais rápida', () => {
    const inf = infinitoCourse('x');
    expect(darkSpeed(inf, 0, 0)).toBeLessThan(0.6);
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

describe('o Clássico: rodadas de mapas e fases', () => {
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

  it('o mapa troca a cada 5 fases e não há chefe', () => {
    for (let r = 0; r < 6; r++) {
      const maps = Array.from({ length: 5 }, (_, i) => classicoCourse('x', r * 5 + i + 1).map);
      expect(new Set(maps).size).toBe(1);
    }
    expect(classicoCourse('x', 5).map).not.toBe(classicoCourse('x', 6).map);
    expect('boss' in classicoCourse('x', 5)).toBe(false);
  });

  it('as fases ficam mais longas (até um teto), mais difíceis, e a escuridão larga mais perto', () => {
    let prev = 0;
    for (let n = 1; n <= 40; n++) {
      const c = classicoCourse('x', n);
      expect(c.length).toBeGreaterThanOrEqual(prev);
      prev = c.length;
      expect(phaseDifficulty(n)).toBeLessThan(1);
    }
    expect(phaseDifficulty(20)).toBeGreaterThan(phaseDifficulty(2));
    expect(classicoCourse('x', 30).length).toBe(320);
    expect(classicoCourse('x', 10).darkStart).toBeLessThan(classicoCourse('x', 1).darkStart);
    expect(phaseDifficulty(6)).toBeGreaterThan(phaseDifficulty(4));
  });

  it('o Infinito sorteia um mapa e fica nele, sem linha de chegada', () => {
    const c = infinitoCourse('x');
    expect(c.length).toBe(Infinity);
    expect(new Set(SEEDS.map((s) => infinitoCourse(s).map)).size).toBeGreaterThan(1);
  });

  it('cumprir a fase leva à próxima, soma a distância e troca de mapa a cada 5 fases', () => {
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

describe('os obstáculos: tamanhos, jeitos e o que fazem', () => {
  const field = (n: number, seed = 'obs') => {
    const course = classicoCourse(seed, n);
    const width = new WidthField(course, `${seed}:w`);
    const covers = new CoverField(course, `${seed}:c`, width);
    const f = new ObstacleField(course, `${seed}:o`, covers, width);
    f.ensure(600);
    return f.list;
  };

  it('vão aparecendo tipos novos fase a fase', () => {
    const kinds = (n: number) => new Set(SEEDS.flatMap((s) => field(n, s).map((o) => o.kind)));
    // já na fase 1 há objetos interativos (lama, esteira, mola)
    expect(kinds(1)).toEqual(new Set(['pequeno', 'medio', 'lamacal', 'mola', 'esteira']));
    expect(kinds(2).has('grande')).toBe(true);
    expect(kinds(2).has('deslizante')).toBe(true);
    expect(kinds(3).has('vaivem')).toBe(true);
    expect(kinds(4).has('ima')).toBe(true);
    expect(kinds(2).has('gelo')).toBe(true);
    expect(kinds(4).has('orbita')).toBe(true);
    expect(kinds(5).has('serra')).toBe(true);
    expect(kinds(12).size).toBe(12);
  });

  it('têm tamanhos diferentes e quanto mais avançado, mais obstáculos', () => {
    const rs = field(8).filter((o) => isSolid(o.kind)).map((o) => o.r);
    expect(Math.min(...rs)).toBeLessThan(0.55);
    expect(Math.max(...rs)).toBeGreaterThan(1.1);
    const dens = (n: number) => SEEDS.reduce((s, sd) => s + field(n, sd).filter((o) => o.y < 300).length, 0);
    expect(dens(10)).toBeGreaterThan(dens(1));
  });

  it('os que se mexem andam, voltam e ficam sempre dentro do corredor', () => {
    const movers = SEEDS.flatMap((s) => field(8, s)).filter((o) => o.amp > 0);
    expect(movers.length).toBeGreaterThan(0);
    for (const o of movers) {
      const seen = new Set<string>();
      for (let t = 0; t < o.period; t += 7) {
        const q = obstaclePos(o, t);
        seen.add(`${q.x.toFixed(2)},${q.y.toFixed(2)}`);
        expect(Math.abs(q.x)).toBeLessThanOrEqual(HALF);
      }
      expect(seen.size).toBeGreaterThan(5);
      expect(obstaclePos(o, 3)).toEqual(obstaclePos(o, 3 + o.period));
    }
  });

  it('sempre sobra um vão: nenhum grupo fecha o corredor', () => {
    for (const s of SEEDS) {
      const list = field(12, s).filter((o) => isSolid(o.kind));
      for (let i = 0; i < list.length; i++) {
        const a = list[i]!;
        // quem está na mesma faixa de altura (até 1,7 m): os vãos entre eles passam um boneco
        const same = list.filter((o) => Math.abs(o.y - a.y) < 1.7).sort((p, q) => p.x - q.x);
        let left = -HALF;
        let widest = 0;
        for (const o of same) {
          const reach = o.r + (o.kind === 'deslizante' ? o.amp : 0);
          widest = Math.max(widest, o.x - reach - left);
          left = o.x + reach;
        }
        widest = Math.max(widest, HALF - left);
        expect(widest).toBeGreaterThan(2 * PLAYER_R + 0.2);
      }
    }
  });

  it('o lamaçal deixa devagar, a esteira empurra de lado e a mola joga para trás', () => {
    const mk = (kind: string) => {
      for (let k = 0; k < 60; k++) {
        const sim = new SinalSim(`h${k}`, 'classico');
        (sim as unknown as { n: number }).n = 8;
        (sim as unknown as { startCourse: () => void }).startCourse();
        const o = sim.view.obstacles.find((q) => q.kind === kind && q.amp === 0);
        if (o) return { sim, o };
      }
      return null;
    };
    const lama = mk('lamacal');
    expect(lama).not.toBeNull();
    lama!.sim.x = lama!.o.x;
    lama!.sim.y = lama!.o.y;
    const y0 = lama!.sim.y;
    for (let i = 0; i < 30; i++) lama!.sim.step(0, 100);
    expect(lama!.sim.y - y0).toBeLessThan(MAX_SPEED * 0.5 * 0.6);

    const est = mk('esteira');
    expect(est).not.toBeNull();
    est!.sim.x = est!.o.x;
    est!.sim.y = est!.o.y;
    const x0 = est!.sim.x;
    for (let i = 0; i < 20; i++) est!.sim.step(0, 0);
    expect(Math.abs(est!.sim.x - x0)).toBeGreaterThan(0.3);
    expect(Math.sign(est!.sim.x - x0)).toBe(est!.o.dir);

    const mola = mk('mola');
    expect(mola).not.toBeNull();
    mola!.sim.x = mola!.o.x;
    mola!.sim.y = mola!.o.y - mola!.o.r - 0.6;
    const m0 = mola!.sim.y;
    for (let i = 0; i < 30; i++) mola!.sim.step(0, 100);
    expect(mola!.sim.y).toBeLessThan(m0 + 0.2);
  });

});

describe('pancadas: bater te joga para trás, e qualquer movimento denuncia', () => {
  /** Um sim na fase 8, sem escuridão, com um obstáculo `kind` fixo (ou que se mexe) ao alcance. */
  function withObstacle(kind: string, moving = false) {
    for (let k = 0; k < 120; k++) {
      const sim = new SinalSim(`pa${k}`, 'classico');
      (sim as unknown as { n: number }).n = 8;
      (sim as unknown as { startCourse: () => void }).startCourse();
      (sim as unknown as { darkY: number }).darkY = -1e7;
      const o = sim.view.obstacles.find((q) => q.kind === kind && (q.amp > 0) === moving);
      if (o) return { sim, o };
    }
    return null;
  }

  it('o obstáculo maior empurra mais forte (e a pancada avisa o tamanho)', () => {
    const push = (kind: string) => {
      const f = withObstacle(kind)!;
      const { sim, o } = f;
      sim.x = o.x;
      sim.y = o.y - o.r - 0.6;
      const start = sim.y;
      let lowest = start;
      let size = 0;
      for (let i = 0; i < 50; i++) {
        for (const e of sim.step(0, 100)) if (e.kind === 'choque') size = Math.max(size, e.size);
        lowest = Math.min(lowest, sim.y);
      }
      return { back: start - lowest, size };
    };
    const small = push('pequeno');
    const big = push('grande');
    expect(small.back).toBeGreaterThan(0.1);
    expect(big.back).toBeGreaterThan(small.back);
    expect(big.size).toBeGreaterThan(small.size);
  });

  it('a pancada aparece na tela: o obstáculo e o boneco guardam o choque por um instante', () => {
    const { sim, o } = withObstacle('medio')!;
    sim.x = o.x;
    sim.y = o.y - o.r - 0.5;
    let sawBump = false;
    let sawKnock = false;
    for (let i = 0; i < 30; i++) {
      sim.step(0, 100);
      const v = sim.view;
      if (v.obstacles.find((q) => q.id === o.id)!.bump > 0.5) sawBump = true;
      if (v.knock > 0.4 && v.knockDir.y < 0) sawKnock = true;
    }
    expect(sawBump).toBe(true);
    expect(sawKnock).toBe(true);
  });

  it('o que se mexe bate mais forte e te empurra mesmo com você parado', () => {
    const f = withObstacle('serra', true) ?? withObstacle('deslizante', true)!;
    const { sim, o } = f;
    // fica parado no caminho dele: ele vem e te joga
    const start = sim.view.obstacles.find((q) => q.id === o.id)!;
    sim.x = start.x + 0.5;
    sim.y = start.y;
    let hit = false;
    for (let i = 0; i < 60 * 8 && !sim.dead && !hit; i++) {
      hit = sim.step(0, 0).some((e) => e.kind === 'choque');
    }
    expect(hit).toBe(true);
  });

  it('ser empurrado ou deslizar com o Vigia olhando também te entrega (sai do esconderijo ou perde)', () => {
    const f = withObstacle('esteira')!;
    const { sim, o } = f;
    const tl = sim.vigiaTimeline;
    const c = tl.upTo(80).find((q) => q.lookEnd - q.lookStart > 1)!;
    // parado, sem esconderijo, até logo depois de ele começar a olhar
    while (sim.view.t < c.lookStart + 0.3 && !sim.dead) sim.step(0, 0);
    expect(sim.dead).toBe(false);
    sim.x = o.x;
    sim.y = o.y;
    const ev = sim.step(0, 0);
    expect(ev.some((e) => e.kind === 'fim' && e.reason === 'vigia')).toBe(true);
  });

  it('o gelo escorrega mesmo depois de soltar o analógico', () => {
    const ice = withObstacle('gelo')!;
    ice.sim.x = ice.o.x;
    ice.sim.y = ice.o.y;
    for (let i = 0; i < 40; i++) ice.sim.step(0, 100);
    const y0 = ice.sim.y;
    for (let i = 0; i < 10; i++) ice.sim.step(0, 0);
    expect(ice.sim.y - y0).toBeGreaterThan(0.2); // soltou o analógico e continuou deslizando
  });

  it('as órbitas e as serras andam em volta do ponto e voltam, dentro do corredor', () => {
    const orb = SEEDS.flatMap((sd) => {
      const course = classicoCourse(sd, 10);
      const width = new WidthField(course, `${sd}:w`);
      const f = new ObstacleField(course, `${sd}:o`, new CoverField(course, `${sd}:c`, width), width);
      f.ensure(500);
      return f.list.filter((o) => o.kind === 'orbita' || o.kind === 'serra');
    });
    expect(orb.length).toBeGreaterThan(5);
    for (const o of orb) {
      const xs = new Set<string>();
      for (let t = 0; t < o.period; t += 9) {
        const q = obstaclePos(o, t);
        xs.add(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
        expect(Math.abs(q.x)).toBeLessThanOrEqual(HALF + 0.001);
      }
      expect(xs.size).toBeGreaterThan(6);
      expect(obstaclePos(o, 5)).toEqual(obstaclePos(o, 5 + o.period));
    }
  });
});

describe('atordoado: bateu, fica tonto e o Vigia pega', () => {
  function bumped(kind: string) {
    for (let k = 0; k < 120; k++) {
      const sim = new SinalSim(`st${k}`, 'classico');
      (sim as unknown as { n: number }).n = 8;
      (sim as unknown as { startCourse: () => void }).startCourse();
      (sim as unknown as { darkY: number }).darkY = -1e7;
      const o = sim.view.obstacles.find((q) => q.kind === kind && q.amp === 0);
      if (!o) continue;
      sim.x = o.x;
      sim.y = o.y - o.r - 0.5;
      return { sim, o };
    }
    return null;
  }

  it('bater atordoa (mais tempo no obstáculo maior) e atordoado não obedece o analógico', () => {
    const run = (kind: string) => {
      const { sim } = bumped(kind)!;
      let hit = false;
      for (let i = 0; i < 40 && !hit; i++) hit = sim.step(0, 100).some((e) => e.kind === 'choque');
      expect(hit).toBe(true);
      expect(sim.isStunned).toBe(true);
      expect(sim.view.stun).toBeGreaterThan(0);
      let ticks = 0;
      const y0 = sim.y;
      while (sim.isStunned && ticks < 300) {
        sim.step(0, 100); // manda para a frente, mas está tonto
        ticks++;
      }
      // enquanto durou, o analógico não levou o boneco para a frente além do recuo da pancada
      expect(sim.y).toBeLessThan(y0 + 0.5);
      return ticks;
    };
    expect(run('grande')).toBeGreaterThan(run('pequeno'));
    expect(run('pequeno')).toBeGreaterThan(30);
  });

  it('o atordoamento acaba sozinho', () => {
    const { sim } = bumped('medio')!;
    for (let i = 0; i < 40; i++) sim.step(0, 100);
    for (let i = 0; i < 200; i++) sim.step(0, 0);
    expect(sim.isStunned).toBe(false);
    expect(sim.view.stun).toBe(0);
  });

  it('se o Vigia olha com o boneco atordoado, perde mesmo parado; escondido, não', () => {
    const seen = (hide: boolean) => {
      const { sim, o } = bumped('grande')!;
      const c = sim.vigiaTimeline.upTo(80).find((q) => q.lookEnd - q.lookStart > 1.1)!;
      // parado até um instante antes de o olhar começar
      while (sim.view.t < c.lookStart - 0.5 && !sim.dead) sim.step(0, 0);
      expect(sim.dead).toBe(false);
      sim.x = o.x;
      sim.y = o.y - o.r - 0.5;
      let ended = false;
      for (let i = 0; i < 60 && !ended; i++) {
        if (hide) {
          const cv = sim.view.covers.find((q) => !q.broken)?.def;
          if (cv) {
            sim.x = cv.x;
            sim.y = cv.y;
          }
        }
        // bate no obstáculo e fica parado: só o atordoamento denuncia
        ended = sim.step(0, i < 10 ? 100 : 0).some((e) => e.kind === 'fim' && e.reason === 'vigia');
        if (!hide && sim.view.t > c.lookStart + 0.6) break;
      }
      return sim.dead && sim.result.ended === 'vigia';
    };
    expect(seen(false)).toBe(true);
  });
});

describe('moitas compridas e prêmios de se esconder', () => {
  const longCover = () => {
    for (let k = 0; k < 120; k++) {
      const sim = new SinalSim(`lg${k}`, 'classico');
      (sim as unknown as { darkY: number }).darkY = -1e7;
      const c = sim.view.covers.find((v) => v.def.len > 0)?.def;
      if (c) return { sim, c };
    }
    return null;
  };

  it('existem moitas compridas (5 a 14 m), mais comuns no começo, sempre para a frente', () => {
    const lens: number[] = [];
    let early = 0;
    let late = 0;
    for (const sd of SEEDS) {
      for (const [n, bucket] of [[1, 'early'], [30, 'late']] as const) {
        const course = classicoCourse(sd, n);
        const f = new CoverField(course, `${sd}:cv`, new WidthField(course, `${sd}:cw`));
        f.ensure(2500);
        for (const c of f.list) {
          if (c.len > 0) {
            lens.push(c.len);
            if (bucket === 'early') early++;
            else late++;
            expect(c.fragile).toBe(false);
          }
        }
      }
    }
    expect(Math.min(...lens)).toBeGreaterThanOrEqual(5);
    expect(Math.max(...lens)).toBeLessThanOrEqual(14);
    // os comprimentos variam de verdade (não são todos iguais)
    expect(Math.max(...lens) - Math.min(...lens)).toBeGreaterThan(6);
    expect(early).toBeGreaterThan(late);
  });

  it('dá para correr por toda a moita comprida com o Vigia olhando, e fora dela não', () => {
    const { sim, c } = longCover()!;
    const cyc = sim.vigiaTimeline.upTo(80).find((q) => q.lookEnd - q.lookStart > 1.1)!;
    // espera parado no começo da pista (fora da moita, que gasta se você fica dentro) até o olhar
    while (sim.view.t < cyc.lookStart + 0.3 && !sim.dead) sim.step(0, 0);
    expect(sim.dead).toBe(false);
    // já olhando: corre pela moita inteira
    sim.x = c.x;
    sim.y = c.y + 0.2;
    const startY = sim.y;
    let ended = false;
    for (let i = 0; i < 40 && !ended && sim.y < c.y + c.len - 0.5; i++) {
      ended = sim.step(0, 100).some((e) => e.kind === 'fim');
    }
    expect(ended).toBe(false);
    expect(sim.view.hidden).toBe(true);
    expect(sim.y - startY).toBeGreaterThan(c.len > 5 ? 2 : 1);
  });

  it('a moita comprida gasta mais rápido por segundo, mas aguenta um pouco mais no total', () => {
    const { sim, c } = longCover()!;
    let broke = -1;
    for (let i = 0; i < 60 * 8 && broke < 0; i++) {
      sim.x = c.x;
      sim.y = c.y + 0.5;
      if (sim.step(0, 0).some((e) => e.kind === 'quebrou')) broke = i;
    }
    expect(broke / 60).toBeGreaterThan(3.5);
    expect(broke / 60).toBeLessThan(4.6); // 6,5 s de força, gastando 1,6x
  });

  it('escondido, o atordoamento passa mais rápido, a escuridão anda devagar e sair dá fôlego', () => {
    // atordoamento
    const stunned = (hide: boolean) => {
      for (let k = 0; k < 120; k++) {
        const sim = new SinalSim(`sx${k}`, 'classico');
        (sim as unknown as { n: number }).n = 8;
        (sim as unknown as { startCourse: () => void }).startCourse();
        (sim as unknown as { darkY: number }).darkY = -1e7;
        const o = sim.view.obstacles.find((q) => q.kind === 'grande' && q.amp === 0);
        const cv = sim.view.covers[0]?.def;
        if (!o || !cv) continue;
        sim.x = o.x;
        sim.y = o.y - o.r - 0.5;
        for (let i = 0; i < 40 && !sim.isStunned; i++) sim.step(0, 100);
        if (!sim.isStunned) continue; // o caminho até o obstáculo tinha algo no meio: tenta outra seed
        let n = 0;
        while (sim.isStunned && n < 300) {
          if (hide) {
            sim.x = cv.x;
            sim.y = cv.y;
          }
          sim.step(0, 0);
          n++;
        }
        return n;
      }
      return 0;
    };
    expect(stunned(true)).toBeLessThan(stunned(false) * 0.6);

    // escuridão
    const dark = (hide: boolean) => {
      const sim = new SinalSim('dk', 'infinito');
      const c = sim.view.covers[0]!.def;
      const d0 = sim.view.darkY;
      for (let i = 0; i < 120; i++) {
        if (hide) {
          sim.x = c.x;
          sim.y = c.y;
        }
        sim.step(0, 0);
      }
      return sim.view.darkY - d0;
    };
    expect(dark(true)).toBeLessThan(dark(false) * 0.5);

    // fôlego
    const sim = new SinalSim('fl', 'infinito');
    (sim as unknown as { darkY: number }).darkY = -1e7;
    const c = sim.view.covers[0]!.def;
    for (let i = 0; i < 70; i++) {
      sim.x = c.x;
      sim.y = c.y;
      sim.step(0, 0);
    }
    expect(sim.view.hidden).toBe(true);
    sim.x = 0;
    sim.y = c.y - 8;
    let got = false;
    for (let i = 0; i < 3; i++) got = got || sim.step(0, 0).some((e) => e.kind === 'folego');
    expect(got).toBe(true);
    const y0 = sim.y;
    for (let i = 0; i < 30; i++) sim.step(0, 100);
    expect(sim.y - y0).toBeGreaterThan(MAX_SPEED * 0.5 * 1.15);
  });
});

describe('a sala joga fase por fase: parar na linha de chegada', () => {
  it('com holdAtFinish, cruzar a linha termina a fase daquele boneco (sem passar para a próxima)', () => {
    const sim = new SinalSim('fin', 'classico');
    sim.holdAtFinish = true;
    (sim as unknown as { darkY: number }).darkY = -1e7;
    sim.externalDark = true;
    // sem obstáculos no caminho: aqui só importa a linha de chegada
    (sim as unknown as { obstacles: { list: unknown[]; ensure: () => void } }).obstacles = { list: [], ensure: () => {} };
    const len = sim.course.length;
    sim.y = len - 0.3;
    let got: number | null = null;
    for (let i = 0; i < 30 && !sim.finished; i++) {
      for (const e of sim.step(0, 100)) if (e.kind === 'chegou') got = e.meters;
    }
    expect(sim.finished).toBe(true);
    expect(sim.dead).toBe(false);
    expect(got).toBe(len);
    expect(sim.course.n).toBe(1);
    // parado: não anda mais, não perde, o resultado é a fase inteira
    const y0 = sim.y;
    for (let i = 0; i < 60; i++) sim.step(0, 100);
    expect(sim.y).toBe(y0);
    expect(sim.dead).toBe(false);
    expect(sim.result.meters).toBeCloseTo(len, 6);
  });

  it('a fase de partida vem do construtor: cada fase tem a sua pista', () => {
    const a = new SinalSim('fin', 'classico', 1);
    const b = new SinalSim('fin', 'classico', 4);
    expect(a.course.n).toBe(1);
    expect(b.course.n).toBe(4);
    expect(b.course.length).toBeGreaterThan(a.course.length);
    expect(b.course.darkStart).toBeLessThan(a.course.darkStart);
  });
});
