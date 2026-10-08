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

/**
 * Posição fixa de cada botão no tabuleiro 3x3 dos modos em que botões novos entram (Escalada e
 * Siga o Líder): os quatro primeiros ficam nos cantos, depois vêm o centro e as bordas. Um botão
 * novo nunca empurra os outros: ele aparece no lugar que já estava reservado para ele.
 */
export const SLOT_OF_PAD = [0, 2, 6, 8, 4, 1, 7, 3, 5];

interface Props {
  pads: number;
  /** Entram botões novos ao longo da partida: o tabuleiro vira uma grade fixa com os lugares vazios à mostra. */
  growing?: boolean;
  /** Botão aceso agora (reprodução ou toque). */
  lit: number | null;
  /** Botão tocado errado: ganha contorno. */
  bad?: number | null;
  /** Botão proibido pelas regras (Siga o Líder): fica apagado e não aceita toque. */
  banned?: number | null;
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
export function EcoBoard({
  pads,
  growing = false,
  lit,
  bad = null,
  banned = null,
  fresh = null,
  interactive,
  onTap,
}: Props) {
  const span = spans(pads);
  const key = (e: KeyboardEvent, pad: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) onTap(pad);
    }
  };

  const padButton = (i: number) => {
    const p = PADS[i]!;
    return (
      <button
        key={i}
        type="button"
        className={`eco-pad${lit === i ? ' lit' : ''}${bad === i ? ' bad' : ''}${fresh === i ? ' fresh' : ''}${banned === i ? ' banned' : ''}`}
        style={
          {
            '--span': span[i],
            '--pad': p.color,
            background: p.color,
            color: p.ink,
          } as CSSProperties
        }
        aria-label={`Botão ${i + 1}, ${p.name}`}
        disabled={!interactive || banned === i}
        onPointerDown={(e) => {
          e.preventDefault();
          onTap(i);
        }}
        onKeyDown={(e) => key(e, i)}
      >
        <PadSymbol pad={i} size={52} />
      </button>
    );
  };

  if (growing) {
    // Sempre os nove lugares, na mesma posição: os que ainda não existem aparecem tracejados.
    return (
      <div
        className={`eco-board stable${lit !== null ? ' dim' : ''}`}
        role="group"
        aria-label="Botões do Ecooo"
      >
        {Array.from({ length: 9 }, (_, cell) => {
          const pad = SLOT_OF_PAD.indexOf(cell);
          return pad < pads ? (
            padButton(pad)
          ) : (
            <div key={`ghost-${cell}`} className="eco-ghost" aria-hidden="true" />
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`eco-board${lit !== null ? ' dim' : ''}`}
      role="group"
      aria-label="Botões do Ecooo"
    >
      {PADS.slice(0, pads).map((_, i) => padButton(i))}
    </div>
  );
}
