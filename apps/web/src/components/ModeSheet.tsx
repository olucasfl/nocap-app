import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { modeArt } from './ModePicker';
import type { GameId } from '@/lib/stats';
import './mode-sheet.css';

/**
 * Ficha de um modo, aberta ao tocar no cartão: arte, nome, explicação, regras e o botão de jogar.
 * "Escolher outro modo" (ou Esc / tocar fora) fecha e volta para a lista.
 */
export function ModeSheet({
  game,
  modeId,
  title,
  lead,
  rules,
  onClose,
  children,
}: {
  game: GameId;
  modeId: string;
  title: string;
  lead: string;
  rules: ReactNode;
  onClose: () => void;
  /** Área de ação (botão Jogar, avisos, Daily). */
  children: ReactNode;
}) {
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    close.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // No <body>: a tela de baixo tem animação de entrada e um `position: fixed` ali dentro ficaria preso a ela.
  return createPortal(
    <div className="ms-backdrop" onClick={onClose}>
      <section
        className={`ms ${game}${modeId === 'daily' ? ' daily' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Modo ${title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ms-head">
          <span className="ms-art">{modeArt(modeId)}</span>
          <h2 className="ms-title">{title}</h2>
        </header>
        <p className="ms-lead">{lead}</p>
        <div className="ms-rules">{rules}</div>
        <div className="ms-actions">
          {children}
          <button ref={close} type="button" className="btn ghost" data-sfx="back" onClick={onClose}>
            Escolher outro modo
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
