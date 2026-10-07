import { describe, expect, it } from 'vitest';
import { usernameProblem } from './account.service';

describe('usernameProblem', () => {
  it('aceita @ válido (maiúsculas viram minúsculas)', () => {
    expect(usernameProblem('lucas_01')).toBeNull();
    expect(usernameProblem('  Lucas_01 ')).toBeNull();
  });

  it('diz exatamente o que está errado', () => {
    expect(usernameProblem('ab')).toMatch(/curto/);
    expect(usernameProblem('a'.repeat(21))).toMatch(/longo/);
    expect(usernameProblem('lu cas')).toMatch(/sem acento|letras minúsculas/);
    expect(usernameProblem('josé')).toMatch(/sem acento/);
    expect(usernameProblem('a.b.c')).toMatch(/minúsculas/);
  });
});
