import type { FsMatchRow } from '@nocap/games';

/** Tela de fim de partida: tabela com posição, pontos, abates, assistências e mortes. */
export function FsMatchEnd({
  rows,
  minutes,
  onAgain,
  onExit,
}: {
  rows: FsMatchRow[];
  minutes: number;
  onAgain: () => void;
  onExit: () => void;
}) {
  const me = rows.find((r) => r.id === 'me');
  const winners = rows.filter((r) => r.winner);
  const title = me?.winner ? (winners.length > 1 ? 'Empate na frente!' : 'Você venceu!') : `${winners.map((w) => w.name).join(' e ')} venceu`;
  return (
    <div className="fsm cfx-end" role="dialog" aria-label="Fim da partida" data-testid="fs-end">
      <div className="fsm-card">
        <header>
          <h2 data-testid="fs-end-title">{title}</h2>
          <span className="mono">{minutes} min · Duna</span>
        </header>
        <div className="fsm-body">
          <table className="cfx-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Jogador</th>
                <th>Pontos</th>
                <th>Abates</th>
                <th>Assist.</th>
                <th>Mortes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`${r.id === 'me' ? 'you' : ''}${r.winner ? ' win' : ''}`} data-testid={`fs-end-row-${r.id}`}>
                  <td>{r.place}</td>
                  <td>
                    {r.name}
                    
                  </td>
                  <td>
                    <b>{r.points}</b>
                  </td>
                  <td>{r.kills}</td>
                  <td>{r.assists}</td>
                  <td>{r.deaths}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cfx-actions">
            <button type="button" className="btn ghost" onClick={onExit} data-testid="fs-end-exit">
              Mudar a partida
            </button>
            <button type="button" className="btn" onClick={onAgain} data-testid="fs-end-again">
              Jogar de novo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
