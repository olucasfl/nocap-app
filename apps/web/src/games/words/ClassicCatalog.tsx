import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import type { ClassicMode } from '@nocap/games';
import { classicProgress, levelView, CLASSIC_KEYS } from './classic-engine';
import { loadClassicLevels, tierOf, tierRanges, type ClassicLevel } from './levels/levels';
import { useProgress, type LevelStatus } from './levels/progress';
import { MiniBoards } from './words-art';
import { FilterBar, GridLoader, Pill, WordsShell, type FilterId } from './words-kit';
import { MODE_LABEL } from './words-api';
import './connect/connect.css';
import './classic-levels.css';

const isMode = (m: string | undefined): m is ClassicMode => m === 'classic' || m === 'dueto' || m === 'quarteto';

interface Cell {
  n: number;
  status: LevelStatus;
  won: boolean;
  used: number;
  tries: number;
  at?: number;
}

/** O catálogo de fases de um modo do Classic (1, 2 ou 4 palavras): do mais fácil ao mais difícil, com o estado de cada uma. */
export function ClassicCatalog() {
  const { modo } = useParams({ strict: false }) as { modo?: string };
  const mode: ClassicMode = isMode(modo) ? modo : 'classic';
  const info = MODE_LABEL[mode];
  const [levels, setLevels] = useState<ClassicLevel[] | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');
  const prog = useProgress(classicProgress[mode]);

  useEffect(() => {
    setLevels(null);
    void loadClassicLevels().then((all) => setLevels(all[CLASSIC_KEYS[mode]]));
  }, [mode]);

  const cells = useMemo((): Cell[] | null => {
    if (!levels) return null;
    return levels.map((lv, i) => {
      const p = prog[String(i + 1)];
      if (!p || (p.guesses.length === 0 && !p.gaveUp)) return { n: i + 1, status: 'new', won: false, used: 0, tries: info.tries };
      const v = levelView(mode, lv, i + 1, p.guesses, p.gaveUp ?? false);
      return { n: i + 1, status: v.state === 'open' ? 'open' : 'done', won: v.state === 'won', used: v.used, tries: v.tries, at: p.at };
    });
  }, [levels, prog, mode, info.tries]);

  if (!levels || !cells) {
    return (
      <WordsShell title={info.name} back="/words/classic" accent="green" className="cx-theme cl-theme">
        <GridLoader />
      </WordsShell>
    );
  }

  const done = cells.filter((x) => x.status === 'done').length;
  const open = cells.filter((x) => x.status === 'open').length;
  const last = cells.filter((x) => x.status === 'open').sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
  const nextNew = cells.find((x) => x.status === 'new');
  const pct = Math.round((done / cells.length) * 100);
  const counts = { all: cells.length, new: cells.length - done - open, open, done };

  return (
    <WordsShell title={info.name} back="/words/classic" accent="green" className="cx-theme cl-theme" right={<Pill tone="paper">{done}/{cells.length}</Pill>}>
      <section className="cx-hero" data-testid="classic-hero">
        <div className="cx-hero-art">
          <MiniBoards count={info.words as 1 | 2 | 4} />
        </div>
        <div className="cx-hero-text">
          <h2>Escolha uma fase</h2>
          <p>
            {cells.length} fases do mais fácil ao mais difícil. {info.tries} tentativas em cada.
          </p>
          <div className="cx-meter" aria-label={`${pct}% concluído`}>
            <i style={{ transform: `scaleX(${done / cells.length})` }} />
          </div>
          <div className="cx-stats">
            <span>
              <b>{done}</b> completas
            </span>
            <span>
              <b>{open}</b> em andamento
            </span>
            <span>
              <b>{counts.new}</b> novas
            </span>
          </div>
        </div>
      </section>

      {(last || nextNew) && (
        <Link
          to="/words/classic/fase/$modo/$n"
          params={{ modo: mode, n: String((last ?? nextNew)!.n) }}
          className="cx-continue"
          data-testid="continue"
          data-sfx="start"
        >
          <span className="cx-continue-n">{(last ?? nextNew)!.n}</span>
          <span>
            <b>{last ? 'Continuar' : 'Começar'}</b>
            <small>
              {last ? `Fase ${last.n} · ${last.used} de ${last.tries} tentativas` : `Fase ${nextNew!.n} · ${tierOf(levels[nextNew!.n - 1]!)}`}
            </small>
          </span>
          <i>→</i>
        </Link>
      )}

      <FilterBar value={filter} onChange={setFilter} counts={counts} />

      {tierRanges(levels).map(({ tier, from, to }) => {
        const shown = cells.filter((x) => x.n >= from && x.n <= to && (filter === 'all' || x.status === filter));
        if (shown.length === 0) return null;
        return (
          <section className="cx-tier" key={tier} aria-label={tier}>
            <h3 className="wd-section">
              {tier} · fases {from} a {to}
            </h3>
            <div className="cx-grid">
              {shown.map((x, i) => (
                <Link
                  key={x.n}
                  to="/words/classic/fase/$modo/$n"
                  params={{ modo: mode, n: String(x.n) }}
                  className={`cx-cell ${x.status}${x.status === 'done' ? (x.won ? ' won' : ' lost') : ''}`}
                  style={{ '--i': i } as CSSProperties}
                  data-testid={`level-${x.n}`}
                  data-status={x.status}
                  aria-label={`Fase ${x.n}: ${x.status === 'done' ? (x.won ? `completa em ${x.used} de ${x.tries}` : 'não resolvida') : x.status === 'open' ? `em andamento, ${x.used} de ${x.tries}` : 'nova'}`}
                >
                  <b>{x.n}</b>
                  <small>{x.status === 'new' ? 'nova' : x.status === 'done' && !x.won ? 'perdeu' : `${x.used}/${x.tries}`}</small>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </WordsShell>
  );
}
