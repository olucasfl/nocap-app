import { useEffect, useState } from 'react';
import { sendRoom, serverNow, useMeId, useRoom } from '@/lib/rooms';
import './pause-overlay.css';

/**
 * A pausa do líder (Fut Fox, Desmorona!, Atravessa! e Ping Fox! em sala). Todo mundo vê "Jogo pausado"; só o líder tem o
 * botão de despausar, e a volta tem uma contagem de 3 segundos. Enquanto estiver pausado as teclas do jogo ficam
 * travadas (o jogo em si já está parado: o relógio dele é o da sala sem os tempos de pausa).
 */
export function PauseOverlay() {
  const pause = useRoom((s) => s.snapshot?.pause ?? null);
  const hostId = useRoom((s) => s.snapshot?.hostId);
  const me = useMeId();
  const [, tick] = useState(0);
  const active = !!pause && pause.at !== null;

  useEffect(() => {
    if (!active) return undefined;
    // o mouse volta a aparecer para o líder poder clicar
    if (document.pointerLockElement) document.exitPointerLock();
    const id = window.setInterval(() => tick((n) => n + 1), 100);
    // teclas do jogo travadas (as que já estavam seguradas soltam normalmente)
    const block = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', block, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', block, true);
    };
  }, [active]);

  if (!pause || pause.at === null) return null;
  const left = pause.resumeAt !== null ? Math.ceil((pause.resumeAt - serverNow()) / 1000) : null;
  if (left !== null && left <= 0) return null;
  const leader = !!me && hostId === me;
  return (
    <div className="po" role="status" aria-live="assertive" data-testid="pause-overlay">
      {left === null ? (
        <div className="po-card">
          <div className="po-ic" aria-hidden="true">
            <i />
            <i />
          </div>
          <h2>Jogo pausado</h2>
          <p>{leader ? 'Só você pode despausar.' : 'O líder pausou a partida. Já já volta.'}</p>
          {leader && (
            <button
              type="button"
              className="po-btn"
              data-sfx="start"
              data-testid="pause-resume"
              onClick={() => sendRoom('resume')}
            >
              Despausar
            </button>
          )}
        </div>
      ) : (
        <div className="po-count" key={left} data-testid="pause-count">
          {left}
        </div>
      )}
    </div>
  );
}
