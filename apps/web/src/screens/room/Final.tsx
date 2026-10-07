import { useAuth } from '@/lib/auth';
import { leaveRoom, sendRoom, useRoom, type RoomSnapshot } from '@/lib/rooms';

export function Final({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const message = useRoom((s) => s.message);
  const isHost = snapshot.hostId === me;
  const max = snapshot.settings.rounds * 10;

  return (
    <section className="screen rm">
      <h1>Pódio</h1>
      <ol className="rm-podium">
        {(snapshot.final ?? []).map((r) => (
          <li
            key={r.userId}
            className={`rm-pod${r.placement === 1 ? ' first' : ''}${r.userId === me ? ' me' : ''}`}
          >
            <span className="mono rm-pos">{r.placement}º</span>
            <span className="rm-result-name">@{r.username}</span>
            <span className="rm-result-score">
              {(r.totalTenths / 10).toFixed(1)}
              <small className="mono">/{max}</small>
            </span>
          </li>
        ))}
      </ol>
      <p className="mono rm-hint">Partida de sala: não entra no ranking.</p>
      {message && (
        <p className="acc-failure mono" role="alert">
          {message}
        </p>
      )}
      <div className="stack">
        {isHost ? (
          <button type="button" className="btn alt" onClick={() => sendRoom('rematch')}>
            Revanche
          </button>
        ) : (
          <p className="mono rm-hint">Esperando o host propor a revanche...</p>
        )}
        <button type="button" className="btn ghost" onClick={leaveRoom}>
          Sair da sala
        </button>
      </div>
    </section>
  );
}
