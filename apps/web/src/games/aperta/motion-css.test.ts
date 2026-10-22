import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guarda de movimento de todo o CSS do Aperta! (spec 038, seção 11): só `transform` e `opacity`
 * animam, nada de transição de outras propriedades, `will-change` só nelas e movimento reduzido
 * tratado em todo arquivo que anima. Complementa `aperta-css.test.ts` e `game-css.test.ts`.
 */
const ALLOWED = ['transform', 'opacity'];
const files = readdirSync(__dirname)
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({ name: f, css: readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));

/** Corpo de cada `@keyframes`, contando as chaves (os quadros têm chaves aninhadas). */
function keyframes(css: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    out.push({ name: m[1]!, body: css.slice(start, i - 1) });
  }
  return out;
}

/** Propriedades declaradas dentro dos quadros (`to { transform: ... }`). */
function declared(body: string): string[] {
  return [...body.matchAll(/([a-z-]+)\s*:[^;{}]+(?:;|(?=\}))/g)].map((m) => m[1]!);
}

describe('movimento no CSS do Aperta!', () => {
  it('há CSS para conferir', () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
    expect(files.flatMap((f) => keyframes(f.css)).length).toBeGreaterThan(30);
  });

  for (const { name, css } of files) {
    describe(name, () => {
      it('os keyframes só animam transform e opacity', () => {
        for (const k of keyframes(css)) {
          for (const p of declared(k.body)) {
            expect(ALLOWED, `${k.name}: ${p}`).toContain(p);
          }
        }
      });

      it('transition só em transform e opacity', () => {
        for (const m of css.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)/g)) {
          const value = m[1]!.replace(/!important/, '').trim();
          if (value === 'none') continue;
          for (const part of value.split(',')) {
            const prop = part.trim().split(/\s+/)[0]!;
            expect(ALLOWED, `transition ${prop}`).toContain(prop);
          }
        }
      });

      it('will-change só pede transform ou opacity', () => {
        for (const m of css.matchAll(/will-change\s*:\s*([^;}]+)/g)) {
          for (const prop of m[1]!.split(',')) expect(ALLOWED).toContain(prop.trim());
        }
      });

      it('quem anima trata prefers-reduced-motion', () => {
        if (!/animation(?:-name)?\s*:\s*(?!none)[\w-]/.test(css)) return;
        expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
      });
    });
  }

  it('todo animation aponta para um @keyframes que existe', () => {
    const names = new Set(files.flatMap((f) => keyframes(f.css).map((k) => k.name)));
    for (const { name, css } of files) {
      for (const m of css.matchAll(/animation\s*:\s*([^;]+);/g)) {
        for (const part of m[1]!.split(',')) {
          const used = part.trim().split(/\s+/).find((t) => /^[a-z][\w-]*$/i.test(t) && /^(ap|apg|art)/.test(t));
          if (used) expect(names.has(used), `${name}: ${used}`).toBe(true);
        }
      }
    }
  });

  it('sem filtro pesado animado nem backdrop-filter', () => {
    for (const { name, css } of files) {
      expect(css, name).not.toMatch(/backdrop-filter/);
    }
  });

  it('aparelho fraco troca o desfoque grande por degradê', () => {
    const sky = files.find((f) => f.name === 'aperta.css')!.css;
    expect(sky).toMatch(/\.is-lite \.ap-neb \{[^}]*filter:\s*none/);
  });

  it('o CSS do polimento das telas novas existe, anima e é conferido como os outros', () => {
    const polish = files.find((f) => f.name === 'polish.css');
    expect(polish, 'polish.css').toBeDefined();
    const names = keyframes(polish!.css).map((k) => k.name);
    expect(names).toEqual(
      expect.arrayContaining(['app-flash', 'app-flash-ring', 'app-region-in', 'app-streak', 'app-storm', 'app-card-in', 'app-node-pop']),
    );
  });

  it('todo CSS do Aperta! é importado por algum componente (nenhum arquivo órfão fora da checagem)', () => {
    const sources = readdirSync(__dirname)
      .filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))
      .map((f) => readFileSync(join(__dirname, f), 'utf8'))
      .join('\n');
    for (const { name } of files) {
      if (name === 'ArtPreview.css') continue; // página de pré-visualização do kit de arte
      expect(sources, name).toContain("'./" + name + "'");
    }
  });

  it('o movimento reduzido silencia cada loop e cada entrada do polimento', () => {
    const polish = files.find((f) => f.name === 'polish.css')!.css;
    const reduced = polish.slice(polish.indexOf('prefers-reduced-motion'));
    for (const sel of ['.ap-flash', '.ap-evfx-shower i', '.ap-evfx-storm', '.ap-vault-slots li.is-full', '.ap-node.is-owned', '.ap-game .ap-region']) {
      expect(reduced, sel).toContain(sel);
    }
  });

  it('os loops de evento não pedem desfoque nem sombra animada', () => {
    const polish = files.find((f) => f.name === 'polish.css')!.css;
    expect(polish).not.toMatch(/filter/);
    for (const k of keyframes(polish)) expect(k.body, k.name).not.toMatch(/box-shadow|filter|width|height|left|top/);
  });
});
