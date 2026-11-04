import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { FS_MATCH_BOTS, FS_MATCH_MINUTES, FS_POINTS, fsMatchConfig, type FsMatchConfig } from '@nocap/games';
import { FoxShotTestPage } from './FoxShotTestPage';
import './foxshot.css';

const KEY = 'nocap-fs-match';
function saved(): FsMatchConfig {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { minutes?: number; bots?: number };
    return fsMatchConfig(p.minutes ?? 5, p.bots ?? FS_MATCH_BOTS.default);
  } catch {
    return fsMatchConfig(5, FS_MATCH_BOTS.default);
  }
}

/** Counter Fox: prepara a partida (minutos e bots) e entra no mapa Duna (spec 057). */
export function CounterFoxPage() {
  const [cfg, setCfg] = useState<FsMatchConfig>(saved);
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);

  const start = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
    } catch {
      /* sem armazenamento: só não lembra da escolha */
    }
    setRun((r) => r + 1);
    setPlaying(true);
  };

  if (playing) return <FoxShotTestPage key={run} match={cfg} onExit={() => setPlaying(false)} onAgain={() => setRun((r) => r + 1)} />;
  return (
    <main className="cfx" data-testid="cfx-setup">
      <div className="cfx-card">
        <header>
          <span className="mono">Counter Fox</span>
          <h1>Mata-mata no Duna</h1>
        </header>
        <p className="cfx-rule mono">
          Abate = {FS_POINTS.kill} pontos · Assistência = {FS_POINTS.assist} pontos · Quem fizer mais pontos até o tempo acabar vence.
        </p>
        <fieldset>
          <legend>Duração</legend>
          <div className="cfx-opts" role="radiogroup" aria-label="Duração da partida">
            {FS_MATCH_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={cfg.minutes === m}
                className={cfg.minutes === m ? 'on' : ''}
                onClick={() => setCfg(fsMatchConfig(m, cfg.bots))}
                data-testid={`cfx-min-${m}`}
              >
                {m} min
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Bots ({cfg.bots + 1} jogadores com você)</legend>
          <div className="cfx-opts bots" role="radiogroup" aria-label="Quantidade de bots">
            {Array.from({ length: FS_MATCH_BOTS.max - FS_MATCH_BOTS.min + 1 }, (_, i) => i + FS_MATCH_BOTS.min).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={cfg.bots === n}
                className={cfg.bots === n ? 'on' : ''}
                onClick={() => setCfg(fsMatchConfig(cfg.minutes, n))}
                data-testid={`cfx-bots-${n}`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="cfx-actions">
          <Link to="/fox-cap" className="btn ghost">
            Voltar
          </Link>
          <button type="button" className="btn" onClick={start} data-testid="cfx-start">
            Jogar
          </button>
        </div>
      </div>
    </main>
  );
}
