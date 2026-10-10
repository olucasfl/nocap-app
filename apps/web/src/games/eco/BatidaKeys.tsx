import { useEffect, useState } from 'react';
import { PADS } from './pads';
import { DEFAULT_KEYS, assignKey, getBatidaKeys, keyLabel, setBatidaKeys } from '@/lib/batida-keys';

/**
 * Teclas das 5 pistas, para quem joga no computador. Toque numa pista e aperte a tecla nova; o
 * padrão é 1 a 5. Se a tecla já era de outra pista, as duas trocam. Usado na pausa e na abertura.
 */
export function BatidaKeys({ onChange }: { onChange?: (keys: string[]) => void }) {
  const [keys, setKeys] = useState<string[]>(() => getBatidaKeys());
  /** Pista esperando uma tecla nova (`null` = ninguém). */
  const [listening, setListening] = useState<number | null>(null);
  const [warn, setWarn] = useState('');

  useEffect(() => {
    if (listening === null) return;
    const onKey = (e: KeyboardEvent) => {
      // Enquanto espera, a tecla é desta tela: o jogo (que também escuta teclado) não vê.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') {
        setListening(null);
        setWarn('');
        return;
      }
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      const next = assignKey(keys, listening, e.key);
      if (!next) {
        setWarn('Essa tecla não pode ser usada. Escolha outra.');
        return;
      }
      setBatidaKeys(next);
      setKeys(next);
      onChange?.(next);
      setListening(null);
      setWarn('');
    };
    // Na captura, para chegar antes do jogo.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, keys, onChange]);

  const reset = () => {
    const next = [...DEFAULT_KEYS];
    setBatidaKeys(next);
    setKeys(next);
    onChange?.(next);
    setListening(null);
    setWarn('');
  };
  const isDefault = keys.every((k, i) => k === DEFAULT_KEYS[i]);

  return (
    <div className="bt-keys" role="group" aria-label="Teclas das pistas (computador)">
      <div className="mono bt-keys-title">TECLAS NO COMPUTADOR</div>
      <div className="bt-keys-row">
        {keys.map((k, i) => (
          <button
            key={i}
            type="button"
            data-sfx="select"
            className={`bt-key${listening === i ? ' on' : ''}`}
            style={{ background: PADS[i]!.color, color: PADS[i]!.ink }}
            aria-label={`Pista ${i + 1}, ${PADS[i]!.name}: tecla ${keyLabel(k)}. Toque para mudar.`}
            onClick={() => {
              setListening(listening === i ? null : i);
              setWarn('');
            }}
          >
            <b>{listening === i ? '?' : keyLabel(k)}</b>
          </button>
        ))}
      </div>
      <p className="mono bt-keys-hint" role="status">
        {warn ||
          (listening !== null
            ? `Aperte a tecla da pista ${listening + 1} (Esc cancela)`
            : 'Toque numa pista e aperte a tecla que quiser.')}
      </p>
      {!isDefault && (
        <button type="button" className="bt-cal-link mono" data-sfx="back" onClick={reset}>
          Voltar ao padrão (1 2 3 4 5)
        </button>
      )}
    </div>
  );
}
