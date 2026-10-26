import { useEffect, useRef, useState } from 'react';
import { hardReload } from '@/lib/hard-reload';
import { saveResume, useEnterGate } from '@/lib/app-version';
import { sfx } from '@/lib/sfx';
import './confirm-dialog.css';

/**
 * "Atualize antes de entrar": a pessoa tentou entrar ou criar uma sala com uma versão velha do app. Atualizar guarda o
 * que ela estava fazendo e, ao voltar, a entrada continua sozinha.
 */
export function UpdateBeforeEnter() {
  const pending = useEnterGate((s) => s.pending);
  const [busy, setBusy] = useState(false);
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pending) return;
    sfx.warn();
    ok.current?.focus();
  }, [pending]);
  if (!pending) return null;
  const update = () => {
    setBusy(true);
    saveResume(pending);
    void hardReload();
  };
  return (
    <div className="cd-backdrop" style={{ zIndex: 1100 }}>
      <div className="cd" role="alertdialog" aria-modal="true" aria-labelledby="ube-title">
        <h2 id="ube-title" className="cd-title">
          Atualize antes de entrar
        </h2>
        <p className="cd-text">
          Saiu uma versão nova do NoCap e a sua está desatualizada. Atualize para entrar na sala; o
          app continua de onde você parou.
        </p>
        <div className="cd-actions">
          <button
            ref={ok}
            type="button"
            className="btn alt"
            data-sfx="start"
            disabled={busy}
            onClick={update}
            data-testid="update-before-enter"
          >
            {busy ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => useEnterGate.setState({ pending: null })}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
