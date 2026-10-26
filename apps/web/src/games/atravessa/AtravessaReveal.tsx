import { useAuth } from '@/lib/auth';
import { at, sendRoom, toLocal, type RoomSnapshot } from '@/lib/rooms';
import { Countdown } from '@/components/Countdown';

/** Cor da raposa de cada pessoa (a que ela escolheu no lobby). */
export const roomColor = (snapshot: RoomSnapshot, id: string): string =>
  snapshot.atravessa?.colors[id] ?? '#ff6a2b';

/** Metros em texto: 1 234 m. */
export const meters = (n: number) => `${n.toLocaleString('pt-BR')} m`;

/** Tempo da corrida em m:ss,cc. */
export function raceTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 10));
  const cs = total % 100;
  const s = Math.floor(total / 100) % 60;
  const m = Math.floor(total / 6000);
  return `${m}:${String(s).padStart(2, '0')},${String(cs).padStart(2, '0')}`;
}

/**
 * Placar de uma rodada do Infinito: metros de cada um na rodada e a soma até agora. Passa sozinho
 * (o líder pode adiantar).
 */
export function AtravessaReveal({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const round = snapshot.round!;
  const info = snapshot.atravessa;
  const isHost = snapshot.hostId === me;
  const rows = snapshot.members
    .map((m) => ({
      m,
      round: info?.roundMeters?.[m.id] ?? 0,
      total: info?.totals?.[m.id] ?? 0,
    }))
    .sort((a, b) => b.round - a.round || b.total - a.total);

  return (
    <section className="screen rm">
      <h1>Rodada {round.index + 1}</h1>
      <p className="lead">Metros andados nesta rodada e a soma até agora.</p>
      <ul className="rm-results">
        {rows.map(({ m, round: r, total }) => (
          <li key={m.id} className={`rm-result${m.id === me ? ' me' : ''}`}>
            <span
              className="rm-swatch"
              style={{ background: roomColor(snapshot, m.id) }}
              aria-hidden="true"
            />
            <span className="rm-result-name">{at(m.username)}</span>
            <span className="rm-result-score">
              {meters(r)}
              <small className="mono"> · SOMA {meters(total)}</small>
            </span>
          </li>
        ))}
      </ul>
      {round.endsAt && (
        <Countdown
          endsAt={toLocal(round.endsAt)}
          totalMs={8000}
          warnMs={0}
          label="PRÓXIMA RODADA"
        />
      )}
      <div className="stack">
        {isHost ? (
          <button type="button" className="btn" onClick={() => sendRoom('next')}>
            Próxima rodada
          </button>
        ) : (
          <p className="mono rm-hint">A próxima rodada começa sozinha.</p>
        )}
      </div>
    </section>
  );
}
