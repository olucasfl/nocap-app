import type { CSSProperties } from 'react';
import './animated-text.css';

/**
 * Título com as letras entrando em sequência (sobem, giram um pouco e assentam). Cada linha é
 * um item de `lines`. Só transform/opacity; com movimento reduzido aparece pronto.
 * `startMs` atrasa o começo; `stepMs` é o intervalo entre as letras.
 */
export function AnimatedText({
  lines,
  startMs = 40,
  stepMs = 22,
}: {
  lines: string[];
  startMs?: number;
  stepMs?: number;
}) {
  let n = 0;
  return (
    <>
      <span className="at-sr">{lines.join(' ')}</span>
      {lines.map((line, li) => (
        <span className="at-line" key={li} aria-hidden="true">
          {line.split(' ').map((word, wi, words) => (
            <span className="at-word" key={wi}>
              {word.split('').map((ch) => {
                const i = n++;
                return (
                  <span
                    className="at-ch"
                    key={i}
                    style={{ '--d': `${startMs + i * stepMs}ms` } as CSSProperties}
                  >
                    {ch}
                  </span>
                );
              })}
              {wi < words.length - 1 && <span className="at-space"> </span>}
            </span>
          ))}
        </span>
      ))}
    </>
  );
}
