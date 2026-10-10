import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KEYS,
  assignKey,
  isAssignable,
  keyLabel,
  laneOfKey,
  normalizeKey,
  sanitizeKeys,
} from './batida-keys';

describe('teclas do Batida', () => {
  it('o padrão é 1, 2, 3, 4 e 5', () => {
    expect(DEFAULT_KEYS).toEqual(['1', '2', '3', '4', '5']);
  });

  it('normaliza e escreve a tecla para o botão', () => {
    expect(normalizeKey('A')).toBe('a');
    expect(normalizeKey(' ')).toBe('espaço');
    expect(keyLabel('a')).toBe('A');
    expect(keyLabel(' ')).toBe('ESPAÇO');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('5')).toBe('5');
  });

  it('Esc, Tab, Enter, modificadoras e F1 a F12 não podem ser de pista', () => {
    for (const k of ['Escape', 'Tab', 'Enter', 'Shift', 'Control', 'Alt', 'Meta', 'F5', 'F12']) {
      expect(isAssignable(k), k).toBe(false);
    }
    for (const k of ['a', 'Z', '7', ' ', 'ArrowLeft', ';']) expect(isAssignable(k), k).toBe(true);
  });

  it('troca a tecla de uma pista', () => {
    expect(assignKey(DEFAULT_KEYS, 0, 'q')).toEqual(['q', '2', '3', '4', '5']);
    expect(assignKey(DEFAULT_KEYS, 4, 'A')).toEqual(['1', '2', '3', '4', 'a']);
  });

  it('se outra pista já usava a tecla, as duas trocam (nunca duas iguais)', () => {
    expect(assignKey(DEFAULT_KEYS, 0, '3')).toEqual(['3', '2', '1', '4', '5']);
    const swapped = assignKey(['a', 's', 'd', 'f', 'g'], 4, 'a')!;
    expect(new Set(swapped).size).toBe(5);
    expect(swapped[4]).toBe('a');
    expect(swapped[0]).toBe('g');
  });

  it('recusa tecla reservada ou pista que não existe', () => {
    expect(assignKey(DEFAULT_KEYS, 0, 'Escape')).toBeNull();
    expect(assignKey(DEFAULT_KEYS, 5, 'a')).toBeNull();
    expect(assignKey(DEFAULT_KEYS, -1, 'a')).toBeNull();
  });

  it('o que vem do armazenamento só vale se estiver inteiro e sem repetição', () => {
    expect(sanitizeKeys(['a', 's', 'd', 'f', 'g'])).toEqual(['a', 's', 'd', 'f', 'g']);
    expect(sanitizeKeys(['a', 'a', 'd', 'f', 'g'])).toEqual([...DEFAULT_KEYS]);
    expect(sanitizeKeys(['a', 's'])).toEqual([...DEFAULT_KEYS]);
    expect(sanitizeKeys(['a', 's', 'd', 'f', 'Escape'])).toEqual([...DEFAULT_KEYS]);
    expect(sanitizeKeys(null)).toEqual([...DEFAULT_KEYS]);
    expect(sanitizeKeys('lixo')).toEqual([...DEFAULT_KEYS]);
  });

  it('acha a pista de uma tecla apertada, sem diferenciar maiúscula', () => {
    expect(laneOfKey(['a', 's', 'd', 'f', 'g'], 'D')).toBe(2);
    expect(laneOfKey(DEFAULT_KEYS, '9')).toBeUndefined();
  });
});
