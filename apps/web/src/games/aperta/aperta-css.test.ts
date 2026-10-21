import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'aperta.css'), 'utf8');

describe('CSS do Aperta!', () => {
  it('os keyframes só animam transform e opacity', () => {
    const blocks = [...css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)];
    expect(blocks.length).toBeGreaterThan(5);
    for (const [, body] of blocks) {
      const props = [...body!.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(['transform', 'opacity'], `propriedade ${p}`).toContain(p);
    }
  });

  it('não usa transition (nada anima fora dos keyframes)', () => {
    expect(css).not.toMatch(/transition\s*:/);
  });

  it('desliga as animações com prefers-reduced-motion', () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
