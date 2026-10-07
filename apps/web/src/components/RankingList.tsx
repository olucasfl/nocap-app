import { Loader } from './Loader';
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Ranking, RankingEntry } from '@/lib/ranking';
import { streakLabel } from '@/lib/stats';
import '@/screens/ranking.css';

/** Botões de escolha (jogo, quadro, período...) no estilo do app. */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  columns,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  columns?: number;
}) {
  return (
    <div
      className="rk-seg"
      role="radiogroup"
      aria-label={label}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ entry, max, showDays }: { entry: RankingEntry; max: number; showDays: boolean }) {
  return (
    <li className={`rk-row${entry.isMe ? ' me' : ''}`}>
      <span className="mono rk-pos">{entry.rank}</span>
      <span className="rk-name">
        @{entry.username}
        {showDays && entry.days !== undefined && (
          <small className="mono rk-days">{streakLabel(entry.days).toUpperCase()}</small>
        )}
      </span>
      <span className="rk-score">
        {(entry.score / 10).toFixed(1)}
        {max > 0 && <small className="mono">/{max}</small>}
      </span>
    </li>
  );
}

/**
 * Lista de um ranking, com carregando, erro, vazio e a sua posição quando está fora do top.
 * `max`: máximo de pontos de cada linha (0 esconde). Sem conta, avisa que só quem tem conta aparece.
 */
export function RankingList({
  query,
  max,
  showDays = false,
  loggedIn,
  empty,
  footer,
}: {
  query: UseQueryResult<Ranking>;
  /** Máximo de pontos por linha (no Daily somado, depende dos dias: passe 0). */
  max: number;
  showDays?: boolean;
  loggedIn: boolean;
  empty: string;
  footer?: ReactNode;
}) {
  const listed = query.data?.entries ?? [];
  const meOutside = query.data?.me && !listed.some((e) => e.isMe) ? query.data.me : null;

  return (
    <>
      {query.isPending && <Loader inline />}
      {query.isError && (
        <div className="rk-state">
          <p className="lead">Não deu para carregar o ranking. Confira a conexão.</p>
          <button type="button" className="btn ghost" onClick={() => void query.refetch()}>
            Tentar de novo
          </button>
        </div>
      )}
      {query.isSuccess && listed.length === 0 && <p className="lead">{empty}</p>}
      {listed.length > 0 && (
        <ol className="rk-list">
          {listed.map((e) => (
            <Row key={e.username} entry={e} max={max} showDays={showDays} />
          ))}
        </ol>
      )}
      {meOutside && (
        <section aria-label="Sua posição">
          <p className="mono rk-you">SUA POSIÇÃO</p>
          <ol className="rk-list">
            <Row entry={{ ...meOutside, isMe: true }} max={max} showDays={showDays} />
          </ol>
        </section>
      )}
      {query.isSuccess && !loggedIn && (
        <p className="lead rk-note">
          O ranking é só de quem tem conta.{' '}
          <Link to="/criar-conta" className="rk-link">
            Crie a sua
          </Link>{' '}
          para aparecer aqui.
        </p>
      )}
      {footer}
    </>
  );
}
