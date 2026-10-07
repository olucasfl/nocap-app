// Gera a marca do NoCap como SVG com curvas (sem depender de fonte instalada).
// Fonte dos glifos: Archivo (SIL OFL), pacote @expo-google-fonts/archivo.
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';

const OUT = process.argv[2];
if (!OUT) throw new Error('uso: node build-brand.cjs <pasta-de-saida>');
// Pasta do pacote @expo-google-fonts/archivo (ver brand/README.md).
const ARCHIVO_DIR =
  process.env.ARCHIVO_DIR ??
  path.join(import.meta.dirname, 'node_modules/@expo-google-fonts/archivo');
const FONT = (w) => path.join(ARCHIVO_DIR, `${w}/Archivo_${w}.ttf`);
const load = (w) => {
  const buf = fs.readFileSync(FONT(w));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const black = load('900Black_Italic');
const bold = load('700Bold');

/** Serializa os comandos do caminho (o toPathData do opentype.js gera NaN nesta fonte). */
function pathData(p) {
  const r = (n) => String(Math.round(n * 100) / 100);
  return p.commands
    .map((c) => {
      switch (c.type) {
        case 'M':
          return `M${r(c.x)} ${r(c.y)}`;
        case 'L':
          return `L${r(c.x)} ${r(c.y)}`;
        case 'Q':
          return `Q${r(c.x1)} ${r(c.y1)} ${r(c.x)} ${r(c.y)}`;
        case 'C':
          return `C${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} ${r(c.x)} ${r(c.y)}`;
        default:
          return 'Z';
      }
    })
    .join('');
}

const INK = '#111111';
const PAPER = '#F4F4EF';
const ORANGE = '#FF6A2B';
const YELLOW = '#FFD23F';
const BLUE = '#2F5BFF';

/** Caminho de um texto com espaçamento entre letras (em em), começando em (x, y). */
function textPath(font, text, x, y, size, spacingEm = 0) {
  const scale = size / font.unitsPerEm;
  let cx = x;
  let d = '';
  const glyphs = [...text].map((c) => font.charToGlyph(c));
  glyphs.forEach((g, i) => {
    d += pathData(g.getPath(cx, y, size));
    let adv = g.advanceWidth * scale + spacingEm * size;
    const next = glyphs[i + 1];
    if (next) {
      const k = font.getKerningValue(g, next);
      adv += (Number.isFinite(k) ? k : 0) * scale;
    }
    cx += adv;
  });
  return { d, width: cx - x - spacingEm * size };
}

/** Caixa de um caminho (bounding box do texto) para centralizar. */
function bbox(font, text, size, spacingEm = 0) {
  const p = textPath(font, text, 0, 0, size, spacingEm);
  // bounding box dos glifos individuais
  const scale = size / font.unitsPerEm;
  let cx = 0,
    x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;
  const glyphs = [...text].map((c) => font.charToGlyph(c));
  glyphs.forEach((g, i) => {
    const b = g.getPath(cx, 0, size).getBoundingBox();
    if (b.x2 > b.x1) {
      x1 = Math.min(x1, b.x1);
      y1 = Math.min(y1, b.y1);
      x2 = Math.max(x2, b.x2);
      y2 = Math.max(y2, b.y2);
    }
    let adv = g.advanceWidth * scale + spacingEm * size;
    const next = glyphs[i + 1];
    if (next) {
      const k = font.getKerningValue(g, next);
      adv += (Number.isFinite(k) ? k : 0) * scale;
    }
    cx += adv;
  });
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1, width: p.width };
}

// ---------------------------------------------------------------- ícone (512 x 512)
/**
 * "!" itálico da marca, em adesivo: miolo claro, contorno de tinta e sombra dura sem blur
 * (a assinatura do Pop Brutal). O fundo é laranja de ponta a ponta, então vale nos dois temas
 * e deixa o sistema (iOS/Android) arredondar o ícone.
 */
function iconParts({ size = 512, safe = 1 }) {
  const glyphH = size * 0.7 * safe;
  const fs_ = glyphH / 0.72; // altura de caixa-alta do Archivo ~0,72 em
  const b = bbox(black, '!', fs_);
  const gx = size / 2 - (b.x1 + b.w / 2) - size * 0.012;
  const gy = size / 2 - (b.y1 + b.h / 2);
  const d = pathData(black.charToGlyph('!').getPath(gx, gy, fs_));
  const off = size * 0.034;
  return { d, off, stroke: size * 0.03 };
}

function iconSvg({ rounded = false, adaptive = false } = {}) {
  const { d, off, stroke } = iconParts({ safe: rounded ? 0.92 : 1 });
  const bg = rounded
    ? `<rect width="512" height="512" rx="116" fill="${ORANGE}"/>`
    : `<rect width="512" height="512" fill="${ORANGE}"/>`;
  const style = adaptive
    ? `<style>.ink{fill:${INK};stroke:${INK}}.face{fill:${PAPER}}@media (prefers-color-scheme:dark){.ink{fill:${INK};stroke:${INK}}}</style>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="NoCap">
${style}
${bg}
<path d="${d}" transform="translate(${off} ${off})" fill="${INK}" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round"/>
<path d="${d}" fill="${PAPER}" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round" paint-order="stroke"/>
</svg>
`;
}

// ---------------------------------------------------------------- logotipo "NO CAP!"
function wordmark({ ink = INK, bang = ORANGE, height = 120 }) {
  const size = height / 0.72;
  const sp = -0.05;
  const main = textPath(black, 'NO CAP', 0, 0, size, sp);
  const mb = bbox(black, 'NO CAP', size, sp);
  const bangPath = textPath(black, '!', main.width + sp * size + size * 0.03, 0, size, 0);
  const full = bbox(black, 'NO CAP!', size, sp);
  const pad = height * 0.08;
  const x0 = Math.min(mb.x1, 0) - pad;
  const y0 = mb.y1 - pad;
  const w = full.x2 + size * 0.05 - x0 + pad;
  const h = mb.y2 - mb.y1 + pad * 2;
  return {
    w: Math.round(w),
    h: Math.round(h),
    svg: (
      extra = '',
    ) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" width="${Math.round(w)}" height="${Math.round(h)}" role="img" aria-label="no cap!">${extra}
<path d="${main.d}" fill="${ink}"/>
<path d="${bangPath.d}" fill="${bang}"/>
</svg>
`,
    inner: { x0, y0, w, h, main: main.d, bang: bangPath.d },
  };
}

// ---------------------------------------------------------------- imagem de compartilhamento (1200 x 630)
function ogSvg() {
  const W = 1200,
    H = 630;
  const wm = wordmark({ height: 96 });
  const tag = textPath(bold, 'Jogos para jogar com amigos.', 0, 0, 44, 0);
  const tagBox = bbox(bold, 'Jogos para jogar com amigos.', 44, 0);
  const tile = 300;
  const tx = 110,
    ty = (H - tile) / 2 - 10;
  const { d, off, stroke } = iconParts({ size: tile });
  const wmX = tx + tile + 90;
  const wmScale = 1;
  const wmY = H / 2 - 82;
  const i = wm.inner;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="${PAPER}"/>
<g transform="translate(${tx + 14} ${ty + 14})"><rect width="${tile}" height="${tile}" rx="64" fill="${INK}"/></g>
<g transform="translate(${tx} ${ty})">
  <rect width="${tile}" height="${tile}" rx="64" fill="${ORANGE}" stroke="${INK}" stroke-width="10"/>
  <path d="${d}" transform="translate(${off} ${off})" fill="${INK}" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round"/>
  <path d="${d}" fill="${PAPER}" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round" paint-order="stroke"/>
</g>
<g transform="translate(${wmX - i.x0 * wmScale} ${wmY - i.y0 * wmScale})">
  <path d="${i.main}" fill="${INK}"/>
  <path d="${i.bang}" fill="${ORANGE}"/>
</g>
<g transform="translate(${wmX + 4} ${wmY + i.h + 46 - tagBox.y1})">
  <path d="${tag.d}" fill="${INK}"/>
</g>
<rect x="${wmX + 4}" y="${wmY + i.h + 92}" width="170" height="16" rx="8" fill="${YELLOW}" stroke="${INK}" stroke-width="4"/>
<rect x="${wmX + 190}" y="${wmY + i.h + 92}" width="70" height="16" rx="8" fill="${BLUE}" stroke="${INK}" stroke-width="4"/>
</svg>
`;
}

fs.mkdirSync(OUT, { recursive: true });
const wmInk = wordmark({});
const wmLight = wordmark({ ink: PAPER });
fs.writeFileSync(path.join(OUT, 'icon.svg'), iconSvg());
fs.writeFileSync(path.join(OUT, 'icon-rounded.svg'), iconSvg({ rounded: true }));
fs.writeFileSync(path.join(OUT, 'wordmark.svg'), wmInk.svg());
fs.writeFileSync(path.join(OUT, 'wordmark-light.svg'), wmLight.svg());
fs.writeFileSync(path.join(OUT, 'og.svg'), ogSvg());
{
  const { d } = iconParts({ safe: 0.95 });
  fs.writeFileSync(
    path.join(OUT, 'safari-pinned-tab.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${d}" fill="#000000"/></svg>
`,
  );
}
console.log('ok', { wordmark: [wmInk.w, wmInk.h] });
