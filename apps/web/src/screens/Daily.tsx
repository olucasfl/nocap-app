import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { dailyDate } from '@nocap/games';
import { GameArt, GAME_LABEL } from '@/components/GameArt';
import { PlayGate } from '@/components/PlayGate';
import { Choice, RankingList } from '@/components/RankingList';
import { useAuth } from '@/lib/auth';
import { PERIODS, SCOPES, fetchRanking, type Game, type Period, type Scope } from '@/lib/ranking';
import { dailyMax, fetchStats, streakLabel, type DailyInfo } from '@/lib/stats';
import './daily.css';
import './ranking.css';

const GAMES: { id: Game; label: string }[] = [
  { id: 'color', label: 'Cor' },
  { id: 'time', label: 'Tempo' },
];

function DailyCard({ game, info }: { game: Game; info: DailyInfo | undefined }) {
  const done = !!info?.playedToday;
  return (
    <li className={`dl-card ${game}`}>
      <GameArt game={game} />
      <div className="dl-body">
        <div className="dl-name">{GAME_LABEL[game]}</div>
        {done ? (
          <div className="mono dl-status done">
            FEITO · {((info?.totalScore ?? 0) / 10).toFixed(1)}/{dailyMax(game)}
          </div>
        ) : (
          <div className="mono dl-status">AINDA NÃO JOGADO HOJE</div>
        )}
        {info && (
          <div className="mono dl-streak">SEQUÊNCIA {streakLabel(info.current).toUpperCase()}</div>
        )}
      </div>
      {!done && (
        <Link
          to={game === 'color' ? '/cor' : '/tempo'}
          search={{ modo: 'daily' }}
          className="dl-go"
        >
          JOGAR
        </Link>
      )}
    </li>
  );
}

/**
 * O Daily é um jogo especial: uma partida de Cor e uma de Tempo por dia, iguais para todo mundo,
 * com ranking próprio (hoje, semana e sempre somam os dias jogados).
 */
export function Daily() {
  const user = useAuth((s) => s.user);
  const [, mm, dd] = dailyDate().split('-');
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const [game, setGame] = useState<Game>('color');
  const [period, setPeriod] = useState<Period>('day');
  const [scope, setScope] = useState<Scope>('all');

  const ranking = useQuery({
    queryKey: ['ranking', game, 'daily', period, scope, user?.id ?? null],
    queryFn: () => fetchRanking(game, 'daily', period, scope),
  });

  return (
    <main className="dl">
      <header>
        <div className="mono dl-kicker">
          DAILY · {dd}/{mm}
        </div>
        <h1>Daily</h1>
        <p className="lead">
          Uma partida de cada jogo por dia, com as mesmas cores e os mesmos alvos para todo mundo.
        </p>
      </header>

      <PlayGate what="jogar o Daily">
        <ul className="dl-list">
          <DailyCard game="color" info={stats.data?.daily.color} />
          <DailyCard game="time" info={stats.data?.daily.time} />
        </ul>
      </PlayGate>

      <section className="dl-rank" aria-label="Ranking do Daily">
        <h2 className="mono dl-h2">RANKING DO DAILY</h2>
        <Choice label="Jogo" value={game} options={GAMES} onChange={setGame} />
        <Choice label="Período" value={period} options={PERIODS} onChange={setPeriod} columns={3} />
        {user && <Choice label="Quem aparece" value={scope} options={SCOPES} onChange={setScope} />}
        <p className="mono dl-note">
          {period === 'day'
            ? 'NOTA DO DAILY DE HOJE'
            : 'SOMA DOS PONTOS DOS DAILYS DO PERÍODO (UM POR DIA)'}
        </p>
        <RankingList
          query={ranking}
          max={period === 'day' ? dailyMax(game) : 0}
          showDays={period !== 'day'}
          loggedIn={!!user}
          empty={
            scope === 'friends'
              ? 'Nem você nem seus amigos jogaram o Daily neste período.'
              : 'Ninguém jogou o Daily neste período ainda.'
          }
        />
      </section>
    </main>
  );
}
