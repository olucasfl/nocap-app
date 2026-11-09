import type { ReactNode } from 'react';

/** Um jogo da Home: a capa (pôster) com as cores do tema dele e para onde ele leva. */
export interface Poster {
  id: string;
  name: string;
  tag: string;
  to: string;
  search?: Record<string, string>;
  a: string;
  b: string;
  /** Jogo que tem Daily (o selo mostra se já foi feito hoje). */
  daily?: 'color' | 'time' | 'eco' | 'wclassic';
  badge?: string;
}

export interface Shelf {
  id: string;
  title: string;
  sub: string;
  posters: Poster[];
}

export const SHELVES: Shelf[] = [
  {
    id: 'palavras',
    title: 'Palavras',
    sub: 'Ache, ligue e forme',
    posters: [
      {
        id: 'classic',
        name: "Classic Word's",
        tag: 'Descubra a palavra',
        to: '/words/classic',
        a: '#3fcf7d',
        b: '#0b3d2a',
        daily: 'wclassic',
      },
      {
        id: 'connect',
        name: "Connect Word's",
        tag: 'Ligue 4 grupos',
        to: '/words/connect',
        a: '#8b7bff',
        b: '#241868',
      },
      {
        id: 'bee',
        name: "Bee Word's",
        tag: 'Todas as palavras do favo',
        to: '/words/bee',
        a: '#ffd23f',
        b: '#6b4a06',
      },
    ],
  },
  {
    id: 'reflexo',
    title: 'Reflexo e blocos',
    sub: 'Cor, tempo, ritmo e encaixe',
    posters: [
      {
        id: 'color',
        name: 'Mesmíssima',
        tag: 'Recrie a cor de memória',
        to: '/cor',
        a: '#ff7a3d',
        b: '#6a2108',
        daily: 'color',
      },
      {
        id: 'time',
        name: 'Já Deu?',
        tag: 'Pare na hora certa',
        to: '/tempo',
        a: '#4a8dff',
        b: '#0f2a6a',
        daily: 'time',
      },
      {
        id: 'eco',
        name: 'Ecooo',
        tag: 'Repita a sequência',
        to: '/eco',
        a: '#a06bff',
        b: '#2f1668',
        daily: 'eco',
      },
      {
        id: 'blocks',
        name: "Block's",
        tag: 'Encaixe e empilhe',
        to: '/blocks',
        a: '#ffb21f',
        b: '#6a3a06',
      },
    ],
  },
  {
    id: 'foxcap',
    title: 'Fox Cap!',
    sub: 'Jogos de raposa, com amigos online',
    posters: [
      {
        id: 'counterfox',
        name: 'Counter Fox',
        tag: 'Mata-mata tático',
        to: '/fox-cap/counter-fox',
        a: '#ff8a3d',
        b: '#1d1236',
        badge: 'ONLINE',
      },
      {
        id: 'bola',
        name: 'Fut Fox',
        tag: 'Futebol de raposas',
        to: '/fox-cap',
        search: { jogo: 'bola' },
        a: '#38d27a',
        b: '#0b3d2a',
        badge: 'ONLINE',
      },
      {
        id: 'pingpong',
        name: 'Ping Fox!',
        tag: 'Pingue-pongue 1x1',
        to: '/fox-cap',
        search: { jogo: 'pingpong' },
        a: '#4a8dff',
        b: '#0f2a6a',
        badge: 'ONLINE',
      },
      {
        id: 'atravessa',
        name: 'Atravessa!',
        tag: 'Atravesse sem parar',
        to: '/fox-cap',
        search: { jogo: 'atravessa' },
        a: '#ff5a4d',
        b: '#5e1426',
        badge: 'ONLINE',
      },
      {
        id: 'desmorona',
        name: 'Desmorona!',
        tag: 'O chão some a cada passo',
        to: '/fox-cap',
        search: { jogo: 'desmorona' },
        a: '#ff9d2e',
        b: '#5e2a06',
        badge: 'ONLINE',
      },
    ],
  },
];

const hex = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

/** A arte de cada capa: uma cena do próprio jogo, em SVG, que mexe devagar (só transform e opacity). */
export function CoverArt({ id }: { id: string }): ReactNode {
  switch (id) {
    case 'classic': {
      const rows = [
        { w: 'AMOR', k: ['#3fcf7d', '#3fcf7d', '#f2c230', '#4a5068'] },
        { w: 'GATO', k: ['#4a5068', '#3fcf7d', '#3fcf7d', '#f2c230'] },
        { w: 'CASA', k: ['#3fcf7d', '#3fcf7d', '#3fcf7d', '#3fcf7d'] },
      ];
      return (
        <g transform="translate(150 150) rotate(-7) translate(-110 -92)">
          {rows.map((r, ri) =>
            [...r.w].map((ch, ci) => (
              <g
                key={`${ri}${ci}`}
                className={ri === 2 ? 'cv-hop' : ''}
                style={{ animationDelay: `${ci * 0.12}s` }}
              >
                <rect x={ci * 56} y={ri * 62} width="50" height="54" rx="9" fill={r.k[ci]} />
                <text
                  x={ci * 56 + 25}
                  y={ri * 62 + 37}
                  textAnchor="middle"
                  fontSize="30"
                  fontWeight="800"
                  fill={r.k[ci] === '#4a5068' ? '#f4efe6' : '#0b0d1c'}
                  fontFamily="Rajdhani, sans-serif"
                >
                  {ch}
                </text>
              </g>
            )),
          )}
        </g>
      );
    }
    case 'connect': {
      const cols = ['#ffd23f', '#3fcf7d', '#4a8dff', '#a06bff'];
      return (
        <g transform="translate(150 150) rotate(-6) translate(-122 -96)">
          {cols.map((c, r) => (
            <g key={c} className="cv-slide" style={{ animationDelay: `${r * 0.5}s` }}>
              <rect x="0" y={r * 52} width="244" height="44" rx="10" fill={c} />
              {[0, 1, 2, 3].map((i) => (
                <rect
                  key={i}
                  x={12 + i * 57}
                  y={r * 52 + 13}
                  width="45"
                  height="18"
                  rx="6"
                  fill="#0b0d1c"
                  opacity=".35"
                />
              ))}
            </g>
          ))}
        </g>
      );
    }
    case 'bee': {
      const pos: [number, number][] = [
        [150, 128],
        [150, 56],
        [212, 92],
        [212, 164],
        [150, 200],
        [88, 164],
        [88, 92],
      ];
      return (
        <g>
          {pos.map(([x, y], i) => (
            <g key={i} className="cv-pulse" style={{ animationDelay: `${i * 0.25}s` }}>
              <polygon
                points={hex(x, y, 38)}
                fill={i === 0 ? '#ffd23f' : '#fff3b0'}
                opacity={i === 0 ? 1 : 0.92}
              />
              <text
                x={x}
                y={y + 12}
                textAnchor="middle"
                fontSize="34"
                fontWeight="800"
                fill="#3a2808"
                fontFamily="Rajdhani, sans-serif"
              >
                {'EABLMOR'[i]}
              </text>
            </g>
          ))}
        </g>
      );
    }
    case 'blocks': {
      const cols = ['#ff6a2b', '#3f6bff', '#3fcf7d', '#a06bff', '#ffd23f'];
      const cells: [number, number, number][] = [
        [0, 4, 0],
        [1, 4, 1],
        [2, 4, 2],
        [3, 4, 3],
        [4, 4, 4],
        [0, 3, 1],
        [1, 3, 1],
        [3, 3, 3],
        [3, 2, 3],
        [2, 2, 2],
        [2, 3, 2],
      ];
      return (
        <g transform="translate(38 36)">
          <rect x="-8" y="-8" width="236" height="236" rx="16" fill="#0b0d1c" opacity=".35" />
          {cells.map(([c, r, k], i) => (
            <rect key={i} x={c * 44} y={r * 44} width="40" height="40" rx="9" fill={cols[k]} />
          ))}
          <g className="cv-drop">
            <rect x="0" y="0" width="40" height="40" rx="9" fill="#ffd23f" />
            <rect x="44" y="0" width="40" height="40" rx="9" fill="#ffd23f" />
            <rect x="88" y="0" width="40" height="40" rx="9" fill="#ffd23f" />
          </g>
        </g>
      );
    }
    case 'color':
      return (
        <g>
          <circle cx="116" cy="124" r="78" fill="#ff5a8a" opacity=".92" className="cv-pulse" />
          <circle
            cx="186"
            cy="124"
            r="78"
            fill="#ffd23f"
            opacity=".88"
            className="cv-pulse"
            style={{ animationDelay: '.4s' }}
          />
          <circle
            cx="150"
            cy="184"
            r="78"
            fill="#4a8dff"
            opacity=".88"
            className="cv-pulse"
            style={{ animationDelay: '.8s' }}
          />
          <circle cx="150" cy="148" r="26" fill="#fff" opacity=".9" />
        </g>
      );
    case 'time':
      return (
        <g transform="translate(150 150)">
          <circle r="104" fill="#0b1224" opacity=".55" />
          <circle r="100" fill="none" stroke="#e8efff" strokeWidth="10" />
          {Array.from({ length: 12 }, (_, i) => (
            <rect
              key={i}
              x="-3"
              y="-92"
              width="6"
              height="14"
              rx="3"
              fill="#e8efff"
              opacity=".7"
              transform={`rotate(${i * 30})`}
            />
          ))}
          <circle cx="62" cy="-62" r="12" fill="#3fcf7d" />
          <g className="cv-aim">
            <rect x="-5" y="-78" width="10" height="82" rx="5" fill="#fff" />
          </g>
          <circle r="12" fill="#4a8dff" />
        </g>
      );
    case 'eco': {
      const pads: [number, number, string, number][] = [
        [40, 30, '#ff5a4d', 0],
        [156, 30, '#ffd23f', 1],
        [40, 146, '#3fcf7d', 2],
        [156, 146, '#4a8dff', 3],
      ];
      return (
        <g>
          {pads.map(([x, y, c, i]) => (
            <g key={c} className="cv-lit" style={{ animationDelay: `${i * 0.8}s` }}>
              <rect x={x} y={y} width="104" height="104" rx="24" fill={c} />
              <rect
                x={x}
                y={y}
                width="104"
                height="104"
                rx="24"
                fill="none"
                stroke="#fff"
                strokeWidth="5"
                className="cv-ring"
              />
            </g>
          ))}
          <circle cx="92" cy="82" r="14" fill="#0b0d1c" opacity=".7" />
          <rect x="182" y="68" width="28" height="28" rx="4" fill="#0b0d1c" opacity=".7" />
          <path d="M92 168 108 198H76Z" fill="#0b0d1c" opacity=".7" />
          <path d="M208 160 224 188 208 216 192 188Z" fill="#0b0d1c" opacity=".7" />
        </g>
      );
    }
    case 'counterfox':
      return (
        <g>
          <circle cx="210" cy="96" r="62" fill="#ffd9a0" opacity=".9" />
          <path d="M-10 230Q70 170 150 214T330 190V300H-10Z" fill="#3a1d46" />
          <path d="M-10 262Q90 214 180 252T330 236V320H-10Z" fill="#1d1236" />
          <g transform="translate(120 150)" className="cv-scope">
            <circle r="62" fill="none" stroke="#ff8a3d" strokeWidth="5" />
            <circle r="4" fill="#ff8a3d" />
            <path
              d="M-86 0h56M30 0h56M0 -86v56M0 30v56"
              stroke="#ff8a3d"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </g>
        </g>
      );
    case 'bola':
      return (
        <g transform="translate(150 150) rotate(-12) translate(-150 -150)">
          <rect x="30" y="30" width="240" height="220" rx="12" fill="#1c9a5a" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={30 + i * 60} y="30" width="30" height="220" fill="#1faa62" />
          ))}
          <rect
            x="30"
            y="30"
            width="240"
            height="220"
            rx="12"
            fill="none"
            stroke="#fff"
            strokeWidth="4"
          />
          <path d="M150 30v220" stroke="#fff" strokeWidth="4" />
          <circle cx="150" cy="140" r="38" fill="none" stroke="#fff" strokeWidth="4" />
          <circle cx="86" cy="120" r="11" fill="#3f82ff" />
          <circle cx="212" cy="160" r="11" fill="#ff8a3d" />
          <g className="cv-roll">
            <circle cx="120" cy="150" r="13" fill="#fff" />
            <circle cx="120" cy="150" r="5" fill="#0b0d1c" />
          </g>
        </g>
      );
    case 'pingpong':
      return (
        <g>
          <path d="M60 90h180l44 150H16Z" fill="#1d5fd0" />
          <path d="M60 90h180l44 150H16Z" fill="none" stroke="#fff" strokeWidth="5" />
          <path d="M150 90v150" stroke="#fff" strokeWidth="4" />
          <g className="cv-paddle">
            <circle cx="214" cy="190" r="34" fill="#ff5a4d" />
            <circle cx="214" cy="190" r="28" fill="#ff7a6d" />
            <rect x="206" y="218" width="16" height="42" rx="6" fill="#d9a066" />
          </g>
          <g className="cv-ball">
            <circle cx="96" cy="150" r="11" fill="#fff" />
          </g>
        </g>
      );
    case 'atravessa':
      return (
        <g transform="translate(150 150) rotate(-6) translate(-130 -120)">
          <rect x="0" y="0" width="260" height="46" fill="#3f8f4a" />
          <rect x="0" y="46" width="260" height="92" fill="#34343e" />
          <path d="M0 92h260" stroke="#ffd27a" strokeWidth="4" strokeDasharray="20 14" />
          <rect x="0" y="138" width="260" height="44" fill="#2f80d8" />
          <rect x="0" y="182" width="260" height="46" fill="#3f8f4a" />
          <g className="cv-car">
            <rect x="20" y="56" width="62" height="28" rx="8" fill="#ffd23f" />
          </g>
          <g className="cv-car b">
            <rect x="150" y="100" width="62" height="28" rx="8" fill="#ff5a4d" />
          </g>
          <g className="cv-log">
            <rect x="40" y="150" width="96" height="22" rx="9" fill="#8a5a2b" />
          </g>
          <g className="cv-hop">
            <circle cx="130" cy="206" r="15" fill="#ff8a3d" />
            <path d="M118 196 124 180 130 194 136 180 142 196" fill="#ff8a3d" />
          </g>
        </g>
      );
    case 'desmorona':
      return (
        <g transform="translate(150 150) rotate(-8) translate(-120 -100)">
          {Array.from({ length: 4 }, (_, r) =>
            Array.from({ length: 5 }, (_, c) => {
              const n = r * 5 + c;
              if (n === 7 || n === 13) return null;
              const fall = n % 4 === 1;
              return (
                <rect
                  key={n}
                  className={fall ? 'cv-fall' : ''}
                  style={fall ? { animationDelay: `${(n % 5) * 0.5}s` } : undefined}
                  x={c * 50}
                  y={r * 50}
                  width="44"
                  height="44"
                  rx="7"
                  fill={n % 3 === 0 ? '#d4761c' : '#ff9d2e'}
                />
              );
            }),
          )}
          <g className="cv-hop">
            <circle cx="125" cy="75" r="14" fill="#fff3d6" stroke="#ff8a3d" strokeWidth="5" />
          </g>
        </g>
      );
    default:
      return null;
  }
}
