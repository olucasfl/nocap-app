import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import { UPGRADES, affordableUpgradeIndex, formatNumber, type SaveState } from '@nocap/games';
import { useEffect, useRef, useState } from 'react';
import { UpgradeIcon } from './UpgradeIcon';
import {
  UPGRADE_TABS,
  autoSummary,
  buyRows,
  buyLabel,
  ownedRows,
  revealedIds,
  tabBadge,
  tabOf,
  type UpgradeRow,
  type UpgradeSection,
  type UpgradeTab,
} from './upgrades-logic';
import './upgrades.css';

const GHOST_MS = 950;
const FX_MS = 1500;

interface ListFx {
  leaving: { row: UpgradeRow; at: number }[];
  arrive: ReadonlySet<string>;
  bought: ReadonlySet<string>;
}
const NO_FX: ListFx = { leaving: [], arrive: new Set(), bought: new Set() };

const reducedMotion = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Compara a lista de melhorias com a anterior e devolve o que mudou: itens que saíram (ficam um instante como
 * "Comprado" e somem), itens que chegaram (entram depois que o outro sai) e itens que só subiram de nível.
 * Trocar de aba ou de seção não conta como compra.
 */
function useListFx(rows: UpgradeRow[], scope: string): ListFx {
  const prev = useRef<{ scope: string; rows: UpgradeRow[] } | null>(null);
  const [fx, setFx] = useState<ListFx>(NO_FX);
  const sig = `${scope}|${rows.map((r) => `${r.id}:${r.level}`).join(',')}`;
  const latest = useRef(rows);
  latest.current = rows;

  useEffect(() => {
    const now = latest.current;
    const before = prev.current;
    prev.current = { scope, rows: now };
    if (!before || before.scope !== scope || reducedMotion()) {
      setFx(NO_FX);
      return undefined;
    }
    const ids = new Set(now.map((r) => r.id));
    const old = new Map(before.rows.map((r) => [r.id, r]));
    const leaving = before.rows.flatMap((r, at) => (ids.has(r.id) ? [] : [{ row: r, at }]));
    const arrive = new Set(now.filter((r) => !old.has(r.id)).map((r) => r.id));
    const bought = new Set(now.filter((r) => (old.get(r.id)?.level ?? Infinity) < r.level).map((r) => r.id));
    if (leaving.length === 0 && arrive.size === 0 && bought.size === 0) return undefined;
    setFx({ leaving, arrive, bought });
    const t1 = window.setTimeout(() => setFx((f) => ({ ...f, leaving: [] })), GHOST_MS);
    const t2 = window.setTimeout(() => setFx(NO_FX), FX_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // sig resume o conteúdo da lista; `rows` muda de identidade a cada render.
  }, [sig]);

  return fx;
}

interface Props {
  state: SaveState;
  onBuy: (index: number) => boolean | void;
  /** Fila de pedidos: completa um gerador de uma vez. */
  onBuyBatch?: (index: number) => boolean | void;
  /** Melhorias que a pessoa já viu (o selo das abas conta as que ela ainda não viu). */
  seen: ReadonlySet<string>;
  onSeen: (ids: string[]) => void;
}

/** "Melhorar" para o que tem níveis (0/8) e "Comprar" para o que se compra uma vez (spec 041, A6). */
const verbOf = (row: UpgradeRow): string => (row.max > 1 ? 'Melhorar' : 'Comprar');

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

function UpgradeCard({
  row,
  onBuy,
  onBuyBatch,
  dust,
  tutorialTarget,
  fxClass = '',
}: {
  row: UpgradeRow;
  fxClass?: string;
  onBuy: (index: number) => boolean | void;
  onBuyBatch?: (index: number) => boolean | void;
  dust: number;
  tutorialTarget: boolean;
}) {
  const canBuy = row.status === 'affordable';
  const verb = verbOf(row);
  const label =
    row.status === 'affordable'
      ? `${verb} ${row.name} por ${formatNumber(row.cost ?? 0)} de poeira`
      : row.status === 'short'
        ? `${row.name}: falta ${formatNumber(row.missing)} de poeira`
        : row.status === 'maxed'
          ? `${row.name}: completo`
          : row.status === 'mystery'
            ? `Melhoria escondida, custa ${formatNumber(row.cost ?? 0)} de poeira`
            : `${row.name}: trancada`;
  const leveled = row.max > 1 && row.status !== 'mystery';
  return (
    <li className={`ap-up is-${row.status}${fxClass}`}>
      <span className="ap-up-medal">{row.status === 'mystery' ? <span className="ap-up-lock" aria-hidden="true">?</span> : <UpgradeIcon id={row.id} size={52} />}</span>
      <div className="ap-up-body">
        <h3>{row.name}</h3>
        <p className="ap-up-text">{row.text}</p>
        {row.gain && row.status !== 'maxed' && <p className="ap-up-gain">{row.gain}</p>}
        {row.lockHint && <p className="ap-up-lock">{row.lockHint}</p>}
        {leveled && <Pips level={row.level} max={row.max} />}
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
        {row.status === 'affordable' || row.status === 'short' ? <small className="ap-up-verb">{row.status === 'short' ? 'Falta' : verb}</small> : null}
        <b>{buyLabel(row)}</b>
        {(row.status === 'affordable' || row.status === 'short') && <small>{row.status === 'short' ? `Preço ${formatNumber(row.cost ?? 0)}` : 'poeira'}</small>}
      </button>
      {row.bulkCost !== null && onBuyBatch && (
        <button
          type="button"
          className="ap-up-buy ap-up-bulk"
          aria-label={`Completar ${row.name}: mais ${row.bulkLevels} níveis por ${formatNumber(row.bulkCost)} de poeira, 5% mais barato`}
          aria-disabled={dust < row.bulkCost}
          onClick={() => {
            if (dust >= row.bulkCost!) {
              if (onBuyBatch(row.index)) {
                apertaSfx.thunk();
                apertaVibrate(14);
              }
            } else {
              apertaSfx.boing();
              apertaVibrate([10, 40, 10]);
            }
          }}
        >
          <b>
            Completar (+{row.bulkLevels}): {formatNumber(row.bulkCost)}
          </b>
          <small>5% mais barato</small>
        </button>
      )}
    </li>
  );
}

/** O item que acabou de ser completado: mostra o carimbo "Comprado" e some antes de o próximo entrar. */
function GhostCard({ row }: { row: UpgradeRow }) {
  return (
    <li className="ap-up is-leaving" aria-hidden="true">
      <span className="ap-up-medal">
        <UpgradeIcon id={row.id} size={52} />
      </span>
      <div className="ap-up-body">
        <h3>{row.name}</h3>
      </div>
      <span className="ap-up-stamp">Comprado</span>
    </li>
  );
}

/** Um item já completo: ícone, nome, o que faz e o N/N, sem botão. */
function OwnedCard({ row }: { row: UpgradeRow }) {
  return (
    <li className="ap-own">
      <span className="ap-own-icon">
        <UpgradeIcon id={row.id} size={40} />
      </span>
      <div className="ap-own-body">
        <h4>{row.name}</h4>
        <p>{row.text}</p>
      </div>
      <span className="ap-own-tag">{row.max > 1 ? `${row.max}/${row.max}` : 'Comprada'}</span>
    </li>
  );
}

const OWNED_GROUPS: { title: string; match: (r: UpgradeRow) => boolean }[] = [
  { title: 'Toque', match: (r) => r.kind === 'touch' },
  { title: 'Geradores de poeira', match: (r) => r.kind === 'generator' },
  { title: 'Geradores de energia', match: (r) => r.kind === 'energy' },
  { title: 'Melhorias de gerador', match: (r) => r.kind === 'perk' },
];

function AutoSummary({ state }: { state: SaveState }) {
  const s = autoSummary(state);
  return (
    <p className="ap-up-auto">
      Você ganha <b>{s.active}</b> de poeira e <b>{s.energy}</b> de energia por segundo, de verdade.
      {s.capped && ` Os geradores renderiam ${s.potential} de poeira por segundo, mas o limite do seu toque segura: melhore o toque.`}
    </p>
  );
}

/**
 * Página de Melhorias (spec 041): duas abas, Toque e Geradores, e o botão Comprados. Nas abas ficam as melhorias de Toque e de Geradores
 * (um gerador de poeira e um de energia por vez, com o limite 0/8); o que está completo vai para Comprados.
 */
export function UpgradesPage({ state, onBuy, onBuyBatch, seen, onSeen }: Props) {
  // O tutorial aponta para a melhoria mais barata que já cabe na poeira: a página abre na aba dela.
  const first = affordableUpgradeIndex(state);
  const [section, setSection] = useState<UpgradeSection>('buy');
  const [tab, setTab] = useState<UpgradeTab>(() => (first === null ? 'touch' : tabOf((UPGRADES[first] as (typeof UPGRADES)[number]).kind)));
  const rows = buyRows(state, tab);
  const fx = useListFx(rows, `${section}:${tab}`);
  const shown = rows.slice();
  for (const g of [...fx.leaving].sort((a, b) => a.at - b.at)) shown.splice(Math.min(g.at, shown.length), 0, g.row);
  const owned = ownedRows(state);
  const visible = revealedIds(state, tab).join(',');

  // Abrir a aba conta como ver o que há nela: o selo some, e só volta com uma descoberta nova.
  useEffect(() => {
    onSeen(visible === '' ? [] : visible.split(','));
  }, [visible, onSeen]);

  return (
    <div className="ap-upwrap">
      <div className="ap-upbar">
        <div className="ap-uptabs" role="tablist" aria-label="Tipo de melhoria">
          {UPGRADE_TABS.map((t) => {
            const active = section === 'buy' && t.id === tab;
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
                onClick={() => {
                  setSection('buy');
                  setTab(t.id);
                }}
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
        <button
          type="button"
          aria-pressed={section === 'owned'}
          className={`ap-ownbtn${section === 'owned' ? ' on' : ''}`}
          onClick={() => setSection(section === 'owned' ? 'buy' : 'owned')}
        >
          Comprados
          <small>{owned.length}</small>
        </button>
      </div>

      {section === 'buy' ? (
        <>
          {tab === 'generators' && <AutoSummary state={state} />}
          <ul className="ap-uplist" id="ap-uppanel" role="tabpanel" aria-labelledby={`ap-uptab-${tab}`} aria-label="Melhorias à venda">
            {shown.map((row) =>
              fx.leaving.some((g) => g.row.id === row.id) ? (
                <GhostCard key={`ghost-${row.id}`} row={row} />
              ) : (
                <UpgradeCard
                  key={row.id}
                  row={row}
                  onBuy={onBuy}
                  onBuyBatch={onBuyBatch}
                  dust={state.run.dust}
                  tutorialTarget={row.index === first}
                  fxClass={`${fx.arrive.has(row.id) ? ' is-arriving' : ''}${fx.bought.has(row.id) ? ' is-bought' : ''}`}
                />
              ),
            )}
            {rows.length === 0 && <li className="ap-up-empty">Nada novo por aqui: veja o que você já tem em Comprados.</li>}
          </ul>
        </>
      ) : (
        <div className="ap-ownwrap" role="tabpanel" aria-label="Melhorias compradas">
          {owned.length === 0 && <p className="ap-up-empty">Você ainda não completou nenhuma melhoria.</p>}
          {OWNED_GROUPS.map((g) => {
            const list = owned.filter(g.match);
            if (list.length === 0) return null;
            return (
              <section key={g.title} aria-label={g.title}>
                <h3 className="ap-own-group">
                  {g.title}
                  <small>{list.length}</small>
                </h3>
                <ul className="ap-ownlist">
                  {list.map((r) => (
                    <OwnedCard key={r.id} row={r} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
