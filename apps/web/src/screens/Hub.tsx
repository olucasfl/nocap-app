import { ArrowRight } from '@/components/icons';
import { BlocksArt, ColorArt, EcoArt, SinalArt, TimeArt } from '@/components/HubArt';
import { PartyArt } from '@/components/PartyArt';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatedText } from '@/components/AnimatedText';
import { MuteButton } from '@/components/MuteButton';
import { RoomBanner } from '@/components/RoomBanner';
import { ThemeButton } from '@/components/ThemeButton';
import { useAuth } from '@/lib/auth';
import { getBlocksBest } from '@/games/blocks/storage';
import { getSinalBest } from '@/games/sinal/storage';
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
  if (!stats) return 'ENTRE PARA JOGAR';
  const best = bestTenths(stats, game, 'classic');
  if (best <= 0) return 'SEM RECORDE NO CLÁSSICO';
  return `RECORDE CLÁSSICO ${formatBest(game, 'classic', best)}`;
}

/** O recorde do Sinal Vermelho: o da conta (servidor) ou, sem conta, o deste aparelho. */
function sinalBestLabel(stats: Stats | undefined): string {
  const server = Math.max(
    bestTenths(stats, 'sinal', 'infinito'),
    bestTenths(stats, 'sinal', 'classico'),
  );
  const meters = Math.max(Math.floor(server / 10), Math.floor(Math.max(getSinalBest('infinito'), getSinalBest('classico'))));
  return meters > 0 ? `RECORDE ${meters} M` : 'SEM RECORDE AINDA';
}

/** O recorde do Block's: o da conta (servidor) ou, sem conta, o deste aparelho. */
function blocksBestLabel(stats: Stats | undefined): string {
  const points = Math.max(Math.floor(bestTenths(stats, 'blocks', 'classic') / 10), getBlocksBest());
  return points > 0 ? `RECORDE ${points} PTS` : 'SEM RECORDE AINDA';
}

/** Situação do Daily do jogo hoje, em palavras: jogado (com a nota) ou ainda disponível. */
function dailyStatus(stats: Stats | undefined, game: GameId): string {
  const info = stats?.daily[game];
  if (!info) return 'DAILY DISPONÍVEL';
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
        <Link to="/nocap" className="hub-card hub-card-party" data-sfx="start">
          <span className="hub-tag">PARA JOGAR COM AMIGOS</span>
          <div className="hub-party-text">
            <div className="hub-card-name party">NoCap!</div>
            <p className="hub-party-lead">
              O jogo que une tudo do app: cores, tempo, sequências, digitação e minijogos, todo
              mundo disputando ao vivo na mesma sala.
            </p>
            <div className="mono hub-card-meta">2 A 12 PESSOAS · SÓ EM SALA</div>
            <span className="hub-cta">
              Jogar com amigos <ArrowRight size={20} />
            </span>
          </div>
          <PartyArt />
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

        <Link to="/sinal" className="hub-card hub-card-sinal" data-sfx="start">
          <div className="hub-art">
            <SinalArt />
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name long">Sinal Vermelho</div>
            <div className="mono hub-card-meta">CORRA SEM SER VISTO</div>
            <div className="mono hub-card-meta">{sinalBestLabel(data)}</div>
          </div>
        </Link>

        <div className="hub-more mono">+ MAIS JOGOS EM BREVE</div>
      </div>
    </main>
  );
}
