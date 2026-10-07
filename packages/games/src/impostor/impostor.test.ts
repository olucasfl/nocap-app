import { describe, expect, it } from 'vitest';
import {
  IMPOSTOR_MAX_PLAYERS,
  IMPOSTOR_MIN_PLAYERS,
  assignImpostors,
  effectiveImpostors,
  impostorLimit,
  scoreImpostorRound,
  tallyVotes,
} from './index';

describe('tamanho da sala', () => {
  it('de 3 a 12 pessoas', () => {
    expect(IMPOSTOR_MIN_PLAYERS).toBe(3);
    expect(IMPOSTOR_MAX_PLAYERS).toBe(12);
  });
});

describe('limite de intrusos', () => {
  it('até 3, mas sempre sobra uma pessoa normal (3 pessoas: até 2 intrusos)', () => {
    expect([3, 4, 5, 6, 7, 8].map(impostorLimit)).toEqual([2, 3, 3, 3, 3, 3]);
  });
  it('sala cheia (12 pessoas) também aguenta no máximo 3 intrusos', () => {
    expect([9, 10, 11, 12].map(impostorLimit)).toEqual([3, 3, 3, 3]);
    expect(effectiveImpostors(3, 12)).toBe(3);
    expect(effectiveImpostors(1, 12)).toBe(1);
  });
  it('o pedido do host se adapta ao tamanho da sala', () => {
    expect(effectiveImpostors(3, 3)).toBe(2);
    expect(effectiveImpostors(2, 3)).toBe(2);
    expect(effectiveImpostors(3, 4)).toBe(3);
    expect(effectiveImpostors(2, 6)).toBe(2);
    expect(effectiveImpostors(1, 8)).toBe(1);
    expect(effectiveImpostors(3, 8)).toBe(3);
  });
});

describe('assignImpostors', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  it('é determinística, sem repetir, e não depende da ordem da lista', () => {
    const one = assignImpostors(ids, 2, 'seed', 0);
    expect(one).toHaveLength(2);
    expect(new Set(one).size).toBe(2);
    expect(assignImpostors([...ids].reverse(), 2, 'seed', 0)).toEqual(one);
  });
  it('muda de uma rodada para outra', () => {
    const rounds = new Set([0, 1, 2, 3, 4, 5].map((i) => assignImpostors(ids, 1, 's', i)[0]));
    expect(rounds.size).toBeGreaterThan(2);
  });
  it('todos têm chance de ser intruso', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) assignImpostors(ids, 1, `x${i}`, 0).forEach((x) => seen.add(x));
    expect(seen.size).toBe(ids.length);
  });
});

describe('tallyVotes', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  it('pega quem tem mais votos que o (K+1)-ésimo', () => {
    const r = tallyVotes(ids, { a: 'b', c: 'b', d: 'b', e: 'c' }, 1);
    expect(r.counts).toEqual({ b: 3, c: 1 });
    expect(r.caught).toEqual(['b']);
  });
  it('empate na fronteira não pega ninguém', () => {
    expect(tallyVotes(ids, { a: 'b', c: 'd' }, 1).caught).toEqual([]);
  });
  it('com 2 intrusos, os dois mais votados são pegos se passam do terceiro', () => {
    const r = tallyVotes(ids, { a: 'b', c: 'b', d: 'e', b: 'e', e: 'a' }, 2);
    expect(r.caught.sort()).toEqual(['b', 'e']);
  });
  it('ignora voto em si mesmo e em quem não existe', () => {
    const r = tallyVotes(ids, { a: 'a', b: 'zzz' }, 1);
    expect(r.counts).toEqual({});
    expect(r.caught).toEqual([]);
  });
});

describe('scoreImpostorRound', () => {
  const memberIds = ['a', 'b', 'c', 'd'];
  const accuracy = { a: 9, b: 8, c: 7, d: 3 };
  it('tripulação pontua pelo acerto e pelo voto certo; intruso pego fica quase só com a nota', () => {
    const { points } = scoreImpostorRound({
      memberIds,
      impostors: ['d'],
      accuracy,
      votes: { a: 'd', b: 'd', c: 'd', d: 'a' },
    });
    // d foi pego, mas ganha 1 pelo voto de inocente (a recebeu 1)
    expect(points).toEqual({ a: 12, b: 11, c: 10, d: 4 });
  });
  it('intruso que escapa ganha o bônus de sobreviver', () => {
    const { points, tally } = scoreImpostorRound({
      memberIds,
      impostors: ['d'],
      accuracy,
      votes: { a: 'b', b: 'a', c: 'b', d: 'b' },
    });
    expect(tally.caught).toEqual(['b']);
    // nota 3 + sobreviveu 6 + 3 votos em b + 1 em a
    expect(points.d).toBe(3 + 6 + 4);
    expect(points.a).toBe(9);
  });
});
