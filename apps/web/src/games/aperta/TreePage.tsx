import { useMemo, useState } from 'react';
import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import { TREE_BRANCHES, formatNumber, type SaveState } from '@nocap/games';
import { TreeGraph } from './TreeGraph';
import { TreePanel } from './TreePanel';
import { treeView } from './tree-logic';
import './tree.css';

interface Props {
  state: SaveState;
  onBuy: (nodeId: string) => boolean | void;
  onRespec: () => boolean | void;
}

const HINT_KEY = 'aperta:tree-drag-hint';

function hintSeen(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function markHintSeen(): void {
  try {
    window.localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* sem armazenamento: a dica volta na próxima abertura, sem prejuízo */
  }
}

/**
 * Página da Árvore de Habilidades (spec 040, 6.1): cabeçalho com saldo e filtro por ramo, o grafo em SVG que arrasta e
 * dá zoom, o painel do nó e o refazer em 2 passos. A página do Cofre dos Proibidos é outra.
 */
export function TreePage({ state, onBuy, onRespec }: Props) {
  const view = treeView(state);
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [hint, setHint] = useState(() => !hintSeen());

  const rows = useMemo(() => new Map(view.branches.flatMap((b) => b.nodes).map((n) => [n.id, n])), [view]);
  const row = selected ? (rows.get(selected) ?? null) : null;

  const buy = (id: string) => {
    if (onBuy(id)) {
      apertaSfx.thunk();
      apertaVibrate(14);
    }
  };

  return (
    <div className="ap-tree">
      <header className="ap-th">
        <p className="ap-tree-frag" aria-live="polite">
          <b>{formatNumber(view.available)}</b>
          <span>{view.available === 1 ? 'Cintila' : 'Cintilas'} para gastar</span>
          <small>
            {formatNumber(view.earned)} ganhas · {formatNumber(view.spent)} gastas
          </small>
        </p>
        <div className="ap-th-chips" role="group" aria-label="Filtrar por ramo">
          <button type="button" className={`ap-chipf${filter === 'all' ? ' is-on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            Tudo
          </button>
          {TREE_BRANCHES.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`ap-chipf${filter === b.id ? ' is-on' : ''}`}
              aria-pressed={filter === b.id}
              onClick={() => setFilter(filter === b.id ? 'all' : b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
      </header>

      <div className="ap-tree-stage">
        <div className="ap-tree-graph">
          <TreeGraph
            rows={rows}
            selected={selected}
            onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
            filter={filter}
            onFirstDrag={() => {
              if (hint) {
                setHint(false);
                markHintSeen();
              }
            }}
          />
          {hint && view.open && (
            <p className="ap-tg-hint" role="note">
              Arraste para explorar a árvore
            </p>
          )}
          {!view.open && <p className="ap-tg-closed">Os ramos se abrem depois do seu primeiro colapso.</p>}
        </div>
        <TreePanel row={row} onBuy={buy} onClose={() => setSelected(null)} />
      </div>

      <details className="ap-tree-sources">
        <summary>De onde vêm as Cintilas</summary>
        <ul>
          {view.sources.map((s) => (
            <li key={s.id}>
              <span>{s.label}</span>
              <b>{formatNumber(s.value)}</b>
            </li>
          ))}
        </ul>
      </details>

      <section className="ap-respec" aria-labelledby="ap-respec-title">
        <h3 id="ap-respec-title">Refazer árvore</h3>
        {view.respec.can ? (
          <p className="ap-sub">
            Devolve todas as {view.respec.refund} {view.respec.refund === 1 ? 'Cintila gasta' : 'Cintilas gastas'}, sem taxa, sem custo de poeira e sem
            limite de vezes.
          </p>
        ) : (
          <p className="ap-sub">
            {view.respec.spent > 0
              ? 'Só dá para refazer a árvore na tela de colapso ou com a vida zerada, nunca no meio de uma vida.'
              : 'Compre algum nó para poder refazer a árvore depois. Não gasta poeira.'}
          </p>
        )}
        {!confirming ? (
          <button type="button" className="ap-tbtn" disabled={!view.respec.can} onClick={() => setConfirming(true)}>
            Refazer árvore
          </button>
        ) : (
          <div className="ap-respec-confirm" role="group" aria-label="Confirmar refazer a árvore">
            <button
              type="button"
              className="ap-tbtn is-danger"
              autoFocus
              onClick={() => {
                if (onRespec()) apertaSfx.boing();
                setConfirming(false);
                setSelected(null);
              }}
            >
              Confirmar: devolver {view.respec.refund}
            </button>
            <button type="button" className="ap-tbtn is-ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
