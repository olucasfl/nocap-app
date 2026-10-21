import { useRef, type CSSProperties } from 'react';
import type { RegionMenuItem } from './content-logic';
import { useDialog } from './useDialog';

interface Props {
  items: RegionMenuItem[];
  onPick: (regionId: string) => void;
  onClose: () => void;
}

/** Menu de regiões (spec 038, 5.4): rever o cenário de qualquer região já aberta, sem custo. */
export function RegionMenu({ items, onPick, onClose }: Props) {
  const root = useRef<HTMLDivElement>(null);
  useDialog(root, onClose);
  return (
    <div className="ap-modal-game">
      <div ref={root} className="ap-mcard-game ap-regionmenu" role="dialog" aria-modal="true" aria-labelledby="ap-region-title">
        <h2 id="ap-region-title">Regiões do espaço</h2>
        <p className="ap-sub">Escolha qual região aparece ao fundo. Só muda o cenário.</p>
        <ul className="ap-rm-list">
          {items.map(({ art, current }) => (
            <li key={art.id}>
              <button
                type="button"
                className={`ap-rm${current ? ' is-current' : ''}`}
                aria-pressed={current}
                style={{ '--rm-a': art.sky.a, '--rm-b': art.sky.glowA, '--rm-c': art.sky.c } as CSSProperties}
                onClick={() => onPick(art.id)}
              >
                <i className="ap-rm-swatch" aria-hidden="true" />
                <span>{art.name}</span>
                {current && <small>Agora</small>}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="ap-btn" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
