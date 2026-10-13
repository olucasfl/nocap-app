import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { sendRoom, toLocal, type RoomSnapshot, at } from '@/lib/rooms';

/**
 * O intervalo entre as fases do Sinal Vermelho: como cada pessoa terminou a fase (chegou na linha ou
 * caiu e até onde foi) e o total de metros até agora. A próxima fase começa sozinha; o líder pode pular.
 */
export function SinalPhase({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const summary = snapshot.sinal?.summary;
  const colors = snapshot.sinal?.colors ?? {};
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const name = (id: string) => snapshot.members.find((m) => m.id === id)?.username ?? '?';
  const left = snapshot.round?.endsAt
    ? Math.max(0, Math.ceil((toLocal(snapshot.round.endsAt) - now) / 1000))
    : 0;
  const isHost = snapshot.hostId === me;
  if (!summary) return null;
  const ranked = [...summary.rows].sort((a, b) => b.totalTenths - a.totalTenths);

  return (
    <section className="screen rm">
      <div className="mono rm-label">
        FASE {summary.n} DE {summary.total}
      </div>
      <h1>{summary.n === 1 ? 'Primeira fase feita' : `Fase ${summary.n} feita`}</h1>
      <ol className="rm-results">
        {summary.rows.map((r) => (
          <li key={r.id} className={`rm-result${r.id === me ? ' me' : ''}`}>
            <span className="mono rm-pos">{r.place}º</span>
            <span className="rm-swatch" style={{ background: colors[r.id] }} aria-hidden="true" />
            <span className="rm-result-name">{at(name(r.id))}</span>
            <span className="rm-result-score">
              {Math.round(r.tenths / 10)}
              <small className="mono"> m · {r.finished ? 'CHEGOU' : 'CAIU'}</small>
            </span>
          </li>
        ))}
      </ol>
      <div className="mono rm-label">TOTAL ATÉ AGORA</div>
      <ol className="rm-results">
        {ranked.map((r, i) => (
          <li key={r.id} className={`rm-result${r.id === me ? ' me' : ''}`}>
            <span className="mono rm-pos">{i + 1}º</span>
            <span className="rm-swatch" style={{ background: colors[r.id] }} aria-hidden="true" />
            <span className="rm-result-name">{at(name(r.id))}</span>
            <span className="rm-result-score">
              {Math.round(r.totalTenths / 10)}
              <small className="mono"> m</small>
            </span>
          </li>
        ))}
      </ol>
      <p className="mono rm-hint">
        {left > 0 ? `A PRÓXIMA FASE COMEÇA EM ${left} S` : 'COMEÇANDO A PRÓXIMA FASE...'}
      </p>
      {isHost && (
        <button type="button" className="btn" data-sfx="start" onClick={() => sendRoom('next')}>
          Próxima fase agora
        </button>
      )}
    </section>
  );
}
