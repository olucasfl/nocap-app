/**
 * Sprite SVG com os gradientes e os astros. Monte UMA vez na raiz do jogo (e na pré-visualização);
 * AstroMedal, GrimoireBook e RegionBackdrop referenciam os símbolos por `<use href="#ap-art-...">`.
 */
export function SpaceArtSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ap-g-moon" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#f6f8fd" />
          <stop offset="1" stopColor="#8c94a8" />
        </radialGradient>
        <radialGradient id="ap-g-merc" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#cbbfb3" />
          <stop offset="1" stopColor="#6e625a" />
        </radialGradient>
        <radialGradient id="ap-g-ven" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="1" stopColor="#c98f33" />
        </radialGradient>
        <radialGradient id="ap-g-mars" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ff9a6b" />
          <stop offset="1" stopColor="#8f2d12" />
        </radialGradient>
        <radialGradient id="ap-g-jup" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#f3d8ae" />
          <stop offset="1" stopColor="#a8683a" />
        </radialGradient>
        <radialGradient id="ap-g-sat" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fbe8b6" />
          <stop offset="1" stopColor="#b88a3e" />
        </radialGradient>
        <radialGradient id="ap-g-tit" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffd98a" />
          <stop offset="1" stopColor="#b8601a" />
        </radialGradient>
        <radialGradient id="ap-g-ice" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#f1fbff" />
          <stop offset="1" stopColor="#7aa7c9" />
        </radialGradient>
        <radialGradient id="ap-g-nep" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#9cc3ff" />
          <stop offset="1" stopColor="#173a94" />
        </radialGradient>
        <radialGradient id="ap-g-bet" cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#ffc36b" />
          <stop offset=".5" stopColor="#ff6a3a" />
          <stop offset="1" stopColor="#8e1f10" />
        </radialGradient>
        <radialGradient id="ap-g-red" cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#ff9a7a" />
          <stop offset=".5" stopColor="#e0281c" />
          <stop offset="1" stopColor="#5a0a08" />
        </radialGradient>
        <radialGradient id="ap-g-star" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".4" stopColor="#bfe0ff" />
          <stop offset="1" stopColor="#3c7be0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ap-g-starb" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".4" stopColor="#9fb4ff" />
          <stop offset="1" stopColor="#6a4be0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ap-g-shade" cx="30%" cy="28%" r="85%">
          <stop offset=".45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".55" />
        </radialGradient>
        <radialGradient id="ap-g-hole" cx="50%" cy="50%" r="50%">
          <stop offset=".5" stopColor="#000" />
          <stop offset=".62" stopColor="#ff9d3a" />
          <stop offset="1" stopColor="#ff5a1f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ap-g-sun-y" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset=".35" stopColor="#ffd45a" />
          <stop offset="1" stopColor="#ff9d1f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ap-g-sun-o" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff0d0" />
          <stop offset=".35" stopColor="#ff9a4a" />
          <stop offset="1" stopColor="#e0501f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ap-g-sun-r" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd0c0" />
          <stop offset=".4" stopColor="#ff4a38" />
          <stop offset="1" stopColor="#a8120d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ap-g-bubble" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#e6dcff" stopOpacity=".55" />
          <stop offset="1" stopColor="#7a56e0" stopOpacity=".08" />
        </radialGradient>
        <radialGradient id="ap-g-medal-bg" cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor="#0e1740" />
          <stop offset="1" stopColor="#04060f" />
        </radialGradient>
        <linearGradient id="ap-g-ring" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a6a2e" />
          <stop offset=".5" stopColor="#f3d58e" />
          <stop offset="1" stopColor="#8a6a2e" />
        </linearGradient>
        <linearGradient id="ap-g-arm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bcd0ff" />
          <stop offset="1" stopColor="#7a56e0" />
        </linearGradient>
        <clipPath id="ap-c-jup">
          <circle cx="32" cy="32" r="25" />
        </clipPath>
        <clipPath id="ap-c-front">
          <rect x="0" y="32" width="64" height="32" />
        </clipPath>

        <symbol id="ap-art-moon" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="url(#ap-g-moon)" />
          <circle cx="22" cy="24" r="5" fill="#8f97ab" opacity=".7" />
          <circle cx="40" cy="38" r="7" fill="#8f97ab" opacity=".7" />
          <circle cx="42" cy="22" r="3.5" fill="#8f97ab" opacity=".7" />
          <circle cx="26" cy="42" r="3" fill="#8f97ab" opacity=".7" />
          <circle cx="32" cy="32" r="26" fill="url(#ap-g-shade)" />
        </symbol>
        <symbol id="ap-art-mercury" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="22" fill="url(#ap-g-merc)" />
          <circle cx="24" cy="27" r="4" fill="#5a4f48" opacity=".6" />
          <circle cx="38" cy="38" r="5" fill="#5a4f48" opacity=".6" />
          <circle cx="40" cy="24" r="2.5" fill="#5a4f48" opacity=".6" />
          <circle cx="32" cy="32" r="22" fill="url(#ap-g-shade)" />
        </symbol>
        <symbol id="ap-art-venus" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="24" fill="url(#ap-g-ven)" />
          <path
            d="M10 28c10-6 16 4 26-1s14 2 18 0M10 38c8-4 16 3 24-1s14 1 20-1"
            stroke="#fff"
            strokeWidth="3"
            fill="none"
            opacity=".35"
            strokeLinecap="round"
          />
          <circle cx="32" cy="32" r="24" fill="url(#ap-g-shade)" />
        </symbol>
        <symbol id="ap-art-mars" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="24" fill="url(#ap-g-mars)" />
          <ellipse cx="32" cy="12" rx="9" ry="3.5" fill="#fff" opacity=".9" />
          <path
            d="M12 36c8-6 14 2 22-3s10 4 18 2"
            stroke="#5e1a08"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            opacity=".6"
          />
          <circle cx="32" cy="32" r="24" fill="url(#ap-g-shade)" />
        </symbol>
        <symbol id="ap-art-rock" viewBox="0 0 64 64">
          <path d="M14 30c0-10 8-18 18-18s20 6 18 18c2 10-6 20-18 20S12 42 14 30z" fill="#8a8f99" />
          <circle cx="26" cy="26" r="5" fill="#5d626d" opacity=".7" />
          <circle cx="40" cy="36" r="6" fill="#5d626d" opacity=".7" />
          <circle cx="34" cy="20" r="3" fill="#5d626d" opacity=".7" />
          <path
            d="M14 30c0-10 8-18 18-18s20 6 18 18c2 10-6 20-18 20S12 42 14 30z"
            fill="url(#ap-g-shade)"
          />
        </symbol>
        <symbol id="ap-art-jupiter" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="25" fill="url(#ap-g-jup)" />
          <g clipPath="url(#ap-c-jup)">
            <path
              d="M4 22h56M4 30h56M4 40h56M4 47h56"
              stroke="#8a4f2a"
              strokeWidth="3.5"
              opacity=".55"
            />
            <ellipse cx="42" cy="37" rx="7" ry="4" fill="#c4452f" />
          </g>
          <circle cx="32" cy="32" r="25" fill="url(#ap-g-shade)" />
        </symbol>
        <symbol id="ap-art-saturn" viewBox="0 0 64 64">
          <g transform="rotate(-18 32 32)">
            <ellipse
              cx="32"
              cy="32"
              rx="30"
              ry="9"
              fill="none"
              stroke="url(#ap-g-ring)"
              strokeWidth="5"
            />
            <circle cx="32" cy="32" r="15" fill="url(#ap-g-sat)" />
            <circle cx="32" cy="32" r="15" fill="url(#ap-g-shade)" />
            <ellipse
              cx="32"
              cy="32"
              rx="30"
              ry="9"
              fill="none"
              stroke="url(#ap-g-ring)"
              strokeWidth="5"
              clipPath="url(#ap-c-front)"
            />
          </g>
        </symbol>
        <symbol id="ap-art-titan" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="#ffb24d" opacity=".25" />
          <circle cx="32" cy="32" r="23" fill="url(#ap-g-tit)" />
          <path
            d="M12 30c10-5 28 5 40-1"
            stroke="#7a3d0e"
            strokeWidth="3"
            fill="none"
            opacity=".5"
          />
          <circle cx="32" cy="32" r="23" fill="url(#ap-g-shade)" />
        </symbol>
        <symbol id="ap-art-ice" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="24" fill="url(#ap-g-ice)" />
          <path
            d="M12 24l14 8 6-10 10 14 12-6M20 44l12-10 14 12"
            stroke="#8a5a3a"
            strokeWidth="2"
            fill="none"
            opacity=".6"
            strokeLinecap="round"
          />
          <circle cx="32" cy="32" r="24" fill="url(#ap-g-shade)" />
        </symbol>
        <symbol id="ap-art-neptune" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="24" fill="url(#ap-g-nep)" />
          <path d="M10 28h44M12 38h40" stroke="#fff" strokeWidth="2.5" opacity=".28" />
          <ellipse cx="26" cy="30" rx="6" ry="3.5" fill="#0b2266" opacity=".7" />
          <circle cx="32" cy="32" r="24" fill="url(#ap-g-shade)" />
        </symbol>
        <symbol id="ap-art-star" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill="url(#ap-g-star)" opacity=".7" />
          <path d="M32 2l3 27 27 3-27 3-3 27-3-27L2 32l27-3z" fill="#e6f3ff" />
          <circle cx="32" cy="32" r="9" fill="#fff" />
        </symbol>
        <symbol id="ap-art-starb" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill="url(#ap-g-starb)" opacity=".7" />
          <path d="M32 4l2.6 25.4L60 32l-25.4 2.6L32 60l-2.6-25.4L4 32l25.4-2.6z" fill="#dfe6ff" />
          <path
            d="M12 12l16 18M52 12L36 30M12 52l16-18M52 52L36 34"
            stroke="#c9d6ff"
            strokeWidth="2"
            opacity=".7"
          />
          <circle cx="32" cy="32" r="8" fill="#fff" />
        </symbol>
        <symbol id="ap-art-betel" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill="#ff6a3a" opacity=".3" />
          <circle cx="32" cy="32" r="22" fill="url(#ap-g-bet)" />
          <circle cx="26" cy="26" r="6" fill="#ffd98a" opacity=".6" />
          <circle cx="38" cy="38" r="5" fill="#ffb347" opacity=".5" />
          <circle cx="40" cy="26" r="3" fill="#ffd98a" opacity=".5" />
        </symbol>
        <symbol id="ap-art-redgiant" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill="#ff3a2a" opacity=".3" />
          <circle cx="32" cy="32" r="23" fill="url(#ap-g-red)" />
          <circle cx="25" cy="25" r="7" fill="#ffb09a" opacity=".55" />
          <circle cx="40" cy="38" r="4" fill="#ff7a5a" opacity=".5" />
        </symbol>
        <symbol id="ap-art-nebula" viewBox="0 0 64 64">
          <ellipse cx="24" cy="30" rx="22" ry="15" fill="#ff5fb2" opacity=".6" />
          <ellipse cx="40" cy="36" rx="22" ry="14" fill="#4fd1c5" opacity=".55" />
          <ellipse cx="32" cy="22" rx="16" ry="11" fill="#8b5cf6" opacity=".7" />
          <ellipse cx="30" cy="32" rx="9" ry="6" fill="#fff" opacity=".35" />
          <circle cx="26" cy="30" r="1.8" fill="#fff" />
          <circle cx="42" cy="24" r="1.4" fill="#fff" />
          <circle cx="36" cy="40" r="1.4" fill="#fff" />
          <circle cx="18" cy="42" r="1.2" fill="#fff" />
        </symbol>
        <symbol id="ap-art-galaxy" viewBox="0 0 64 64">
          <path
            d="M32 32c8-12 24-8 26 4M32 32c-8 12-24 8-26-4M32 32c-12-8-8-24 4-26M32 32c12 8 8 24-4 26"
            stroke="url(#ap-g-arm)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            opacity=".9"
          />
          <circle cx="32" cy="32" r="9" fill="#fff3c2" opacity=".35" />
          <circle cx="32" cy="32" r="5" fill="#fff3c2" />
        </symbol>
        <symbol id="ap-art-hole" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill="url(#ap-g-hole)" />
          <ellipse
            cx="32"
            cy="32"
            rx="30"
            ry="8"
            fill="none"
            stroke="#ffcf70"
            strokeWidth="3"
            opacity=".9"
          />
          <circle cx="32" cy="32" r="13" fill="#000" stroke="#ff9d3a" strokeWidth="2" />
        </symbol>
        <symbol id="ap-art-lock" viewBox="0 0 64 64">
          <rect x="16" y="29" width="32" height="24" rx="5" fill="#2a3a7a" />
          <path d="M22 29v-7a10 10 0 0 1 20 0v7" stroke="#2a3a7a" strokeWidth="6" fill="none" />
          <circle cx="32" cy="41" r="4" fill="#0a1030" />
        </symbol>
      </defs>
    </svg>
  );
}
