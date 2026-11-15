import { HEROES, MAPS } from '@nocap/games';

/**
 * Arte nova do Night Hunt feita no estilo do Slash: variações de matiz dos sprites do guerreiro (um por herói) e da
 * decoração do chão (um por mapa), ícones novos de armas e passivos com contorno escuro, e a moldura dourada das evoluções.
 * Tudo é gerado uma vez ao carregar e entra no mesmo atlas, então o desenho usa só nomes de quadro.
 */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Giro de matiz com ajuste opcional de saturação e luz, preservando o alfa. */
function shifted(
  src: HTMLCanvasElement,
  hue: number,
  sat = 1,
  light = 0,
  keepSkin = false,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const q = c.getContext('2d')!;
  q.drawImage(src, 0, 0);
  const img = q.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! === 0) continue;
    const [h, s, l] = rgb2hsl(d[i]!, d[i + 1]!, d[i + 2]!);
    if (keepSkin && h >= 8 && h <= 42 && s >= 0.3 && l >= 0.38 && l <= 0.85) continue; // pele continua pele
    const [r, g, b] = hsl2rgb(
      h + hue,
      Math.min(1, s * sat),
      Math.min(0.97, Math.max(0.02, l + light)),
    );
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  q.putImageData(img, 0, 0);
  return c;
}

function silhouette(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const q = c.getContext('2d')!;
  q.drawImage(src, 0, 0);
  q.globalCompositeOperation = 'source-in';
  q.fillStyle = color;
  q.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Contorno de `t` pixels em volta do desenho (como o contorno escuro dos ícones do Slash). */
function outlined(src: HTMLCanvasElement, color: string, t: number, pad = t): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width + pad * 2;
  c.height = src.height + pad * 2;
  const q = c.getContext('2d')!;
  const sil = silhouette(src, color);
  for (let dy = -t; dy <= t; dy++)
    for (let dx = -t; dx <= t; dx++)
      if (dx * dx + dy * dy <= t * t + 1) q.drawImage(sil, pad + dx, pad + dy);
  q.drawImage(src, pad, pad);
  return c;
}

const PAL: Record<string, string> = {
  y: '#ffd94a',
  w: '#ffffff',
  o: '#e8962a',
  b: '#3a4a66',
  s: '#9fb2d0',
  d: '#6c7fa3',
  r: '#d84a4a',
  R: '#8a2030',
  u: '#4a7aff',
  U: '#9ac0ff',
  g: '#2f9e44',
  G: '#6fd86a',
  n: '#8a5a32',
  p: '#6a3fb0',
  P: '#9a6fe0',
  e: '#3ad0e8',
  k: '#10131c',
};
const ICONS: Record<string, string[]> = {
  lightning: [
    '.......yyyy.....',
    '......yyyyw.....',
    '.....yyyyw......',
    '....yyyyw.......',
    '...yyyyyyyy.....',
    '...yyooooyyy....',
    '.......yyyyw....',
    '......yyyyw.....',
    '.....yyyyw......',
    '.....yyyw.......',
    '....yyyw........',
    '....yyw.........',
    '...yyw..........',
    '...yw...........',
    '...w............',
    '................',
  ],
  armor: [
    '................',
    '..bbbbbbbbbbbb..',
    '..bwwwwwwwwwwb..',
    '..bwssssssssdb..',
    '..bwssssssssdb..',
    '..bwssrrrrssdb..',
    '..bwssrrrrssdb..',
    '..bwssrrrrssdb..',
    '..bwssssssssdb..',
    '...bwssssssdb...',
    '...bwssssssdb...',
    '....bwssssdb....',
    '.....bwssdb.....',
    '......bwdb......',
    '.......bb.......',
    '................',
  ],
  magnet: [
    '................',
    '..wwww....wwww..',
    '.rrrrrr..uuuuuu.',
    '.rwrrrr..uUuuuu.',
    '.rrrrrr..uuuuuu.',
    '.rrrrrr..uuuuuu.',
    '.rrrrrr..uuuuuu.',
    '.rrrrrrrrruuuuu.',
    '.rrrrrrrrruuuuu.',
    '..rrrrrrrruuuu..',
    '...rrrrrrruuu...',
    '....rrrrrruu....',
    '.....rrrruu.....',
    '................',
    '................',
    '................',
  ],
  clover: [
    '................',
    '...gggg..gggg...',
    '..gGGGGggGGGGg..',
    '..gGGGGGGGGGGg..',
    '..gGGGGGGGGGGg..',
    '...gGGGggGGGg...',
    '....gggGGggg....',
    '...gggGGGGggg...',
    '..gGGGGGGGGGGg..',
    '..gGGGGGGGGGGg..',
    '..gGGGGggGGGGg..',
    '...gggg..gggg...',
    '.......nn.......',
    '.......n........',
    '......n.........',
    '................',
  ],
  tome: [
    '................',
    '..pppppppppppp..',
    '.pPPPPPPPPPPPPp.',
    '.pPyyyyyyyyyyPp.',
    '.pPyppppppppyPp.',
    '.pPyppyyyyppyPp.',
    '.pPyppyyyyppyPp.',
    '.pPyppppppppyPp.',
    '.pPyyyyyyyyyyPp.',
    '.pPPPPPPPPPPPPp.',
    '.pwwwwwwwwwwwwp.',
    '.pwwwwwwwwwwwwp.',
    '..pppppppppppp..',
    '................',
    '................',
    '................',
  ],
  reroll: [
    '................',
    '..wwwwwwwwwwww..',
    '.wssssssssssssd.',
    '.wsrrssssssrrsd.',
    '.wsrrssssssrrsd.',
    '.wssssssssssssd.',
    '.wssssrrrrssssd.',
    '.wssssrrrrssssd.',
    '.wssssssssssssd.',
    '.wsrrssssssrrsd.',
    '.wsrrssssssrrsd.',
    '.wssssssssssssd.',
    '..dddddddddddd..',
    '................',
    '................',
    '................',
  ],
  skip: [
    '................',
    '................',
    '..ee......ee....',
    '..eeee....eeee..',
    '..eeeeee..eeeeee',
    '..eeeeeeeeeeeeee',
    '..eeeeeeeeeeeeee',
    '..eeeeeeeeeeeeee',
    '..eeeeee..eeeeee',
    '..eeee....eeee..',
    '..ee......ee....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  banish: [
    '................',
    '....wwwwwwww....',
    '...wrrrrrrrrw...',
    '..wrrr....rrrw..',
    '.wrrr......rrrw.',
    '.wrr..rr....rrw.',
    '.wrr..rrr...rrw.',
    '.wrr...rrr..rrw.',
    '.wrr....rrr.rrw.',
    '.wrr.....rrrrrw.',
    '.wrrr.....rrrrw.',
    '..wrrr....rrrw..',
    '...wrrrrrrrrw...',
    '....wwwwwwww....',
    '................',
    '................',
  ],
  evolve: [
    '................',
    '.......yy.......',
    '.......yy.......',
    '......yyyy......',
    '......yyyy......',
    '..yyyyyyyyyyyy..',
    '...yyyyooyyyy...',
    '....yyyooyyy....',
    '.....yyyyyy.....',
    '.....yyyyyy.....',
    '....yyy..yyy....',
    '....yy....yy....',
    '...yy......yy...',
    '................',
    '................',
    '................',
  ],
};

function paint(map: string[], scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 16 * scale;
  c.height = 16 * scale;
  const q = c.getContext('2d')!;
  map.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === '.') return;
      q.fillStyle = PAL[ch] ?? '#ff00ff';
      q.fillRect(i * scale, j * scale, scale, scale);
    }),
  );
  return c;
}

/** Aumenta o atlas e devolve o novo atlas (imagem, retângulos). `frames` ganha os nomes novos. */
export function extendAtlas(
  base: HTMLImageElement,
  frames: Record<string, Rect>,
  bgs: { f: string }[][],
): HTMLCanvasElement {
  const W = base.width;
  const pending: Array<{ name: string; canvas: HTMLCanvasElement }> = [];
  const crop = (name: string): HTMLCanvasElement => {
    const f = frames[name]!;
    const c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    c.getContext('2d')!.drawImage(base, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    return c;
  };
  const queued = new Map<string, HTMLCanvasElement>();
  const add = (name: string, canvas: HTMLCanvasElement) => {
    pending.push({ name, canvas });
    queued.set(name, canvas);
  };

  // heróis: o guerreiro com outro matiz
  for (const h of Object.values(HEROES)) {
    if (!h.hue) continue;
    for (const name of Object.keys(frames))
      if (name.startsWith('Player/'))
        add(`Player/${h.id}/${name.slice(7)}`, shifted(crop(name), h.hue, 1.05, 0, true));
  }
  // mapas: decoração com outro matiz
  const bgNames = new Set(bgs.flat().map((b) => b.f));
  for (const m of Object.values(MAPS)) {
    if (!m.hue) continue;
    const sat = m.id === 'gelo' ? 0.45 : 0.85;
    const light = m.id === 'gelo' ? 0.2 : 0.05;
    for (const name of bgNames)
      add(`Background/${m.id}/${name.slice(11)}`, shifted(crop(name), m.hue, sat, light));
  }
  // orbes do jogador: as bolas do corvo em azul
  for (let i = 0; i < 4; i++)
    add(`X/orb${i}`, shifted(crop(`Enemies/DarkRaven/Ball0${i}`), 140, 1.2));
  // ícones novos
  const base32 = (id: string) => outlined(paint(ICONS[id]!, 2), '#0f2233', 2);
  for (const id of Object.keys(ICONS)) add(`X/${id}`, base32(id));
  add('X/orbit', outlined(shifted(crop('UI/UpgradeIcons/HaloProjectile'), 195, 1.1), '#0f2233', 0));
  // ícones de evolução: o ícone da arma com brilho dourado e uma estrela
  const evoBase: Record<string, string> = {
    evoHorizontal: 'UI/UpgradeIcons/HorizontalProjectile',
    evoDiagonal: 'UI/UpgradeIcons/DiagonalProjectile',
    evoHalo: 'UI/UpgradeIcons/HaloProjectile',
    evoAxe: 'UI/UpgradeIcons/ThrowAxe',
    evoOrbit: 'X/orbit',
    evoLightning: 'X/lightning',
    evoSword: 'UI/UpgradeIcons/WeaponDamage',
  };
  for (const [id, src] of Object.entries(evoBase)) {
    const b = queued.get(src) ?? crop(src);
    const c = document.createElement('canvas');
    c.width = b.width + 12;
    c.height = b.height + 12;
    const q = c.getContext('2d')!;
    const glow = silhouette(b, '#ffd94a');
    q.globalAlpha = 0.9;
    for (const [dx, dy] of [
      [-3, 0],
      [3, 0],
      [0, -3],
      [0, 3],
      [-2, -2],
      [2, -2],
      [-2, 2],
      [2, 2],
    ])
      q.drawImage(glow, 6 + dx!, 6 + dy!);
    q.globalAlpha = 1;
    q.drawImage(b, 6, 6);
    q.drawImage(paint(ICONS.evolve!, 1), c.width - 18, 0);
    add(`E/${id}`, c);
  }

  // empacota tudo em linhas abaixo do atlas original
  let x = 0;
  let y = base.height;
  let rowH = 0;
  const placed: Array<{ name: string; canvas: HTMLCanvasElement; x: number; y: number }> = [];
  for (const p of pending) {
    if (x + p.canvas.width + 1 > W) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    placed.push({ ...p, x, y });
    frames[p.name] = { x, y, w: p.canvas.width, h: p.canvas.height };
    x += p.canvas.width + 1;
    rowH = Math.max(rowH, p.canvas.height);
  }
  const out = document.createElement('canvas');
  out.width = W;
  out.height = y + rowH + 1;
  const q = out.getContext('2d')!;
  q.drawImage(base, 0, 0);
  for (const p of placed) q.drawImage(p.canvas, p.x, p.y);
  return out;
}
