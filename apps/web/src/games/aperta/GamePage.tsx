import type { ReactNode } from 'react';
import type { PageName } from './game-logic';

export const PAGE_TITLE: Record<PageName, string> = {
  upgrades: 'Melhorias',
  grimoires: 'Grimórios',
  achievements: 'Conquistas',
  tree: 'Árvore de Habilidades',
  vault: 'Cofre dos Proibidos',
};

const ICON: Record<PageName, string> = {
  upgrades: 'M12 19V5M5 12l7-7 7 7',
  grimoires: 'M4 5h7a3 3 0 0 1 3 3v12a3 3 0 0 0-3-3H4zM20 5h-7a3 3 0 0 0-3 3',
  achievements: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8.5 20h7M10 17h4',
  tree: 'M12 21V9M12 13 7 9M12 16l5-4M12 9V3M7 9V6M17 12V8',
  vault: 'M5 10h14v10H5zM8 10V7a4 4 0 0 1 8 0v3M12 14v3',
};

export function PageIcon({ name, className }: { name: PageName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICON[name]} />
    </svg>
  );
}

interface Props {
  name: PageName;
  /** Faixa de aviso do topo da página. */
  notice: string;
  onClose: () => void;
  children?: ReactNode;
}

/**
 * Página temática do jogo (spec 038, 3.5): abre entre o HUD e a dock, com cabeçalho, X e uma faixa
 * de aviso. O conteúdo de cada página chega nas etapas seguintes; por enquanto o corpo é provisório.
 */
export function GamePage({ name, notice, onClose, children }: Props) {
  return (
    <div className="ap-sheetwrap">
      <section className="ap-sheet" aria-labelledby={`ap-sheet-${name}`}>
        <header className="ap-shead">
          <span className="ap-shead-icon">
            <PageIcon name={name} />
          </span>
          <h2 id={`ap-sheet-${name}`}>{PAGE_TITLE[name]}</h2>
          <button type="button" className="ap-x" data-tut="page-close" aria-label={`Fechar ${PAGE_TITLE[name]}`} onClick={onClose}>
            <span className="ap-x-x" aria-hidden="true">
              X
            </span>
            <span className="ap-x-back" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M15 5l-7 7 7 7" />
              </svg>
              <b>Voltar</b>
            </span>
          </button>
        </header>
        <div className="ap-sbody" data-tut={`${name}-page`}>
          <p className="ap-pnotice">
            <i aria-hidden="true">!</i>
            <span>{notice}</span>
          </p>
          {children ?? <p className="ap-sub">Esta página chega nas próximas etapas.</p>}
        </div>
      </section>
    </div>
  );
}
