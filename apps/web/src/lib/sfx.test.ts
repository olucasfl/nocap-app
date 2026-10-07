import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sfx } from './sfx';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(p) ? [p] : [];
  });
}

describe('sons da interface', () => {
  it('todo data-sfx usado no app existe em sfx (ou é "toggle")', () => {
    const used = new Set<string>();
    for (const f of files(join(__dirname, '..'))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/data-sfx=(?:"([^"]+)"|\{([^}]+)\})/g)) {
        if (m[1]) used.add(m[1]);
        // Expressões (a ? 'x' : 'y'): só os literais dos ramos, não os da comparação.
        else for (const l of m[2]!.matchAll(/[?:]\s*'([A-Za-z]+)'/g)) used.add(l[1]!);
      }
      // Props que carregam o nome do som (ex.: sfx: 'navGames', confirmSfx="bye").
      for (const m of src.matchAll(/(?:sfx: |confirmSfx[=:] ?)['"]([A-Za-z]+)['"]/g))
        used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(10);
    for (const name of used) {
      if (name === 'toggle') continue;
      expect(typeof (sfx as Record<string, unknown>)[name], `som "${name}"`).toBe('function');
    }
  });
});
