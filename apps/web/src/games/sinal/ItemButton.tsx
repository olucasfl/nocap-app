import type { ItemKind } from '@nocap/games';
import { ITEM_COLOR, ITEM_NAME } from './art/perigos';

/** O desenho do item no botão da tela (o mesmo do chão, em SVG). */
function ItemGlyph({ kind }: { kind: ItemKind }) {
  const ink = '#111111';
  if (kind === 'sombra') {
    return (
      <g>
        <ellipse cx="0" cy="0" rx="11" ry="7.5" fill="#ffffff" stroke={ink} strokeWidth="1.6" />
        <circle cx="0" cy="0" r="4" fill="#2a1a50" />
        <path d="M-11 9L11 -9" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    );
  }
  if (kind === 'impulso') {
    return (
      <path d="M3 -12L-8 2H-1L-4 12L8 -3H1Z" fill="#ffffff" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
    );
  }
  if (kind === 'escorregao') {
    // uma gota que escorre
    return (
      <g>
        <path d="M0 -12C6 -4 10 1 10 5A10 10 0 0 1 -10 5C-10 1 -6 -4 0 -12Z" fill="#ffffff" stroke={ink} strokeWidth="1.6" />
        <path d="M-5 6A5 5 0 0 0 0 11" fill="none" stroke="#25c7e8" strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }
  if (kind === 'peso') {
    // um peso de academia
    return (
      <g>
        <path d="M-5 -6A5 5 0 0 1 5 -6" fill="none" stroke={ink} strokeWidth="2.4" />
        <rect x="-11" y="-6" width="22" height="16" rx="4" fill="#ffffff" stroke={ink} strokeWidth="1.6" />
        <text x="0" y="6" textAnchor="middle" fontSize="8" fontWeight="900" fill={ink}>
          KG
        </text>
      </g>
    );
  }
  // atordoar: uma estrela
  return (
    <path
      d="M0 -12L3.4 -4L12 -3.4L5.6 2.4L7.6 11L0 6.6L-7.6 11L-5.6 2.4L-12 -3.4L-3.4 -4Z"
      fill="#ffffff"
      stroke={ink}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  );
}

/** O botão do item que se carrega: grande, no canto de baixo, longe do analógico (que fica no centro). */
export function ItemButton({
  kind,
  onUse,
  side = 'right',
}: {
  kind: ItemKind;
  onUse: () => void;
  side?: 'left' | 'right';
}) {
  return (
    <button
      type="button"
      className={`sv-itembtn${side === 'left' ? ' left' : ''}`}
      aria-label={`Usar ${ITEM_NAME[kind]}`}
      data-sfx="select"
      style={{ background: ITEM_COLOR[kind] }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onUse}
    >
      <svg viewBox="-14 -14 28 28" width="34" height="34" aria-hidden="true">
        <ItemGlyph kind={kind} />
      </svg>
      <span className="mono">{ITEM_NAME[kind]}</span>
    </button>
  );
}
