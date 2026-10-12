import './hub-art.css';

/**
 * A arte de cada jogo no Hub: cada um com a sua personalidade, no estilo Pop Brutal (contorno de
 * tinta, sombra dura, cores chapadas, sem emoji). Só `transform` e `opacity` se mexem, e tudo para
 * com movimento reduzido.
 */

const INK = 'var(--ink)';
const stroke = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const hard = { fill: INK, opacity: 1 };

/** Mesmíssima: a cor alvo, a que você fez quase igual, e a nota que sai da diferença. */
export function ColorArt() {
  return (
    <svg className="ha ha-color" viewBox="0 0 200 150" aria-hidden="true">
      <g className="ha-float a">
        <g transform="rotate(-9 62 72)">
          <rect x="22" y="22" width="84" height="104" rx="14" {...hard} transform="translate(5 5)" />
          <rect x="22" y="22" width="84" height="104" rx="14" fill="#b6e83a" {...stroke} />
          <rect x="30" y="30" width="68" height="62" rx="9" fill="#c7f04f" {...stroke} strokeWidth={2.5} />
          <rect x="30" y="98" width="42" height="9" rx="4.5" fill={INK} />
          <rect x="30" y="111" width="28" height="7" rx="3.5" fill={INK} opacity="0.45" />
        </g>
      </g>
      <g className="ha-float b">
        <g transform="rotate(8 140 78)">
          <rect x="98" y="30" width="84" height="104" rx="14" {...hard} transform="translate(5 5)" />
          <rect x="98" y="30" width="84" height="104" rx="14" fill="#9ed64a" {...stroke} />
          <rect x="106" y="38" width="68" height="62" rx="9" fill="#8fcb3f" {...stroke} strokeWidth={2.5} />
          <rect x="106" y="106" width="42" height="9" rx="4.5" fill={INK} />
          <rect x="106" y="119" width="28" height="7" rx="3.5" fill={INK} opacity="0.45" />
        </g>
      </g>
      {/* conta-gotas */}
      <g transform="rotate(32 100 22)" className="ha-float c">
        <rect x="95" y="2" width="10" height="26" rx="5" fill="var(--paper)" {...stroke} strokeWidth={3} />
        <rect x="90" y="-4" width="20" height="9" rx="4.5" fill={INK} />
        <path d="M100 28v12" {...stroke} strokeWidth={3.5} />
      </g>
      {/* a nota */}
      <g className="ha-stamp">
        <g transform="rotate(-10 100 78)">
          <circle cx="105" cy="83" r="23" {...hard} />
          <circle cx="100" cy="78" r="23" fill="var(--yellow)" {...stroke} />
          <text x="100" y="86" textAnchor="middle" fontFamily="Archivo, Arial Black, sans-serif" fontWeight="900" fontSize="23" fill={INK}>
            98
          </text>
        </g>
      </g>
    </svg>
  );
}

/** Já Deu?: um cronômetro grande, de ponteiro correndo, com as marcas do tempo ao redor. */
export function TimeArt() {
  const ticks = Array.from({ length: 12 }, (_, i) => i);
  return (
    <svg className="ha ha-time" viewBox="0 0 200 150" aria-hidden="true">
      {/* botão de cima e coroa */}
      <rect x="90" y="4" width="20" height="14" rx="4" fill="var(--yellow)" {...stroke} strokeWidth={3} />
      <rect x="84" y="14" width="32" height="10" rx="4" fill={INK} />
      {/* botão do lado */}
      <g transform="rotate(42 100 80)">
        <rect x="92" y="10" width="16" height="12" rx="4" fill="var(--yellow)" {...stroke} strokeWidth={3} />
      </g>
      <circle cx="105" cy="85" r="58" {...hard} />
      <circle cx="100" cy="80" r="58" fill="var(--white)" {...stroke} strokeWidth={4.5} />
      <circle cx="100" cy="80" r="46" fill="none" stroke={INK} strokeWidth="2" opacity="0.25" />
      {ticks.map((i) => (
        <line
          key={i}
          x1="100"
          y1="38"
          x2="100"
          y2={i % 3 === 0 ? 50 : 45}
          stroke={INK}
          strokeWidth={i % 3 === 0 ? 4 : 2.5}
          strokeLinecap="round"
          transform={`rotate(${i * 30} 100 80)`}
        />
      ))}
      {/* o pedaço que já passou */}
      <path d="M100 80L100 38A42 42 0 0 1 135 56Z" fill="var(--orange)" opacity="0.9" />
      <g className="ha-sweep">
        <line x1="100" y1="80" x2="100" y2="36" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="100" cy="36" r="4.5" fill="var(--yellow)" {...stroke} strokeWidth={2.5} />
      </g>
      <circle cx="100" cy="80" r="7" fill={INK} />
      {/* riscos de velocidade */}
      <g className="ha-lines" stroke="var(--on-blue)" strokeWidth="4" strokeLinecap="round">
        <path d="M10 56h20M4 74h26M12 92h18" />
      </g>
    </svg>
  );
}

/** Ecooo: os botões da sequência, um acende de cada vez, e o som sai em ondas. */
export function EcoArt() {
  const pads = [
    { x: 24, y: 18, color: 'var(--orange)', d: 0, shape: <circle cx="0" cy="0" r="13" /> },
    { x: 104, y: 18, color: 'var(--blue)', d: 0.8, shape: <rect x="-12" y="-12" width="24" height="24" rx="3" /> },
    { x: 24, y: 80, color: 'var(--yellow)', d: 2.4, shape: <path d="M0 -14l14 24h-28z" /> },
    { x: 104, y: 80, color: 'var(--eco-purple)', d: 1.6, shape: <path d="M0 -14l4.2 9.4 10.3 1.3-7.5 7.2 1.9 10.1L0 8.5l-8.9 4.5 1.9-10.1-7.5-7.2 10.3-1.3z" /> },
  ];
  return (
    <svg className="ha ha-eco" viewBox="0 0 200 150" aria-hidden="true">
      {pads.map((p) => (
        <g key={p.d} transform={`translate(${p.x} ${p.y})`}>
          <rect x="6" y="6" width="72" height="56" rx="14" {...hard} />
          <g className="ha-pad" style={{ animationDelay: `${p.d}s` }}>
            <rect x="0" y="0" width="72" height="56" rx="14" fill={p.color} {...stroke} />
            <g transform="translate(36 28)" fill={INK} opacity="0.85">
              {p.shape}
            </g>
            <rect className="ha-glow" x="0" y="0" width="72" height="56" rx="14" fill="#fff" style={{ animationDelay: `${p.d}s` }} />
          </g>
        </g>
      ))}
      <g className="ha-waves" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round">
        <path d="M180 36a14 14 0 0 1 0 22" />
        <path d="M188 28a24 24 0 0 1 0 38" />
      </g>
    </svg>
  );
}

/** Sinal Vermelho: o semáforo de olho aberto, a pista até o horizonte e o boneco correndo. */
export function SinalArt() {
  return (
    <svg className="ha ha-sinal" viewBox="0 0 200 150" aria-hidden="true">
      {/* a pista */}
      <path d="M88 70L10 150H190L112 70Z" fill="#1d1d2b" {...stroke} strokeWidth={3} />
      <path d="M100 70V150" stroke="var(--yellow)" strokeWidth="4" strokeDasharray="10 9" className="ha-road" />
      {/* o poste e o semáforo */}
      <rect x="95" y="64" width="10" height="14" fill="#5a5a66" {...stroke} strokeWidth={3} />
      <rect x="62" y="6" width="76" height="62" rx="14" {...hard} transform="translate(5 5)" />
      <rect x="62" y="6" width="76" height="62" rx="14" fill="#1d1d2b" {...stroke} />
      <circle cx="82" cy="37" r="13" fill="#3a2a2a" {...stroke} strokeWidth={3} />
      <circle cx="118" cy="37" r="13" fill="#3a2a2a" {...stroke} strokeWidth={3} />
      <circle className="ha-amber" cx="82" cy="37" r="13" fill="#ffb020" />
      {/* a lâmpada vermelha com o olho */}
      <circle cx="100" cy="37" r="18" fill="#e5303a" {...stroke} strokeWidth={3.5} />
      <ellipse cx="100" cy="37" rx="11" ry="8" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle className="ha-pupil" cx="100" cy="37" r="4.6" fill={INK} />
      {/* o boneco */}
      <g className="ha-run">
        <ellipse cx="102" cy="136" rx="13" ry="5" fill="rgba(0,0,0,.3)" />
        <ellipse cx="94" cy="124" rx="4" ry="6" fill="var(--paper)" {...stroke} strokeWidth={2.5} />
        <ellipse cx="110" cy="124" rx="4" ry="6" fill="var(--paper)" {...stroke} strokeWidth={2.5} />
        <circle cx="102" cy="118" r="14" fill="var(--paper)" {...stroke} strokeWidth={3.5} />
        <path d="M102 114l3.5 5-3.5 4-3.5-4z" fill="#33c27f" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
