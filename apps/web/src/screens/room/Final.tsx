import { useAuth } from '@/lib/auth';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { closeRoom, leaveRoom, sendRoom, useRoom, type RoomSnapshot } from '@/lib/rooms';

/**
 * Pódio da sala e votação da revanche. Todo mundo vota em "jogar de novo" ou sai; quando todos
 * que ficaram votaram, a sala volta ao lobby com as mesmas regras e o líder pode começar
 * (mudando as regras, se quiser). Os outros aguardam.
 */
export function Final({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const message = useRoom((s) => s.message);
  const [closing, setClosing] = useState(false);
  const impostor =
    snapshot.game === 'impostor' || (snapshot.game === 'eco' && snapshot.mode === 'leader');
  const eco = snapshot.game === 'eco';
  /** Siga o Líder: no pódio entra a porcentagem (média das rodadas) e a soma de acertos; as notas de cada rodada não aparecem antes. */
  const hits = snapshot.eco?.hits;
  const max = snapshot.settings.rounds * 10;
  const mine = snapshot.members.find((m) => m.id === me);
  const voted = !!mine?.rematch;
  const here = snapshot.members.filter((m) => m.connected);
  const votes = here.filter((m) => m.rematch).length;

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
              {hits
                ? (r.totalTenths / 10).toFixed(1)
                : eco
                  ? Math.round(r.totalTenths / 10)
                  : (r.totalTenths / 10).toFixed(1)}
              <small className="mono">
                {hits
                  ? `% · ${hits[r.userId] ?? 0} ${(hits[r.userId] ?? 0) === 1 ? 'acerto' : 'acertos'}`
                  : eco
                    ? ' passos'
                    : impostor
                      ? ' pts'
                      : `/${max}`}
              </small>
            </span>
          </li>
        ))}
      </ol>
      <p className="mono rm-hint">Partida de sala: não entra no ranking.</p>

      <div className="rm-vote">
        <div className="mono rm-label">
          JOGAR DE NOVO? · {votes} DE {here.length}
        </div>
        <ul className="fr-list">
          {snapshot.members.map((m) => (
            <li key={m.id} className="fr-row">
              <span className="fr-name">
                @{m.username}
                {m.id === me && <span className="mono rm-badge you">VOCÊ</span>}
                {m.isHost && <span className="mono rm-badge">LÍDER</span>}
              </span>
              <span className={`mono rm-ready${m.rematch ? ' on' : ''}`}>
                {!m.connected ? 'SEM CONEXÃO' : m.rematch ? 'QUER JOGAR' : 'PENSANDO'}
              </span>
            </li>
          ))}
        </ul>
        <p className="mono rm-hint">
          {voted
            ? 'Seu voto foi enviado. Quando todo mundo votar, o líder libera o começo.'
            : 'Quando todo mundo votar em jogar de novo, o líder libera o começo. Quem não quer, sai.'}
        </p>
      </div>

      {message && (
        <p className="acc-failure mono" role="alert">
          {message}
        </p>
      )}
      <div className="stack">
        <button
          type="button"
          className={voted ? 'btn ghost' : 'btn alt'}
          data-sfx="toggle"
          aria-checked={voted}
          onClick={() => sendRoom('vote', { again: !voted })}
        >
          {voted ? 'Mudei de ideia' : 'Jogar de novo'}
        </button>
        <button type="button" className="btn ghost" data-sfx="back" onClick={leaveRoom}>
          Sair da sala
        </button>
        {mine?.isHost && (
          <button
            type="button"
            className="btn ghost"
            data-sfx="remove"
            onClick={() => setClosing(true)}
          >
            Encerrar sala
          </button>
        )}
        <ConfirmDialog
          open={closing}
          title="Encerrar a sala?"
          text="Todo mundo que está na sala será removido e a sala deixa de existir."
          confirmLabel="Encerrar"
          confirmSfx="remove"
          onConfirm={() => {
            setClosing(false);
            closeRoom();
          }}
          onCancel={() => setClosing(false)}
        />
      </div>
    </section>
  );
}
