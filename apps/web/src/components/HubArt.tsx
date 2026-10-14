import './hub-art.css';

/**
 * A arte de cada jogo no Hub: cada um com a sua personalidade, no estilo Pop Brutal (contorno de
 * tinta, sombra dura, cores chapadas, sem emoji). Só `transform` e `opacity` se mexem, e tudo para
 * com movimento reduzido.
 */

/** A arte é a mesma nos dois temas: o fundo do cartão é uma cor viva, então o contorno é sempre tinta escura. */
const INK = '#111111';
const PAPER = '#f4f4ef';
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
        <rect x="95" y="2" width="10" height="26" rx="5" fill={PAPER} {...stroke} strokeWidth={3} />
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
      <circle cx="100" cy="80" r="58" fill={PAPER} {...stroke} strokeWidth={4.5} />
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
      <g className="ha-lines" stroke="#ffffff" strokeWidth="4" strokeLinecap="round">
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

/** Atravessa!: faixas em diagonal (grama, estrada, rio), uma tora e o bichinho de blocos pulando. */
export function AtravessaArt() {
  return (
    <svg className="ha ha-atravessa" viewBox="0 0 200 150" aria-hidden="true">
      {/* as faixas inclinadas passam do desenho: o recorte mantém tudo dentro do cartão */}
      <defs>
        <clipPath id="ha-atr-clip">
          <rect x="0" y="0" width="200" height="150" rx="16" />
        </clipPath>
      </defs>
      <g clipPath="url(#ha-atr-clip)">
      <g transform="translate(0 -52) skewY(26)">
        <rect x="-10" y="70" width="220" height="30" fill="#8dd252" {...stroke} strokeWidth={3} />
        <rect x="-10" y="100" width="220" height="30" fill="#3a3d4a" {...stroke} strokeWidth={3} />
        <path d="M-10 115H210" stroke="#f4f4ef" strokeWidth="3" strokeDasharray="12 10" className="ha-road" />
        <rect x="-10" y="130" width="220" height="30" fill="#58bdf2" {...stroke} strokeWidth={3} />
        <rect x="120" y="136" width="52" height="18" rx="3" fill="#8a5a34" {...stroke} strokeWidth={3} />
        <rect x="-10" y="160" width="220" height="40" fill="#8dd252" {...stroke} strokeWidth={3} />
      </g>
      </g>
      <g className="ha-run">
        <ellipse cx="88" cy="128" rx="20" ry="5" fill="rgba(0,0,0,.3)" />
        {/* a cauda grande, com a ponta branca */}
        <path d="M70 118c-18 2-24-16-12-28 4 10 12 14 20 14z" fill="#ff7d26" {...stroke} strokeWidth={3} />
        <path d="M58 90c4 2 6 6 5 11-5-1-8-5-5-11z" fill="#fff3e2" {...stroke} strokeWidth={2.4} />
        {/* o corpo e as patas escuras */}
        <rect x="72" y="96" width="30" height="26" rx="6" fill="#ff7d26" {...stroke} strokeWidth={3.5} />
        <rect x="76" y="116" width="8" height="10" rx="2" fill="#35211a" {...stroke} strokeWidth={2.4} />
        <rect x="92" y="116" width="8" height="10" rx="2" fill="#35211a" {...stroke} strokeWidth={2.4} />
        <rect x="80" y="104" width="14" height="14" rx="4" fill="#fff3e2" />
        {/* as orelhas saindo do boné */}
        <path d="M76 82l-3-14 11 8z" fill="#ff7d26" {...stroke} strokeWidth={2.6} />
        <path d="M98 82l3-14-11 8z" fill="#ff7d26" {...stroke} strokeWidth={2.6} />
        {/* o boné azul com a aba */}
        <rect x="72" y="76" width="30" height="12" rx="5" fill="#2f5bff" {...stroke} strokeWidth={3} />
        <rect x="72" y="83" width="30" height="3" fill="#fff" />
        <path d="M70 90l-12 4 2 5 14-4z" fill="#2347c9" {...stroke} strokeWidth={2.6} />
        {/* o rosto */}
        <rect x="70" y="88" width="32" height="14" rx="4" fill="#ff7d26" {...stroke} strokeWidth={3} />
        <rect x="76" y="92" width="4" height="5" fill={INK} />
        <rect x="90" y="92" width="4" height="5" fill={INK} />
        <rect x="82" y="96" width="6" height="5" rx="1.5" fill="#35211a" />
      </g>
    </svg>
  );
}

/** Block's: o tabuleiro com uma linha completa que estoura, a peça que vai cair e o selo dos pontos. */
export function BlocksArt() {
  const face: Record<string, string> = { o: '#ff6a2b', b: '#2f5bff', p: '#ff9ecf', g: '#33c27f', v: '#7a3cff' };
  const U = 21;
  const X0 = 38;
  const Y0 = 26;
  // linha 4 é a que completa e some; as de cima ficam
  const grid = ['.....', '.....', 'o....', 'bb.pp', 'obgvb'];
  const block = (c: string, r: number, k: number, clear: boolean) => (
    <g key={`${r}-${k}`} className={clear ? 'ha-clearcell' : undefined} style={{ animationDelay: `${k * 0.06}s` }}>
      <rect x={X0 + k * U + 1.5} y={Y0 + r * U + 1.5} width={U - 3} height={U - 3} rx="4.5" fill={face[c]} {...stroke} strokeWidth={2.4} />
      <rect x={X0 + k * U + 4} y={Y0 + r * U + 4} width={U - 8} height="4.5" rx="2.2" fill="#fff" opacity="0.5" />
    </g>
  );
  return (
    <svg className="ha ha-blocks" viewBox="0 0 200 150" aria-hidden="true">
      <rect x={X0 - 6 + 6} y={Y0 - 6 + 6} width={5 * U + 12} height={5 * U + 12} rx="14" {...hard} />
      <rect x={X0 - 6} y={Y0 - 6} width={5 * U + 12} height={5 * U + 12} rx="14" fill={PAPER} {...stroke} />
      {Array.from({ length: 25 }, (_, i) => (
        <rect key={i} x={X0 + (i % 5) * U + 2} y={Y0 + Math.floor(i / 5) * U + 2} width={U - 4} height={U - 4} rx="4" fill={INK} opacity="0.1" />
      ))}
      {grid.map((row, r) => [...row].map((c, k) => (c === '.' ? null : block(c, r, k, r === 4))))}
      <g className="ha-float a">
        <g transform="translate(140 30) rotate(8)">
          <rect x="4" y="4" width="22" height="22" rx="5" {...hard} />
          <rect x="4" y="26" width="22" height="22" rx="5" {...hard} />
          <rect x="26" y="26" width="22" height="22" rx="5" {...hard} />
          <rect x="0" y="0" width="22" height="22" rx="5" fill="#ffd23f" {...stroke} strokeWidth={2.6} />
          <rect x="0" y="22" width="22" height="22" rx="5" fill="#ffd23f" {...stroke} strokeWidth={2.6} />
          <rect x="22" y="22" width="22" height="22" rx="5" fill="#ffd23f" {...stroke} strokeWidth={2.6} />
        </g>
      </g>
      <g className="ha-stamp">
        <g transform="rotate(-8 100 75)">
          <rect x="132" y="104" width="52" height="28" rx="14" {...hard} transform="translate(3 3)" />
          <rect x="132" y="104" width="52" height="28" rx="14" fill="#ff6a2b" {...stroke} strokeWidth={3} />
          <text x="158" y="124" textAnchor="middle" fontFamily="Archivo, Arial Black, sans-serif" fontWeight="900" fontSize="17" fill={INK}>
            +60
          </text>
        </g>
      </g>
    </svg>
  );
}

/** Mix Nocap: as peças de todos os jogos do app juntas em volta do "!", a ideia do jogo em uma imagem. */
export function MixArt() {
  return (
    <svg className="ha ha-mix" viewBox="0 0 200 150" aria-hidden="true">
      {/* Mesmíssima: barras de cor */}
      <g className="ha-float a" transform="rotate(-9 52 42)">
        <rect x="14" y="14" width="60" height="60" rx="11" {...hard} transform="translate(4 4)" />
        <rect x="14" y="14" width="60" height="60" rx="11" fill="var(--orange)" {...stroke} strokeWidth={3} />
        <rect x="23" y="24" width="42" height="9" rx="4.5" fill={PAPER} />
        <rect x="23" y="38" width="42" height="9" rx="4.5" fill="var(--yellow)" />
        <rect x="23" y="52" width="42" height="9" rx="4.5" fill={INK} />
      </g>
      {/* Já Deu?: relógio */}
      <g className="ha-float b" transform="rotate(8 148 42)">
        <rect x="118" y="12" width="60" height="60" rx="11" {...hard} transform="translate(4 4)" />
        <rect x="118" y="12" width="60" height="60" rx="11" fill="var(--blue)" {...stroke} strokeWidth={3} />
        <circle cx="148" cy="42" r="19" fill={PAPER} {...stroke} strokeWidth={2.5} />
        <path d="M148 31v12l8 4" fill="none" {...stroke} strokeWidth={3} />
      </g>
      {/* Ecooo: botões */}
      <g className="ha-float c" transform="rotate(7 52 112)">
        <rect x="14" y="82" width="60" height="56" rx="11" {...hard} transform="translate(4 4)" />
        <rect x="14" y="82" width="60" height="56" rx="11" fill="var(--green)" {...stroke} strokeWidth={3} />
        <circle cx="34" cy="102" r="7" fill={PAPER} {...stroke} strokeWidth={2} />
        <rect x="46" y="95" width="14" height="14" rx="3" fill="var(--yellow)" {...stroke} strokeWidth={2} />
        <path d="M34 114l8 14h-16z" fill="var(--orange)" {...stroke} strokeWidth={2} />
        <circle cx="53" cy="121" r="7" fill="var(--blue)" {...stroke} strokeWidth={2} />
      </g>
      {/* Block's: o bloco */}
      <g className="ha-float a" transform="rotate(-7 148 112)">
        <rect x="118" y="82" width="60" height="56" rx="11" {...hard} transform="translate(4 4)" />
        <rect x="118" y="82" width="60" height="56" rx="11" fill="var(--yellow)" {...stroke} strokeWidth={3} />
        <rect x="128" y="92" width="19" height="19" rx="4" fill="var(--pink)" {...stroke} strokeWidth={2.5} />
        <rect x="149" y="92" width="19" height="19" rx="4" fill="var(--blue)" {...stroke} strokeWidth={2.5} />
        <rect x="128" y="113" width="19" height="19" rx="4" fill="var(--orange)" {...stroke} strokeWidth={2.5} />
      </g>
      {/* o "!" no meio, a marca do NoCap */}
      <g className="ha-stamp">
        <g transform="rotate(-8 100 75)">
          <circle cx="105" cy="80" r="26" {...hard} />
          <circle cx="100" cy="75" r="26" fill="var(--yellow)" {...stroke} strokeWidth={3.5} />
          <text x="100" y="89" textAnchor="middle" fontFamily="Archivo, Arial Black, sans-serif" fontWeight="900" fontSize="40" fill={INK}>
            !
          </text>
        </g>
      </g>
    </svg>
  );
}
