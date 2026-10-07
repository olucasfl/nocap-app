import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { GameArt, GAME_LABEL } from '@/components/GameArt';
import { Choice, RankingList } from '@/components/RankingList';
import { useAuth } from '@/lib/auth';
import {
  PERIODS,
  SCOPES,
  boardMax,
  boardsOf,
  fetchRanking,
  type Board,
  type Game,
  type Period,
  type Scope,
} from '@/lib/ranking';
import './ranking.css';

/** O ranking de UM jogo, dentro dele: só os quadros daquele jogo (o Daily tem o seu na tela do Daily). */
export function GameRanking({ game }: { game: Game }) {
  const user = useAuth((s) => s.user);
  const [board, setBoard] = useState<Board>('classic');
  const [period, setPeriod] = useState<Period>('week');
  const [scope, setScope] = useState<Scope>('all');

  const query = useQuery({
    queryKey: ['ranking', game, board, period, scope, user?.id ?? null],
    queryFn: () => fetchRanking(game, board, period, scope),
  });

  return (
    <main className="rk">
      <header className="rk-head">
        <GameArt game={game} size="sm" />
        <div>
          <div className="mono rk-kicker">RANKING</div>
          <h1 className="rk-title">{GAME_LABEL[game]}</h1>
        </div>
      </header>
      <Link to={game === 'color' ? '/cor' : '/tempo'} className="rk-back mono">
        VOLTAR PARA {GAME_LABEL[game].toUpperCase()}
      </Link>
      {user && (
        <Choice label="Quem aparece" value={scope} options={SCOPES} onChange={setScope} />
      )}
      <Choice label="Modo" value={board} options={boardsOf(game)} onChange={setBoard} columns={3} />
      <Choice label="Período" value={period} options={PERIODS} onChange={setPeriod} columns={3} />
      <RankingList
        query={query}
        max={boardMax(game, board)}
        loggedIn={!!user}
        empty={
          scope === 'friends'
            ? 'Nem você nem seus amigos jogaram esse modo neste período.'
            : 'Ninguém jogou esse modo neste período. Seja a primeira pessoa.'
        }
      />
    </main>
  );
}

export const ColorRankingPage = () => <GameRanking game="color" />;
export const TimeRankingPage = () => <GameRanking game="time" />;
