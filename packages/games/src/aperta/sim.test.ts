import { beforeAll, describe, expect, it } from 'vitest';
import { LIFE_BAND_LAST_COLLAPSE, LIFE_GROWTH_MAX, LIFE_HOURS_MAX, LIFE_HOURS_MIN } from './economy';
import { PROFILES, formatSimReport, simulate, simulateAverage, type SimResult } from './sim';

const SEEDS = Array.from({ length: 16 }, (_, i) => `v${i}`);

describe('simulate', () => {
  it('é determinístico pela semente', () => {
    const a = simulate({ profile: 'normal', seed: 'det', collapses: 1 });
    const b = simulate({ profile: 'normal', seed: 'det', collapses: 1 });
    expect(a).toEqual(b);
  });

  it('não devolve NaN nem infinito e as vidas fecham', () => {
    const r = simulate({ profile: 'normal', seed: 'sane', collapses: 2 });
    expect(r.lives).toHaveLength(2);
    for (const life of r.lives) {
      expect(life.stalled).toBe(false);
      expect(Number.isFinite(life.hours)).toBe(true);
      expect(Number.isFinite(life.dust)).toBe(true);
      expect(life.hours).toBeGreaterThan(0);
      expect(life.picks).toBeGreaterThan(0);
    }
    expect(r.alerts.filter((a) => /inválido|travou/.test(a))).toEqual([]);
  });

  it('os marcos da 1ª vida vêm em ordem', () => {
    const life = simulate({ profile: 'normal', seed: 'ms', collapses: 1 }).lives[0]!;
    const marks = life.milestones as number[];
    expect(marks.every((m) => m !== null)).toBe(true);
    // 1ª escolha < 10 escolhas < 1 mi < estrela pronta
    expect(marks[1]!).toBeLessThan(marks[2]!);
    expect(marks[2]!).toBeLessThan(marks[3]!);
    expect(marks[3]!).toBeLessThanOrEqual(marks[4]!);
  });

  it('a 1ª melhoria sai em até 1 min e o 1º grimório logo (economia v2, spec 039)', () => {
    const life = simulate({ profile: 'normal', seed: 'first', collapses: 1 }).lives[0]!;
    const upgradeSec = (life.milestones[0] as number) * 3600;
    const pickSec = (life.milestones[1] as number) * 3600;
    // O Satélite custa 15 (6 s de toques); o simulador junta para a melhoria de melhor ganho por preço, então a
    // 1ª compra leva até ~1 min. O 1º grimório sai aos 38 toques (~15 s).
    expect(upgradeSec).toBeGreaterThanOrEqual(5);
    expect(upgradeSec).toBeLessThanOrEqual(60);
    expect(pickSec).toBeGreaterThan(5);
    expect(pickSec).toBeLessThanOrEqual(40);
  });

  it('quem toca mais rápido chega antes (casual, normal e ativo)', () => {
    const hours = (profile: 'casual' | 'normal' | 'active'): number =>
      simulate({ profile, seed: 'speed', collapses: 1 }).lives[0]!.hours;
    expect(hours('casual')).toBeGreaterThan(hours('normal'));
    expect(hours('normal')).toBeGreaterThan(hours('active'));
  });

  it('para uma vida que não termina e avisa', () => {
    const r = simulate({ profile: 'casual', seed: 'stall', collapses: 1, maxHoursPerLife: 0.05 });
    expect(r.lives[0]?.stalled).toBe(true);
    expect(r.alerts.join(' ')).toMatch(/travou/);
  });

  it('os três perfis da spec 040: casual 30 min/dia, normal 1 a 2 h/dia e ativo 4 h/dia', () => {
    expect(Object.keys(PROFILES)).toEqual(['casual', 'normal', 'active']);
    expect(PROFILES.casual).toMatchObject({ touchesPerSec: 1, hoursPerDay: 0.5 });
    expect(PROFILES.normal).toMatchObject({ touchesPerSec: 2.5, hoursPerDay: 1.5 });
    expect(PROFILES.active).toMatchObject({ touchesPerSec: 4, hoursPerDay: 4 });
  });

  it('cada vida devolve as horas de jogo e os dias no ritmo do perfil', () => {
    const life = simulate({ profile: 'casual', seed: 'days', collapses: 1 }).lives[0]!;
    expect(life.days).toBeCloseTo(life.hours / PROFILES.casual.hoursPerDay, 9);
    expect(life.reqHours.filter((x) => x !== null).length).toBe(3);
    expect(life.milestoneKind).toBe('combo');
  });

  it('o jogador simulado cumpre o marco de cada tipo (nenhuma vida trava por causa dele)', () => {
    // 14 vidas passam por todos os tipos do ciclo, inclusive missões (abrem no colapso 4) e geradores. Em muitas sementes o
    // jogador simulado pega Cygnus X-1 (objetos desligados) e o marco pula capturas, raros e missões; nesta ele não pega.
    const r = simulate({ profile: 'normal', seed: 'm0', collapses: 14, maxHoursPerLife: 30 });
    expect(r.lives).toHaveLength(14);
    expect(new Set(r.lives.map((l) => l.milestoneKind)).size).toBe(6);
    expect(r.lives.every((l) => !l.stalled)).toBe(true);
  }, 300_000);
});

// 16 sementes que não foram usadas para calibrar (a calibragem usou `c` e `e`): uma vida isolada varia muito pela
// sorte dos grimórios e das missões, então as travas valem para a média.
const LIVES = 40;
describe('travas de duração da spec 040 (perfil normal)', () => {
  let hours: number[] = [];
  let results: SimResult[] = [];
  beforeAll(() => {
    ({ hours, results } = simulateAverage('normal', SEEDS, LIVES));
  }, 900_000);

  it('até o 15º colapso cada vida leva de 1 h a 3 h', () => {
    for (let k = 1; k <= LIFE_BAND_LAST_COLLAPSE; k++) {
      const h = hours[k - 1]!;
      expect(h, `vida ${k}: ${h.toFixed(2)} h`).toBeGreaterThanOrEqual(LIFE_HOURS_MIN);
      expect(h, `vida ${k}: ${h.toFixed(2)} h`).toBeLessThanOrEqual(LIFE_HOURS_MAX);
    }
  });

  it('depois do 15º a vida cresce no máximo 3% por colapso (tendência da média)', () => {
    // Regressão de ln(horas) contra o colapso: a inclinação não passa de ln(1,03). A média de uma vida isolada
    // oscila, então a tendência é o que a trava mede; e nenhuma média passa do teto de 3 h crescido 3% por colapso desde o 15º.
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = LIFE_BAND_LAST_COLLAPSE + 1; k <= LIVES; k++) {
      xs.push(k);
      ys.push(Math.log(hours[k - 1]!));
    }
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const slope = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i]! - my), 0) / xs.reduce((acc, x) => acc + (x - mx) ** 2, 0);
    expect(slope, `inclinação ${(slope * 100).toFixed(2)}% por colapso`).toBeLessThanOrEqual(Math.log(1 + LIFE_GROWTH_MAX));
    for (let k = LIFE_BAND_LAST_COLLAPSE + 1; k <= LIVES; k++) {
      const ceiling = LIFE_HOURS_MAX * Math.pow(1 + LIFE_GROWTH_MAX, k - LIFE_BAND_LAST_COLLAPSE);
      expect(hours[k - 1]!, `vida ${k}`).toBeLessThanOrEqual(ceiling);
    }
  });

  it('nunca vira muro: nenhuma vida simulada trava e nenhum valor sai inválido', () => {
    for (const r of results) {
      for (const life of r.lives) {
        expect(life.stalled).toBe(false);
        expect(Number.isFinite(life.dust)).toBe(true);
        expect(Number.isFinite(life.hours)).toBe(true);
      }
      expect(r.lives).toHaveLength(LIVES);
      expect(r.alerts.filter((a) => /inválido|travou|1e300/.test(a))).toEqual([]);
    }
  });

  it('a meta de poeira nunca fica abaixo do que a vida rende: o requisito de poeira vale a partir do 2º colapso', () => {
    // No 1º colapso (2 mi) as escolhas seguram a vida; do 2º em diante a poeira é o requisito que fecha.
    for (const r of results) {
      for (const life of r.lives.slice(1, LIFE_BAND_LAST_COLLAPSE)) {
        const dustDone = life.reqHours[0] ?? 0;
        expect(dustDone, `vida ${life.collapse}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('os três perfis rodam a mesma economia', () => {
  it('casual, normal e ativo fecham 6 colapsos sem travar e o ativo é o mais rápido no total', () => {
    const total = (profile: 'casual' | 'normal' | 'active'): number => {
      const r = simulate({ profile, seed: 'perfis', collapses: 6, maxHoursPerLife: 80 });
      expect(r.lives, profile).toHaveLength(6);
      expect(r.lives.every((l) => !l.stalled)).toBe(true);
      return r.lives.reduce((a, l) => a + l.hours, 0);
    };
    const [c, n, a] = [total('casual'), total('normal'), total('active')];
    expect(c).toBeGreaterThan(n);
    expect(n).toBeGreaterThan(a);
  }, 300_000);
});

describe('formatSimReport', () => {
  it('imprime a tabela de marcos e a de vidas, com horas e dias por perfil', () => {
    const results: SimResult[] = (['casual', 'normal', 'active'] as const).map((profile) =>
      simulate({ profile, seed: 'fmt', collapses: 2 }),
    );
    const text = formatSimReport(results);
    expect(text).toContain('Horas de jogo aberto até cada marco');
    expect(text).toContain('Estrela pronta');
    expect(text).toContain('Duração de cada vida');
    expect(text).toContain('Ativo (4 h/dia)');
    expect(text).toContain('1º');
    expect(text).toMatch(/\d d\)/);
    expect(text).not.toMatch(/NaN|Infinity/);
  });
});
