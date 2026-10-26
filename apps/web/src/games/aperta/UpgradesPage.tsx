import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import { formatNumber, type SaveState } from '@nocap/games';
import { useEffect, useState } from 'react';
import { ItemIcon } from './ItemIcon';
import { UpgradeIcon } from './UpgradeIcon';
import {
  UPGRADE_TABS,
  buyLabel,
  generatorRows,
  itemsView,
  powers,
  revealedIds,
  tabBadge,
  type EffectLine,
  type GeneratorRow,
  type ItemRow,
  type UpgradeTab,
} from './upgrades-logic';
import './upgrades.css';

interface Props {
  state: SaveState;
  onBuy: (index: number) => boolean | void;
  /** Completa um gerador de uma vez. */
  onBuyBatch?: (index: number) => boolean | void;
  /** Geradores que a pessoa já viu (o selo da aba conta os novos). */
  seen: ReadonlySet<string>;
  onSeen: (ids: string[]) => void;
}

/** "Seu toque 40 -> 80": o total real, nunca só o "+4". */
function Effect({ line, big = false }: { line: EffectLine | null; big?: boolean }) {
  if (!line) return null;
  if (line.idle) {
    return (
      <p className="ap-eff is-idle">
        {line.label}: <b>{line.before}</b>
        <span> (vale quando você tiver um)</span>
      </p>
    );
  }
  return (
    <p
      className={`ap-eff${big ? ' is-big' : ''}`}
      aria-label={`${line.label}: de ${line.before} para ${line.after}`}
    >
      <small>{line.label}</small>
      <span className="ap-eff-nums">
        <b>{line.before}</b>
        <i aria-hidden="true">{'→'}</i>
        <b className="ap-eff-after">{line.after}</b>
      </span>
    </p>
  );
}

function Powers({ state }: { state: SaveState }) {
  const p = powers(state);
  return (
    <dl className="ap-powers" aria-label="Seus poderes">
      <div>
        <dt>Toque</dt>
        <dd>{p.touch}</dd>
      </div>
      <div>
        <dt>Energia por toque</dt>
        <dd>{p.energy}</dd>
      </div>
      <div>
        <dt>Poeira por segundo</dt>
        <dd>{p.dustSec}</dd>
      </div>
      <div>
        <dt>Energia por minuto</dt>
        <dd>{p.energySec}</dd>
      </div>
    </dl>
  );
}

function buyFeedback(ok: boolean | void): void {
  if (ok) {
    apertaSfx.buy();
    apertaVibrate(14);
  }
}

function NextItem({ row, onBuy }: { row: ItemRow; onBuy: Props['onBuy'] }) {
  return (
    <section className={`ap-next${row.affordable ? ' is-ready' : ''}`} aria-label="Próximo item">
      <p className="ap-next-tag">Próximo item</p>
      <div className="ap-next-head">
        <span className="ap-next-icon">
          <ItemIcon id={row.id} size={64} />
        </span>
        <div>
          <h3>{row.name}</h3>
          <p className="ap-next-text">{row.text}</p>
        </div>
      </div>
      <Effect line={row.line} big />
      <div
        className="ap-next-bar"
        role="progressbar"
        aria-label="Poeira para este item"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(row.fill * 100)}
      >
        <i style={{ transform: `scaleX(${row.fill})` }} />
      </div>
      <button
        type="button"
        className="ap-up-buy ap-next-buy"
        data-tut="buy-first"
        aria-label={
          row.affordable
            ? `Comprar ${row.name} por ${formatNumber(row.cost)} de poeira`
            : `${row.name}: falta ${formatNumber(row.missing)} de poeira`
        }
        aria-disabled={!row.affordable}
        onClick={() => {
          if (row.affordable) buyFeedback(onBuy(row.index));
          else {
            apertaSfx.boing();
            apertaVibrate([10, 40, 10]);
          }
        }}
      >
        <small className="ap-up-verb">{row.affordable ? 'Comprar' : 'Falta'}</small>
        <b>{row.affordable ? formatNumber(row.cost) : formatNumber(row.missing)}</b>
        <small>{row.affordable ? 'poeira' : `Preço ${formatNumber(row.cost)}`}</small>
      </button>
    </section>
  );
}

function UpcomingItem({ row }: { row: ItemRow }) {
  return (
    <li className="ap-soon">
      <span className="ap-soon-icon">
        <ItemIcon id={row.id} size={40} />
      </span>
      <div className="ap-soon-body">
        <h4>{row.name}</h4>
        <p>
          {row.line && !row.line.idle
            ? `${row.line.label}: ${row.line.before} → ${row.line.after}`
            : row.text}
        </p>
      </div>
      <span className="ap-soon-price" aria-label={`Preço ${formatNumber(row.cost)}`}>
        {formatNumber(row.cost)}
      </span>
    </li>
  );
}

function OwnedItem({ row }: { row: ItemRow }) {
  return (
    <li className="ap-bought" data-era={row.era}>
      <span className="ap-bought-icon">
        <ItemIcon id={row.id} size={40} />
      </span>
      <div className="ap-bought-body">
        <h4>{row.name}</h4>
        <p>{row.text}</p>
      </div>
    </li>
  );
}

function ItemsPanel({ state, onBuy }: { state: SaveState; onBuy: Props['onBuy'] }) {
  const view = itemsView(state);
  return (
    <div className="ap-cols" id="ap-uppanel" role="tabpanel" aria-labelledby="ap-uptab-items">
      <section className="ap-col" aria-label="Para comprar">
        <h3 className="ap-colhead">
          Para comprar
          <small>
            {view.bought}/{view.total}
          </small>
        </h3>
        <p className="ap-up-intro">
          Itens são compras únicas: pague uma vez e o ganho vale até o próximo colapso.
        </p>
        {view.next ? (
          <NextItem row={view.next} onBuy={onBuy} />
        ) : (
          <p className="ap-up-empty">
            Você comprou todos os itens desta vida.
            {view.moreAt !== null && ` O colapso ${view.moreAt} libera mais itens.`}
          </p>
        )}
        {view.upcoming.length > 0 && (
          <>
            <h4 className="ap-sub">Em seguida</h4>
            <ul className="ap-soonlist" aria-label="Próximos itens">
              {view.upcoming.map((r) => (
                <UpcomingItem key={r.id} row={r} />
              ))}
            </ul>
          </>
        )}
        {view.later > 0 && view.next !== null && (
          <p className="ap-later">
            <b>+{view.later}</b> itens mais fortes liberam nos próximos colapsos
          </p>
        )}
      </section>
      <section className="ap-col" aria-label="Comprados">
        <h3 className="ap-colhead">
          Comprados
          <small>{view.owned.length}</small>
        </h3>
        {view.owned.length === 0 ? (
          <p className="ap-up-empty">Os itens que você comprar aparecem aqui.</p>
        ) : (
          <ul className="ap-boughtlist" aria-label="Itens comprados">
            {view.owned.map((r) => (
              <OwnedItem key={r.id} row={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Pips({ level, max }: { level: number; max: number }) {
  return (
    <span className="ap-up-pips" role="img" aria-label={`${level} de ${max}`}>
      <span className="ap-up-count">
        {level}/{max}
      </span>
      <span className="ap-up-track" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <i key={i} className={i < level ? 'on' : ''} />
        ))}
      </span>
    </span>
  );
}

function GeneratorCard({
  row,
  onBuy,
  onBuyBatch,
  dust,
}: {
  row: GeneratorRow;
  onBuy: Props['onBuy'];
  onBuyBatch?: Props['onBuyBatch'];
  dust: number;
}) {
  const canBuy = row.status === 'affordable';
  const label = canBuy
    ? `Melhorar ${row.name} por ${formatNumber(row.cost ?? 0)} de poeira`
    : row.status === 'short'
      ? `${row.name}: falta ${formatNumber(row.missing)} de poeira`
      : row.status === 'maxed'
        ? `${row.name}: no máximo`
        : `${row.name}: trancado`;
  return (
    <li className={`ap-up is-${row.status}`}>
      <span className="ap-up-medal">
        <UpgradeIcon id={row.id} size={52} />
      </span>
      <div className="ap-up-body">
        <h3>{row.name}</h3>
        <p className="ap-up-text">{row.text} por nível</p>
        {row.gain && <p className="ap-up-gain">{row.gain}</p>}
        {row.payback && <p className="ap-up-payback">{row.payback}</p>}
        {row.total && row.status === 'maxed' && <p className="ap-up-text">{row.total}</p>}
        {row.lockHint && <p className="ap-up-lock">{row.lockHint}</p>}
        <Pips level={row.level} max={row.max} />
      </div>
      <button
        type="button"
        className="ap-up-buy"
        aria-label={label}
        aria-disabled={!canBuy}
        onClick={() => {
          if (canBuy) buyFeedback(onBuy(row.index));
          else if (row.status === 'short') {
            apertaSfx.boing();
            apertaVibrate([10, 40, 10]);
          }
        }}
      >
        {row.status === 'affordable' && <small className="ap-up-verb">Melhorar</small>}
        <b>{buyLabel(row)}</b>
        {(row.status === 'affordable' || row.status === 'short') && (
          <small>
            {row.status === 'short' ? `Preço ${formatNumber(row.cost ?? 0)}` : 'poeira'}
          </small>
        )}
      </button>
      {row.bulkCost !== null && onBuyBatch && (
        <button
          type="button"
          className="ap-up-buy ap-up-bulk"
          aria-label={`Completar ${row.name}: mais ${row.bulkLevels} níveis por ${formatNumber(row.bulkCost)} de poeira`}
          aria-disabled={dust < row.bulkCost}
          onClick={() => {
            if (dust >= row.bulkCost!) buyFeedback(onBuyBatch(row.index));
            else {
              apertaSfx.boing();
              apertaVibrate([10, 40, 10]);
            }
          }}
        >
          <b>
            Completar (+{row.bulkLevels}): {formatNumber(row.bulkCost)}
          </b>
        </button>
      )}
    </li>
  );
}

function OwnedGenerator({ row }: { row: GeneratorRow }) {
  return (
    <li className={`ap-bought is-gen${row.energy ? ' is-energy' : ''}`}>
      <span className="ap-bought-icon">
        <UpgradeIcon id={row.id} size={40} />
      </span>
      <div className="ap-bought-body">
        <h4>{row.name}</h4>
        <p>{row.total ?? row.text}</p>
        <Pips level={row.level} max={row.max} />
      </div>
    </li>
  );
}

function GeneratorsPanel({
  state,
  onBuy,
  onBuyBatch,
}: {
  state: SaveState;
  onBuy: Props['onBuy'];
  onBuyBatch?: Props['onBuyBatch'];
}) {
  const rows = generatorRows(state);
  const buy = rows.filter((r) => r.status !== 'maxed');
  const owned = rows.filter((r) => r.level > 0);
  const buyDust = buy.filter((r) => !r.energy);
  const buyEnergy = buy.filter((r) => r.energy);
  return (
    <div className="ap-cols" id="ap-uppanel" role="tabpanel" aria-labelledby="ap-uptab-generators">
      <section className="ap-col" aria-label="Para comprar">
        <h3 className="ap-colhead">Para comprar</h3>
        <p className="ap-up-intro">
          Geradores trabalham sozinhos, até quando você não toca. Cada nível rende por segundo, e os
          itens multiplicam isso.
        </p>
        {buyDust.length > 0 && (
          <>
            <h4 className="ap-sub">De poeira</h4>
            <ul className="ap-uplist" aria-label="Geradores de poeira">
              {buyDust.map((r) => (
                <GeneratorCard
                  key={r.id}
                  row={r}
                  onBuy={onBuy}
                  onBuyBatch={onBuyBatch}
                  dust={state.run.dust}
                />
              ))}
            </ul>
          </>
        )}
        {buyEnergy.length > 0 && (
          <>
            <h4 className="ap-sub">De energia (enchem a barra de grimórios)</h4>
            <ul className="ap-uplist" aria-label="Geradores de energia">
              {buyEnergy.map((r) => (
                <GeneratorCard
                  key={r.id}
                  row={r}
                  onBuy={onBuy}
                  onBuyBatch={onBuyBatch}
                  dust={state.run.dust}
                />
              ))}
            </ul>
          </>
        )}
        {buy.length === 0 && (
          <p className="ap-up-empty">Todos os geradores disponíveis estão no máximo.</p>
        )}
      </section>
      <section className="ap-col" aria-label="Comprados">
        <h3 className="ap-colhead">
          Comprados
          <small>{owned.length}</small>
        </h3>
        {owned.length === 0 ? (
          <p className="ap-up-empty">
            Os geradores que você comprar aparecem aqui, com o quanto rendem.
          </p>
        ) : (
          <ul className="ap-boughtlist" aria-label="Geradores comprados">
            {owned.map((r) => (
              <OwnedGenerator key={r.id} row={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Página de Melhorias (spec 043): "Seus poderes" no alto e duas abas, Itens (em fila) e Geradores (que trabalham sozinhos). */
export function UpgradesPage({ state, onBuy, onBuyBatch, seen, onSeen }: Props) {
  const [tab, setTab] = useState<UpgradeTab>('items');
  const visible = revealedIds(state).join(',');

  // Abrir a aba dos geradores conta como ver o que há nela: o selo some, e só volta com um gerador novo.
  useEffect(() => {
    if (tab === 'generators') onSeen(visible === '' ? [] : visible.split(','));
  }, [tab, visible, onSeen]);

  return (
    <div className="ap-upwrap">
      <Powers state={state} />
      <div className="ap-upbar">
        <div className="ap-uptabs" role="tablist" aria-label="Tipo de melhoria">
          {UPGRADE_TABS.map((t) => {
            const active = t.id === tab;
            const badge = active ? 0 : tabBadge(state, t.id, seen);
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`ap-uptab-${t.id}`}
                aria-selected={active}
                aria-controls="ap-uppanel"
                className={`ap-uptab${active ? ' on' : ''}`}
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
      </div>
      {tab === 'items' ? (
        <ItemsPanel state={state} onBuy={onBuy} />
      ) : (
        <GeneratorsPanel state={state} onBuy={onBuy} onBuyBatch={onBuyBatch} />
      )}
    </div>
  );
}
