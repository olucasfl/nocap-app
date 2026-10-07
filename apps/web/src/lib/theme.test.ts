import { describe, expect, it } from 'vitest';
import { nextTheme, parseTheme } from './theme';

describe('tema', () => {
  it('alterna entre Claro e Escuro', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });

  it('valor salvo vale; sem valor (ou inválido) começa pelo tema do sistema', () => {
    expect(parseTheme('dark', false)).toBe('dark');
    expect(parseTheme('light', true)).toBe('light');
    expect(parseTheme(null, true)).toBe('dark');
    expect(parseTheme('roxo', false)).toBe('light');
  });
});
