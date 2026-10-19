import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import { useAuth } from '@/lib/auth';
import { BeeArt, ClassicArt, ConnectArt } from './words-art';
import { Pill, WordsShell } from './words-kit';
import { fetchDaily } from './words-api';
import meta from './levels/meta.json';
import { beeProgress, connectProgress, useProgress } from './levels/progress';

const TILES: [string, string][] = [
  ['W', 'g'],
  ['O', 'y'],
  ['R', 'p'],
  ['D', 'g'],
  ['S', 'y'],
];

/** O grupo Word's. O Classic tem Daily e ranking; o Bee e o Connect são fases offline, salvas no aparelho. */
export function WordsPage() {
  const user = useAuth((s) => s.user);
  const classic = useQuery({ queryKey: ['words', 'daily'], queryFn: fetchDaily, enabled: !!user, retry: false });
  const bee = useProgress(beeProgress);
  const connect = useProgress(connectProgress);
  const beeDone = Object.values(bee).filter((p) => p.closed).length;
  const connectDone = Object.keys(connect).filter((k) => {
    const g = connect[k]!.guesses;
    return g.length >= 4;
  }).length;

  const classicTag = !user
    ? 'Entre para jogar'
    : !classic.data
      ? '...'
      : classic.data.run
        ? classic.data.run.state === 'open'
          ? 'Daily em andamento'
          : 'Daily feito'
        : 'Daily disponível';

  const games = [
    {
      key: 'classic',
      to: '/words/classic',
      name: "Classic Word's",
      desc: 'Descubra a palavra de 5 letras. Daily, 1, 2 ou 4 palavras, com ranking.',
      art: <ClassicArt />,
      tags: [classicTag, 'Ranking'],
      good: classicTag === 'Daily feito',
    },
    {
      key: 'connect',
      to: '/words/connect',
      name: "Connect Word's",
      desc: 'Separe 16 palavras em 4 grupos escondidos.',
      art: <ConnectArt />,
      tags: [`${meta.connect} fases`, connectDone > 0 ? `${connectDone} jogadas` : 'Offline'],
      good: false,
    },
    {
      key: 'bee',
      to: '/words/bee',
      name: "Bee Word's",
      desc: 'Forme o máximo de palavras com 7 letras.',
      art: <BeeArt />,
      tags: [`${meta.bee} fases`, beeDone > 0 ? `${beeDone} concluídas` : 'Offline'],
      good: false,
    },
  ] as const;

  return (
    <WordsShell title="Word's">
      <section className="wd-hero" aria-label="Jogos de palavras">
        <div className="wd-hero-tiles" aria-hidden="true">
          {TILES.map(([l, c], i) => (
            <i key={l} className={c} style={{ '--i': i } as CSSProperties}>
              {l}
            </i>
          ))}
        </div>
        <h2>Jogos de palavras</h2>
        <p>Classic com Daily e ranking. Connect e Bee têm centenas de fases para jogar quando quiser.</p>
      </section>

      <div className="wd-games">
        {games.map((g, i) => (
          <Link key={g.key} to={g.to} className={`wd-card ${g.key}`} style={{ '--i': i } as CSSProperties} data-sfx="start" data-testid={`game-${g.key}`}>
            <div className="wd-card-art">{g.art}</div>
            <div className="wd-card-body">
              <div className="wd-card-name">{g.name}</div>
              <div className="wd-card-desc">{g.desc}</div>
              <div className="wd-card-tags">
                <Pill tone={g.good ? 'good' : 'paper'}>{g.tags[0]}</Pill>
                <Pill tone="paper">{g.tags[1]}</Pill>
              </div>
            </div>
            <span className="wd-card-go" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>
    </WordsShell>
  );
}
