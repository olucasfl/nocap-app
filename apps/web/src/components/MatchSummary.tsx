import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NewRecord } from '@/components/NewRecord';
import { useAuth } from '@/lib/auth';
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
    <section className="ms-rank" aria-label="Seu lugar no ranking">
      <div className="ms-rank-head">
        <span className="mono ms-label">SEU LUGAR NO RANKING</span>
        <div className="ms-seg" role="radiogroup" aria-label="Período">
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
        <p className="mono ms-hint">
          {saved ? 'Carregando o ranking...' : 'Salvando a partida...'}
        </p>
      ) : q.isError ? (
        <p className="mono ms-hint">Não deu para carregar o ranking agora.</p>
      ) : (
        <>
          <div className="ms-rank-main">
            <b className="ms-rank-pos">{me ? `${me.rank}º` : '-'}</b>
            <span className="ms-rank-text">
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
            <ol className="ms-top" aria-label="Três primeiros">
              {top.map((e) => (
                <li key={e.username} className={e.isMe ? 'me' : ''}>
                  <span className="mono">{e.rank}º</span>
                  <span className="ms-top-name">@{e.username}</span>
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
  const c = compareToBest(previousBest, scoreTenths);
  const bars = meterPercents(game, mode, scoreTenths, c.best);
  const unit = scoreUnit(game, mode);
  const withSlash = unit.startsWith('/');

  return (
    <>
      {c.verdict === 'record' && (
        <NewRecord
          now={formatBest(game, mode, scoreTenths)}
          before={formatBest(game, mode, previousBest!)}
        />
      )}
      <section className={`ms ms-${c.verdict}`} aria-label="Sua nota e o seu recorde">
        <div className="ms-pair">
          <div className="ms-cell now">
            <span className="mono ms-label">ESTA PARTIDA</span>
            <b>
              {scoreValue(game, mode, scoreTenths)}
              <small className="mono">{withSlash ? unit : ` ${unit}`}</small>
            </b>
          </div>
          <div className="ms-cell best">
            <span className="mono ms-label">SEU RECORDE</span>
            <b>
              {scoreValue(game, mode, c.best)}
              <small className="mono">{withSlash ? unit : ` ${unit}`}</small>
            </b>
          </div>
        </div>
        <div className="ms-meter" aria-hidden="true">
          <i className="ms-fill" style={{ width: `${bars.now}%` }} />
          <i className="ms-mark" style={{ left: `${bars.best}%` }} />
        </div>
        <p className="mono ms-verdict" role="status">
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
