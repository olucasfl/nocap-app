import { describe, expect, it } from 'vitest';
import { HINT_COUNT, HINTS_PER_COLOR, PALETTE, paletteRound } from './palette';
import { hexToHsb } from './palette-types';

/** A dica compara com outra cor? Então "mais escuro que X" não descreve a cor sozinha. */
const isRelative = (hint: string) => /\b(mais|menos|que)\b/i.test(hint);

describe('paleta do Intruso: tamanho e formato', () => {
  it('tem de 300 a 400 cores, cada uma com exatamente 5 dicas', () => {
    expect(PALETTE.length).toBeGreaterThanOrEqual(300);
    expect(PALETTE.length).toBeLessThanOrEqual(400);
    for (const c of PALETTE) {
      expect(c.hints, c.name).toHaveLength(HINTS_PER_COLOR);
    }
    expect(HINT_COUNT).toBe(PALETTE.length * HINTS_PER_COLOR);
  });

  it('cada cor tem HSB válido, nome único e cor única', () => {
    const names = new Set<string>();
    const colors = new Set<string>();
    for (const c of PALETTE) {
      expect(c.hsb.h, c.name).toBeGreaterThanOrEqual(0);
      expect(c.hsb.h, c.name).toBeLessThanOrEqual(359);
      expect(c.hsb.s, c.name).toBeGreaterThanOrEqual(0);
      expect(c.hsb.s, c.name).toBeLessThanOrEqual(100);
      expect(c.hsb.b, c.name).toBeGreaterThanOrEqual(0);
      expect(c.hsb.b, c.name).toBeLessThanOrEqual(100);
      expect(names.has(c.name), `nome repetido: ${c.name}`).toBe(false);
      names.add(c.name);
      const key = `${c.hsb.h}/${c.hsb.s}/${c.hsb.b}`;
      expect(colors.has(key), `cor repetida: ${c.name} (${key})`).toBe(false);
      colors.add(key);
    }
  });

  it('nenhuma dica se repete e todas têm tamanho de frase', () => {
    const seen = new Set<string>();
    for (const c of PALETTE) {
      for (const h of c.hints) {
        expect(h.trim().length, `${c.name}: "${h}"`).toBeGreaterThan(25);
        expect(h.length, `${c.name}: "${h}"`).toBeLessThan(140);
        expect(seen.has(h), `dica repetida: "${h}"`).toBe(false);
        seen.add(h);
      }
    }
  });
});

describe('paleta do Intruso: qualidade das dicas', () => {
  it('nenhuma dica usa termo técnico (o intruso não sabe o que é saturação ou brilho)', () => {
    for (const c of PALETTE) {
      for (const h of c.hints) {
        expect(h, `${c.name}: "${h}"`).not.toMatch(/brilho|satura|matiz|\bhsb\b|\bhex\b/i);
      }
    }
  });

  it('as dicas não contradizem a cor: escuro, claro, vivo e apagado', () => {
    for (const c of PALETTE) {
      const { s, b } = c.hsb;
      for (const h of c.hints) {
        if (isRelative(h)) continue;
        const where = `${c.name} (${c.hsb.h}/${s}/${b}): "${h}"`;
        // Só vale como descrição própria quando a dica não compara com outra cor.
        if (/\bescur[oa]s?\b|\bescur[ií]ssim[oa]\b|\bfechad[oa]\b/i.test(h)) {
          expect(b, where).toBeLessThanOrEqual(75);
        }
        if (/\bclar[oa]s?\b|\bclarinh[oa]s?\b|\bclar[ií]ssim[oa]\b|\bpálid[oa]\b/i.test(h)) {
          expect(b, where).toBeGreaterThanOrEqual(78);
        }
        if (/\bvivo\b|\bviva\b|\bvibrante\b|\bberrante\b|\bfortíssim[oa]\b|\baceso\b/i.test(h)) {
          expect(s, where).toBeGreaterThanOrEqual(55);
        }
        if (/\bapagad[oa]\b|\bacinzentad[oa]\b|\bfosco\b|\bfosca\b/i.test(h)) {
          expect(s, where).toBeLessThanOrEqual(70);
        }
        // "Médio" não vale para cor escura (e nem para quase branca).
        if (/\bmédi[oa]\b/i.test(h)) {
          expect(b, where).toBeGreaterThanOrEqual(45);
          if (s < 25) expect(b, where).toBeLessThanOrEqual(88);
        }
        if (/\bpastel\b/i.test(h)) {
          expect(b, where).toBeGreaterThanOrEqual(85);
          expect(s, where).toBeLessThanOrEqual(50);
        }
        if (/\bneon\b|fluorescente/i.test(h)) {
          expect(b, where).toBeGreaterThanOrEqual(85);
          expect(s, where).toBeGreaterThanOrEqual(65);
        }
        if (/\bquase pret[oa]\b/i.test(h)) expect(b, where).toBeLessThanOrEqual(40);
        if (/\bquase branc[oa]\b/i.test(h)) {
          expect(b, where).toBeGreaterThanOrEqual(88);
          expect(s, where).toBeLessThanOrEqual(25);
        }
      }
    }
  });

  it('o nome da cor combina com a cor de verdade (Verde é verde, Azul é azul...)', () => {
    type Rule = [RegExp, (h: number, s: number, b: number) => boolean];
    const rules: Rule[] = [
      [/^Verde/, (h, s) => h >= 60 && h <= 185 && s >= 6],
      [/^Azul/, (h, s) => h >= 170 && h <= 260 && s >= 6],
      [/^(Vermelho|Escarlate)/, (h, s) => (h <= 15 || h >= 340) && s >= 60],
      [/^Amarelo/, (h, s) => h >= 38 && h <= 70 && s >= 20],
      [/^Laranja/, (h, s) => h >= 15 && h <= 45 && s >= 25],
      [/^Rosa/, (h) => h >= 320 || h <= 12],
      [/^(Roxo|Violeta|Lilás|Lavanda)/, (h) => h >= 245 && h <= 325],
      [/^Cinza/, (_h, s) => s <= 45],
      [/^Branco/, (_h, s, b) => b >= 95 && s <= 10],
      [/^Preto/, (_h, _s, b) => b <= 15],
      [/^Marrom/, (h, s, b) => h <= 45 && b <= 82 && s >= 35],
    ];
    for (const c of PALETTE) {
      for (const [re, ok] of rules) {
        if (re.test(c.name)) {
          expect(ok(c.hsb.h, c.hsb.s, c.hsb.b), `${c.name} ${c.hsb.h}/${c.hsb.s}/${c.hsb.b}`).toBe(
            true,
          );
        }
      }
    }
  });
});

describe('hexToHsb', () => {
  it('converte cores conhecidas', () => {
    expect(hexToHsb('#FF0000')).toEqual({ h: 0, s: 100, b: 100 });
    expect(hexToHsb('#00FF00')).toEqual({ h: 120, s: 100, b: 100 });
    expect(hexToHsb('#0000FF')).toEqual({ h: 240, s: 100, b: 100 });
    expect(hexToHsb('#FFFFFF')).toEqual({ h: 0, s: 0, b: 100 });
    expect(hexToHsb('#000000')).toEqual({ h: 0, s: 0, b: 0 });
    expect(hexToHsb('#800020')).toEqual({ h: 345, s: 100, b: 50 });
  });
  it('recusa hexadecimal inválido', () => {
    expect(() => hexToHsb('azul')).toThrow();
  });
});

describe('rodada do Intruso', () => {
  it('é determinística e as rodadas da partida têm cores diferentes', () => {
    expect(paletteRound('x', 2)).toEqual(paletteRound('x', 2));
    const names = new Set([0, 1, 2, 3, 4].map((i) => paletteRound('x', i).name));
    expect(names.size).toBe(5);
  });
});
