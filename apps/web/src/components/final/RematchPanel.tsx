import { useState, type CSSProperties } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export interface RematchMember {
  id: string;
  name: string;
  /** Cor da raposa (css). */
  color: string;
  connected: boolean;
  rematch: boolean;
  host: boolean;
}

export type RematchRoom = {
  members: RematchMember[];
  meId: string;
  voted: boolean;
  isHost: boolean;
  message?: string | null;
  onVote: (again: boolean) => void;
  onLeave: () => void;
  onClose: () => void;
};

/** Treino: jogar de novo ou voltar. */
export function TrainingActions({
  note,
  onAgain,
  onExit,
  busy,
}: {
  note: string;
  onAgain?: () => void;
  onExit: () => void;
  busy?: boolean;
}) {
  return (
    <section className="fz-vote" aria-label="Próximo passo">
      <div className="fz-vote-head">
        <h3>E agora?</h3>
      </div>
      <p className="fz-hint">{note}</p>
      <div className="fz-btns">
        {onAgain && (
          <button
            type="button"
            className="fz-btn"
            onClick={onAgain}
            disabled={busy}
            data-sfx="start"
            data-testid="final-again"
          >
            {busy ? 'Preparando…' : 'Jogar de novo'}
          </button>
        )}
        <button
          type="button"
          className="fz-btn is-ghost"
          onClick={onExit}
          data-sfx="back"
          data-testid="final-exit"
        >
          Voltar
        </button>
      </div>
    </section>
  );
}

/** A votação de "jogar de novo" da sala: quem quer, quem pensa, quem saiu, e os botões de votar, sair e encerrar. */
export function RematchPanel({ room }: { room: RematchRoom }) {
  const [closing, setClosing] = useState(false);
  const here = room.members.filter((m) => m.connected);
  const votes = here.filter((m) => m.rematch).length;
  const everyone = room.members.every((m) => !m.connected || m.rematch);
  return (
    <section className="fz-vote" aria-label="Jogar de novo">
      <div className="fz-vote-head">
        <h3>Jogar de novo?</h3>
        <span data-testid="final-count">
          {votes} de {here.length}
        </span>
      </div>
      <div className="fz-meter" aria-hidden="true">
        <i style={{ transform: `scaleX(${here.length ? votes / here.length : 0})` }} />
      </div>
      <ul className="fz-members">
        {room.members.map((m) => {
          const state = !m.connected ? 'off' : m.rematch ? 'yes' : 'wait';
          return (
            <li key={m.id} data-state={state} className={m.id === room.meId ? 'is-you' : ''}>
              <i aria-hidden="true" style={{ background: m.color } as CSSProperties} />
              <span className="fz-mname">
                {m.name}
                {m.host && <small>líder</small>}
                {m.id === room.meId && m.name.toLowerCase() !== 'você' && <small>você</small>}
              </span>
              <b>{state === 'yes' ? 'Quer jogar' : state === 'wait' ? 'Pensando…' : 'Saiu'}</b>
            </li>
          );
        })}
      </ul>
      <p className="fz-hint">
        {everyone
          ? 'Todo mundo topou. A sala volta ao lobby com as mesmas regras.'
          : room.voted
            ? 'Seu voto foi enviado. Quando todo mundo votar, a sala volta ao lobby.'
            : 'Quando todo mundo votar, a sala volta ao lobby. Quem não quer, sai.'}
      </p>
      {room.message && (
        <p className="fz-error" role="alert">
          {room.message}
        </p>
      )}
      <div className="fz-btns">
        <button
          type="button"
          className={`fz-btn${room.voted ? ' is-ghost' : ''}`}
          aria-pressed={room.voted}
          onClick={() => room.onVote(!room.voted)}
          data-sfx="toggle"
          data-testid="final-vote"
        >
          {room.voted ? 'Mudei de ideia' : 'Jogar de novo'}
        </button>
        <button
          type="button"
          className="fz-btn is-ghost"
          onClick={room.onLeave}
          data-sfx="back"
          data-testid="final-leave"
        >
          Sair da sala
        </button>
        {room.isHost && (
          <button
            type="button"
            className="fz-btn is-danger"
            onClick={() => setClosing(true)}
            data-testid="final-close"
          >
            Encerrar sala
          </button>
        )}
      </div>
      <ConfirmDialog
        open={closing}
        title="Encerrar a sala?"
        text="Todo mundo que está na sala será removido e a sala deixa de existir."
        confirmLabel="Encerrar"
        confirmSfx="remove"
        onConfirm={() => {
          setClosing(false);
          room.onClose();
        }}
        onCancel={() => setClosing(false)}
      />
    </section>
  );
}
