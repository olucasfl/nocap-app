import { useState } from 'react';
import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import { formatNumber, type SaveState } from '@nocap/games';
import { AstroMedal } from './AstroMedal';
import { treeView, type TreeNodeRow } from './tree-logic';
import './tree.css';

interface Props {
  state: SaveState;
  onBuy: (nodeId: string) => boolean | void;
  onRespec: () => boolean | void;
}

function nodeLabel(n: TreeNodeRow, branch: string): string {
  const base = `${branch}, ${n.name} (${n.level} de ${n.maxLevel}): ${n.text}`;
  switch (n.status) {
    case 'owned':
      return `${base}. Comprado`;
    case 'buyable':
      return `${base}. Comprar por ${n.cost} Cintilas`;
    case 'short':
      return `${base}. Falta ${n.missing} Cintilas`;
    case 'blocked':
      return `${base}. Compre antes: ${n.needs.join(', ')}`;
    case 'soon':
      return `${base}. Chega em uma atualização`;
    case 'closed':
      return `${base}. Abre depois do primeiro colapso`;
  }
}

function nodeButton(n: TreeNodeRow): string {
  switch (n.status) {
    case 'owned':
      return 'Comprado';
    case 'buyable':
      return `Comprar · ${n.cost}`;
    case 'short':
      return `Falta ${n.missing}`;
    case 'soon':
      return 'Em breve';
    default:
      return `Custo ${n.cost}`;
  }
}

/** Corpo da página da Árvore de Habilidades (spec 038, 3.5; moeda da spec 040): versão provisória em lista (a árvore em grafo é a etapa 18): 5 ramos de 24 nós e o refazer em 2 passos. */
export function TreePage({ state, onBuy, onRespec }: Props) {
  const view = treeView(state);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="ap-tree">
      <p className="ap-tree-frag" aria-live="polite">
        <b>{formatNumber(view.available)}</b>
        <span>{view.available === 1 ? 'Cintila' : 'Cintilas'} para gastar</span>
        <small>
          {formatNumber(view.earned)} ganhas · {formatNumber(view.spent)} gastas
        </small>
      </p>
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

      <ul className="ap-tree-grid" aria-label="Ramos da árvore">
        {view.branches.map((b) => (
          <li key={b.id} className={`ap-branch${b.owned >= b.total ? ' is-full' : ''}${view.open ? '' : ' is-closed'}`}>
            <header>
              <span className="ap-branch-medal">
                <AstroMedal astro={b.astro} />
              </span>
              <h3>{b.name}</h3>
              <small>{b.owned} de {b.total}</small>
            </header>
            <ol>
              {b.nodes.map((n) => (
                <li key={n.id} className={`ap-node is-${n.status}`}>
                  <p>
                    <b>{n.name}</b>
                    <span>
                      {n.maxLevel > 1 ? `Nível ${n.level} de ${n.maxLevel}. ` : ''}
                      {n.text}
                    </span>
                  </p>
                  <button
                    type="button"
                    className="ap-node-buy"
                    aria-label={nodeLabel(n, b.name)}
                    aria-disabled={n.status !== 'buyable'}
                    onClick={() => {
                      if (n.status === 'buyable') {
                        if (onBuy(n.id)) {
                          apertaSfx.thunk();
                          apertaVibrate(14);
                        }
                      } else if (n.status === 'short') {
                        apertaSfx.boing();
                        apertaVibrate([10, 40, 10]);
                      }
                    }}
                  >
                    {nodeButton(n)}
                  </button>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>

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
