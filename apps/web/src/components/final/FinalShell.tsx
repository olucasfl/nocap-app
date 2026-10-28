import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import './final.css';

export type FinalTone = 'win' | 'lose' | 'draw' | 'watch';

/**
 * Casca das telas de fim de partida do Atravessa! e do Desmorona!: fundo escurecido, cartão com rolagem própria e
 * cabeçalho com o tema do jogo, o título entrando letra por letra e o subtítulo. O conteúdo vai em `children`.
 */
export function FinalShell({
  theme,
  tone,
  kicker,
  title,
  sub,
  deco,
  label,
  testId,
  footer,
  children,
}: {
  theme: 'dsm' | 'atr';
  tone: FinalTone;
  kicker: string;
  title: string;
  sub?: string;
  deco?: ReactNode;
  label: string;
  testId: string;
  /** Botões de ação: ficam fixos embaixo do cartão, e o resto rola por cima. */
  footer: ReactNode;
  children: ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    card.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      className="fz"
      data-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-testid={testId}
    >
      <div className="fz-card" data-tone={tone} ref={card} tabIndex={-1}>
        <div className="fz-body">
          <header className="fz-head">
            <div className="fz-deco" aria-hidden="true">
              {deco}
            </div>
            <span className="fz-kicker">{kicker}</span>
            <h2 className="fz-title" aria-label={title}>
              {[...title].map((ch, i) => (
                <i key={i} aria-hidden="true" style={{ '--i': i } as CSSProperties}>
                  {ch === ' ' ? '\u00a0' : ch}
                </i>
              ))}
            </h2>
            {sub && <p className="fz-sub">{sub}</p>}
          </header>
          {children}
        </div>
        <div className="fz-foot">{footer}</div>
      </div>
    </div>
  );
}
