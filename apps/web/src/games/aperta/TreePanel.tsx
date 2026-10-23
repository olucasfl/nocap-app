import type { TreeNodeRow } from './tree-logic';

interface Props {
  row: TreeNodeRow | null;
  onBuy: (id: string) => void;
  onClose: () => void;
}

const STATUS_TEXT: Record<TreeNodeRow['status'], string> = {
  owned: 'Comprado no nível máximo',
  buyable: 'Dá para comprar agora',
  short: 'Faltam Cintilas',
  blocked: 'Bloqueado: compre o pré-requisito',
  closed: 'A árvore abre depois do 1º colapso',
  soon: 'Ainda não existe no jogo',
};

/** Painel do nó (embaixo do grafo no celular, ao lado no PC): o que faz, o que muda no próximo nível e o botão de comprar. */
export function TreePanel({ row, onBuy, onClose }: Props) {
  if (!row) {
    return (
      <aside className="ap-tp is-empty" aria-label="Detalhe do nó">
        <p className="ap-sub">Toque numa estrela para ver o que ela faz e quanto custa.</p>
      </aside>
    );
  }
  const can = row.status === 'buyable';
  const maxed = row.level >= row.maxLevel;
  return (
    <aside className={`ap-tp is-${row.status}`} aria-label={`Detalhe: ${row.name}`}>
      <header>
        <div>
          <small>
            {row.branchName} · tier {row.tier}
          </small>
          <h3>{row.name}</h3>
        </div>
        <button type="button" className="ap-tp-close" onClick={onClose} aria-label="Fechar o detalhe do nó">
          Fechar
        </button>
      </header>
      <p className="ap-tp-text">{row.text}</p>
      <dl className="ap-tp-facts">
        <div>
          <dt>Nível</dt>
          <dd>
            {row.level} de {row.maxLevel}
          </dd>
        </div>
        <div>
          <dt>{maxed ? 'Custo' : 'Próximo nível'}</dt>
          <dd>{maxed ? 'pago' : `${row.cost} ${row.cost === 1 ? 'Cintila' : 'Cintilas'}`}</dd>
        </div>
      </dl>
      {row.nowText && (
        <p className="ap-tp-now">
          <b>Agora:</b> {row.nowText}
        </p>
      )}
      {row.nextText && (
        <p className="ap-tp-next">
          <b>{row.owned ? 'No próximo nível:' : 'Ao comprar:'}</b> {row.nextText}
        </p>
      )}
      {row.parents.length > 0 && (
        <p className="ap-tp-parents">
          <b>Pré-requisitos:</b>{' '}
          {row.parents.map((p, i) => (
            <span key={p.id} className={p.owned ? 'is-have' : 'is-miss'}>
              {i > 0 ? ', ' : ''}
              {p.name} ({p.owned ? 'ok' : 'falta'})
            </span>
          ))}
        </p>
      )}
      <p className="ap-tp-status" role="status">
        {row.status === 'short'
          ? `Faltam ${row.missing} ${row.missing === 1 ? 'Cintila' : 'Cintilas'}.`
          : row.status === 'blocked'
            ? `Compre antes: ${row.needs.join(', ')}.`
            : row.status === 'soon'
              ? `${row.soonHint ?? 'Chega em uma atualização'}.`
              : STATUS_TEXT[row.status]}
      </p>
      {!maxed && (
        <button type="button" className="ap-tp-buy" disabled={!can} onClick={() => can && onBuy(row.id)}>
          {can ? `Comprar · ${row.cost}` : row.status === 'short' ? `Falta ${row.missing}` : row.status === 'soon' ? 'Em breve' : 'Indisponível'}
        </button>
      )}
    </aside>
  );
}
