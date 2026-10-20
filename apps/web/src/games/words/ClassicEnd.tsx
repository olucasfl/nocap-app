import type { CSSProperties } from 'react';
import type { ReactNode } from 'react';
import { Celebrate } from './words-kit';
import type { RunView } from './words-api';

const WIN_TITLES = ['Genial!', 'Incrível!', 'Muito bom!', 'Mandou bem!', 'Na hora certa!', 'Ufa, por pouco!'];

/** A frase da vitória cresce conforme a pessoa gastou mais tentativas (do total que tinha). */
function winTitle(used: number, tries: number): string {
  const i = Math.min(WIN_TITLES.length - 1, Math.floor(((used - 1) / tries) * WIN_TITLES.length));
  return WIN_TITLES[i]!;
}

/**
 * A tela de fim de partida do Classic: aparece só depois que a última linha termina de virar. Mostra a
 * palavra certa bem grande (principalmente quando a pessoa perde), quantas tentativas usou e as ações.
 * `collapsed` mostra só uma barra para a pessoa rever o tabuleiro sem perder os botões.
 */
export function ClassicEnd({
  run,
  collapsed,
  onToggle,
  actions,
}: {
  run: RunView;
  collapsed: boolean;
  onToggle: () => void;
  /** Os botões do fim (próxima fase, voltar...). */
  actions: ReactNode;
}) {
  const won = run.state === 'won';
  const gaveUp = !won && run.used < run.tries;
  const answers = run.answers ?? [];
  const title = won ? winTitle(run.used, run.tries) : gaveUp ? 'Você desistiu' : 'Não foi dessa vez';
  const many = answers.length > 1;

  if (collapsed) {
    return (
      <div className="cw-endbar" data-testid="end-bar">
        <button type="button" className="btn ghost" onClick={onToggle}>
          Ver resultado
        </button>
        {actions}
      </div>
    );
  }

  return (
    <div className={`cw-end ${won ? 'won' : 'lost'}`} role="dialog" aria-label="Resultado da partida" data-testid="end">
      <Celebrate burst={1} kind={won ? (run.used <= 2 ? 'epic' : 'win') : 'lose'} />
      <div className="cw-end-card">
        <span className="wd-shine" aria-hidden="true" />
        <div className={`wd-stamp ${won ? 'won' : 'lost'}`} data-testid="end-title">
          {title}
        </div>
        <p className="mono cw-end-sub">{won ? (many ? 'Você descobriu todas' : 'Você descobriu a palavra') : many ? 'As palavras eram' : 'A palavra era'}</p>

        <div className={`cw-end-answers${many ? ' many' : ''}${answers.length > 2 ? ' four' : ''}`}>
          {answers.map((w, r) => (
            <div key={r} className="cw-end-word" aria-label={`${many ? 'Palavra' : 'A palavra era'} ${w.toUpperCase()}`} data-testid={`end-answer-${r}`}>
              {[...w].map((ch, i) => (
                <span key={i} style={{ '--i': i + r * 2 } as CSSProperties}>
                  {ch}
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className="cw-end-score">
          <span className="mono">{won ? 'Acertou em' : 'Você usou'}</span>
          <b data-testid="nota">{run.used}</b>
          <span className="mono">de {run.tries}</span>
        </div>
        <div className="cw-end-pips" aria-hidden="true">
          {Array.from({ length: run.tries }, (_, i) => (
            <i key={i} className={i < run.used ? (i === run.used - 1 ? (won ? 'win' : 'last') : 'on') : ''} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>

        <div className="cw-end-actions">{actions}</div>
        <button type="button" className="cw-end-peek" onClick={onToggle}>
          Ver tabuleiro
        </button>
      </div>
    </div>
  );
}
