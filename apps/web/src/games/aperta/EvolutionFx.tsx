import { useEffect } from 'react';
import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import type { AstroId } from './astros';
import { GrimoireBook } from './GrimoireBook';
import { RARITY_LABEL, type Rarity } from './rarity';
import './evolution.css';

export const EVOLUTION_MS = 2600;

interface Props {
  name: string;
  astro: AstroId;
  from: Rarity;
  to: Rarity;
  level: number;
  onDone: () => void;
}

/**
 * Evolução de raridade (spec 042): o livro antigo estremece, um clarão, o livro novo toma o lugar e o selo
 * "RARO -> LENDÁRIO" sobe. Só `transform` e `opacity`; com movimento reduzido vira uma troca direta com um clarão curto.
 * Toque em qualquer lugar fecha.
 */
export function EvolutionFx({ name, astro, from, to, level, onDone }: Props) {
  useEffect(() => {
    apertaSfx.star();
    apertaVibrate([20, 40, 60]);
    const t = window.setTimeout(onDone, EVOLUTION_MS);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="ap-evo-fx" data-to={to} role="status" aria-live="polite" onClick={onDone}>
      <div className="ap-evo-glow" aria-hidden="true" />
      <div className="ap-evo-stage" aria-hidden="true">
        <i className="ap-evo-ring" />
        <i className="ap-evo-ring is-late" />
        <div className="ap-evo-book is-from">
          <GrimoireBook rarity={from} astro={astro} name={name} size="md" still />
        </div>
        <div className="ap-evo-book is-to">
          <GrimoireBook rarity={to} astro={astro} name={name} size="md" still />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} className="ap-evo-spark" style={{ ['--a' as string]: `${i * 60}deg` }} />
        ))}
      </div>
      <p className="ap-evo-seal">
        <b>{RARITY_LABEL[from]}</b>
        <svg viewBox="0 0 24 12" width="26" height="13" aria-hidden="true">
          <path d="M1 6h19M15 1l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <b className="is-next">{RARITY_LABEL[to]}</b>
      </p>
      <p className="ap-evo-name">
        {name} <small>NVL {level}</small>
      </p>
    </div>
  );
}
