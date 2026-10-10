import { useEffect, useRef } from 'react';
import { sfx } from '@/lib/sfx';
import './confirm-dialog.css';

/**
 * A conta já está numa sala e pediu outra. Três saídas claras: voltar à sala atual, sair dela e
 * seguir com o que pediu, ou desistir. Esc e o fundo desistem.
 */
export function RoomConflictDialog({
  open,
  code,
  onBack,
  onLeave,
  onCancel,
}: {
  open: boolean;
  code: string | null;
  onBack: () => void;
  onLeave: () => void;
  onCancel: () => void;
}) {
  const back = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    sfx.warn();
    back.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="cd-backdrop" onClick={onCancel}>
      <div
        className="cd"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rc-title"
        aria-describedby="rc-text"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="rc-title" className="cd-title">
          Você já está em uma sala
        </h2>
        <p id="rc-text" className="cd-text">
          {code ? `Sala ${code}. ` : ''}Para entrar em outra, você precisa sair dela antes. Quer
          voltar para ela ou sair?
        </p>
        <div className="cd-actions">
          <button ref={back} type="button" className="btn alt" data-sfx="roomJoin" onClick={onBack}>
            Voltar para a sala
          </button>
          <button type="button" className="btn ghost" data-sfx="remove" onClick={onLeave}>
            Sair dela e continuar
          </button>
          <button type="button" className="btn ghost" data-sfx="cancel" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
