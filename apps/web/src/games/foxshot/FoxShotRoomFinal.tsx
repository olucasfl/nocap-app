import { useEffect } from 'react';
import { sendRoom, leaveRoom, useMeId, type RoomSnapshot } from '@/lib/rooms';
import { CounterFoxBackdrop } from './CounterFoxBackdrop';
import { CounterFoxLogo } from './CounterFoxLogo';
import { FsBombEnd } from './FsBombEnd';
import './counterfox-hub.css';

/** Resultado do mata-mata online: tabela com posição, pontos, abates, assistências e mortes; jogar de novo volta ao lobby da sala. */
export function FoxShotRoomFinal({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useMeId();
  const rows = snapshot.foxshot?.score
    ? [...snapshot.foxshot.score].sort((a, b) => b.points - a.points || b.kills - a.kills || a.deaths - b.deaths)
    : [];
  const final = snapshot.final ?? [];
  const place = (id: string) => final.find((f) => f.userId === id)?.placement ?? 0;
  const mine = rows.find((r) => r.id === me);
  const won = place(me ?? '') === 1;
  const voted = snapshot.members.find((m) => m.id === me)?.rematch;
  useEffect(() => {
    try {
      document.exitPointerLock?.();
      if (document.fullscreenElement) void document.exitFullscreen();
    } catch {
      /* sem trava para soltar */
    }
  }, []);
  const bomb = snapshot.foxshot?.bomb;
  if (snapshot.foxshot?.kind === 'bomb' && bomb) {
    const mySide = bomb.sides[me ?? ''] ?? null;
    return (
      <FsBombEnd
        winner={bomb.winner}
        tr={bomb.tr}
        ct={bomb.ct}
        mySide={mySide}
        mapName={snapshot.foxshot?.pvp ? 'Arena de Blocos' : 'Duna'}
        pvp={!!snapshot.foxshot?.pvp}
        rows={rows.map((r) => ({ id: r.id, name: r.name, side: bomb.sides[r.id] ?? 'ct', kills: r.kills, assists: r.assists, deaths: r.deaths, points: r.points, me: r.id === me }))}
        exitLabel="Sair da sala"
        onExit={() => void leaveRoom()}
        againLabel={voted ? 'Esperando os outros' : 'Jogar de novo'}
        againNote={voted ? 'toque para desistir' : 'volta ao lobby da sala'}
        againOn={!!voted}
        onAgain={() => sendRoom('vote', { again: !voted })}
      />
    );
  }
  return (
    <main className="cfh cfl" data-testid="fsr-final">
      <CounterFoxBackdrop />
      <div className="cfl-wrap" style={{ gridTemplateRows: 'auto 1fr auto' }}>
        <header className="cfl-head">
          <CounterFoxLogo compact />
          <div className="cfl-chips">
            <span className="cfl-chip">Fim da partida</span>
            <span className="cfl-chip">{snapshot.foxshot?.minutes ?? 5} min</span>
          </div>
        </header>
        <section className="cfl-body">
          <div className="cfl-pane">
            <h2 className="cfh-fin-title" data-testid="fsr-final-title">
              {won ? 'Você venceu!' : `${rows[0]?.name ?? ''} venceu`}
            </h2>
            {mine && <p className="cfl-note">Você fez {mine.points} pontos: {mine.kills} abates e {mine.assists} assistências.</p>}
            <table className="cfx-table cfh-table">
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
                  <tr key={r.id} className={`${r.id === me ? 'you' : ''}${place(r.id) === 1 ? ' win' : ''}`} data-testid={`fsr-row-${r.id}`}>
                    <td>{place(r.id)}</td>
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
        </section>
        <footer className="cfl-foot">
          <button type="button" className="cfh-btn danger" onClick={() => void leaveRoom()} data-sfx="back" data-testid="fsr-final-leave">
            <span>Sair da sala</span>
          </button>
          <span className="cfl-spacer" />
          <button type="button" className={`cfh-btn main${voted ? ' on' : ''}`} onClick={() => sendRoom('vote', { again: !voted })} data-sfx="start" data-testid="fsr-final-again">
            <span>{voted ? 'Esperando os outros' : 'Jogar de novo'}</span>
            <small>{voted ? 'toque para desistir' : 'volta ao lobby da sala'}</small>
          </button>
        </footer>
      </div>
    </main>
  );
}
