import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'game.css'), 'utf8');

describe('CSS da tela de jogo', () => {
  it('os keyframes só animam transform e opacity', () => {
    const blocks = [...css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)];
    expect(blocks.length).toBeGreaterThan(8);
    for (const [, body] of blocks) {
      const props = [...body!.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(['transform', 'opacity'], `propriedade ${p}`).toContain(p);
    }
  });

  it('nada transita (só keyframes de transform e opacity)', () => {
    expect(css).not.toMatch(/transition\s*:/);
  });

  it('desliga as animações com prefers-reduced-motion', () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it('os alvos de toque têm pelo menos 44 px', () => {
    for (const sel of ['.ap-hbtn', '.ap-x', '.ap-pick']) {
      const rule = css.match(new RegExp(`${sel.replace('.', '\\.')} \\{([^}]*)\\}`));
      expect(rule?.[1], sel).toMatch(/(min-)?(height|width):\s*(4[4-9]|[5-9]\d)px/);
    }
  });

  it('a tela não rola na horizontal e tem ajuste para celular', () => {
    expect(css).toMatch(/\.ap-game \{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
  });

  it('os botões têm foco visível para teclado', () => {
    expect(css).toMatch(/\.ap-game button:focus-visible/);
  });

  it('os objetos têm alvo de toque de pelo menos 44 px e a camada deixa o botão central livre', () => {
    expect(css.match(/\.ap-obj \{([^}]*)\}/)?.[1]).toMatch(/width:\s*(4[4-9]|[5-9]\d)px/);
    expect(css.match(/\.ap-field-over \{([^}]*)\}/)?.[1]).toMatch(/pointer-events:\s*none/);
  });

  it('com movimento reduzido os objetos ficam parados', () => {
    const reduced = css.slice(css.indexOf('prefers-reduced-motion: reduce'));
    expect(reduced).toMatch(/\.ap-obj-drift/);
  });
});
