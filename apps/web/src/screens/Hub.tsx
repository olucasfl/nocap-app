import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { MuteButton } from '@/components/MuteButton';
import { RoomBanner } from '@/components/RoomBanner';
import { ThemeButton } from '@/components/ThemeButton';
import { WORDS_LANDING, useWordsFonts } from '@/games/words/landing/WordsLanding';
import { useAuth } from '@/lib/auth';
import { fetchStats, streakLabel, type GameId, type Stats } from '@/lib/stats';
import { CoverArt, SHELVES, type Poster } from './home/posters';
import './home/home.css';

/** Os Dailys de hoje (cada um leva ao Daily do jogo). */
const DAILIES = [
  {
    game: 'color',
    name: 'Mesmíssima',
    to: '/cor',
    search: { modo: 'daily' },
    a: '#ff7a3d',
    b: '#6a2108',
    word: 'cor',
  },
  {
    game: 'time',
    name: 'Já Deu?',
    to: '/tempo',
    search: { modo: 'daily' },
    a: '#4a8dff',
    b: '#0f2a6a',
    word: 'tempo',
  },
  {
    game: 'eco',
    name: 'Ecooo',
    to: '/eco',
    search: { modo: 'daily' },
    a: '#a06bff',
    b: '#2f1668',
    word: 'sequência',
  },
  {
    game: 'wclassic',
    name: "Word's",
    to: '/words/classic/daily',
    search: undefined,
    a: '#3fcf7d',
    b: '#0b3d2a',
    word: 'palavra',
  },
] as const;

const Check = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="4.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

function PosterCard({ p, i, stats }: { p: Poster; i: number; stats: Stats | undefined }) {
  const done = p.daily ? !!stats?.daily[p.daily as GameId]?.playedToday : false;
  const chip = p.daily && stats ? (done ? 'Daily feito' : 'Daily hoje') : p.badge;
  return (
    <Link
      to={p.to as '/'}
      search={p.search as never}
      className="nh-poster"
      style={{ '--a': p.a, '--b': p.b, '--i': i } as React.CSSProperties}
      data-sfx="start"
      data-testid={`card-${p.id}`}
      aria-label={`${p.name}: ${p.tag}`}
    >
      <svg
        className="art"
        viewBox="0 0 300 400"
        preserveAspectRatio="xMidYMin slice"
        aria-hidden="true"
      >
        <CoverArt id={p.id} />
      </svg>
      {chip && (
        <span className={`nh-chip${done ? ' done' : ''}`}>
          {p.daily && <i />}
          {chip}
        </span>
      )}
      <span className="nh-poster-info">
        <b>{p.name}</b>
        <span>{p.tag}</span>
      </span>
    </Link>
  );
}

/** A Home: o destaque do dia (os 4 Dailys) e os jogos em prateleiras de pôsteres, sem mais nada. */
export function Hub() {
  useWordsFonts();
  const user = useAuth((s) => s.user);
  const authStatus = useAuth((s) => s.status);
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    enabled: !!user,
    retry: false,
  });
  const data = user ? stats.data : undefined;
  const streak = data?.visit.current ?? 0;
  const rawName = user?.name?.trim().split(/\s+/)[0] || user?.username || '';
  const firstName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : '';

  const doneCount = data
    ? DAILIES.filter((d) => data.daily[d.game as GameId]?.playedToday).length
    : 0;
  const next = data ? DAILIES.find((d) => !data.daily[d.game as GameId]?.playedToday) : DAILIES[0];
  const allDone = !!data && !next;
  const theme = allDone ? WORDS_LANDING.color : undefined;
  const ha = next?.a ?? theme?.a ?? '#ff7a3d';
  const hb = next?.b ?? '#2a0f06';

  return (
    <main className="hub nh">
      <header className="top">
        <div className="nh-logo">
          no cap<span>!</span>
        </div>
        <div className="top-actions">
          <ThemeButton />
          <MuteButton />
        </div>
      </header>

      <RoomBanner />

      <section
        className="nh-hero"
        style={{ '--ha': ha, '--hb': hb } as React.CSSProperties}
        aria-label="Dailys de hoje"
        data-testid="home-hero"
      >
        <div className="nh-hero-top">
          <span className="nh-kicker">{firstName ? `Olá, ${firstName}` : 'Bora jogar?'}</span>
          {streak > 0 && (
            <span className="nh-streak" title="Dias seguidos entrando no NoCap">
              {streakLabel(streak).toUpperCase()} SEGUIDOS
            </span>
          )}
        </div>
        <div>
          <h1>
            {allDone
              ? 'Dailys completos!'
              : data
                ? `${doneCount} de ${DAILIES.length} dailys feitos`
                : 'Os dailys de hoje'}
          </h1>
          <p>
            {allDone
              ? 'Volte amanhã para manter a sequência.'
              : data
                ? `Falta o Daily de ${next!.name}.`
                : user || authStatus === 'loading'
                  ? 'Um por jogo, por dia, igual para todo mundo.'
                  : 'Entre para guardar recordes e dailys.'}
          </p>
        </div>
        <div className="nh-hero-row">
          <div className="nh-dots" role="group" aria-label="Um Daily por jogo">
            {DAILIES.map((d) => {
              const done = !!data?.daily[d.game as GameId]?.playedToday;
              return (
                <Link
                  key={d.game}
                  to={d.to as '/'}
                  search={d.search as never}
                  className={`nh-dot${done ? ' done' : ''}`}
                  data-sfx="start"
                  data-testid={`daily-${d.game}`}
                  aria-label={`Daily de ${d.name}${done ? ', feito hoje' : ''}`}
                  title={d.name}
                >
                  {done ? <Check /> : d.name.charAt(0)}
                </Link>
              );
            })}
          </div>
          {next && (
            <Link
              to={next.to as '/'}
              search={next.search as never}
              className="nh-cta"
              data-sfx="start"
              data-testid="home-cta"
            >
              Jogar Daily <i aria-hidden="true">→</i>
            </Link>
          )}
        </div>
      </section>

      {SHELVES.map((shelf) => (
        <section key={shelf.id} className="nh-shelf" aria-label={shelf.title}>
          <div className="nh-shelf-h">
            <h2>{shelf.title}</h2>
            <small>{shelf.sub}</small>
          </div>
          <div className="nh-row">
            {shelf.posters.map((p, i) => (
              <PosterCard key={p.id} p={p} i={i} stats={data} />
            ))}
          </div>
        </section>
      ))}

      <p className="nh-foot">Mais jogos em breve</p>
    </main>
  );
}
