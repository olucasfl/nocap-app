/** A abelha do Bee Word's: corpo listrado, asas que batem e antenas. Só tokens do Pop Brutal. */
export function BeeMascot({ className = '', flying = true }: { className?: string; flying?: boolean }) {
  return (
    <svg className={`bz-bee${flying ? ' flying' : ''} ${className}`} viewBox="0 0 120 100" aria-hidden="true">
      <defs>
        <clipPath id="bz-body-clip">
          <ellipse cx="68" cy="58" rx="34" ry="25" />
        </clipPath>
      </defs>
      <g className="bz-wings">
        <g transform="rotate(-18 62 40)">
          <ellipse className="bz-wing a" cx="62" cy="26" rx="14" ry="22" fill="#f4f4ef" stroke="#111" strokeWidth="3.2" />
        </g>
        <g transform="rotate(14 84 42)">
          <ellipse className="bz-wing b" cx="84" cy="28" rx="12" ry="20" fill="#f4f4ef" stroke="#111" strokeWidth="3.2" />
        </g>
      </g>
      <g className="bz-body">
        <ellipse cx="71" cy="61" rx="34" ry="25" fill="#111" />
        <ellipse cx="68" cy="58" rx="34" ry="25" fill="#ffd23f" stroke="#111" strokeWidth="3.5" />
        <g clipPath="url(#bz-body-clip)">
          <rect x="52" y="30" width="9" height="56" fill="#111" />
          <rect x="72" y="30" width="9" height="56" fill="#111" />
          <rect x="90" y="30" width="9" height="56" fill="#111" />
        </g>
        <path d="M100 58 L112 58 L100 65 Z" fill="#111" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="34" cy="56" r="17" fill="#ffd23f" stroke="#111" strokeWidth="3.5" />
        <circle cx="29" cy="52" r="5.5" fill="#fff" stroke="#111" strokeWidth="2.4" />
        <circle cx="30.5" cy="52.5" r="2.4" fill="#111" />
        <path d="M24 64 Q31 69 38 63" fill="none" stroke="#111" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M28 41 Q22 30 14 28" fill="none" stroke="#111" strokeWidth="2.8" strokeLinecap="round" />
        <circle cx="13" cy="27.5" r="3.4" fill="#ff6a2b" stroke="#111" strokeWidth="2.2" />
        <path d="M38 40 Q40 28 46 22" fill="none" stroke="#111" strokeWidth="2.8" strokeLinecap="round" />
        <circle cx="47" cy="21" r="3.4" fill="#ff6a2b" stroke="#111" strokeWidth="2.2" />
      </g>
    </svg>
  );
}

/** Um hexágono "de status" para os números do catálogo (a forma vem do CSS). */
export function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}
