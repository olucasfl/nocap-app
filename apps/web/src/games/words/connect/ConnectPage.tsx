import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BackButton } from '@/components/BackButton';
import { PlayGate } from '@/components/PlayGate';
import { useAuth } from '@/lib/auth';
import { fetchStats } from '@/lib/stats';
import { fetchConnectDaily } from './connect-api';
import '../classic.css';

/** A página do Connect Word's: o Daily e as regras. */
export function ConnectPage() {
  const user = useAuth((s) => s.user);
  const daily = useQuery({ queryKey: ['words', 'connect', 'daily'], queryFn: fetchConnectDaily, enabled: !!user, retry: false });
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user, retry: false });
  const streak = stats.data?.daily.wconnect;
  const run = daily.data?.run;

  const state = !user
    ? 'Entre para jogar o Daily'
    : !daily.data
      ? 'Carregando...'
      : !run
        ? 'Jogar'
        : run.over
          ? `Você já jogou hoje · nota ${(run.nota ?? 0).toFixed(1).replace('.', ',')}`
          : `Continuar · ${run.found.length} de 4 grupos`;

  return (
    <div className="app">
      <main className="screen cw">
        <header className="cw-top">
          <BackButton to="/words" />
          <div className="cw-title">Connect Word&apos;s</div>
          <span />
        </header>
        <PlayGate what="jogar">
          <div className="wp-list">
            {run?.over ? (
              <div className="wp-card daily">
                <div className="wp-name">Daily #{daily.data!.number}</div>
                <div className="mono wp-meta">{state}</div>
                <div className="mono wp-meta">O próximo puzzle sai à meia-noite</div>
                {streak && <div className="mono wp-meta">Sequência {streak.current} · melhor {streak.best}</div>}
              </div>
            ) : (
              <Link to="/words/connect/jogar" className="wp-card daily" data-sfx="start">
                <div className="wp-name">Daily{daily.data ? ` #${daily.data.number}` : ''}</div>
                <div className="mono wp-meta">{state}</div>
                <div className="mono wp-meta">16 palavras, 4 grupos · 5 vidas</div>
              </Link>
            )}
            <Link to="/ranking" search={{ jogo: 'wconnect', modo: 'daily' }} className="wp-card">
              <div className="wp-name">Ranking do Daily</div>
              <div className="mono wp-meta">Menos erros, nota maior</div>
            </Link>
            <div className="wp-card">
              <div className="wp-name">Como jogar</div>
              <ul className="wp-rules">
                <li>Separe as 16 palavras em 4 grupos de 4 que têm algo em comum.</li>
                <li>Marque 4 palavras e envie. Cada erro custa 1 de 5 vidas.</li>
                <li>&quot;Falta uma&quot; quer dizer que 3 das 4 palavras são do mesmo grupo.</li>
                <li>Cada puzzle é jogado uma vez só. Cuidado com palavras que servem a dois grupos.</li>
              </ul>
            </div>
          </div>
        </PlayGate>
      </main>
    </div>
  );
}
