import { describe, expect, it } from 'vitest';
import { mergeProgress, sameProgress, sanitizeProgress, type BeeProgressData, type ClassicProgressData, type ConnectProgressData } from './progress';

describe('juntar o progresso (nunca perde nada)', () => {
  it('Bee: une as palavras achadas e mantém a fase fechada', () => {
    const a: BeeProgressData = { found: ['casa', 'mesa'], closed: false, at: 10 };
    const b: BeeProgressData = { found: ['mesa', 'rosa'], closed: true, at: 5 };
    expect(mergeProgress('bee', a, b)).toEqual({ found: ['casa', 'mesa', 'rosa'], closed: true, at: 10 });
    expect(mergeProgress('bee', b, a)).toEqual({ found: ['mesa', 'rosa', 'casa'], closed: true, at: 10 });
  });

  it('Connect: fica com mais palpites e guarda dica e desistência de qualquer lado', () => {
    const row = ['a', 'b', 'c', 'd'];
    const a: ConnectProgressData = { guesses: [row], at: 1, hint: 2 };
    const b: ConnectProgressData = { guesses: [row, row], at: 9, gaveUp: true };
    expect(mergeProgress('connect', a, b)).toEqual({ guesses: [row, row], at: 9, gaveUp: true, hint: 2 });
  });

  it('Classic: fica com mais palpites e a fase terminada continua terminada', () => {
    const a: ClassicProgressData = { guesses: ['casas', 'amigo'], at: 4, done: true };
    const b: ClassicProgressData = { guesses: ['casas'], at: 8 };
    expect(mergeProgress('classic-c', a, b)).toEqual({ guesses: ['casas', 'amigo'], at: 8, done: true });
    expect(mergeProgress('classic-c', b, a)).toEqual({ guesses: ['casas', 'amigo'], at: 8, done: true });
  });

  it('juntar é idempotente e a ordem não muda o tamanho do resultado', () => {
    const a: ClassicProgressData = { guesses: ['casas'], at: 1 };
    expect(sameProgress(mergeProgress('classic-d', a, a), a)).toBe(true);
  });
});

describe('sanitizeProgress', () => {
  it('aceita o formato certo e descarta campos desconhecidos', () => {
    expect(sanitizeProgress('classic-q', { guesses: ['casas'], at: 3, done: true, lixo: 1 })).toEqual({ guesses: ['casas'], at: 3, done: true });
    expect(sanitizeProgress('bee', { found: ['a', 'a', 'b'], closed: 'sim', at: 1 })).toEqual({ found: ['a', 'b'], closed: false, at: 1 });
  });
  it('recusa formato errado, palpites demais e palavra enorme', () => {
    expect(sanitizeProgress('bee', { found: 'x' })).toBeNull();
    expect(sanitizeProgress('connect', { guesses: [['a', 'b']], at: 1 })).toBeNull();
    expect(sanitizeProgress('classic-c', { guesses: Array(61).fill('casas'), at: 1 })).toBeNull();
    expect(sanitizeProgress('classic-c', { guesses: ['x'.repeat(41)], at: 1 })).toBeNull();
    expect(sanitizeProgress('classic-c', null)).toBeNull();
  });
});
