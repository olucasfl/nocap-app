import { describe, expect, it } from 'vitest';
import { GRIMOIRES, upgradeIndex, type GrimoireDef } from './catalog';
import { drawGrimoires, grimoireUseful, newSave, rerollGrimoire, type SaveState } from './engine';

const byId = (id: string): GrimoireDef => GRIMOIRES.find((g) => g.id === id)!;

function withLevels(s: SaveState, levels: Record<string, number>): SaveState {
  const upgradeLevels = s.run.upgradeLevels.slice();
  for (const [id, n] of Object.entries(levels)) upgradeLevels[upgradeIndex(id)] = n;
  return { ...s, run: { ...s.run, upgradeLevels, picks: 40 } };
}

const start = (collapses = 0): SaveState => ({ ...newSave('u', 0), collapses });

/** Quais grimórios saem em muitas escolhas sorteadas. */
function seen(base: (i: number) => SaveState, n = 400): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < n; i++) for (const id of drawGrimoires(base(i)).offers) ids.add(id);
  return ids;
}

describe('grimório só é oferecido se rende agora (spec 039, seção 7)', () => {
  it('de combo precisa do Ritmo Firme', () => {
    for (const id of ['uranus', 'europa', 'vesta', 'sirius', 'rigel']) {
      expect(grimoireUseful(start(), byId(id)), id).toBe(false);
      expect(grimoireUseful(withLevels(start(), { rhythm: 1 }), byId(id)), id).toBe(true);
    }
  });

  it('de geradores precisa de gerador do tipo certo', () => {
    expect(grimoireUseful(start(), byId('earth'))).toBe(false);
    expect(grimoireUseful(withLevels(start(), { satellite: 1 }), byId('earth'))).toBe(true);
    // Energia só rende com gerador de energia; poeira, com gerador de poeira.
    expect(grimoireUseful(withLevels(start(1), { satellite: 1 }), byId('pallas'))).toBe(false);
    expect(grimoireUseful(withLevels(start(1), { antenna: 1 }), byId('pallas'))).toBe(true);
    expect(grimoireUseful(withLevels(start(), { antenna: 1 }), byId('earth'))).toBe(false);
    // O "tocando" e o "parado" valem para qualquer gerador.
    expect(grimoireUseful(start(), byId('vela-pulsar'))).toBe(false);
    expect(grimoireUseful(withLevels(start(4), { antenna: 1 }), byId('vela-pulsar'))).toBe(true);
  });

  it('de objetos precisa dos objetos abertos, e o de um tipo precisa daquele tipo', () => {
    expect(grimoireUseful(start(), byId('venus'))).toBe(false);
    expect(grimoireUseful(withLevels(start(), { satellite: 1 }), byId('venus'))).toBe(true);
    // Depois do 1º colapso os objetos já abrem sozinhos.
    expect(grimoireUseful(start(1), byId('venus'))).toBe(true);
    // Asteroide só existe a partir do colapso 1.
    expect(grimoireUseful(withLevels(start(0), { satellite: 1 }), byId('ryugu'))).toBe(false);
    expect(grimoireUseful(start(1), byId('ryugu'))).toBe(true);
  });

  it('os que sempre rendem (toque a cada N, energia, poeira de partida) saem desde o começo', () => {
    for (const id of ['moon', 'mercury', 'jupiter', 'ceres', 'titan', 'betelgeuse']) {
      expect(grimoireUseful(start(), byId(id)), id).toBe(true);
    }
  });

  it('no começo do jogo a escolha nunca traz combo, geradores nem objetos', () => {
    const ids = seen((i) => ({ ...newSave(`d${i}`, 0), run: { ...newSave(`d${i}`, 0).run, picks: 40 } }));
    for (const id of ids) {
      const g = byId(id);
      expect(grimoireUseful(start(), g), id).toBe(true);
    }
    for (const id of ['uranus', 'europa', 'earth', 'sun', 'venus', 'mars', 'halley', 'vela-pulsar']) expect(ids.has(id), id).toBe(false);
    expect(ids.size).toBeGreaterThan(5);
  });

  it('com o Ritmo Firme, os de combo passam a sair; com geradores, os de geradores', () => {
    const rhythm = seen((i) => withLevels(newSave(`r${i}`, 0), { rhythm: 1 }));
    expect(rhythm.has('uranus') || rhythm.has('vesta') || rhythm.has('europa')).toBe(true);
    expect(rhythm.has('earth')).toBe(false);
    const gens = seen((i) => withLevels(newSave(`g${i}`, 0), { satellite: 2 }));
    expect(gens.has('earth') || gens.has('sun')).toBe(true);
    expect(gens.has('uranus')).toBe(false);
  });

  it('a troca de uma carta também só traz o que rende', () => {
    for (let i = 0; i < 100; i++) {
      const base = withLevels(newSave(`t${i}`, 0), {});
      const { offers } = drawGrimoires(base);
      const pending = { offers, openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 1 };
      const next = rerollGrimoire({ ...base, run: { ...base.run, pending } }, offers[0] as string, 1);
      for (const id of next.run.pending?.offers ?? []) expect(grimoireUseful(base, byId(id)), id).toBe(true);
    }
  });

  it('a escolha nunca abre vazia, mesmo com poucas cartas que rendem', () => {
    const lonely = { ...newSave('l', 0), run: { ...newSave('l', 0).run, picks: 0 } };
    expect(drawGrimoires(lonely).offers.length).toBe(3);
  });
});
