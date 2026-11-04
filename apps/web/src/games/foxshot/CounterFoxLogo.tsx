/**
 * Logo do Counter Fox: uma mira circular com a cabeça da raposa no centro e o nome em letras de estêncil.
 * Tudo em SVG (sem arquivo), com o anel girando devagar (só transform).
 */
export function CounterFoxEmblem({ size = 120, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={`cfh-emblem ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Counter Fox"
    >
      <defs>
        <linearGradient id="cfh-fox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb347" />
          <stop offset="1" stopColor="#ff5a1f" />
        </linearGradient>
      </defs>
      <g className="cfh-ring" style={{ transformOrigin: '60px 60px' }}>
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="2" strokeDasharray="4 7" />
        <path d="M60 2v14M60 104v14M2 60h14M104 60h14" stroke="#ffb347" strokeWidth="4" strokeLinecap="square" />
      </g>
      <circle cx="60" cy="60" r="42" fill="rgba(8,12,26,.85)" stroke="#ff6a2b" strokeWidth="3" />
      {/* cabeça da raposa: orelhas, rosto e focinho */}
      <path d="M26 30 L46 44 L60 40 L74 44 L94 30 L90 62 L60 92 L30 62 Z" fill="url(#cfh-fox)" stroke="#1a0d05" strokeWidth="3" strokeLinejoin="round" />
      <path d="M44 66 L60 60 L76 66 L60 90 Z" fill="#fff4e0" stroke="#1a0d05" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M52 58 L58 62 M68 58 L62 62" stroke="#1a0d05" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="84" r="4" fill="#1a0d05" />
    </svg>
  );
}

export function CounterFoxLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`cfh-logo${compact ? ' compact' : ''}`} data-testid="cfh-logo">
      <CounterFoxEmblem size={compact ? 64 : 112} />
      <div className="cfh-word">
        <span className="cfh-w1">COUNTER</span>
        <span className="cfh-w2">FOX</span>
        {!compact && <small>MATA-MATA TÁTICO DAS RAPOSAS</small>}
      </div>
    </div>
  );
}
