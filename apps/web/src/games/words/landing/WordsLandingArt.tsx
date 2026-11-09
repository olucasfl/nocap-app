import type { CSSProperties, ReactNode } from 'react';

export type WordsGame = 'classic' | 'connect' | 'bee';

const HEX = 'M50 6 88 28V72L50 94 12 72V28Z';

/** Símbolo de cada jogo, desenhado só para ele. */
export function Emblem({ game }: { game: WordsGame }) {
  const body: Record<WordsGame, ReactNode> = {
    // três casas do Wordle: certa, no lugar errado, ausente
    classic: (
      <>
        <rect x="4" y="30" width="28" height="40" rx="5" fill="#3fcf7d" />
        <rect x="36" y="22" width="28" height="40" rx="5" fill="#f2c230" />
        <rect x="68" y="30" width="28" height="40" rx="5" fill="#4a5068" />
        <text
          x="18"
          y="58"
          textAnchor="middle"
          fontSize="26"
          fontWeight="800"
          fill="#0b0d1c"
          fontFamily="Rajdhani, sans-serif"
        >
          W
        </text>
        <text
          x="50"
          y="50"
          textAnchor="middle"
          fontSize="26"
          fontWeight="800"
          fill="#0b0d1c"
          fontFamily="Rajdhani, sans-serif"
        >
          O
        </text>
        <text
          x="82"
          y="58"
          textAnchor="middle"
          fontSize="26"
          fontWeight="800"
          fill="#f4efe6"
          fontFamily="Rajdhani, sans-serif"
        >
          D
        </text>
        <path d="M10 82h80" stroke="#fff6" strokeWidth="4" strokeLinecap="round" />
      </>
    ),
    // quatro barras de cor, os quatro grupos
    connect: (
      <>
        <rect x="6" y="12" width="88" height="17" rx="6" fill="#ffd23f" />
        <rect x="6" y="33" width="88" height="17" rx="6" fill="#3fcf7d" />
        <rect x="6" y="54" width="88" height="17" rx="6" fill="#4a8dff" />
        <rect x="6" y="75" width="88" height="17" rx="6" fill="#a06bff" />
        <path
          d="M22 20.5h56M22 41.5h56M22 62.5h56M22 83.5h56"
          stroke="#0b0d1c"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="10 8"
          opacity=".55"
        />
      </>
    ),
    // favo com a letra do centro
    bee: (
      <>
        <path d={HEX} fill="#7a5a0b" transform="translate(0 4)" />
        <path d={HEX} fill="#ffd23f" />
        <path d="M50 24 72 37V63L50 76 28 63V37Z" fill="#fff3b0" />
        <path
          d="M34 16q16-12 32 0"
          fill="none"
          stroke="#0b0d1c"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <text
          x="50"
          y="60"
          textAnchor="middle"
          fontSize="34"
          fontWeight="800"
          fill="#0b0d1c"
          fontFamily="Rajdhani, sans-serif"
        >
          B
        </text>
      </>
    ),
  };
  return (
    <svg className="gx-emblem" viewBox="0 0 100 100" aria-hidden="true">
      {body[game]}
    </svg>
  );
}

const TILE_LETTERS = [...'PALAVRASTEMPOLETRASJOGOFOXCAPNOCAPGRUPOFAVOABELHA'];

/** Cenário animado de cada jogo (só transform e opacity). */
export function Backdrop({ game }: { game: WordsGame }) {
  if (game === 'classic') {
    return (
      <div className="glb wlb-classic" aria-hidden="true">
        {TILE_LETTERS.slice(0, 18).map((ch, i) => (
          <span
            key={i}
            className={`wlb-tile k${i % 3}`}
            style={
              {
                '--x': `${(i * 37) % 100}%`,
                '--d': `${-((i * 1.9) % 16)}s`,
                '--t': `${13 + (i % 5) * 2}s`,
                '--s': 0.7 + (i % 4) * 0.22,
              } as CSSProperties
            }
          >
            {ch}
          </span>
        ))}
        <div className="glb-vig" />
      </div>
    );
  }
  if (game === 'connect') {
    const colors = ['#ffd23f', '#3fcf7d', '#4a8dff', '#a06bff'];
    return (
      <div className="glb wlb-connect" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className="wlb-lane"
            style={
              {
                '--y': `${6 + i * 10.5}%`,
                '--t': `${26 + (i % 4) * 7}s`,
                '--d': `${-i * 4}s`,
                '--c': colors[i % 4],
                '--dir': i % 2 ? 1 : -1,
              } as CSSProperties
            }
          >
            {Array.from({ length: 4 }, (_, j) => (
              <i key={j} />
            ))}
          </div>
        ))}
        <div className="glb-vig" />
      </div>
    );
  }
  return (
    <div className="glb wlb-bee" aria-hidden="true">
      <svg className="wlb-comb" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern
            id="wl-comb"
            width="52"
            height="60"
            patternUnits="userSpaceOnUse"
            patternTransform="scale(1.1)"
          >
            <path
              d="M26 2 48 15V41L26 54 4 41V15Z"
              fill="none"
              stroke="#ffd23f"
              strokeWidth="2"
              opacity=".14"
            />
            <path
              d="M52 32 74 45V71L52 84 30 71V45Z"
              fill="none"
              stroke="#ffd23f"
              strokeWidth="2"
              opacity=".14"
              transform="translate(-26 -30)"
            />
          </pattern>
        </defs>
        <rect width="400" height="300" fill="url(#wl-comb)" />
      </svg>
      {Array.from({ length: 7 }, (_, i) => (
        <i
          key={i}
          className="wlb-hex"
          style={
            {
              '--x': `${8 + i * 13}%`,
              '--y': `${14 + ((i * 29) % 62)}%`,
              '--d': `${-i * 1.3}s`,
            } as CSSProperties
          }
        />
      ))}
      <div className="wlb-fly f1">
        <svg viewBox="0 0 60 40">
          <ellipse cx="30" cy="24" rx="14" ry="10" fill="#ffd23f" />
          <path d="M24 15v18M32 14v20" stroke="#0b0d1c" strokeWidth="4" />
          <ellipse cx="26" cy="10" rx="9" ry="5" fill="#fff" opacity=".7" />
        </svg>
      </div>
      <div className="wlb-fly f2">
        <svg viewBox="0 0 60 40">
          <ellipse cx="30" cy="24" rx="14" ry="10" fill="#ffd23f" />
          <path d="M24 15v18M32 14v20" stroke="#0b0d1c" strokeWidth="4" />
          <ellipse cx="26" cy="10" rx="9" ry="5" fill="#fff" opacity=".7" />
        </svg>
      </div>
      <div className="glb-vig" />
    </div>
  );
}

/** O quadro à direita do menu: uma amostra viva do jogo. */
export function Showcase({ game, text }: { game: WordsGame; text: string }) {
  let art: ReactNode;
  if (game === 'classic') {
    const rows: [string, string[]][] = [
      ['AMBOS', ['hit', 'hit', 'miss', 'near', 'miss']],
      ['AMIGO', ['hit', 'hit', 'hit', 'hit', 'hit']],
    ];
    art = (
      <div className="wl-show-board" aria-hidden="true">
        {rows.map(([w, k], r) => (
          <div key={w} className="wl-show-row">
            {[...w].map((ch, i) => (
              <span
                key={i}
                className={`wl-tile ${k[i]}`}
                style={{ '--i': r * 5 + i } as CSSProperties}
              >
                {ch}
              </span>
            ))}
          </div>
        ))}
        <div className="wl-show-row dim">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="wl-tile empty" />
          ))}
        </div>
      </div>
    );
  } else if (game === 'connect') {
    const words = [
      'ONÇA',
      'MESA',
      'LOBO',
      'CADEIRA',
      'SOFÁ',
      'TIGRE',
      'URSO',
      'ARMÁRIO',
      'LEÃO',
      'RAPOSA',
      'BANCO',
      'ESTANTE',
      'CAMA',
      'PUMA',
      'LINCE',
      'BAÚ',
    ];
    const group = [0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1];
    art = (
      <div className="wl-show-conn" aria-hidden="true">
        {words.map((w, i) => (
          <span key={w} className={`wl-chipw g${group[i]}`} style={{ '--i': i } as CSSProperties}>
            {w}
          </span>
        ))}
      </div>
    );
  } else {
    const ring = ['A', 'L', 'E', 'M', 'R', 'O'];
    art = (
      <div className="wl-show-bee" aria-hidden="true">
        {ring.map((ch, i) => (
          <i
            key={i}
            className="hx ring"
            style={{ '--a': `${i * 60}deg`, '--i': i } as CSSProperties}
          >
            <b>{ch}</b>
          </i>
        ))}
        <i className="hx mid">
          <b>B</b>
        </i>
      </div>
    );
  }
  return (
    <div className="gx-show wl-show">
      <div className="gx-art wl-art">{art}</div>
      <p className="gx-show-d">{text}</p>
    </div>
  );
}
