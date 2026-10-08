/**
 * A arte do NoCap!: os quatro jogos do app (Mesmíssima, Já Deu?, Ecooo e as formas do minijogo
 * grande) viram peças soltas, juntas em volta da marca "!". É a ideia do jogo em uma imagem: ele
 * une tudo do app. Só traço e preenchimento (sem emoji), com os tokens do Pop Brutal.
 */
export function PartyArt() {
  const stroke = { stroke: 'var(--party-bg)', strokeWidth: 4, strokeLinejoin: 'round' as const };
  const shadow = { fill: 'var(--party-fg)', opacity: 0.22 };
  return (
    <svg className="party-art" viewBox="0 0 220 210" aria-hidden="true">
      {/* Mesmíssima: barras de cor */}
      <g transform="rotate(-8 59 59)">
        <rect x="26" y="26" width="82" height="82" rx="14" {...shadow} />
        <rect
          x="20"
          y="20"
          width="82"
          height="82"
          rx="14"
          style={{ fill: 'var(--orange)', ...stroke }}
        />
        <rect x="32" y="34" width="58" height="12" rx="6" style={{ fill: 'var(--paper)' }} />
        <rect x="32" y="52" width="58" height="12" rx="6" style={{ fill: 'var(--yellow)' }} />
        <rect x="32" y="70" width="58" height="12" rx="6" style={{ fill: 'var(--party-bg)' }} />
      </g>
      {/* Já Deu?: relógio */}
      <g transform="rotate(7 150 55)">
        <rect x="116" y="16" width="82" height="82" rx="14" {...shadow} />
        <rect
          x="110"
          y="10"
          width="82"
          height="82"
          rx="14"
          style={{ fill: 'var(--blue)', ...stroke }}
        />
        <circle
          cx="151"
          cy="51"
          r="27"
          style={{ fill: 'none', stroke: 'var(--paper)', strokeWidth: 5 }}
        />
        <path
          d="M151 51V33M151 51l11 11"
          style={{ stroke: 'var(--yellow)', strokeWidth: 5, strokeLinecap: 'round' }}
        />
        <circle cx="151" cy="51" r="4" style={{ fill: 'var(--paper)' }} />
      </g>
      {/* Ecooo: botões */}
      <g transform="rotate(6 59 152)">
        <rect x="26" y="112" width="82" height="82" rx="14" {...shadow} />
        <rect
          x="20"
          y="106"
          width="82"
          height="82"
          rx="14"
          style={{ fill: 'var(--green)', ...stroke }}
        />
        <rect x="32" y="118" width="26" height="26" rx="7" style={{ fill: 'var(--orange)' }} />
        <rect x="64" y="118" width="26" height="26" rx="7" style={{ fill: 'var(--blue)' }} />
        <rect x="32" y="150" width="26" height="26" rx="7" style={{ fill: 'var(--yellow)' }} />
        <rect x="64" y="150" width="26" height="26" rx="7" style={{ fill: 'var(--eco-purple)' }} />
      </g>
      {/* Caça-Formas: peças */}
      <g transform="rotate(-6 150 150)">
        <rect x="116" y="112" width="82" height="82" rx="14" {...shadow} />
        <rect
          x="110"
          y="106"
          width="82"
          height="82"
          rx="14"
          style={{ fill: 'var(--yellow)', ...stroke }}
        />
        <polygon points="132,140 152,140 142,120" style={{ fill: 'var(--party-bg)' }} />
        <circle
          cx="170"
          cy="130"
          r="11"
          style={{ fill: 'var(--orange)', stroke: 'var(--party-bg)', strokeWidth: 3 }}
        />
        <polygon
          points="151,150 155,161 167,161 157,168 161,179 151,172 141,179 145,168 135,161 147,161"
          style={{
            fill: 'var(--eco-purple)',
            stroke: 'var(--party-bg)',
            strokeWidth: 3,
            strokeLinejoin: 'round',
          }}
        />
      </g>
      {/* A marca no meio: tudo junto */}
      <g transform="rotate(-10 105 103)">
        <circle cx="111" cy="109" r="30" {...shadow} />
        <circle
          cx="105"
          cy="103"
          r="30"
          style={{ fill: 'var(--party-fg)', stroke: 'var(--party-bg)', strokeWidth: 5 }}
        />
        <text
          x="105"
          y="119"
          textAnchor="middle"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontStyle: 'italic',
            fontSize: 46,
            fill: 'var(--orange)',
          }}
        >
          !
        </text>
      </g>
      {/* Brilhos */}
      <path
        d="M205 118v14M198 125h14"
        style={{ stroke: 'var(--yellow)', strokeWidth: 4, strokeLinecap: 'round' }}
      />
      <path
        d="M8 96v10M3 101h10"
        style={{ stroke: 'var(--party-fg)', strokeWidth: 3, strokeLinecap: 'round' }}
      />
    </svg>
  );
}
