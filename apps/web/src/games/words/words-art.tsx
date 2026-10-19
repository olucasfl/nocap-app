import './words-art.css';

/** A arte do Word's: tudo em SVG, Pop Brutal (contorno de tinta, sombra dura, cores chapadas, sem emoji). */
const INK = '#111111';
const PAPER = '#f4f4ef';
const GREEN = '#33c27f';
const YELLOW = '#ffd23f';
const BLUE = '#2f5bff';
const PURPLE = '#7a3cff';
const stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

/** Uma casa de letra, com sombra dura. `delay` escalona a virada. */
function Tile({ x, y, s = 30, fill, letter, delay = 0, flip = true }: { x: number; y: number; s?: number; fill: string; letter?: string; delay?: number; flip?: boolean }) {
  return (
    <g className={flip ? 'wa-flip' : undefined} style={{ animationDelay: `${delay}s`, transformOrigin: `${x + s / 2}px ${y + s / 2}px` }}>
      <rect x={x + 3} y={y + 3} width={s} height={s} rx={s * 0.2} fill={INK} />
      <rect x={x} y={y} width={s} height={s} rx={s * 0.2} fill={fill} {...stroke} strokeWidth={s > 26 ? 3 : 2.4} />
      {letter && (
        <text x={x + s / 2} y={y + s * 0.7} textAnchor="middle" fontFamily="Archivo, Arial Black, sans-serif" fontWeight="900" fontSize={s * 0.58} fill={INK}>
          {letter}
        </text>
      )}
    </g>
  );
}

/** O ícone da Home: uma palavra que se revela, uma grade 2x2 e um favo, num só cartão. */
export function WordsHubArt() {
  const tiles: [string, string][] = [
    ['W', GREEN],
    ['O', YELLOW],
    ['R', PAPER],
    ['D', GREEN],
    ['S', YELLOW],
  ];
  return (
    <svg className="ha ha-words" viewBox="0 0 200 150" aria-hidden="true">
      {tiles.map(([l, c], i) => (
        <Tile key={l} x={14 + i * 36} y={20} s={32} fill={c} letter={l} delay={i * 0.18} />
      ))}
      {/* grade do Connect */}
      <g className="wa-float a">
        {[
          [26, 78, YELLOW],
          [54, 78, GREEN],
          [26, 106, BLUE],
          [54, 106, PURPLE],
        ].map(([x, y, c]) => (
          <g key={`${x}${y}`}>
            <rect x={(x as number) + 2} y={(y as number) + 2} width="22" height="22" rx="5" fill={INK} />
            <rect x={x as number} y={y as number} width="22" height="22" rx="5" fill={c as string} {...stroke} strokeWidth={2.2} />
          </g>
        ))}
      </g>
      {/* favo do Bee */}
      <g className="wa-float b">
        <polygon points={hexPoints(148, 108, 30)} fill={INK} transform="translate(4 4)" />
        <polygon points={hexPoints(148, 108, 30)} fill={YELLOW} {...stroke} />
        <polygon points={hexPoints(148, 108, 17)} fill={PAPER} {...stroke} strokeWidth={2.4} />
        <circle cx="148" cy="108" r="4.5" fill={INK} />
      </g>
      <rect className="wa-shine" x="-40" y="0" width="22" height="150" fill="#fff" opacity="0.18" />
    </svg>
  );
}

/** Classic: a grade do Termo com a linha do meio se revelando. */
export function ClassicArt() {
  const rows: string[] = ['mmnmm', 'nhmmh', 'hhhhh'];
  const color = { m: '#4a4a44', n: YELLOW, h: GREEN } as const;
  return (
    <svg className="wa-art" viewBox="0 0 140 110" aria-hidden="true">
      {rows.map((row, r) =>
        [...row].map((c, i) => (
          <Tile key={`${r}${i}`} x={8 + i * 26} y={6 + r * 32} s={22} fill={color[c as keyof typeof color]} delay={(r * 5 + i) * 0.1} />
        )),
      )}
    </svg>
  );
}

/** Connect: quatro faixas coloridas que se organizam. */
export function ConnectArt() {
  const bands = [YELLOW, GREEN, BLUE, PURPLE];
  return (
    <svg className="wa-art" viewBox="0 0 140 110" aria-hidden="true">
      {bands.map((c, i) => (
        <g key={c} className="wa-slide" style={{ animationDelay: `${i * 0.25}s` }}>
          <rect x="10" y={10 + i * 25 + 3} width="124" height="20" rx="6" fill={INK} />
          <rect x="8" y={10 + i * 25} width="124" height="20" rx="6" fill={c} {...stroke} strokeWidth={2.4} />
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x={18 + k * 28} y={10 + i * 25 + 6} width="20" height="8" rx="3" fill={INK} opacity="0.85" />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Bee: o favo com a letra do centro em destaque. */
export function BeeArt() {
  const pts: [number, number][] = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return [70 + 36 * Math.cos(a), 55 + 36 * Math.sin(a)];
  });
  const letters = ['A', 'N', 'D', 'R', 'T', 'E'];
  return (
    <svg className="wa-art" viewBox="0 0 140 110" aria-hidden="true">
      {pts.map(([x, y], i) => (
        <g key={i} className="wa-pop" style={{ animationDelay: `${i * 0.12}s`, transformOrigin: `${x}px ${y}px` }}>
          <polygon points={hexPoints(x + 2, y + 2, 19)} fill={INK} />
          <polygon points={hexPoints(x, y, 19)} fill={PAPER} {...stroke} strokeWidth={2.4} />
          <text x={x} y={y + 6} textAnchor="middle" fontFamily="Archivo, Arial Black, sans-serif" fontWeight="900" fontSize="17" fill={INK}>
            {letters[i]}
          </text>
        </g>
      ))}
      <polygon points={hexPoints(72, 57, 21)} fill={INK} />
      <polygon points={hexPoints(70, 55, 21)} fill={YELLOW} {...stroke} />
      <text x="70" y="62" textAnchor="middle" fontFamily="Archivo, Arial Black, sans-serif" fontWeight="900" fontSize="19" fill={INK}>
        U
      </text>
    </svg>
  );
}

/** Miniatura dos tabuleiros de cada modo do Classic (1, 2 ou 4 grades). */
export function MiniBoards({ count }: { count: 1 | 2 | 4 }) {
  const grid = (ox: number, oy: number, w: number, key: string) => (
    <g key={key}>
      {Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => (
          <rect
            key={`${r}${c}`}
            x={ox + c * (w + 2)}
            y={oy + r * (w + 2)}
            width={w}
            height={w}
            rx="2"
            fill={r === 1 && c < 2 ? (c === 0 ? GREEN : YELLOW) : PAPER}
            stroke={INK}
            strokeWidth="1.6"
          />
        )),
      )}
    </g>
  );
  const w = count === 1 ? 11 : count === 2 ? 8 : 6;
  const size = 3 * w + 4;
  const origins: [number, number][] =
    count === 1 ? [[0, 0]] : count === 2 ? [[0, 0], [size + 8, 0]] : [[0, 0], [size + 6, 0], [0, size + 6], [size + 6, size + 6]];
  const width = count === 1 ? size : size * 2 + 8;
  const height = count === 4 ? size * 2 + 6 : size;
  return (
    <svg className="wa-mini" viewBox={`-2 -2 ${width + 4} ${height + 4}`} aria-hidden="true">
      {origins.map(([x, y], i) => grid(x, y, w, `${i}`))}
    </svg>
  );
}
