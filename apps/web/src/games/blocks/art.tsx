import { BLOCK_COLORS, type BlockColor, type BlockShape } from '@nocap/games';

/**
 * Os desenhos do Block's, todos em SVG: o bloco biselado de cada cor, as peças da bandeja, o
 * selo do joinha, o carimbo do PERFECT e os selos de dica. A arte é igual nos dois temas, então o
 * contorno é sempre tinta escura (como na arte do Hub).
 */
export const INK = '#111111';

/** A tinta de cada família de peça: só os tokens do Pop Brutal e as cores de jogo. */
export const BLOCK_HEX: Record<BlockColor, string> = {
  laranja: '#ff6a2b',
  azul: '#2f5bff',
  amarelo: '#ffd23f',
  rosa: '#ff9ecf',
  verde: '#33c27f',
  roxo: '#7a3cff',
  turquesa: '#25c7e8',
  vermelho: '#e5303a',
};

/** Mistura a cor com branco (`amount` > 0) ou preto (`amount` < 0), de -1 a 1. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (v: number) => Math.round(v + (target - v) * t);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function BlockArt({ color }: { color: BlockColor }) {
  const face = BLOCK_HEX[color];
  const dark = shade(face, -0.35);
  return (
    <>
      <rect x="0.05" y="0.05" width="0.9" height="0.9" rx="0.17" fill={dark} stroke={INK} strokeWidth="0.075" />
      <rect x="0.14" y="0.12" width="0.72" height="0.66" rx="0.11" fill={face} />
      <rect x="0.14" y="0.12" width="0.72" height="0.2" rx="0.1" fill="#ffffff" opacity="0.38" />
      <rect x="0.14" y="0.58" width="0.72" height="0.2" rx="0.1" fill={dark} opacity="0.28" />
      <path d="M0.22 0.27Q0.22 0.2 0.3 0.2H0.52" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="0.08" strokeLinecap="round" />
    </>
  );
}

/** Os blocos de cada cor, definidos uma vez (as outras figuras só apontam para eles com `use`). */
export function BlockDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {BLOCK_COLORS.map((c) => (
          <g id={`bk-${c}`} key={c}>
            <BlockArt color={c} />
          </g>
        ))}
      </defs>
    </svg>
  );
}

/** Um bloco no tabuleiro, na casa (row, col). */
export function Cell({ color, row, col }: { color: BlockColor; row: number; col: number }) {
  return <use href={`#bk-${color}`} x={col} y={row} width="1" height="1" />;
}

/** A peça inteira, para a bandeja e para a que é arrastada. `unit` é o tamanho de uma casa em px. */
export function PieceArt({ shape, unit }: { shape: BlockShape; unit: number }) {
  return (
    <svg
      viewBox={`0 0 ${shape.w} ${shape.h}`}
      width={shape.w * unit}
      height={shape.h * unit}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {shape.cells.map(([r, c]) => (
        <Cell key={`${r}-${c}`} color={shape.color} row={r} col={c} />
      ))}
    </svg>
  );
}

/**
 * A peça da bandeja, que SEMPRE cabe na caixa dela: o tamanho da casa sai do tamanho da caixa
 * (unidades de contêiner), então a barra de 4 ou 5 casas encolhe em vez de vazar. A caixa precisa
 * ter `container-type: size` (ver `.bk-slot`).
 */
export function FitPiece({ shape }: { shape: BlockShape }) {
  return (
    <svg
      className="bk-fit"
      viewBox={`0 0 ${shape.w} ${shape.h}`}
      aria-hidden="true"
      style={{ '--w': shape.w, '--h': shape.h } as React.CSSProperties}
    >
      {shape.cells.map(([r, c]) => (
        <Cell key={`${r}-${c}`} color={shape.color} row={r} col={c} />
      ))}
    </svg>
  );
}

/** O polegar para cima (traço de 24 de largura), desenhado como figura cheia. */
function Thumb({ fill = '#ffd23f' }: { fill?: string }) {
  return (
    <g fill={fill} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <path d="M7 10v12H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10h1.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </g>
  );
}

/** O selo do joinha: polegar para cima num disco amarelo com sombra dura. */
export function ThumbSeal({ size = 96 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <circle cx="54" cy="54" r="42" fill={INK} />
      <circle cx="50" cy="50" r="42" fill="#ffd23f" stroke={INK} strokeWidth="4" />
      <circle cx="50" cy="50" r="33" fill="none" stroke={INK} strokeWidth="2" strokeDasharray="3 5" opacity="0.5" />
      <g transform="translate(26 24) scale(2)">
        <Thumb fill="#ffffff" />
      </g>
    </svg>
  );
}

/** O carimbo do PERFECT: faixa laranja inclinada, estrelas e contorno de tinta. */
export function PerfectStamp({ width = 280 }: { width?: number }) {
  const star = (x: number, y: number, s: number) => (
    <path
      key={`${x}-${y}`}
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -14l4.2 9.4 10.3 1.3-7.5 7.2 1.9 10.1L0 8.5l-8.9 4.5 1.9-10.1-7.5-7.2 10.3-1.3z"
      fill="#ffd23f"
      stroke={INK}
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
  );
  return (
    <svg viewBox="0 0 280 120" width={width} height={(width * 120) / 280} aria-hidden="true">
      <g transform="rotate(-5 140 62)">
        <rect x="16" y="26" width="256" height="84" rx="18" fill={INK} />
        <rect x="10" y="20" width="256" height="84" rx="18" fill="#ff6a2b" stroke={INK} strokeWidth="5" />
        <rect x="20" y="30" width="236" height="64" rx="12" fill="none" stroke={INK} strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" />
        <text
          x="138"
          y="80"
          textAnchor="middle"
          fontFamily="Archivo, Arial Black, sans-serif"
          fontWeight="900"
          fontSize="48"
          letterSpacing="2"
          fill={INK}
        >
          PERFECT
        </text>
        {star(22, 24, 1.1)}
        {star(256, 96, 0.9)}
        {star(244, 20, 0.65)}
      </g>
    </svg>
  );
}

/** Um selo de dica: cheio enquanto há dica, vazio (só o contorno) depois de usada. */
export function HintSeal({ full, size = 22 }: { full: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill={full ? '#ffd23f' : 'none'} stroke={INK} strokeWidth="2.4" opacity={full ? 1 : 0.35} />
      {full && <path d="M12 6.5a4.2 4.2 0 0 0-2.2 7.8c.4.3.7.7.7 1.2h3c0-.5.3-.9.7-1.2A4.2 4.2 0 0 0 12 6.5zM10.6 17.4h2.8" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** A lâmpada do botão de dica. */
export function Bulb({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0-3.4 10.9c.6.5.9 1.1.9 1.8V16h5v-.3c0-.7.3-1.3.9-1.8A6 6 0 0 0 12 3z" />
      <path d="M9.8 19h4.4M10.6 21.5h2.8" />
    </svg>
  );
}

/** Uma estrela cheia, para a pontuação nova e o recorde. */
export function Star({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="-16 -16 32 32" width={size} height={size} aria-hidden="true">
      <path
        d="M0 -14l4.2 9.4 10.3 1.3-7.5 7.2 1.9 10.1L0 8.5l-8.9 4.5 1.9-10.1-7.5-7.2 10.3-1.3z"
        fill="#ffd23f"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
