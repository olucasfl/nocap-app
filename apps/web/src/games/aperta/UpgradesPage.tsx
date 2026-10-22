import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import { UPGRADES, affordableUpgradeIndex, formatNumber, type SaveState } from '@nocap/games';
import { useEffect, useState } from 'react';
import { AstroMedal } from './AstroMedal';
import {
  UPGRADE_TABS,
  autoSummary,
  buyLabel,
  revealedIds,
  tabBadge,
  tabOf,
  upgradeRows,
  type UpgradeRow,
  type UpgradeTab,
} from './upgrades-logic';
import './upgrades.css';

interface Props {
  state: SaveState;
  onBuy: (index: number) => boolean | void;
  /** Melhorias que a pessoa já viu (o selo das abas conta as que ela ainda não viu). */
  seen: ReadonlySet<string>;
  onSeen: (ids: string[]) => void;
}

function UpgradeCard({ row, onBuy, tutorialTarget }: { row: UpgradeRow; onBuy: (index: number) => boolean | void; tutorialTarget: boolean }) {
  const canBuy = row.status === 'affordable';
  const label =
    row.status === 'affordable'
      ? `Comprar ${row.name} por ${formatNumber(row.cost ?? 0)} de poeira`
      : row.status === 'short'
        ? `${row.name}: falta ${formatNumber(row.missing)} de poeira`
        : row.status === 'maxed'
          ? `${row.name}: comprada`
          : row.status === 'mystery'
            ? `Melhoria escondida, custa ${formatNumber(row.cost ?? 0)} de poeira`
            : `${row.name}: trancada`;
  const generator = row.kind !== 'touch';
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
        {generator && row.status !== 'mystery' && (
          <p className="ap-up-level" key={row.level}>
            Você tem {row.level}
            {row.nextDouble !== null && ` · dobra com ${row.nextDouble}`}
          </p>
        )}
      </div>
      <button
        type="button"
        className="ap-up-buy"
        data-tut={tutorialTarget ? 'buy-first' : undefined}
        aria-label={label}
        aria-disabled={!canBuy}
        onClick={() => {
          if (canBuy) {
            // Só soa se o controller comprou de fato (a trava de toque duplo recusa sem barulho).
            if (onBuy(row.index)) {
              apertaSfx.thunk();
              apertaVibrate(14);
            }
          } else if (row.status === 'short' || row.status === 'mystery') {
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

function AutoSummary({ state }: { state: SaveState }) {
  const s = autoSummary(state);
  return (
    <p className="ap-up-auto">
      Geradores: <b>{s.active}</b> por segundo tocando, <b>{s.idle}</b> parado.
      {s.capped && ' O limite do seu toque já segura o ganho: melhore o toque.'}
    </p>
  );
}

/**
 * Corpo da página de Melhorias (spec 039): duas abas, Toque e Geradores. Cada uma mostra a 1ª melhoria e uma futura
 * escondida ("???" só com o preço); a escondida revela o nome quando a poeira chega perto do valor.
 */
export function UpgradesPage({ state, onBuy, seen, onSeen }: Props) {
  // O tutorial aponta para a melhoria mais barata que já cabe na poeira: a página abre na aba dela.
  const first = affordableUpgradeIndex(state);
  const [tab, setTab] = useState<UpgradeTab>(() => (first === null ? 'touch' : tabOf((UPGRADES[first] as (typeof UPGRADES)[number]).kind)));
  const rows = upgradeRows(state, tab);
  const visible = revealedIds(state, tab).join(',');

  // Abrir a aba conta como ver o que há nela: o selo some, e só volta com uma descoberta nova.
  useEffect(() => {
    onSeen(visible === '' ? [] : visible.split(','));
  }, [visible, onSeen]);

  return (
    <div className="ap-upwrap">
      <div className="ap-uptabs" role="tablist" aria-label="Tipo de melhoria">
        {UPGRADE_TABS.map((t) => {
          const badge = t.id === tab ? 0 : tabBadge(state, t.id, seen);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`ap-uptab-${t.id}`}
              aria-selected={t.id === tab}
              aria-controls="ap-uppanel"
              className={`ap-uptab${t.id === tab ? ' on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {badge > 0 && (
                <span className="ap-badge ap-uptab-badge" aria-label={`${badge} para ver`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {tab === 'generators' && <AutoSummary state={state} />}
      <ul className="ap-uplist" id="ap-uppanel" role="tabpanel" aria-labelledby={`ap-uptab-${tab}`} aria-label="Melhorias">
        {rows.map((row) => (
          <UpgradeCard key={row.id} row={row} onBuy={onBuy} tutorialTarget={row.index === first} />
        ))}
      </ul>
    </div>
  );
}
