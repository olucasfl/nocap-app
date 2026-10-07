import type { CSSProperties, KeyboardEvent } from 'react';
import { PADS, PadSymbol } from './pads';

/** Quantos botões em cada fileira, de 4 a 9 (uma grade de 6 colunas; cada botão ocupa 6/fileira). */
const ROWS: Record<number, number[]> = {
  4: [2, 2],
  5: [3, 2],
  6: [3, 3],
  7: [3, 2, 2],
  8: [3, 3, 2],
  9: [3, 3, 3],
};

/** A coluna que cada botão ocupa na grade, na ordem dos botões. */
export function spans(pads: number): number[] {
  const rows = ROWS[pads] ?? ROWS[4]!;
  return rows.flatMap((n) => Array.from({ length: n }, () => 6 / n));
}

interface Props {
  pads: number;
  /** Botão aceso agora (reprodução ou toque). */
  lit: number | null;
  /** Botão tocado errado: ganha contorno. */
  bad?: number | null;
  /** Botão que acabou de entrar (Escalada): dá um pulo. */
  fresh?: number | null;
  /** Aceita toques? Fora da sua vez os botões ficam parados. */
  interactive: boolean;
  onTap: (pad: number) => void;
}

/**
 * Os botões do Eco. Respondem ao `pointerdown` (não ao `click`), porque a vez de tocar é no ritmo
 * do dedo. Acender é só `opacity` e `transform`: o botão aceso fica forte e os outros apagam.
 */
export function EcoBoard({ pads, lit, bad = null, fresh = null, interactive, onTap }: Props) {
  const span = spans(pads);
  const key = (e: KeyboardEvent, pad: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) onTap(pad);
    }
  };

  return (
    <div
      className={`eco-board${lit !== null ? ' dim' : ''}`}
      role="group"
      aria-label="Botões do Eco"
    >
      {PADS.slice(0, pads).map((p, i) => (
        <button
          key={i}
          type="button"
          className={`eco-pad${lit === i ? ' lit' : ''}${bad === i ? ' bad' : ''}${fresh === i ? ' fresh' : ''}`}
          style={{ '--span': span[i], background: p.color, color: p.ink } as CSSProperties}
          aria-label={`Botão ${i + 1}, ${p.name}`}
          disabled={!interactive}
          onPointerDown={(e) => {
            e.preventDefault();
            onTap(i);
          }}
          onKeyDown={(e) => key(e, i)}
        >
          <PadSymbol pad={i} size={52} />
        </button>
      ))}
    </div>
  );
}
