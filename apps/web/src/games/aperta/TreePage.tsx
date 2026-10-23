import { useMemo, useRef, useState } from 'react';
import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import { TREE_BRANCHES, formatNumber, type SaveState } from '@nocap/games';
import { TreeGraph } from './TreeGraph';
import { TreePanel } from './TreePanel';
import { treeView } from './tree-logic';
import { useDialog } from './useDialog';
import './tree.css';

interface Props {
  state: SaveState;
  onBuy: (nodeId: string) => boolean | void;
  onRespec: () => boolean | void;
  onClose: () => void;
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

const BoltIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path d="M12 2l2.6 6.4L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.6z" fill="currentColor" />
  </svg>
);

/**
 * Árvore de Habilidades em tela cheia (spec 040, 6.1): o grafo ocupa tudo e arrasta/dá zoom; por cima ficam o voltar,
 * o saldo de Cintilas, o filtro por ramo, dois botões (de onde vêm as Cintilas e refazer a árvore) e o painel do nó,
 * que sobe só quando há um nó escolhido. A página do Cofre dos Proibidos é outra.
 */
export function TreePage({ state, onBuy, onRespec, onClose }: Props) {
  const view = treeView(state);
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [pop, setPop] = useState<'sources' | 'respec' | null>(null);
  const [hint, setHint] = useState(() => !hintSeen());
  const root = useRef<HTMLDivElement>(null);
  useDialog(root, () => (pop ? setPop(null) : onClose()));

  const rows = useMemo(() => new Map(view.branches.flatMap((b) => b.nodes).map((n) => [n.id, n])), [view]);
  const row = selected ? (rows.get(selected) ?? null) : null;

  const buy = (id: string) => {
    if (onBuy(id)) {
      apertaSfx.thunk();
      apertaVibrate(14);
    }
  };
  const toggle = (which: 'sources' | 'respec') => {
    setConfirming(false);
    setPop((cur) => (cur === which ? null : which));
  };

  return (
    <div ref={root} className="ap-tree" data-tut="tree-page" role="dialog" aria-label="Árvore de Habilidades" tabIndex={-1}>
      <div className="ap-tree-bg" aria-hidden="true" />
      <div className="ap-tree-graph">
        <TreeGraph
          rows={rows}
          selected={selected}
          onSelect={(id) => {
            setPop(null);
            setSelected((cur) => (cur === id ? null : id));
          }}
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
            Arraste para explorar
          </p>
        )}
        {!view.open && <p className="ap-tg-closed">Abre depois do 1º colapso</p>}
      </div>

      <header className="ap-th">
        <div className="ap-tr-bar">
          <button type="button" className="ap-tr-back" data-tut="page-close" aria-label="Fechar Árvore de Habilidades" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Voltar</span>
          </button>
          <p className="ap-tree-frag" aria-live="polite">
            <BoltIcon />
            <b key={view.available}>{formatNumber(view.available)}</b>
            <span>{view.available === 1 ? 'Cintila' : 'Cintilas'}</span>
          </p>
          <div className="ap-tr-acts">
            <button
              type="button"
              className={`ap-tr-ico${pop === 'sources' ? ' is-on' : ''}`}
              aria-label="De onde vêm as Cintilas"
              aria-expanded={pop === 'sources'}
              onClick={() => toggle('sources')}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                <path d="M12 3v12M7 10l5 5 5-5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className={`ap-tr-ico${pop === 'respec' ? ' is-on' : ''}`}
              aria-label="Refazer árvore"
              aria-expanded={pop === 'respec'}
              onClick={() => toggle('respec')}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                <path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
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

      <div className={`ap-tree-sources ap-tr-pop${pop === 'sources' ? ' is-open' : ''}`} inert={pop !== 'sources'}>
        <h3>De onde vêm as Cintilas</h3>
        <p className="ap-tr-sum">
          {formatNumber(view.earned)} ganhas · {formatNumber(view.spent)} gastas
        </p>
        <ul>
          {view.sources.map((s) => (
            <li key={s.id}>
              <span>{s.label}</span>
              <b>{formatNumber(s.value)}</b>
            </li>
          ))}
        </ul>
      </div>

      <div className={`ap-tr-pop ap-tr-pop-respec${pop === 'respec' ? ' is-open' : ''}`} inert={pop !== 'respec'}>
        <section className="ap-respec" aria-labelledby="ap-respec-title">
          <h3 id="ap-respec-title">Refazer árvore</h3>
          <p className="ap-sub">
            {view.respec.can
              ? `Devolve as ${view.respec.refund} ${view.respec.refund === 1 ? 'Cintila gasta' : 'Cintilas gastas'}. Sem custo.`
              : view.respec.spent > 0
                ? 'Só no colapso ou com a vida zerada.'
                : 'Compre um nó para poder refazer.'}
          </p>
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
                  setPop(null);
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

      {row && (
        <div className="ap-tp-wrap">
          <TreePanel row={row} onBuy={buy} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
