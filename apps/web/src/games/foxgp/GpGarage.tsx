import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GpCarPreview } from './GpCarPreview';
import {
  GP_FUR_OPTIONS,
  GP_PAINT_COLORS,
  GP_PATTERNS,
  hex6,
  loadGarage,
  saveGarage,
  type GpGarageSave,
} from './garage';
import './theme.css';
import './gp-home.css';

/**
 * Garagem do Fox GP (spec 079, 3.2), como a do artifact: a prévia 3D do carro à esquerda, que muda na hora e gira com o
 * dedo ou o mouse, e o painel à direita com a cor do pelo, a cor da carroceria, a do detalhe, o desenho da pintura e o
 * número. Fica salva no aparelho; na sala vai para todos (os outros veem o seu carro).
 */
export function GpGarage({
  onClose,
  onSave,
  primary = 'Salvar',
  takenFurs = [],
}: {
  onClose: () => void;
  onSave?: (g: GpGarageSave) => void;
  primary?: string;
  /** Cores de pelo que já são de outras pessoas na sala. */
  takenFurs?: number[];
}) {
  const [g, setG] = useState<GpGarageSave>(() => loadGarage());
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.code === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  const set = (patch: Partial<GpGarageSave['paint']>) => setG((v) => ({ ...v, paint: { ...v.paint, ...patch } }));
  const name = GP_FUR_OPTIONS.find((f) => f.hex === g.fur)?.name ?? 'Raposa';
  return createPortal(
    <div className="gph-garage" role="dialog" aria-modal="true" aria-label="Garagem" data-testid="gp-garage">
      <div className="gph-garage-floor" aria-hidden="true" />
      <div className="gph-garage-head">
        <span className="gp-kicker">Garagem</span>
        <h1 className="gp-title">Raposa {name.toLowerCase()}</h1>
        <p>A pintura do carro é só visual: todos os carros andam igual na pista.</p>
      </div>
      <GpCarPreview fur={g.fur} paint={g.paint} className="gph-garage-car" label={`Prévia do carro da raposa ${name}`} />
      <div className="gph-garage-panel gp-tpanel">
        <section>
          <h2>Pelagem</h2>
          <div className="gph-swatches" role="radiogroup" aria-label="Cor do pelo">
            {GP_FUR_OPTIONS.map((f) => {
              const taken = takenFurs.includes(f.hex) && f.hex !== g.fur;
              return (
                <button
                  key={f.hex}
                  type="button"
                  role="radio"
                  aria-checked={g.fur === f.hex}
                  aria-label={`${f.name}${taken ? ' (já é de outra pessoa)' : ''}`}
                  disabled={taken}
                  className="gph-sw"
                  style={{ background: hex6(f.hex) }}
                  onClick={() => setG((v) => ({ ...v, fur: f.hex }))}
                  data-testid={`garage-fur-${f.hex.toString(16)}`}
                />
              );
            })}
          </div>
        </section>
        <section>
          <h2>Carroceria</h2>
          <div className="gph-swatches" role="radiogroup" aria-label="Cor da carroceria">
            {GP_PAINT_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                role="radio"
                aria-checked={g.paint.body === c.hex}
                aria-label={c.name}
                className="gph-sw"
                style={{ background: hex6(c.hex) }}
                onClick={() => set({ body: c.hex })}
                data-testid={`garage-body-${c.hex.toString(16)}`}
              />
            ))}
          </div>
        </section>
        <section>
          <h2>Detalhe</h2>
          <div className="gph-swatches" role="radiogroup" aria-label="Cor do detalhe">
            {GP_PAINT_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                role="radio"
                aria-checked={g.paint.accent === c.hex}
                aria-label={c.name}
                className="gph-sw"
                style={{ background: hex6(c.hex) }}
                onClick={() => set({ accent: c.hex })}
              />
            ))}
          </div>
        </section>
        <section>
          <h2>Desenho</h2>
          <div className="gph-patterns" role="radiogroup" aria-label="Desenho da pintura">
            {GP_PATTERNS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={g.paint.pattern === p.id}
                className="gph-pattern"
                onClick={() => set({ pattern: p.id })}
                data-testid={`garage-pattern-${p.id}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>
        <section className="gph-number">
          <h2>Número</h2>
          <div>
            <button type="button" aria-label="Número menor" onClick={() => set({ number: Math.max(1, g.paint.number - 1) })}>
              −
            </button>
            <b className="gpn" aria-live="polite">
              {g.paint.number}
            </b>
            <button type="button" aria-label="Número maior" onClick={() => set({ number: Math.min(99, g.paint.number + 1) })}>
              +
            </button>
          </div>
        </section>
        <div className="gph-garage-btns">
          <button type="button" className="gp-tbtn is-ghost" onClick={onClose}>
            Voltar
          </button>
          <button
            type="button"
            className="gp-tbtn is-primary"
            onClick={() => {
              saveGarage(g);
              onSave?.(g);
              onClose();
            }}
            data-testid="garage-save"
          >
            {primary}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
