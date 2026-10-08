import { describe, expect, it } from 'vitest';
import {
  BIG_WEIGHT,
  MICRO_MAX,
  PARTY_MICRO_PER_ROUND,
  TAP_FULL,
  buildPlan,
  colorPoints,
  colorShowMs,
  commandText,
  noteToPoints,
  tapPoints,
} from './index';

describe('buildPlan', () => {
  it('cada rodada tem 5 micro-desafios e 1 minijogo grande, em ordem', () => {
    const plan = buildPlan('s', 2);
    expect(plan).toHaveLength(2 * (PARTY_MICRO_PER_ROUND + 1));
    const kinds = plan.map((p) => p.kind);
    expect(kinds.slice(0, 6)).toEqual(['micro', 'micro', 'micro', 'micro', 'micro', 'big']);
    expect(kinds.slice(6)).toEqual(['micro', 'micro', 'micro', 'micro', 'micro', 'big']);
    expect(plan.filter((p) => p.round === 2)).toHaveLength(6);
  });

  it('é determinística pela seed e muda com outra seed', () => {
    expect(buildPlan('abc', 3)).toEqual(buildPlan('abc', 3));
    expect(buildPlan('abc', 3)).not.toEqual(buildPlan('xyz', 3));
  });

  it('as pegadinhas aparecem em torno de 20% dos micro-desafios', () => {
    const micro = buildPlan('grande', 5000).filter((p) => p.kind === 'micro');
    const special = micro.filter((p) => p.kind === 'micro' && p.variant !== 'standard').length;
    const share = special / micro.length;
    expect(share).toBeGreaterThan(0.15);
    expect(share).toBeLessThan(0.25);
  });
});

describe('pontuação da Mesmíssima', () => {
  it('nota 10 vale 1000; 5 ou menos vale 0; linear no meio', () => {
    expect(noteToPoints(10)).toBe(MICRO_MAX);
    expect(noteToPoints(7.5)).toBe(500);
    expect(noteToPoints(5)).toBe(0);
    expect(noteToPoints(2)).toBe(0);
  });

  it('Invertido: longe vale muito; perto demais tira pontos e pode ficar negativo', () => {
    expect(colorPoints('inverted', 0)).toBe(1000);
    expect(colorPoints('inverted', 4)).toBe(200);
    expect(colorPoints('inverted', 6)).toBe(0);
    expect(colorPoints('inverted', 10)).toBe(-500);
    expect(colorPoints('inverted', 8)).toBeLessThan(0);
  });

  it('o às cegas mostra o alvo por 1,5 s; os outros por 3 s', () => {
    expect(colorShowMs('blind')).toBe(1500);
    expect(colorShowMs('standard')).toBe(3000);
  });
});

describe('minijogo grande provisório', () => {
  it('vale o dobro de um micro-desafio e trava no teto', () => {
    expect(tapPoints(TAP_FULL)).toBe(MICRO_MAX * BIG_WEIGHT);
    expect(tapPoints(TAP_FULL * 3)).toBe(MICRO_MAX * BIG_WEIGHT);
    expect(tapPoints(0)).toBe(0);
    expect(tapPoints(TAP_FULL / 2)).toBe(MICRO_MAX);
  });

  it('o comando do Invertido destaca "DIFERENTE" e o resto pede parecida', () => {
    const plan = buildPlan('s', 1);
    const micro = plan.find((p) => p.kind === 'micro')!;
    expect(commandText(micro)).toMatch(/cor/);
    expect(commandText({ ...micro, variant: 'inverted' } as typeof micro)).toMatch(/DIFERENTE/);
  });
});
