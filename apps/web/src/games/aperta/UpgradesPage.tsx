import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import { formatNumber, type SaveState } from '@nocap/games';
import { AstroMedal } from './AstroMedal';
import { buyLabel, upgradeRows, type UpgradeRow } from './upgrades-logic';
import './upgrades.css';

interface Props {
  state: SaveState;
  onBuy: (index: number) => boolean | void;
}

function UpgradeCard({ row, onBuy }: { row: UpgradeRow; onBuy: (index: number) => boolean | void }) {
  const canBuy = row.status === 'affordable';
  const label =
    row.status === 'affordable'
      ? `Comprar ${row.name} por ${formatNumber(row.cost ?? 0)} de poeira`
      : row.status === 'short'
        ? `${row.name}: falta ${formatNumber(row.missing)} de poeira`
        : row.status === 'maxed'
          ? `${row.name}: no nível máximo`
          : `${row.name}: trancada`;
  return (
    <li className={`ap-up is-${row.status}`}>
      <span className="ap-up-medal">
        <AstroMedal astro={row.astro} />
      </span>
      <div className="ap-up-body">
        <h3>{row.name}</h3>
        <p className="ap-up-text">{row.text}</p>
        {row.gain && <p className="ap-up-gain">{row.gain}</p>}
        {row.lockHint && <p className="ap-up-lock">{row.lockHint}</p>}
        <p className="ap-up-level" key={row.level}>
          Nível {row.level} de {row.max}
        </p>
      </div>
      <button
        type="button"
        className="ap-up-buy"
        data-tut={row.id === 'pulse' ? 'buy-pulse' : undefined}
        aria-label={label}
        aria-disabled={!canBuy}
        onClick={() => {
          if (canBuy) {
            // Só soa se o controller comprou de fato (a trava de toque duplo recusa sem barulho).
            if (onBuy(row.index)) {
              apertaSfx.thunk();
              apertaVibrate(14);
            }
          } else if (row.status === 'short') {
            apertaSfx.boing();
            apertaVibrate([10, 40, 10]);
          }
        }}
      >
        <b>{buyLabel(row)}</b>
        {(row.status === 'affordable' || row.status === 'short') && <small>{row.status === 'short' ? `Preço ${formatNumber(row.cost ?? 0)}` : 'poeira'}</small>}
      </button>
    </li>
  );
}

/** Corpo da página de Melhorias (spec 038, 3.5 e 5.1): um cartão por melhoria que o colapso atual abriu. */
export function UpgradesPage({ state, onBuy }: Props) {
  const rows = upgradeRows(state);
  return (
    <ul className="ap-uplist" aria-label="Melhorias">
      {rows.map((row) => (
        <UpgradeCard key={row.id} row={row} onBuy={onBuy} />
      ))}
    </ul>
  );
}
