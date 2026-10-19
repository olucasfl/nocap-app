import { AtravessaArt, BlocksArt, ColorArt, EcoArt, MixArt, TimeArt } from '@/components/HubArt';
import { Link } from '@tanstack/react-router';
import { WordsHubArt } from '@/games/words/words-art';
import { useQuery } from '@tanstack/react-query';
import { AnimatedText } from '@/components/AnimatedText';
import { MuteButton } from '@/components/MuteButton';
import { RoomBanner } from '@/components/RoomBanner';
import { ThemeButton } from '@/components/ThemeButton';
import { useAuth } from '@/lib/auth';
import {
  bestTenths,
  dailyScoreText,
  fetchStats,
  formatBest,
  type GameId,
  type Stats,
} from '@/lib/stats';
import './hub.css';

/** Recorde do modo Clássico do jogo (os outros modos mostram o recorde na ficha de cada um). */
function bestLabel(stats: Stats | undefined, game: GameId): string {
  if (!stats) return 'JOGUE SEM CONTA';
  const best = bestTenths(stats, game, 'classic');
  if (best <= 0) return 'SEM RECORDE NO CLÁSSICO';
  return `RECORDE CLÁSSICO ${formatBest(game, 'classic', best)}`;
}

/** O recorde do Atravessa!: o da conta (sem conta não há recorde). */
function atravessaBestLabel(stats: Stats | undefined): string {
  if (!stats) return 'JOGUE SEM CONTA';
  const rows = Math.floor(bestTenths(stats, 'atravessa', 'infinito') / 10);
  return rows > 0 ? `RECORDE ${rows} LINHAS` : 'SEM RECORDE AINDA';
}

/** O recorde do Block's: o da conta (sem conta não há recorde). */
function blocksBestLabel(stats: Stats | undefined): string {
  if (!stats) return 'JOGUE SEM CONTA';
  const points = Math.floor(bestTenths(stats, 'blocks', 'classic') / 10);
  return points > 0 ? `RECORDE ${points} PTS` : 'SEM RECORDE AINDA';
}

/** Situação do Daily do jogo hoje, em palavras: jogado (com a nota) ou ainda disponível. */
function dailyStatus(stats: Stats | undefined, game: GameId): string {
  const info = stats?.daily[game];
  if (!info) return 'DAILY SÓ COM CONTA';
  return info.playedToday
    ? `DAILY FEITO · ${dailyScoreText(game, info.totalScore ?? 0)}`
    : 'DAILY DISPONÍVEL';
}

export function Hub() {
  const user = useAuth((s) => s.user);
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    enabled: !!user,
    retry: false,
  });
  const data = user ? stats.data : undefined;

  return (
    <main className="hub">
      <header className="top">
        <div className="logo hub-logo">
          no cap<span>!</span>
        </div>
        <div className="top-actions">
          <ThemeButton />
          <MuteButton />
        </div>
      </header>

      <RoomBanner />

      <h1 className="hub-title">
        <AnimatedText lines={['O que vai', 'ser hoje?']} />
      </h1>

      <div className="hub-grid">
        <Link to="/words" className="hub-card hub-card-words" data-sfx="start">
          <div className="hub-art">
            <WordsHubArt />
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name">Word&apos;s</div>
            <div className="mono hub-card-meta">JOGOS DE PALAVRAS</div>
            <div className="mono hub-card-meta">{dailyStatus(data, 'wclassic')}</div>
          </div>
        </Link>

        <Link to="/blocks" className="hub-card hub-card-blocks" data-sfx="start">
          <div className="hub-art">
            <BlocksArt />
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name">Block&apos;s</div>
            <div className="mono hub-card-meta">JOGOS DE BLOCOS</div>
            <div className="mono hub-card-meta">{blocksBestLabel(data)}</div>
          </div>
        </Link>

        <Link to="/tempo" className="hub-card hub-card-time" data-sfx="start">
          <div className="hub-art">
            <TimeArt />
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name mid">Já Deu?</div>
            <div className="mono hub-card-meta">{bestLabel(data, 'time')}</div>
            <div className="mono hub-card-meta">{dailyStatus(data, 'time')}</div>
          </div>
        </Link>

        <Link to="/atravessa" className="hub-card hub-card-atravessa" data-sfx="start">
          <div className="hub-art">
            <AtravessaArt />
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name long">Atravessa!</div>
            <div className="mono hub-card-meta">PULE E DESVIE SEM PARAR</div>
            <div className="mono hub-card-meta">{atravessaBestLabel(data)}</div>
          </div>
        </Link>

        <Link to="/cor" className="hub-card hub-card-color" data-sfx="start">
          <div className="hub-art">
            <ColorArt />
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name long">Mesmíssima</div>
            <div className="mono hub-card-meta">{bestLabel(data, 'color')}</div>
            <div className="mono hub-card-meta">{dailyStatus(data, 'color')}</div>
          </div>
        </Link>

        <Link to="/eco" className="hub-card hub-card-eco" data-sfx="start">
          <div className="hub-art">
            <EcoArt />
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name">Ecooo</div>
            <div className="mono hub-card-meta">{bestLabel(data, 'eco')}</div>
            <div className="mono hub-card-meta">{dailyStatus(data, 'eco')}</div>
          </div>
        </Link>

        <Link to="/nocap" className="hub-card hub-card-mix" data-sfx="start">
          <div className="hub-art">
            <MixArt />
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name mid">Mix Nocap</div>
            <div className="mono hub-card-meta">JOGUE COM AMIGOS</div>
            <div className="mono hub-card-meta">2 A 12 PESSOAS · SÓ EM SALA</div>
          </div>
        </Link>

        <div className="hub-more mono">+ MAIS JOGOS EM BREVE</div>
      </div>
    </main>
  );
}
