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
        <ellipse
          cx="380"
          cy="300"
          rx="320"
          ry="72"
          fill="none"
          stroke="#b9c6ff"
          strokeOpacity=".5"
          strokeWidth="12"
        />
        <circle cx="380" cy="300" r="200" fill="url(#ap-pl)" />
        <g clipPath="url(#ap-pc)">
          <ellipse cx="380" cy="250" rx="220" ry="14" fill="#fff" opacity=".1" />
          <ellipse cx="380" cy="320" rx="220" ry="22" fill="#000" opacity=".14" />
          <ellipse cx="380" cy="380" rx="220" ry="16" fill="#9fb4ff" opacity=".1" />
          <circle cx="480" cy="430" r="270" fill="#000" opacity=".32" />
        </g>
        <ellipse
          cx="380"
          cy="300"
          rx="320"
          ry="72"
          fill="none"
          stroke="#b9c6ff"
          strokeOpacity=".9"
          strokeWidth="12"
          clipPath="url(#ap-front)"
        />
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
