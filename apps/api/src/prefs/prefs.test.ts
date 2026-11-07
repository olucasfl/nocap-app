import { describe, expect, it } from 'vitest';
import { prefsSchema } from './prefs.controller';

describe('prefsSchema', () => {
  it('aceita opções válidas e parciais', () => {
    expect(prefsSchema.safeParse({ fs: { sens: 0.1, binds: { fire: 'Mouse0' } }, mute: true }).success).toBe(true);
    expect(prefsSchema.safeParse({}).success).toBe(true);
  });
  it('recusa campos desconhecidos (desempenho fica no aparelho) e valores absurdos', () => {
    expect(prefsSchema.safeParse({ fs: { quality: 'low' } }).success).toBe(true); // fs é parcial; campo extra é descartado
    expect(prefsSchema.safeParse({ other: 1 }).success).toBe(false);
    expect(prefsSchema.safeParse({ fs: { sens: 99 } }).success).toBe(false);
  });
});
