import { describe, expect, it } from 'vitest';
import { beeMaxPoints, playConnect } from '@nocap/games';
import bee from './bee-levels.json';
import connect from './connect-levels.json';
import { tierOf, tierRanges, toBeePuzzle, toConnectPuzzle, type BeeLevel, type ConnectLevel } from './levels';

const BEE = bee as BeeLevel[];
const CONNECT = connect as ConnectLevel[];

describe('fases do Bee', () => {
  it('as faixas crescem: Fácil tem poucas palavras curtas, e a quantidade cresce até o Mestre', () => {
    const avg = (t: number) => {
      const ls = BEE.filter((l) => l.t === t);
      return ls.reduce((s, l) => s + l.w.length, 0) / ls.length;
    };
    expect(avg(0)).toBeLessThan(avg(1));
    expect(avg(1)).toBeLessThan(avg(2));
    expect(avg(2)).toBeLessThan(avg(3));
  });

  it('a faixa Fácil tem de 10 a 22 palavras, nenhuma com mais de 7 letras (pangrama até 8)', () => {
    for (const l of BEE.filter((x) => x.t === 0)) {
      expect(l.w.length).toBeGreaterThanOrEqual(10);
      expect(l.w.length).toBeLessThanOrEqual(22);
      for (const w of l.w) expect(w.length).toBeLessThanOrEqual(l.p.includes(w) ? 8 : 7);
    }
  });

  it('a primeira fase é pequena e toda fase tem pangrama', () => {
    expect(BEE[0]!.w.length).toBeLessThanOrEqual(22);
    expect(Math.max(...BEE[0]!.w.map((w) => w.length))).toBeLessThanOrEqual(8);
    for (const l of BEE) expect(l.p.length).toBeGreaterThan(0);
  });

  it('a pontuação máxima também cresce de uma faixa para a outra', () => {
    const max = (t: number) => {
      const ls = BEE.filter((l) => l.t === t);
      return ls.reduce((s, l) => s + beeMaxPoints(toBeePuzzle(l)), 0) / ls.length;
    };
    expect(max(0)).toBeLessThan(max(1));
    expect(max(2)).toBeLessThan(max(3));
  });

  it('as palavras fora da fase (x) não repetem as da fase', () => {
    for (const l of BEE) for (const w of l.x) expect(l.w).not.toContain(w);
  });
});

describe('fases do Connect', () => {
  it('toda fase tem 4 grupos de 4 palavras, 16 distintas', () => {
    for (const l of CONNECT) {
      expect(l.g).toHaveLength(4);
      const words = l.g.flatMap((g) => g.w);
      expect(words).toHaveLength(16);
      expect(new Set(words).size).toBe(16);
    }
  });

  it('as fases fáceis vêm primeiro e as faixas estão em ordem', () => {
    const ts = CONNECT.map((l) => l.t);
    expect(ts).toEqual([...ts].sort((a, b) => a - b));
    expect(tierOf(CONNECT[0]!)).toBe('Fácil');
    expect(tierRanges(CONNECT)[0]).toMatchObject({ tier: 'Fácil', from: 1 });
  });

  it('acertar os 4 grupos vence sem nenhum erro e desistir revela tudo', () => {
    const p = toConnectPuzzle(CONNECT[0]!);
    const all = p.groups.map((g) => [...g.words]);
    const won = playConnect(p, all);
    expect(won.won).toBe(true);
    expect(won.errors).toBe(0);
    const quit = playConnect(p, [], { gaveUp: true });
    expect(quit.over).toBe(true);
    expect(quit.won).toBe(false);
  });
});
