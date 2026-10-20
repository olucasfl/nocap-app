import { useState } from 'react';
import { summarizeProgress, type ProgressGame, type ProgressSummary } from '@nocap/games';
import meta from '@/games/words/levels/meta.json';
import { beeProgress, classicProgress, connectProgress, useProgress } from '@/games/words/levels/progress';
import './words-progress.css';

export type WordsSummary = Record<ProgressGame, ProgressSummary>;

const ROWS: { game: ProgressGame; name: string; total: number }[] = [
  { game: 'classic-c', name: 'Classic · 1 palavra', total: meta.classic.c },
  { game: 'classic-d', name: 'Classic · 2 palavras', total: meta.classic.d },
  { game: 'classic-q', name: 'Classic · 4 palavras', total: meta.classic.q },
  { game: 'bee', name: "Bee Word's", total: meta.bee },
  { game: 'connect', name: "Connect Word's", total: meta.connect },
];

/** O resumo das fases do aparelho (que já vem sincronizado com a conta). */
export function useMyWordsSummary(): WordsSummary {
  const bee = useProgress(beeProgress);
  const connect = useProgress(connectProgress);
  const c = useProgress(classicProgress.classic);
  const d = useProgress(classicProgress.dueto);
  const q = useProgress(classicProgress.quarteto);
  return summarizeProgress({ bee, connect, 'classic-c': c, 'classic-d': d, 'classic-q': q });
}

/**
 * O botão "Word's" do perfil: abre e fecha o quadro com a fase em que a pessoa está em cada jogo do Word's.
 * `summary` vazio = ainda carregando (ou indisponível).
 */
export function WordsProgress({ summary, whose }: { summary: WordsSummary | null | undefined; whose: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="wp" aria-label="Fases do Word's">
      <button type="button" className="wp-btn" data-sfx="select" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="wp-btn-name">Word's</span>
        <span className="mono wp-btn-sub">{open ? 'FECHAR' : `FASES ${whose.toUpperCase()}`}</span>
        <span className="wp-chev" aria-hidden="true">
          ›
        </span>
      </button>
      {open && (
        <ul className="wp-list" data-testid="words-progress">
          {ROWS.map((r) => {
            const s = summary?.[r.game];
            const count = s ? (s.done ?? s.played) : 0;
            return (
              <li key={r.game} className={`wp-row ${r.game}`}>
                <div className="wp-top">
                  <b>{r.name}</b>
                  <span className="mono wp-at">{!s ? '...' : s.furthest > 0 ? `FASE ${s.furthest}` : 'NÃO COMEÇOU'}</span>
                </div>
                <div className="wp-bar" aria-hidden="true">
                  <i style={{ transform: `scaleX(${Math.min(1, count / r.total)})` }} />
                </div>
                <span className="mono wp-sub">
                  {s ? `${count} DE ${r.total} ${s.done === null ? 'JOGADAS' : 'CONCLUÍDAS'}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
