import { useEffect, useRef } from 'react';
import { sfx } from '@/lib/sfx';
import './confirm-dialog.css';

interface Props {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  /** Som do botão de confirmar (padrão: sucesso). */
  confirmSfx?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação antes de uma ação que tira algo da pessoa (ex.: sair da conta). Esc e fundo cancelam. */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  confirmSfx = 'success',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: Props) {
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // O foco começa no "Cancelar": o caminho seguro.
    sfx.warn();
    cancel.current?.focus();
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
        aria-labelledby="cd-title"
        aria-describedby="cd-text"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cd-title" className="cd-title">
          {title}
        </h2>
        <p id="cd-text" className="cd-text">
          {text}
        </p>
        <div className="cd-actions">
          <button
            ref={cancel}
            type="button"
            className="btn ghost"
            data-sfx="cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button type="button" className="btn alt" data-sfx={confirmSfx} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
