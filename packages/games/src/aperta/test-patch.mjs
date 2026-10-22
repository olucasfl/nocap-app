// Ferramenta de uso único: troca testes `it('<prefixo>...` por texto novo (até o `  });` seguinte).
import { readFileSync, writeFileSync } from 'node:fs';

export function load(p) {
  return { p, s: readFileSync(p, 'utf8') };
}

export function replaceTest(f, prefix, text) {
  const start = f.s.indexOf(`  it('${prefix}`);
  if (start < 0) throw new Error('teste nao achado: ' + prefix);
  const end = f.s.indexOf('\n  });\n', start);
  if (end < 0) throw new Error('fim nao achado: ' + prefix);
  f.s = f.s.slice(0, start) + text.replace(/\n$/, '') + f.s.slice(end + '\n  });'.length);
}

export function replaceBlock(f, startMarker, endMarker, text) {
  const a = f.s.indexOf(startMarker);
  const b = f.s.indexOf(endMarker, a + 1);
  if (a < 0 || b < 0) throw new Error('bloco nao achado: ' + startMarker);
  f.s = f.s.slice(0, a) + text + f.s.slice(b);
}

export function save(f) {
  writeFileSync(f.p, f.s);
}
