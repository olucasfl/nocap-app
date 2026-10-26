import { useState } from 'react';
import { BOL_TEAM_COLORS, BOL_TEAM_NAMES } from '@nocap/games';
import type { StatRow } from './BolaStats';

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * Tela de times: cada time com as suas raposas e vagas. Dá para entrar no lugar de um bot ou numa vaga livre do time
 * desfalcado, ou virar espectador.
 */
export function BolaTeams({
  teams,
  perTeam,
  rows,
  meId,
  spectating,
  onTake,
  onSpectate,
  onBack,
}: {
  teams: number;
  perTeam: number;
  rows: StatRow[];
  meId: string;
  spectating: boolean;
  /** Entra no time; `botId` é o bot que você substitui (ou nulo para uma vaga livre). Devolve o erro, se houver. */
  onTake: (team: number, botId: string | null) => string | null;
  onSpectate: () => string | null;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div
      className="dsm-pick bola-menu-wrap"
      role="dialog"
      aria-modal="true"
      aria-label="Times"
      data-testid="bola-teams"
    >
      <div className="dsm-pick-card bola-menu bola-teams">
        <header className="bola-teams-head">
          <h2>Times</h2>
          <button type="button" className="bola-x dark" onClick={onBack}>
            Voltar
          </button>
        </header>
        {error && (
          <p className="bola-error" role="alert">
            {error}
          </p>
        )}
        <div className="bola-teams-grid">
          {Array.from({ length: teams }, (_, t) => {
            const list = rows.filter((r) => r.team === t);
            const free = Math.max(0, perTeam - list.length);
            return (
              <section
                key={t}
                className="bola-team-card"
                style={{ ['--tc' as string]: css(BOL_TEAM_COLORS[t] as number) }}
              >
                <h3>
                  Time {BOL_TEAM_NAMES[t]}
                  <small>
                    {list.length}/{perTeam}
                  </small>
                </h3>
                <ul>
                  {list.map((r) => (
                    <li key={r.id} className={r.id === meId ? 'is-me' : ''}>
                      <span>
                        {r.id === meId ? 'Você' : r.name}
                        {r.bot ? <small>bot</small> : null}
                      </span>
                      {r.bot && (
                        <button
                          type="button"
                          className="bola-take"
                          onClick={() => setError(onTake(t, r.id))}
                          data-testid={`bola-take-${r.id}`}
                        >
                          Entrar no lugar
                        </button>
                      )}
                    </li>
                  ))}
                  {Array.from({ length: free }, (_, i) => (
                    <li key={`free${i}`} className="is-free">
                      <span>Vaga livre</span>
                      <button
                        type="button"
                        className="bola-take"
                        onClick={() => setError(onTake(t, null))}
                        data-testid={`bola-free-${t}`}
                      >
                        Entrar
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        {!spectating && (
          <button
            type="button"
            className="dsm-btn is-ghost"
            onClick={() => setError(onSpectate())}
            data-testid="bola-team-spec"
          >
            Virar espectador
          </button>
        )}
      </div>
    </div>
  );
}
