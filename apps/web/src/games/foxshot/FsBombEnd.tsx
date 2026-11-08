import { CounterFoxBackdrop } from './CounterFoxBackdrop';
import { CounterFoxLogo } from './CounterFoxLogo';
import './counterfox-hub.css';

export interface FsBombEndRow {
  id: string;
  name: string;
  side: 'tr' | 'ct';
  kills: number;
  assists: number;
  deaths: number;
  points: number;
  me: boolean;
}

const SIDE = { tr: 'Terroristas', ct: 'Contra-terroristas' } as const;

/** Fim de partida do modo Bomba: vitória ou derrota, placar de rounds, os dois times lado a lado e as estatísticas de cada um. */
export function FsBombEnd({
  winner,
  tr,
  ct,
  mySide,
  rows,
  mapName,
  onExit,
  exitLabel,
  onAgain,
  againLabel,
  againNote,
  againOn,
}: {
  winner: 'tr' | 'ct' | null;
  tr: number;
  ct: number;
  /** `null`: quem vê é espectador. */
  mySide: 'tr' | 'ct' | null;
  rows: FsBombEndRow[];
  mapName?: string;
  onExit: () => void;
  exitLabel: string;
  onAgain: () => void;
  againLabel: string;
  againNote?: string;
  againOn?: boolean;
}) {
  const verdict = !winner ? 'empate' : !mySide ? 'fim' : winner === mySide ? 'win' : 'lose';
  const title = verdict === 'win' ? 'Vitória' : verdict === 'lose' ? 'Derrota' : winner ? `${SIDE[winner]} vencem` : 'Empate';
  const mvp = [...rows].sort((a, b) => b.kills - a.kills || b.assists - a.assists || a.deaths - b.deaths)[0];
  const team = (side: 'tr' | 'ct') => rows.filter((r) => r.side === side).sort((a, b) => b.points - a.points || b.kills - a.kills || a.deaths - b.deaths);
  return (
    <main className="cfh cfl cfb-end" data-testid="fb-final" role="dialog" aria-label="Fim da partida">
      <CounterFoxBackdrop />
      <div className="cfl-wrap" style={{ gridTemplateRows: 'auto 1fr auto' }}>
        <header className="cfl-head">
          <CounterFoxLogo compact />
          <div className="cfl-chips">
            <span className="cfl-chip">Modo Bomba</span>
            {mapName && <span className="cfl-chip">{mapName}</span>}
          </div>
        </header>
        <section className="cfl-body cfb-body">
          <div className={`cfb-verdict ${verdict}`}>
            <h2 className="cfh-fin-title" data-testid="fb-final-title">{title}</h2>
            <div className="cfb-score" data-testid="fb-final-score">
              <span className="tr"><b>{tr}</b><small>Terroristas</small></span>
              <i>x</i>
              <span className="ct"><b>{ct}</b><small>Contra-terroristas</small></span>
            </div>
            {mvp && mvp.kills > 0 && <p className="cfl-note">Destaque da partida: {mvp.name} com {mvp.kills} abates.</p>}
          </div>
          <div className="cfb-teams">
            {(['tr', 'ct'] as const).map((side) => (
              <div key={side} className={`cfb-team ${side}${winner === side ? ' won' : ''}`} data-testid={`fb-team-${side}`}>
                <h3>
                  <span>{SIDE[side]}</span>
                  <em>{winner === side ? 'Venceu' : winner ? 'Perdeu' : ''}</em>
                  <b>{side === 'tr' ? tr : ct}</b>
                </h3>
                <table className="cfx-table cfh-table">
                  <thead>
                    <tr>
                      <th>Jogador</th>
                      <th>Pts</th>
                      <th>Abates</th>
                      <th>Assist.</th>
                      <th>Mortes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team(side).map((r) => (
                      <tr key={r.id} className={r.me ? 'you' : ''} data-testid={`fb-row-${r.id}`}>
                        <td>{r.name}</td>
                        <td><b>{r.points}</b></td>
                        <td>{r.kills}</td>
                        <td>{r.assists}</td>
                        <td>{r.deaths}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
        <footer className="cfl-foot">
          <button type="button" className="cfh-btn danger" onClick={onExit} data-sfx="back" data-testid="fb-final-exit">
            <span>{exitLabel}</span>
          </button>
          <span className="cfl-spacer" />
          <button type="button" className={`cfh-btn main${againOn ? ' on' : ''}`} onClick={onAgain} data-sfx="start" data-testid="fb-final-again">
            <span>{againLabel}</span>
            {againNote && <small>{againNote}</small>}
          </button>
        </footer>
      </div>
    </main>
  );
}
