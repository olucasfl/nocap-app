import { beforeAll, describe, expect, it } from 'vitest';
import { TARGET_HOURS } from './economy';
import { PROFILES, formatSimReport, simulate, simulateAverage, type SimResult } from './sim';

// 60 sementes que não foram usadas para calibrar (a calibração usou 60 outras): uma vida isolada varia de 1 a 6 h pela sorte dos grimórios.
const SEEDS = Array.from({ length: 60 }, (_, i) => `v${i}`);

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

  it('a 1ª escolha chega em 2 a 4 minutos no ritmo normal (seção 6.1)', () => {
    const life = simulate({ profile: 'normal', seed: 'first', collapses: 1 }).lives[0]!;
    const minutes = (life.milestones[1] as number) * 60;
    expect(minutes).toBeGreaterThanOrEqual(1.5);
    expect(minutes).toBeLessThanOrEqual(4.5);
  });

  it('quem toca mais rápido chega antes', () => {
    const hours = (profile: 'casual' | 'normal' | 'compulsive'): number =>
      simulate({ profile, seed: 'speed', collapses: 1 }).lives[0]!.hours;
    expect(hours('casual')).toBeGreaterThan(hours('normal'));
    expect(hours('normal')).toBeGreaterThan(hours('compulsive'));
  });

  it('para uma vida que não termina e avisa', () => {
    const r = simulate({ profile: 'casual', seed: 'stall', collapses: 1, maxHoursPerLife: 0.05 });
    expect(r.lives[0]?.stalled).toBe(true);
    expect(r.alerts.join(' ')).toMatch(/travou/);
  });

  it('os perfis têm o ritmo da spec (1, 2,5 e 6 toques/s)', () => {
    expect(PROFILES.casual.touchesPerSec).toBe(1);
    expect(PROFILES.normal.touchesPerSec).toBe(2.5);
    expect(PROFILES.compulsive.touchesPerSec).toBe(6);
  });
});

describe('metas da seção 6.6 (perfil normal, v1: colapsos 1 a 5)', () => {
  let hours: number[] = [];
  let results: SimResult[] = [];
  beforeAll(() => {
    ({ hours, results } = simulateAverage('normal', SEEDS, 5));
  }, 300_000);

  it('o 1º colapso fica entre 6 e 10 h', () => {
    expect(hours[0]!).toBeGreaterThanOrEqual(6);
    expect(hours[0]!).toBeLessThanOrEqual(10);
  });

  it('cada vida fica a ±15% da tabela', () => {
    hours.forEach((h, i) => {
      const target = TARGET_HOURS[i]!;
      expect(h, `vida ${i + 1}: ${h.toFixed(2)} h contra ${target} h`).toBeGreaterThanOrEqual(target * 0.85);
      expect(h, `vida ${i + 1}: ${h.toFixed(2)} h contra ${target} h`).toBeLessThanOrEqual(target * 1.15);
    });
  });

  it('nenhuma vida é mais longa que a anterior', () => {
    for (let i = 1; i < hours.length; i++) expect(hours[i]!).toBeLessThan(hours[i - 1]!);
  });

  it('nenhum caminho dá NaN, infinito ou vida travada', () => {
    for (const r of results) {
      for (const life of r.lives) {
        expect(life.stalled).toBe(false);
        expect(Number.isFinite(life.dust)).toBe(true);
        expect(Number.isFinite(life.hours)).toBe(true);
      }
      expect(r.alerts.filter((a) => /inválido|travou|1e15/.test(a))).toEqual([]);
    }
  });
});

describe('formatSimReport', () => {
  it('imprime a tabela de marcos e a de vidas', () => {
    const results: SimResult[] = (['casual', 'normal', 'compulsive'] as const).map((profile) =>
      simulate({ profile, seed: 'fmt', collapses: 1 }),
    );
    const text = formatSimReport(results);
    expect(text).toContain('Horas de jogo aberto até cada marco');
    expect(text).toContain('Estrela pronta');
    expect(text).toContain('Duração de cada vida');
    expect(text).toContain('1º');
    expect(text).not.toMatch(/NaN|Infinity/);
  });
});
