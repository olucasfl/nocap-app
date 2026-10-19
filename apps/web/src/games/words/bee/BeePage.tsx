import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BackButton } from '@/components/BackButton';
import { PlayGate } from '@/components/PlayGate';
import { useAuth } from '@/lib/auth';
import { fetchStats } from '@/lib/stats';
import { fetchBeeDaily } from './bee-api';
import '../classic.css';

/** A página do Bee Word's: o Daily do favo e o ranking. */
export function BeePage() {
  const user = useAuth((s) => s.user);
  const daily = useQuery({ queryKey: ['words', 'bee', 'daily'], queryFn: fetchBeeDaily, enabled: !!user, retry: false });
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user, retry: false });
  const streak = stats.data?.daily.wbee;
  const run = daily.data?.run;

  const state = !user
    ? 'Entre para jogar o Daily'
    : !daily.data
      ? 'Carregando...'
      : !run
        ? 'Jogar'
        : run.closed
          ? `Fechado · ${run.rank.name} · ${run.points} pontos`
          : `Continuar · ${run.rank.name} · ${run.found.length} palavras`;

  return (
    <div className="app">
      <main className="screen cw">
        <header className="cw-top">
          <BackButton to="/words" />
          <div className="cw-title">Bee Word&apos;s</div>
          <span />
        </header>
        <PlayGate what="jogar">
          <div className="wp-list">
            <Link to="/words/bee/jogar" className="wp-card daily" data-sfx="start">
              <div className="wp-name">Daily{daily.data ? ` #${daily.data.number}` : ''}</div>
              <div className="mono wp-meta">{state}</div>
              <div className="mono wp-meta">Forme palavras com 7 letras · aberto até a meia-noite</div>
              {streak && <div className="mono wp-meta">Sequência {streak.current} · melhor {streak.best}</div>}
            </Link>
            <Link to="/words/bee/jogar" search={{ tipo: 'livre' }} className="wp-card" data-sfx="start">
              <div className="wp-name">Jogar quando quiser</div>
              <div className="mono wp-meta">Um favo novo a qualquer hora · sem ranking</div>
            </Link>
            <Link to="/ranking" search={{ jogo: 'wbee', modo: 'daily' }} className="wp-card">
              <div className="wp-name">Ranking do Daily</div>
              <div className="mono wp-meta">Chegar ao Gênio dá nota 10</div>
            </Link>
            <div className="wp-card">
              <div className="wp-name">Como jogar</div>
              <ul className="wp-rules">
                <li>Use as 7 letras; toda palavra tem a letra do centro e 4 letras ou mais.</li>
                <li>4 letras valem 1 ponto; as maiores valem o tamanho. Pangrama (as 7 letras) soma 7.</li>
                <li>Sem acento: digite &quot;acao&quot; e o jogo mostra &quot;ação&quot;.</li>
              </ul>
            </div>
          </div>
        </PlayGate>
      </main>
    </div>
  );
}
