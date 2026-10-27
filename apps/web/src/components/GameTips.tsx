import { useEffect, useState, type ReactNode } from 'react';
import './game-menu.css';

export interface TipRow {
  keys: ReactNode;
  text: string;
}

const seen = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

/**
 * Controles do jogo. Na primeira partida (`storageKey` ainda não visto) aparece sozinha por cima da contagem; também
 * abre quando a pessoa escolhe "Controles" no menu (`forced`), e aí não guarda nada.
 */
export function GameTips({
  storageKey,
  title = 'Como jogar',
  rows,
  forced = false,
  onDone,
  testId,
  okTestId = 'game-tips-ok',
}: {
  storageKey: string;
  title?: string;
  rows: TipRow[];
  forced?: boolean;
  onDone?: () => void;
  testId?: string;
  okTestId?: string;
}) {
  const [open, setOpen] = useState(() => forced || !seen(storageKey));
  useEffect(() => {
    if (!open || forced) return undefined;
    // some sozinha depois de um tempo, mas só "vale como vista" quando a pessoa toca em Entendi
    const t = window.setTimeout(() => setOpen(false), 20_000);
    return () => window.clearTimeout(t);
  }, [open, forced]);
  if (!open) return null;
  const done = () => {
    if (!forced) {
      try {
        localStorage.setItem(storageKey, '1');
      } catch {
        /* sem armazenamento: aparece de novo na próxima, sem problema */
      }
    }
    setOpen(false);
    onDone?.();
  };
  const card = (
    <div
      className={`gm-tips${forced ? ' is-modal' : ''}`}
      role="dialog"
      aria-label={title}
      data-testid={testId ?? 'game-tips'}
      onClick={(e) => e.stopPropagation()}
    >
      <h2>{title}</h2>
      <ul>
        {rows.map((r, i) => (
          <li key={i}>
            <span className="gm-tip-keys">{r.keys}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="gm-main" onClick={done} data-testid={okTestId}>
        Entendi
      </button>
    </div>
  );
  // aberto pelo menu: janela por cima de tudo (inclusive do menu), fechando ao tocar fora
  return forced ? (
    <div className="gm-wrap is-top" onClick={done}>
      {card}
    </div>
  ) : (
    card
  );
}
