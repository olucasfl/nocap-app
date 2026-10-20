import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from '@tanstack/react-router';
import { FilterBar, GridLoader, Pill, RulesList, Tabs, WordsShell } from '../words-kit';
import { connectClass, playConnect } from '@nocap/games';
import { loadConnectLevels, tierOf, tierRanges, toConnectPuzzle, type ConnectLevel } from '../levels/levels';
import { connectProgress, useProgress, type LevelStatus } from '../levels/progress';
import { ConnectArt } from '../words-art';
import './connect.css';

type Filter = 'all' | LevelStatus;

export const CONNECT_RULES = [
  'São 16 palavras e 4 grupos escondidos. Marque 4 palavras que têm algo em comum e toque em Enviar.',
  'Não há vidas: cada palpite errado só soma 1 ao contador de erros. "Falta uma" quer dizer que 3 das 4 palavras estão certas.',
  'Você tem 1 dica por fase: ela mostra o nome de um dos grupos que ainda faltam. Se travar, pode desistir (pede confirmação) e as palavras são reveladas.',
  'A cor do grupo mostra a dificuldade: amarelo é o mais fácil, verde, azul e roxo (o mais difícil).',
  'Cuidado com as palavras que servem a dois grupos: só existe uma divisão certa.',
  'Seu progresso fica salvo neste aparelho: saia e volte quando quiser, a fase continua de onde parou.',
];

/** O catálogo de fases do Connect: todos os puzzles, do mais fácil ao mais difícil, com o estado de cada um. */
export function ConnectCatalog() {
  const [levels, setLevels] = useState<ConnectLevel[] | null>(null);
  const [tab, setTab] = useState<'fases' | 'regras'>('fases');
  const [filter, setFilter] = useState<Filter>('all');
  const prog = useProgress(connectProgress);

  useEffect(() => {
    void loadConnectLevels().then(setLevels);
  }, []);

  const info = useMemo(() => {
    if (!levels) return null;
    return levels.map((lv, i) => {
      const p = prog[String(i + 1)];
      if (!p || (p.guesses.length === 0 && !p.gaveUp)) return { n: i + 1, status: 'new' as LevelStatus, groups: [] as number[], won: false, errors: 0, at: 0, klass: '' };
      const state = playConnect(toConnectPuzzle(lv), p.guesses, { gaveUp: p.gaveUp });
      return {
        n: i + 1,
        status: (state.over ? 'done' : 'open') as LevelStatus,
        groups: state.found.map((g) => g.level),
        won: state.won,
        errors: state.errors,
        at: p.at,
        klass: state.over ? connectClass(state.won, state.errors, state.gaveUp).name : '',
      };
    });
  }, [levels, prog]);

  if (!levels || !info) {
    return (
      <WordsShell title="Connect Word's" accent="blue" className="cx-theme">
        <GridLoader />
      </WordsShell>
    );
  }

  const done = info.filter((x) => x.status === 'done').length;
  const open = info.filter((x) => x.status === 'open').length;
  const last = info.filter((x) => x.status === 'open').sort((a, b) => b.at - a.at)[0];
  const nextNew = info.find((x) => x.status === 'new');
  const pct = Math.round((done / info.length) * 100);

  return (
    <WordsShell title="Connect Word's" accent="blue" className="cx-theme" right={<Pill tone="paper">{done}/{info.length}</Pill>}>
      <section className="cx-hero" data-testid="connect-hero">
        <div className="cx-hero-art">
          <ConnectArt />
        </div>
        <div className="cx-hero-text">
          <h2>Ache as conexões</h2>
          <p>{info.length} puzzles do mais fácil ao mais difícil. Tudo fica salvo.</p>
          <div className="cx-meter" aria-label={`${pct}% concluído`}>
            <i style={{ transform: `scaleX(${done / info.length})` }} />
          </div>
          <div className="cx-stats">
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
          to="/words/connect/fase/$n"
          params={{ n: String((last ?? nextNew)!.n) }}
          className="cx-continue"
          data-testid="continue"
          data-sfx="start"
        >
          <span className="cx-continue-n">{(last ?? nextNew)!.n}</span>
          <span>
            <b>{last ? 'Continuar' : 'Começar'}</b>
            <small>
              {last ? `Fase ${last.n} · ${last.groups.length} de 4 grupos` : `Fase ${nextNew!.n} · ${tierOf(levels[nextNew!.n - 1]!)}`}
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
          <RulesList steps={CONNECT_RULES} />
        </section>
      ) : (
        <>
          <FilterBar value={filter} onChange={setFilter} counts={{ all: info.length, new: info.filter((x) => x.status === 'new').length, open: info.filter((x) => x.status === 'open').length, done: info.filter((x) => x.status === 'done').length }} />

          {tierRanges(levels).map(({ tier, from, to }) => {
            const cells = info.filter((x) => x.n >= from && x.n <= to && (filter === 'all' || x.status === filter));
            if (cells.length === 0) return null;
            return (
              <section className="cx-tier" key={tier} aria-label={tier}>
                <h3 className="wd-section">
                  {tier} · fases {from} a {to}
                </h3>
                <div className="cx-grid">
                  {cells.map((x, i) => (
                    <Link
                      key={x.n}
                      to="/words/connect/fase/$n"
                      params={{ n: String(x.n) }}
                      className={`cx-cell ${x.status}${x.status === 'done' ? (x.won ? ' won' : ' lost') : ''}`}
                      style={{ '--i': i } as CSSProperties}
                      data-testid={`level-${x.n}`}
                      data-status={x.status}
                      aria-label={`Fase ${x.n}: ${x.status === 'done' ? (x.won ? `concluída, ${x.errors} ${x.errors === 1 ? 'erro' : 'erros'}` : 'desistência') : x.status === 'open' ? 'em andamento' : 'nova'}`}
                    >
                      <b>{x.n}</b>
                      <span className="cx-bars" aria-hidden="true">
                        {[1, 2, 3, 4].map((l) => (
                          <i key={l} className={x.groups.includes(l) ? `l${l}` : ''} />
                        ))}
                      </span>
                      {x.status === 'done' && <small>{x.won ? (x.errors === 0 ? 'perfeita' : `${x.errors} erro${x.errors > 1 ? 's' : ''}`) : 'desistiu'}</small>}
                      {x.status === 'open' && <small>{x.groups.length}/4</small>}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          <div className="cx-legend mono" aria-hidden="true">
            <span className="new">nova</span>
            <span className="open">em andamento</span>
            <span className="done">concluída</span>
          </div>
        </>
      )}
    </WordsShell>
  );
}
