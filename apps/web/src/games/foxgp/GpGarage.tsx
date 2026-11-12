import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GP_FINISHES,
  GP_NUM_STYLES,
  GP_RIM_COLORS,
  GP_RIM_STYLES,
  GP_TYRE_BANDS,
  type GpKartPaint,
  type GpPaint,
} from '@nocap/games';
import { GpCarPreview } from './GpCarPreview';
import { GP_FUR_OPTIONS, GP_PAINT_COLORS, GP_PATTERNS, hex6, loadGarage, saveGarage, type GpGarageSave } from './garage';
import './theme.css';
import './gp-home.css';

type Vehicle = 'kart' | 'f1';
const FINISH_NAME: Record<(typeof GP_FINISHES)[number], string> = {
  brilho: 'Brilho',
  fosco: 'Fosco',
  metal: 'Metálico',
  perola: 'Perolado',
};
const NUM_STYLE_NAME: Record<(typeof GP_NUM_STYLES)[number], string> = {
  cheio: 'Cheio',
  contorno: 'Contorno',
  circulo: 'No círculo',
};
const RIM_STYLE_NAME: Record<(typeof GP_RIM_STYLES)[number], string> = {
  liso: 'Liso',
  raios: '5 raios',
  furado: 'Furado',
  turbina: 'Turbina',
};
const TABS: Record<Vehicle, { id: string; name: string }[]> = {
  f1: [
    { id: 'pintura', name: 'Pintura' },
    { id: 'desenho', name: 'Desenho' },
    { id: 'rodas', name: 'Rodas' },
    { id: 'piloto', name: 'Piloto' },
  ],
  kart: [
    { id: 'carenagem', name: 'Carenagem' },
    { id: 'chassi', name: 'Chassi' },
    { id: 'pecas', name: 'Peças' },
    { id: 'piloto', name: 'Piloto' },
  ],
};

/** Uma fila de cores (as 24 da pintura, ou outra lista). */
function Swatches({
  label,
  value,
  onPick,
  colors = GP_PAINT_COLORS.map((c) => ({ hex: c.hex, name: c.name })),
  testId,
}: {
  label: string;
  value: number | undefined;
  onPick: (hex: number) => void;
  colors?: { hex: number; name: string }[];
  testId?: string;
}) {
  return (
    <section className="gpg-row">
      <h3>{label}</h3>
      <div className="gpg-sw" role="radiogroup" aria-label={label}>
        {colors.map((c) => (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={value === c.hex}
            aria-label={c.name}
            title={c.name}
            style={{ background: c.hex < 0 ? 'transparent' : hex6(c.hex) }}
            className={c.hex < 0 ? 'is-none' : undefined}
            onClick={() => onPick(c.hex)}
            data-testid={testId ? `${testId}-${c.hex.toString(16)}` : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function Choices<T extends string>({
  label,
  value,
  items,
  onPick,
  testId,
}: {
  label: string;
  value: T | undefined;
  items: { id: T; name: string }[];
  onPick: (v: T) => void;
  testId?: string;
}) {
  return (
    <section className="gpg-row">
      <h3>{label}</h3>
      <div className="gpg-chips" role="radiogroup" aria-label={label}>
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            role="radio"
            aria-checked={value === it.id}
            onClick={() => onPick(it.id)}
            data-testid={testId ? `${testId}-${it.id}` : undefined}
          >
            {it.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function NumberPick({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  return (
    <section className="gpg-row gph-number">
      <h3>Número</h3>
      <div>
        <button type="button" aria-label="Número menor" onClick={() => onPick(Math.max(0, value - 1))}>
          −
        </button>
        <b className="gpn" aria-live="polite">
          {value}
        </b>
        <button type="button" aria-label="Número maior" onClick={() => onPick(Math.min(99, value + 1))}>
          +
        </button>
      </div>
    </section>
  );
}

/**
 * Garagem do Fox GP (spec 081, Fase 8): duas abas, Kart (Arcade) e F1 (Realista), cada uma com a sua prévia 3D e as
 * suas opções (6.4 e 7.1), em sub-abas para caber sem rolagem. A cor do pelo e a raposa são as mesmas nos dois. Abre na
 * aba do veículo pedido (o do modo escolhido). Fica salva no aparelho; na sala vai para todos.
 */
export function GpGarage({
  onClose,
  onSave,
  primary = 'Salvar',
  vehicle = 'f1',
}: {
  onClose: () => void;
  onSave?: (g: GpGarageSave) => void;
  primary?: string;
  /** Em qual aba a garagem abre. */
  vehicle?: Vehicle;
  /** (antigo) cores de pelo de outras pessoas: não há mais escolha exclusiva. */
  takenFurs?: number[];
}) {
  const [g, setG] = useState<GpGarageSave>(() => loadGarage());
  const [veh, setVeh] = useState<Vehicle>(vehicle);
  const [tab, setTab] = useState(TABS[vehicle][0]!.id);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.code === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  const f1 = (patch: Partial<GpPaint>) => setG((v) => ({ ...v, paint: { ...v.paint, ...patch } }));
  const kt = (patch: Partial<GpKartPaint>) => setG((v) => ({ ...v, kart: { ...v.kart, ...patch } }));
  const name = GP_FUR_OPTIONS.find((f) => f.hex === g.fur)?.name ?? 'Raposa';
  const p = g.paint;
  const k = g.kart;
  const fur = (
    <Swatches
      label="Pelo da raposa (o mesmo nos dois)"
      value={g.fur}
      colors={GP_FUR_OPTIONS}
      onPick={(hex) => setG((v) => ({ ...v, fur: hex }))}
      testId="garage-fur"
    />
  );
  return createPortal(
    <div className="gph-garage" role="dialog" aria-modal="true" aria-label="Garagem" data-testid="gp-garage">
      <div className="gph-garage-floor" aria-hidden="true" />
      <div className="gph-garage-head">
        <span className="gp-kicker">Garagem</span>
        <h1 className="gp-title">Raposa {name.toLowerCase()}</h1>
      </div>
      <GpCarPreview
        fur={g.fur}
        paint={p}
        kart={k}
        vehicle={veh}
        className="gph-garage-car"
        label={`Prévia do ${veh === 'kart' ? 'kart' : 'F1'} da raposa ${name}`}
      />
      <div className="gph-garage-panel gp-tpanel gpg">
        <div className="gpg-veh" role="tablist" aria-label="Veículo">
          {(['kart', 'f1'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={veh === v}
              onClick={() => {
                setVeh(v);
                setTab(TABS[v][0]!.id);
              }}
              data-testid={`garage-veh-${v}`}
            >
              {v === 'kart' ? 'Kart · Arcade' : 'F1 · Realista'}
            </button>
          ))}
        </div>
        <div className="gpg-tabs" role="tablist" aria-label="Opções">
          {TABS[veh].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              data-testid={`garage-tab-${t.id}`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div className="gpg-body">
          {veh === 'f1' && tab === 'pintura' && (
            <>
              <Swatches label="Carroceria" value={p.body} onPick={(hex) => f1({ body: hex })} testId="garage-body" />
              <Swatches label="Detalhe" value={p.accent} onPick={(hex) => f1({ accent: hex })} testId="garage-accent" />
              <Swatches label="Terceira cor" value={p.third ?? 0xf4f6fb} onPick={(hex) => f1({ third: hex })} />
              <Choices
                label="Acabamento"
                value={p.finish ?? 'brilho'}
                items={GP_FINISHES.map((id) => ({ id, name: FINISH_NAME[id] }))}
                onPick={(finish) => f1({ finish })}
              />
            </>
          )}
          {veh === 'f1' && tab === 'desenho' && (
            <>
              <Choices
                label="Desenho"
                value={p.pattern}
                items={GP_PATTERNS}
                onPick={(pattern) => f1({ pattern })}
                testId="garage-pattern"
              />
              <NumberPick value={p.number} onPick={(number) => f1({ number })} />
              <Choices
                label="Estilo do número"
                value={p.numStyle ?? 'circulo'}
                items={GP_NUM_STYLES.map((id) => ({ id, name: NUM_STYLE_NAME[id] }))}
                onPick={(numStyle) => f1({ numStyle })}
              />
            </>
          )}
          {veh === 'f1' && tab === 'rodas' && (
            <>
              <Swatches
                label="Cor do aro"
                value={p.rim ?? 0x2c2c30}
                colors={GP_RIM_COLORS.map((hex) => ({ hex, name: GP_PAINT_COLORS.find((c) => c.hex === hex)?.name ?? hex6(hex) }))}
                onPick={(rim) => f1({ rim })}
              />
              <Choices
                label="Estilo do aro"
                value={p.rimStyle ?? 'raios'}
                items={GP_RIM_STYLES.map((id) => ({ id, name: RIM_STYLE_NAME[id] }))}
                onPick={(rimStyle) => f1({ rimStyle })}
              />
              <Swatches
                label="Faixa do pneu"
                value={p.band ?? 0xffd23a}
                colors={GP_TYRE_BANDS.map((hex) => ({ hex, name: hex < 0 ? 'Nenhuma' : (GP_PAINT_COLORS.find((c) => c.hex === hex)?.name ?? hex6(hex)) }))}
                onPick={(band) => f1({ band })}
              />
              <Swatches label="Asas" value={p.wing ?? p.accent} onPick={(wing) => f1({ wing })} />
            </>
          )}
          {veh === 'f1' && tab === 'piloto' && (
            <>
              {fur}
              <Swatches label="Capacete" value={p.helmet ?? p.body} onPick={(helmet) => f1({ helmet })} />
              <Swatches label="Luvas" value={p.glove ?? p.accent} onPick={(glove) => f1({ glove })} />
            </>
          )}
          {veh === 'kart' && tab === 'carenagem' && (
            <>
              <Swatches label="Carenagem" value={k.body} onPick={(body) => kt({ body })} testId="garage-kbody" />
              <Swatches label="Faixa" value={k.stripe} onPick={(stripe) => kt({ stripe })} />
              <Choices
                label="Acabamento"
                value={k.finish}
                items={GP_FINISHES.map((id) => ({ id, name: FINISH_NAME[id] }))}
                onPick={(finish) => kt({ finish })}
              />
              <NumberPick value={k.number} onPick={(number) => kt({ number })} />
            </>
          )}
          {veh === 'kart' && tab === 'chassi' && (
            <>
              <Swatches label="Chassi" value={k.chassis} onPick={(chassis) => kt({ chassis })} />
              <Swatches label="Motor" value={k.engine} onPick={(engine) => kt({ engine })} />
              <Swatches label="Tanque" value={k.tank} onPick={(tank) => kt({ tank })} />
            </>
          )}
          {veh === 'kart' && tab === 'pecas' && (
            <>
              <Swatches label="Aro das rodas" value={k.rim} onPick={(rim) => kt({ rim })} />
              <Swatches label="Volante" value={k.steer} onPick={(steer) => kt({ steer })} />
              <Swatches label="Pedais" value={k.pedal} onPick={(pedal) => kt({ pedal })} />
            </>
          )}
          {veh === 'kart' && tab === 'piloto' && (
            <>
              {fur}
              <Swatches label="Macacão" value={k.suit} onPick={(suit) => kt({ suit })} />
              <Swatches label="Detalhe do macacão" value={k.suit2} onPick={(suit2) => kt({ suit2 })} />
              <Swatches label="Luvas" value={k.glove} onPick={(glove) => kt({ glove })} />
              <Choices
                label="Capacete"
                value={k.helmet ? 'com' : 'sem'}
                items={[
                  { id: 'sem', name: 'Sem (cabeça de raposa)' },
                  { id: 'com', name: 'Com' },
                ]}
                onPick={(v) => kt({ helmet: v === 'com' })}
                testId="garage-helmet"
              />
              {k.helmet && <Swatches label="Cor do capacete" value={k.helmetColor} onPick={(helmetColor) => kt({ helmetColor })} />}
            </>
          )}
        </div>
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
