import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NewRecord } from '@/components/NewRecord';
import { useAuth, useIsGuest } from '@/lib/auth';
import {
  compareToBest,
  meterPercents,
  scoreUnit,
  scoreValue,
  verdictText,
} from '@/lib/match-summary';
import {
  PERIODS,
  fetchRanking,
  neighborsOf,
  type Board,
  type Game,
  type Period,
} from '@/lib/ranking';
import { formatBest } from '@/lib/stats';
import './match-summary.css';

const PERIOD_WORD: Record<Period, string> = { day: 'hoje', week: 'na semana', all: 'de sempre' };

/** Diferença de nota em palavras do jogo: pontos com uma casa, ou contagem inteira. */
const gap = (game: Game, mode: string, tenths: number) =>
  scoreValue(game, mode, mode === 'survival' || game === 'eco' ? Math.max(10, tenths) : tenths);

/** Onde a nota desta partida cai no ranking, com abas de período para mexer. */
function RankingPeek({
  game,
  mode,
  scoreTenths,
  saved,
  onRanking,
}: {
  game: Game;
  mode: Board;
  scoreTenths: number;
  saved: boolean;
  onRanking: () => void;
}) {
  const user = useAuth((s) => s.user);
  const [period, setPeriod] = useState<Period>('week');
  const q = useQuery({
    queryKey: ['ranking', game, mode, period, 'all', user?.id ?? null],
    queryFn: () => fetchRanking(game, mode, period, 'all'),
    // Só depois de salvar: antes disso a partida ainda não conta.
    enabled: saved && !!user,
  });
  const entries = q.data?.entries ?? [];
  const me = q.data?.me ?? entries.find((e) => e.isMe) ?? null;
  const near = neighborsOf(entries);
  const top = entries.slice(0, 3);
  const unit = scoreUnit(game, mode);

  return (
    <section className="sum-rank" aria-label="Seu lugar no ranking">
      <div className="sum-rank-head">
        <span className="mono sum-label">SEU LUGAR NO RANKING</span>
        <div className="sum-seg" role="radiogroup" aria-label="Período">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              data-sfx="select"
              aria-checked={period === p.id}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!saved || q.isPending ? (
        <p className="mono sum-hint">
          {saved ? 'Carregando o ranking...' : 'Salvando a partida...'}
        </p>
      ) : q.isError ? (
        <p className="mono sum-hint">Não deu para carregar o ranking agora.</p>
      ) : (
        <>
          <div className="sum-rank-main">
            <b className="sum-rank-pos">{me ? `${me.rank}º` : '-'}</b>
            <span className="sum-rank-text">
              {me ? (
                <>
                  <b>
                    de {q.data!.total} {PERIOD_WORD[period]}
                  </b>
                  <span className="mono">
                    {me.rank === 1
                      ? 'Você está em primeiro. Segure a coroa!'
                      : near.above
                        ? `Faltam ${gap(game, mode, near.above.gap)} ${unit.startsWith('/') ? 'pts' : unit} para passar @${near.above.username}`
                        : ''}
                  </span>
                  <span className="mono">
                    {me.score === scoreTenths
                      ? 'Esta partida é a sua melhor do período.'
                      : `Sua melhor do período: ${scoreValue(game, mode, me.score)}${unit.startsWith('/') ? unit : ` ${unit}`}`}
                  </span>
                </>
              ) : (
                <b>Você ainda não aparece neste período</b>
              )}
            </span>
          </div>
          {top.length > 0 && (
            <ol className="sum-top" aria-label="Três primeiros">
              {top.map((e) => (
                <li key={e.username} className={e.isMe ? 'me' : ''}>
                  <span className="mono">{e.rank}º</span>
                  <span className="sum-top-name">@{e.username}</span>
                  <b>{scoreValue(game, mode, e.score)}</b>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      <button type="button" className="btn ghost" data-sfx="select" onClick={onRanking}>
        Ver ranking completo
      </button>
    </section>
  );
}

/**
 * O fim da partida em números: a nota desta partida lado a lado com o recorde, uma barra que mostra
 * a diferença, o aviso de recorde quando houver e onde a nota cai no ranking (com abas de período).
 * Não vale para o Daily, que não tem recorde (o Daily mostra o ranking do dia).
 */
export function MatchSummary({
  game,
  mode,
  scoreTenths,
  previousBest,
  saved,
  onRanking,
}: {
  game: Game;
  mode: Board;
  /** Nota desta partida em décimos (nas contagens, 10 por rodada ou passo). */
  scoreTenths: number;
  /** Recorde do modo antes desta partida (décimos); `undefined` = sem estatísticas. */
  previousBest?: number;
  /** A partida já foi salva no servidor (o ranking só conta depois). */
  saved: boolean;
  onRanking: () => void;
}) {
  const guest = useIsGuest();
  const c = compareToBest(previousBest, scoreTenths);
  const bars = meterPercents(game, mode, scoreTenths, c.best);
  const unit = scoreUnit(game, mode);
  const withSlash = unit.startsWith('/');

  // Sem conta não há recorde, nem ranking, nem "novo recorde": só a nota desta partida.
  if (guest) {
    return (
      <section className="sum sum-flat" aria-label="Sua nota">
        <div className="sum-pair">
          <div className="sum-cell now">
            <span className="mono sum-label">ESTA PARTIDA</span>
            <b>
              {scoreValue(game, mode, scoreTenths)}
              <small className="mono">{withSlash ? unit : ` ${unit}`}</small>
            </b>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {c.verdict === 'record' && (
        <NewRecord
          now={formatBest(game, mode, scoreTenths)}
          before={formatBest(game, mode, previousBest!)}
        />
      )}
      <section className={`sum sum-${c.verdict}`} aria-label="Sua nota e o seu recorde">
        <div className="sum-pair">
          <div className="sum-cell now">
            <span className="mono sum-label">ESTA PARTIDA</span>
            <b>
              {scoreValue(game, mode, scoreTenths)}
              <small className="mono">{withSlash ? unit : ` ${unit}`}</small>
            </b>
          </div>
          <div className="sum-cell best">
            <span className="mono sum-label">SEU RECORDE</span>
            <b>
              {scoreValue(game, mode, c.best)}
              <small className="mono">{withSlash ? unit : ` ${unit}`}</small>
            </b>
          </div>
        </div>
        <div className="sum-meter" aria-hidden="true">
          <i className="sum-fill" style={{ width: `${bars.now}%` }} />
          <i className="sum-mark" style={{ left: `${bars.best}%` }} />
        </div>
        <p className="mono sum-verdict" role="status">
          {verdictText(game, mode, c)}
        </p>
      </section>
      <RankingPeek
        game={game}
        mode={mode}
        scoreTenths={scoreTenths}
        saved={saved}
        onRanking={onRanking}
      />
    </>
  );
}
