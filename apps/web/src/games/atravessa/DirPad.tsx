import type { Dir } from '@nocap/games';

const ARROW: Record<Dir, string> = {
  0: 'M12 5 5 13h5v6h4v-6h5z',
  1: 'M12 19l7-8h-5V5h-4v6H5z',
  2: 'M5 12l8-7v5h6v4h-6v5z',
  3: 'M19 12l-8-7v5H5v4h6v5z',
};
const LABEL: Record<Dir, string> = { 0: 'Frente', 1: 'Trás', 2: 'Esquerda', 3: 'Direita' };

/**
 * Setas na tela para o celular deitado: o polegar direito fica nelas e o esquerdo livre para tocar (frente) ou deslizar.
 * Só aparecem em telas de toque deitadas (CSS); o teclado, o toque e o deslize continuam valendo.
 */
export function DirPad({ onDir }: { onDir: (d: Dir) => void }) {
  return (
    <div className="at-pad" role="group" aria-label="Setas">
      {([0, 2, 3, 1] as const).map((d) => (
        <button
          key={d}
          type="button"
          className={`at-pad-btn d${d}`}
          aria-label={LABEL[d]}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDir(d);
          }}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
            <path d={ARROW[d]} />
          </svg>
        </button>
      ))}
    </div>
  );
}
