import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from '@tanstack/react-router';
import { beeMaxPoints, beeRank, beeScore } from '@nocap/games';
import { HexLoader, Pill, RulesList, Tabs, WordsShell } from '../words-kit';
import { loadBeeLevels, tierOf, toBeePuzzle, TIERS, type BeeLevel } from '../levels/levels';
import { beeProgress, useProgress, type LevelStatus } from '../levels/progress';
import { BeeMascot } from './BeeArt';
import './bee.css';

type Filter = 'all' | LevelStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'new', label: 'Novas' },
  { id: 'open', label: 'Em andamento' },
  { id: 'done', label: 'Concluídas' },
];

export const BEE_RULES = [
  'Toda palavra tem 4 letras ou mais, usa só as 7 letras do favo e leva a letra do centro (a amarela).',
  '4 letras valem 1 ponto; palavras maiores valem o número de letras. O pangrama, que usa as 7 letras, soma 7 pontos a mais.',
  'Acentos não importam: digite "acao" e o jogo mostra "ação". As letras podem repetir.',
  'Suba de patente: Gênio chega com 70% dos pontos; Rainha das Abelhas é achar todas as palavras.',
  'Seu progresso fica salvo neste aparelho: saia e volte quando quiser, a fase continua de onde parou.',
];

/** O catálogo de fases do Bee: todas as fases, da mais fácil à mais difícil, com o estado de cada uma. */
export function BeeCatalog() {
  const [levels, setLevels] = useState<BeeLevel[] | null>(null);
  const [tab, setTab] = useState<'fases' | 'regras'>('fases');
  const [filter, setFilter] = useState<Filter>('all');
  const prog = useProgress(beeProgress);

  useEffect(() => {
    void loadBeeLevels().then(setLevels);
  }, []);

  const info = useMemo(() => {
    if (!levels) return null;
    return levels.map((lv, i) => {
      const p = prog[String(i + 1)];
      const status: LevelStatus = !p ? 'new' : p.closed ? 'done' : p.found.length > 0 ? 'open' : 'new';
      let rank = '';
      if (status !== 'new' && p) {
        const puzzle = toBeePuzzle(lv);
        rank = beeRank(beeScore(puzzle, p.found), beeMaxPoints(puzzle)).name;
      }
      return { n: i + 1, status, rank, at: p?.at ?? 0, words: p?.found.length ?? 0 };
    });
  }, [levels, prog]);

  if (!levels || !info) {
    return (
      <WordsShell title="Bee Word's" accent="yellow" className="bee-theme">
        <HexLoader />
      </WordsShell>
    );
  }

  const done = info.filter((x) => x.status === 'done').length;
  const open = info.filter((x) => x.status === 'open').length;
  const last = info.filter((x) => x.status === 'open').sort((a, b) => b.at - a.at)[0];
  const nextNew = info.find((x) => x.status === 'new');
  const pct = Math.round((done / info.length) * 100);

  return (
    <WordsShell title="Bee Word's" accent="yellow" className="bee-theme" right={<Pill tone="paper">{done}/{info.length}</Pill>}>
      <section className="bz-hero" data-testid="bee-hero">
        <BeeMascot className="bz-hero-bee" />
        <div className="bz-hero-text">
          <h2>Colmeia de fases</h2>
          <p>
            {info.length} favos do mais fácil ao mais difícil. Jogue, saia e volte: tudo fica salvo.
          </p>
          <div className="bz-meter" aria-label={`${pct}% concluído`}>
            <i style={{ transform: `scaleX(${done / info.length})` }} />
          </div>
          <div className="bz-stats">
            <span>
              <b>{done}</b> concluídas
            </span>
            <span>
              <b>{open}</b> em andamento
            </span>
            <span>
              <b>{info.length - done - open}</b> novas
            </span>
          </div>
        </div>
      </section>

      {(last || nextNew) && (
        <Link
          to="/words/bee/fase/$n"
          params={{ n: String((last ?? nextNew)!.n) }}
          className="bz-continue"
          data-testid="continue"
          data-sfx="start"
        >
          <span className="bz-continue-n">{(last ?? nextNew)!.n}</span>
          <span>
            <b>{last ? 'Continuar' : 'Começar'}</b>
            <small>
              {last ? `Fase ${last.n} · ${last.words} palavras achadas` : `Fase ${nextNew!.n} · ${tierOf(nextNew!.n - 1, info.length)}`}
            </small>
          </span>
          <i>→</i>
        </Link>
      )}

      <Tabs
        label="Seções"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'fases', label: 'Fases' },
          { id: 'regras', label: 'Como jogar' },
        ]}
      />

      {tab === 'regras' ? (
        <section className="wd-panel">
          <h3>Como jogar</h3>
          <RulesList steps={BEE_RULES} />
        </section>
      ) : (
        <>
          <div className="bz-filters" role="group" aria-label="Filtro">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} data-testid={`filter-${f.id}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>

          {TIERS.map((tier) => {
            const cells = info.filter((x) => tierOf(x.n - 1, info.length) === tier && (filter === 'all' || x.status === filter));
            if (cells.length === 0) return null;
            const all = info.filter((x) => tierOf(x.n - 1, info.length) === tier);
            return (
              <section className="bz-tier" key={tier} aria-label={tier}>
                <h3 className="wd-section">
                  {tier} · fases {all[0]!.n} a {all[all.length - 1]!.n}
                </h3>
                <div className="bz-grid">
                  {cells.map((x, i) => (
                    <Link
                      key={x.n}
                      to="/words/bee/fase/$n"
                      params={{ n: String(x.n) }}
                      className={`bz-cell ${x.status}`}
                      style={{ '--i': i } as CSSProperties}
                      data-testid={`level-${x.n}`}
                      data-status={x.status}
                      aria-label={`Fase ${x.n}: ${x.status === 'done' ? `concluída, ${x.rank}` : x.status === 'open' ? 'em andamento' : 'nova'}`}
                    >
                      <span className="bz-cell-in">
                        <b>{x.n}</b>
                        {x.status === 'done' && (
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {x.status === 'open' && <small>{x.words}</small>}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          <div className="bz-legend mono" aria-hidden="true">
            <span className="new">nova</span>
            <span className="open">em andamento</span>
            <span className="done">concluída</span>
          </div>
        </>
      )}
    </WordsShell>
  );
}
