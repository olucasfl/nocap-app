import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(p) ? [p] : [];
  });
}

describe('Daily não tem revanche', () => {
  const screens = files(__dirname).filter((f) => /FinalScreen\.tsx$/.test(f));

  it('acha as telas finais dos jogos (Cor, Tempo, Eco...)', () => {
    expect(screens.length).toBeGreaterThanOrEqual(3);
  });

  it('todo botão "Revanche" de tela final só aparece fora do Daily', () => {
    for (const f of screens) {
      const src = readFileSync(f, 'utf8');
      if (!src.includes('Revanche')) continue;
      // O botão precisa estar dentro de uma condição `run.kind !== 'daily'`.
      const guarded = /run\.kind !== 'daily' && \(\s*<button[^>]*>\s*Revanche/.test(src);
      expect(guarded, `${f}: Revanche sem a trava do Daily`).toBe(true);
    }
  });
});
