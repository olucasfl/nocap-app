import { describe, expect, it } from 'vitest';
import { nextTheme, parseTheme, resolveTheme } from './theme';

describe('tema', () => {
  it('cicla Automático → Claro → Escuro → Automático', () => {
    expect(nextTheme('auto')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('auto');
  });

  it('valor salvo inválido ou ausente vira Automático', () => {
    expect(parseTheme(null)).toBe('auto');
    expect(parseTheme('roxo')).toBe('auto');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
  });

  it('a escolha manual vence o sistema; no Automático vale o sistema', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
