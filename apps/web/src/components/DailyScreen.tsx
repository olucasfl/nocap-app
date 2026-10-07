import { useQuery } from '@tanstack/react-query';
import { dailyDate } from '@nocap/games';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/network';
import { dailyMax, fetchStats, streakLabel, type GameId } from '@/lib/stats';
import { BackButton } from './BackButton';
import { DailyPanel } from './DailyPanel';
import { GameArt, GAME_LABEL } from './GameArt';
import { ArrowRight } from './icons';
import { PlayGate } from './PlayGate';
import './daily-screen.css';

/**
 * A tela do Daily, separada dos outros modos. Quem ainda não jogou hoje vê o convite (e quantas
 * pessoas já jogaram); quem já jogou vê o resultado do dia e toda a parte social. Os dois casos
 * mostram o painel do dia: sair e voltar ao Daily sempre cai aqui, já com "você já jogou".
 */
export function DailyScreen({
  game,
  busy,
  error,
  onPlay,
  onBack,
}: {
  game: GameId;
  busy?: boolean;
  error?: string;
  onPlay: () => void;
  onBack: () => void;
}) {
  const user = useAuth((s) => s.user);
  const online = useOnline();
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const info = stats.data?.daily[game];
  const [, mm, dd] = dailyDate().split('-');
  const played = !!info?.playedToday;

  return (
    <section className="screen ds">
      <BackButton to="/" label="Jogos" onClick={onBack} />
      <header className="ds-head">
        <GameArt game={game} />
        <div>
          <div className="mono ds-kicker">
            DAILY · {dd}/{mm}
          </div>
          <h1 className="ds-title">{GAME_LABEL[game]}</h1>
        </div>
      </header>

      {played && info ? (
        <section className="ds-done" aria-label="Você já jogou o Daily de hoje">
          <div className="mono ds-done-tag">VOCÊ JÁ JOGOU HOJE</div>
          <div className="ds-score">
            {((info.totalScore ?? 0) / 10).toFixed(1)}
            <small className="mono">/{dailyMax(game)}</small>
          </div>
          <p className="ds-text">
            Volte amanhã para manter a sequência
            {info.current > 0 ? ` (${streakLabel(info.current)} seguidos)` : ''}.
          </p>
        </section>
      ) : (
        <section className="ds-play">
          <p className="ds-text">
            Uma partida por dia, com {game === 'color' ? 'as mesmas cores' : 'os mesmos alvos'} para
            todo mundo. Sua nota entra no ranking do dia.
          </p>
          {error && (
            <p className="acc-failure mono" role="alert">
              {error}
            </p>
          )}
          {!online ? (
            <p className="ds-text">Você está sem internet. O Daily só vale online.</p>
          ) : (
            <PlayGate what="jogar o Daily">
              <button
                type="button"
                className="btn alt"
                data-sfx="start"
                disabled={busy}
                onClick={onPlay}
              >
                {busy ? 'Preparando...' : 'Jogar o Daily'} <ArrowRight />
              </button>
            </PlayGate>
          )}
        </section>
      )}

      <DailyPanel game={game} />
    </section>
  );
}
