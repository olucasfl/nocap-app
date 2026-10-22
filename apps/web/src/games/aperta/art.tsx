/** Ilustrações das telas de título e história (copiadas do mockup aprovado). Todas decorativas. */

export function Sky() {
  return (
    <div className="ap-sky" aria-hidden="true">
      <div className="ap-neb ap-n1" />
      <div className="ap-neb ap-n2" />
      <div className="ap-stars ap-s1" />
      <div className="ap-stars ap-s2" />
      <div className="ap-stars ap-s3" />
      <i className="ap-shoot ap-sh1" />
      <i className="ap-shoot ap-sh2" />
    </div>
  );
}

/** Planeta com anéis, lua e o botão sobre a base. */
export function TitleArt() {
  return (
    <svg className="ap-art ap-floaty" viewBox="0 0 600 600" aria-hidden="true">
      <defs>
        <radialGradient id="ap-pl" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#7b92ff" />
          <stop offset=".45" stopColor="#2d3c9a" />
          <stop offset="1" stopColor="#0a1038" />
        </radialGradient>
        <radialGradient id="ap-atm" cx="50%" cy="50%" r="50%">
          <stop offset=".78" stopColor="#5c7cff" stopOpacity="0" />
          <stop offset=".92" stopColor="#7aa0ff" stopOpacity=".5" />
          <stop offset="1" stopColor="#7aa0ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ap-cap" cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ff9a8e" />
          <stop offset=".45" stopColor="#ee3a2f" />
          <stop offset="1" stopColor="#a8120d" />
        </radialGradient>
        <radialGradient id="ap-mn" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#f6f8fd" />
          <stop offset="1" stopColor="#8c94a8" />
        </radialGradient>
        <clipPath id="ap-pc">
          <circle cx="380" cy="300" r="200" />
        </clipPath>
        <clipPath id="ap-front">
          <rect x="0" y="300" width="700" height="300" />
        </clipPath>
      </defs>
      <circle className="ap-glow" cx="380" cy="300" r="250" fill="url(#ap-atm)" />
      <g transform="rotate(-18 380 300)">
        <ellipse cx="380" cy="300" rx="320" ry="72" fill="none" stroke="#b9c6ff" strokeOpacity=".5" strokeWidth="12" />
        <circle cx="380" cy="300" r="200" fill="url(#ap-pl)" />
        <g clipPath="url(#ap-pc)">
          <ellipse cx="380" cy="250" rx="220" ry="14" fill="#fff" opacity=".1" />
          <ellipse cx="380" cy="320" rx="220" ry="22" fill="#000" opacity=".14" />
          <ellipse cx="380" cy="380" rx="220" ry="16" fill="#9fb4ff" opacity=".1" />
          <circle cx="480" cy="430" r="270" fill="#000" opacity=".32" />
        </g>
        <ellipse cx="380" cy="300" rx="320" ry="72" fill="none" stroke="#b9c6ff" strokeOpacity=".9" strokeWidth="12" clipPath="url(#ap-front)" />
      </g>
      <circle cx="110" cy="140" r="28" fill="url(#ap-mn)" />
      <circle cx="100" cy="132" r="6" fill="#8f97ab" opacity=".7" />
      <circle cx="124" cy="152" r="8" fill="#8f97ab" opacity=".7" />
      <g transform="translate(60 -20)">
        <ellipse cx="170" cy="522" rx="110" ry="34" fill="#46506a" />
        <ellipse cx="170" cy="510" rx="110" ry="34" fill="#c7cede" />
        <ellipse cx="170" cy="510" rx="92" ry="26" fill="none" stroke="#8d96ad" strokeWidth="3" />
        <rect x="84" y="452" width="172" height="56" fill="#b3140f" />
        <ellipse cx="170" cy="452" rx="86" ry="28" fill="url(#ap-cap)" />
        <ellipse cx="146" cy="442" rx="38" ry="8" fill="#fff" opacity=".4" />
      </g>
    </svg>
  );
}

const INK = '#02030a';

/** As 3 primeiras ilustrações da história: estação, botão, estrela acendendo (a 4ª tela mostra grimórios, ver StoryScreen). */
export function StoryScene({ index }: { index: number }) {
  return (
    <svg className="ap-scene" viewBox="0 0 440 190" aria-hidden="true">
      <defs>
        <radialGradient id="ap-g-shade" cx="30%" cy="28%" r="85%">
          <stop offset=".45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".55" />
        </radialGradient>
      </defs>
      {index === 0 && (
        <g>
          <circle cx="330" cy="70" r="46" fill="#2d3c9a" />
          <circle cx="330" cy="70" r="46" fill="url(#ap-g-shade)" />
          <rect x="120" y="86" width="110" height="26" rx="6" fill="#aeb7cc" stroke={INK} strokeWidth="3" />
          <rect x="104" y="92" width="22" height="14" fill="#3c9cf0" stroke={INK} strokeWidth="3" />
          <rect x="224" y="92" width="22" height="14" fill="#3c9cf0" stroke={INK} strokeWidth="3" />
          <rect x="156" y="64" width="38" height="22" rx="4" fill="#c7cede" stroke={INK} strokeWidth="3" />
          <circle className="ap-blink" cx="175" cy="75" r="4" fill="#ff5a4d" />
          <path d="M150 132l-40 20M200 132l40 20" stroke="#5a648a" strokeWidth="3" />
        </g>
      )}
      {index === 1 && (
        <g>
          <rect x="90" y="30" width="260" height="140" rx="12" fill="#0e1738" stroke="#33479b" strokeWidth="4" />
          <circle cx="130" cy="64" r="6" fill="#33479b" />
          <circle cx="150" cy="64" r="6" fill="#33479b" />
          <circle cx="170" cy="64" r="6" fill="#33479b" />
          <ellipse cx="220" cy="140" rx="70" ry="16" fill="#46506a" />
          <ellipse cx="220" cy="132" rx="70" ry="16" fill="#c7cede" />
          <rect x="170" y="100" width="100" height="32" fill="#b3140f" />
          <ellipse className="ap-pulse" cx="220" cy="100" rx="50" ry="16" fill="#ee3a2f" />
          <ellipse cx="206" cy="94" rx="22" ry="5" fill="#fff" opacity=".45" />
        </g>
      )}
      {index === 2 && (
        <g>
          <circle className="ap-pulse" cx="220" cy="95" r="70" fill="#ffd166" opacity=".18" />
          <circle className="ap-pulse" cx="220" cy="95" r="40" fill="#ffd166" opacity=".3" />
          <path d="M220 40l8 44 44 8-44 8-8 44-8-44-44-8 44-8z" fill="#fff3c2" />
          <circle cx="220" cy="95" r="12" fill="#fff" />
          <circle className="ap-blink" cx="90" cy="50" r="3" fill="#fff" />
          <circle className="ap-blink" cx="340" cy="60" r="3" fill="#fff" />
          <circle className="ap-blink" cx="360" cy="140" r="2" fill="#fff" />
          <circle className="ap-blink" cx="70" cy="130" r="2" fill="#fff" />
        </g>
      )}
    </svg>
  );
}
