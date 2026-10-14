import { describe, expect, it } from 'vitest';
import {
  CoverField,
  HALF,
  HALF_MAX,
  HALF_MIN,
  HOLD_MAX,
  HOLD_MIN,
  MIN_GAP,
  ObstacleField,
  PLAYER_R,
  SinalSim,
  VigiaTimeline,
  WidthField,
  classicoCourse,
  courseFor,
  darkSpeed,
  evaluateSinal,
  infinitoCourse,
  isSolid,
  noteAt,
  timelineParams,
  type SinalMode,
} from './index';

const SEEDS = Array.from({ length: 12 }, (_, i) => `semente-${i}`);

/** Anda para a frente desviando dos obstáculos e das paredes do ponto onde está. */
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
  // sai de baixo da marca do arremesso e espera a faixa da bola passar
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
  // dá a volta nos perseguidores (eles são mais lentos que o boneco)
  for (const ch of v.chasers) {
    const dy = ch.y - v.y;
    if (dy > -2 && dy < 9) {
      const dx = v.x - ch.x;
      if (Math.abs(dx) < 5) ax += (dx === 0 ? 1 : Math.sign(dx)) * 160;
    }
  }
  return [Math.max(-100, Math.min(100, ax)), ay];
};

/** Quem sabe a cantiga: para quando o LHO esticado começa e anda no resto. */
const perfect = (s: SinalSim): [number, number] => {
  const t = s.view.t;
  const c = s.vigiaTimeline.cycleAt(t);
  return t >= c.avisoStart - 0.02 && t < c.lookEnd + 0.01 ? [0, 0] : steer(s);
};

function run(sim: SinalSim, policy: (s: SinalSim) => [number, number], maxTicks: number) {
  for (let i = 0; i < maxTicks && !sim.dead; i++) {
    const [ax, ay] = policy(sim);
    sim.step(ax, ay);
  }
}

const cycles = (mode: SinalMode, n: number, seed: string, until: number) =>
  new VigiaTimeline(timelineParams(courseFor(seed, mode, n)), `${seed}:v${n}`).upTo(until);

describe('a cantiga do Vigia (spec 026)', () => {
  it('é determinística: a mesma seed dá a mesma cantiga, outra seed dá outra', () => {
    for (const mode of ['infinito', 'classico'] as SinalMode[]) {
      expect(cycles(mode, 3, 'a', 120)).toEqual(cycles(mode, 3, 'a', 120));
      expect(cycles(mode, 3, 'a', 120)).not.toEqual(cycles(mode, 3, 'b', 120));
    }
  });

  it('o primeiro ciclo só começa depois da pessoa se situar e vem firme, com dois versos', () => {
    for (const seed of SEEDS) {
      const c = cycles('infinito', 1, seed, 3)[0]!;
      expect(c.start).toBeGreaterThanOrEqual(2);
      expect(c.tempo).toBe('firme');
      expect(c.verses).toBe(2);
    }
  });

  it('cada verso tem 5 sílabas e só o último LHO é esticado (o aviso)', () => {
    for (const seed of SEEDS) {
      for (const c of cycles('classico', 4, seed, 200)) {
        expect(c.notes.length).toBe(5 * c.verses);
        expect(c.notes.filter((n) => n.hold).length).toBe(1);
        const last = c.notes[c.notes.length - 1]!;
        expect(last.hold).toBe(true);
        expect(last.syl).toBe(4);
        c.notes.forEach((n, i) => expect(n.syl).toBe(i % 5));
        // o aviso começa na nota esticada e o olhar, quando ela acaba
        expect(c.avisoStart).toBeCloseTo(last.t0, 9);
        expect(c.lookStart).toBeCloseTo(last.t1, 9);
        expect(c.lookEnd).toBeGreaterThan(c.lookStart);
        expect(c.end).toBeGreaterThan(c.lookEnd);
      }
    }
  });

  it('o aviso nunca dura menos nem mais que o limite, em qualquer dificuldade', () => {
    for (const n of [1, 3, 8, 20, 80]) {
      for (const seed of SEEDS) {
        for (const c of cycles('classico', n, seed, 200)) {
          const hold = c.lookStart - c.avisoStart;
          expect(hold).toBeGreaterThanOrEqual(HOLD_MIN - 1e-9);
          expect(hold).toBeLessThanOrEqual(HOLD_MAX + 1e-9);
        }
      }
    }
    for (const seed of SEEDS) {
      for (const c of cycles('infinito', 1, seed, 1500)) {
        expect(c.lookStart - c.avisoStart).toBeGreaterThanOrEqual(HOLD_MIN - 1e-9);
      }
    }
  });

  it('o aviso é mais longo que uma sílaba comum (dá para ouvir a diferença)', () => {
    for (const seed of SEEDS) {
      for (const c of cycles('classico', 12, seed, 200)) {
        expect(c.lookStart - c.avisoStart).toBeGreaterThan(c.beat * 1.4);
      }
    }
  });

  it('o compasso encurta com a dificuldade e há três jeitos de cantar', () => {
    const avgBeat = (n: number) => {
      const cs = SEEDS.flatMap((sd) => cycles('classico', n, sd, 120));
      return cs.reduce((a, c) => a + c.beat, 0) / cs.length;
    };
    expect(avgBeat(1)).toBeGreaterThan(avgBeat(30));
    const tempos = new Set(SEEDS.flatMap((sd) => cycles('classico', 25, sd, 300).map((c) => c.tempo)));
    expect([...tempos].sort()).toEqual(['acelera', 'arrasta', 'firme']);
    // no começo vem quase tudo firme
    const early = SEEDS.flatMap((sd) => cycles('classico', 1, sd, 300));
    expect(early.filter((c) => c.tempo === 'firme').length / early.length).toBeGreaterThan(0.45);
  });

  it('quantos versos varia (1 a 3) e a dificuldade tira versos', () => {
    const verses = (n: number) => SEEDS.flatMap((sd) => cycles('classico', n, sd, 400).map((c) => c.verses));
    const easy = verses(1);
    const hard = verses(60);
    expect(new Set(easy)).toEqual(new Set([1, 2, 3]));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(hard)).toBeLessThan(avg(easy));
  });

  it('as sílabas se encadeiam sem sobrepor e noteAt acha a que está tocando', () => {
    const c = cycles('classico', 5, 'z', 60)[3]!;
    for (let i = 1; i < c.notes.length; i++) {
      expect(c.notes[i]!.t0).toBeGreaterThanOrEqual(c.notes[i - 1]!.t1 - 1e-9);
    }
    const n = c.notes[2]!;
    expect(noteAt(c, (n.t0 + n.t1) / 2)).toBe(n);
    expect(noteAt(c, c.lookEnd + 0.01)).toBeNull();
  });

  it('a simulação avisa cada sílaba, na ordem, uma vez só', () => {
    const sim = new SinalSim('x', 'infinito');
    const sylls: number[] = [];
    let holds = 0;
    for (let i = 0; i < 60 * 12 && !sim.dead; i++) {
      for (const e of sim.step(0, 0)) {
        if (e.kind === 'nota') {
          sylls.push(e.syl);
          if (e.hold) holds++;
        }
      }
    }
    expect(sylls.length).toBeGreaterThan(10);
    sylls.forEach((v, i) => expect(v).toBe(i % 5));
    expect(holds).toBeGreaterThan(0);
  });
});

describe('o corredor flexível (spec 026)', () => {
  const widths = (seed: string, mode: SinalMode, n: number, to: number) => {
    const w = new WidthField(courseFor(seed, mode, n), `${seed}:w${n}`);
    const out: number[] = [];
    for (let y = -5; y < to; y += 0.5) out.push(w.halfAt(y));
    return out;
  };

  it('é determinístico e os primeiros 30 m são sempre normais', () => {
    expect(widths('a', 'infinito', 1, 400)).toEqual(widths('a', 'infinito', 1, 400));
    for (const seed of SEEDS) {
      const w = new WidthField(infinitoCourse(seed), seed);
      for (let y = -5; y <= 30; y += 0.5) expect(w.halfAt(y)).toBe(HALF);
    }
  });

  it('estreita e alarga de verdade, sempre dentro dos limites e sem saltos', () => {
    let narrow = 0;
    let wide = 0;
    for (const seed of SEEDS) {
      const xs = widths(seed, 'infinito', 1, 1500);
      for (const h of xs) {
        expect(h).toBeGreaterThanOrEqual(HALF_MIN - 1e-9);
        expect(h).toBeLessThanOrEqual(HALF_MAX + 1e-9);
        if (h < 5.5) narrow++;
        if (h > HALF + 0.5) wide++;
      }
      // transição suave: a largura muda pouco a cada meio metro
      for (let i = 1; i < xs.length; i++) expect(Math.abs(xs[i]! - xs[i - 1]!)).toBeLessThan(0.5);
    }
    expect(narrow).toBeGreaterThan(50);
    expect(wide).toBeGreaterThan(50);
  });

  it('os desfiladeiros ficam mais estreitos e mais comuns com a dificuldade', () => {
    const stat = (n: number) => {
      const xs = SEEDS.flatMap((sd) => widths(sd, 'classico', n, 300));
      return { min: Math.min(...xs), share: xs.filter((h) => h < 5.5).length / xs.length };
    };
    expect(stat(40).min).toBeLessThanOrEqual(stat(1).min + 1e-9);
    expect(stat(40).share).toBeGreaterThan(stat(1).share);
  });

  it('o boneco não atravessa a parede, mesmo onde o corredor estreita', () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const sim = new SinalSim(seed, 'infinito');
      for (let i = 0; i < 60 * 40 && !sim.dead; i++) {
        // anda de lado para a direita e para a frente: encosta na parede o tempo todo
        sim.step(60, 100);
        const half = sim.view.halfAt(sim.y);
        expect(Math.abs(sim.x)).toBeLessThanOrEqual(half - PLAYER_R + 1e-6);
      }
    }
  });

  it('sempre sobra passagem: nenhum obstáculo sólido fecha o corredor em nenhum ponto', () => {
    for (const seed of SEEDS) {
      for (const n of [1, 6, 20]) {
        const course = classicoCourse(seed, n);
        const width = new WidthField(course, `${seed}:w`);
        const f = new ObstacleField(course, `${seed}:o`, new CoverField(course, `${seed}:c`, width), width);
        f.ensure(500);
        for (const o of f.list.filter((q) => isSolid(q.kind))) {
          const half = width.halfAt(o.y);
          expect(Math.max(o.x - o.r + half, half - (o.x + o.r)), `${seed} ${n} ${o.kind}`).toBeGreaterThanOrEqual(
            MIN_GAP - 1e-9,
          );
          expect(Math.abs(o.x)).toBeLessThanOrEqual(half);
        }
      }
    }
  });

  it('nos desfiladeiros não entram obstáculos que varrem o corredor de lado', () => {
    for (const seed of SEEDS) {
      const course = classicoCourse(seed, 30);
      const width = new WidthField(course, `${seed}:w`);
      const f = new ObstacleField(course, `${seed}:o`, new CoverField(course, `${seed}:c`, width), width);
      f.ensure(800);
      for (const o of f.list) {
        if (width.halfAt(o.y) < 5.5) expect(['deslizante', 'orbita', 'serra']).not.toContain(o.kind);
      }
    }
  });

  it('a corrida do servidor continua igual à do jogo com o corredor variável', () => {
    const sim = new SinalSim('x', 'classico');
    const inputs: { tick: number; x: number; y: number }[] = [];
    let last = ['', ''];
    for (let i = 0; i < 60 * 200 && !sim.dead; i++) {
      const [ax, ay] = perfect(sim);
      const key = [String(ax), String(ay)];
      if (key[0] !== last[0] || key[1] !== last[1]) {
        inputs.push({ tick: i, x: ax, y: ay });
        last = key;
      }
      sim.step(ax, ay);
    }
    expect(evaluateSinal('x', 'classico', inputs, 60 * 200)).toEqual(sim.result);
  });
});

describe('a escuridão aparece (spec 026)', () => {
  it('larga mais perto que antes e acelera a partir do começo', () => {
    expect(infinitoCourse('x').darkStart).toBeLessThanOrEqual(30);
    expect(classicoCourse('x', 1).darkStart).toBeLessThanOrEqual(28);
    expect(classicoCourse('x', 40).darkStart).toBeGreaterThanOrEqual(18);
    // com o tempo ela anda tanto quanto quem corre devagar: é preciso seguir em frente
    expect(darkSpeed(infinitoCourse('x'), 120, 0)).toBeGreaterThan(2.5);
  });

  it('quem fica parado é alcançado, e quem corre seguindo a cantiga vai longe', () => {
    for (const seed of SEEDS) {
      const still = new SinalSim(seed, 'infinito');
      run(still, () => [0, 0], 60 * 120);
      expect(still.result.ended, seed).toBe('escuridao');
    }
    for (const seed of SEEDS) {
      const sim = new SinalSim(seed, 'infinito');
      run(sim, perfect, 60 * 150);
      expect(sim.result.meters, seed).toBeGreaterThan(150);
    }
  });
});
