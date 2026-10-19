import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BackButton } from '@/components/BackButton';
import { PlayGate } from '@/components/PlayGate';
import { useAuth } from '@/lib/auth';
import { fetchDaily, MODE_LABEL, type ClassicMode } from './words-api';
import './classic.css';

const MODES: ClassicMode[] = ['classic', 'dueto', 'quarteto'];

/** A página do Classic Word's: o Daily em destaque e os três modos livres, cada um com as suas regras. */
export function ClassicPage() {
  const user = useAuth((s) => s.user);
  const daily = useQuery({ queryKey: ['words', 'daily'], queryFn: fetchDaily, enabled: !!user, retry: false });
  const run = daily.data?.run;

  const state = !user
    ? 'Entre para jogar o Daily'
    : !daily.data
      ? 'Carregando...'
      : !run
        ? 'Jogar'
        : run.state === 'open'
          ? `Continuar · ${run.used} de ${run.tries} tentativas`
          : `Você já jogou hoje · nota ${(run.nota ?? 0).toFixed(1).replace('.', ',')}`;

  return (
    <div className="app">
      <main className="screen cw">
        <header className="cw-top">
          <BackButton to="/words" />
          <div className="cw-title">Classic Word&apos;s</div>
          <span />
        </header>

        <PlayGate what="jogar">
          <div className="wp-list">
            {run && run.state !== 'open' ? (
              <div className="wp-card daily">
                <div className="wp-name">Daily #{daily.data!.number}</div>
                <div className="mono wp-meta">{state}</div>
                <div className="mono wp-meta">A próxima palavra sai à meia-noite</div>
              </div>
            ) : (
              <Link
                to="/words/classic/jogar"
                search={{ tipo: 'daily', modo: 'classic' }}
                className="wp-card daily"
                data-sfx="start"
              >
                <div className="wp-name">Daily{daily.data ? ` #${daily.data.number}` : ''}</div>
                <div className="mono wp-meta">{state}</div>
                <div className="mono wp-meta">Uma palavra por dia, igual para todos · 6 tentativas</div>
              </Link>
            )}

            {MODES.map((m) => {
              const info = MODE_LABEL[m];
              return (
                <Link
                  key={m}
                  to="/words/classic/jogar"
                  search={{ tipo: 'solo', modo: m }}
                  className="wp-card"
                  data-sfx="start"
                >
                  <div className="wp-name">{info.name}</div>
                  <div className="wp-mini" aria-hidden="true">
                    {Array.from({ length: info.words }, (_, i) => (
                      <i key={i} />
                    ))}
                  </div>
                  <div className="mono wp-meta">{info.tries} tentativas · sem ranking</div>
                  <ul className="wp-rules">
                    <li>Palpites de 5 letras que sejam palavras.</li>
                    <li>
                      {info.words === 1
                        ? 'Verde: letra no lugar certo. Amarelo: existe em outro lugar.'
                        : 'O mesmo palpite vale para todos os tabuleiros; o resolvido trava.'}
                    </li>
                  </ul>
                </Link>
              );
            })}
          </div>
        </PlayGate>
      </main>
    </div>
  );
}
