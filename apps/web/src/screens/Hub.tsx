import {
  AtravessaArt,
  BlocksArt,
  BolaArt,
  ColorArt,
  CounterFoxArt,
  DesmoronaArt,
  EcoArt,
  FoxGpArt,
  MiniGolfArt,
  PingArt,
  TimeArt,
} from '@/components/HubArt';
import { Link } from '@tanstack/react-router';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { WordsHubArt } from '@/games/words/words-art';
import { useQuery } from '@tanstack/react-query';
import { Field } from '@/components/Field';
import { Check, Door, Search } from '@/components/icons';
import { NicknameDialog } from '@/components/NicknameDialog';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { fetchFriends } from '@/lib/friends';
import { norm } from '@/lib/home-daily';
import { useRoomEntry } from '@/lib/my-room';
import { MuteButton } from '@/components/MuteButton';
import { RoomBanner } from '@/components/RoomBanner';
import { ThemeButton } from '@/components/ThemeButton';
import { useAuth } from '@/lib/auth';
import {
  bestTenths,
  fetchStats,
  formatBest,
  streakLabel,
  type GameId,
  type Stats,
} from '@/lib/stats';
import './hub.css';

/** Recorde do modo Clássico do jogo (os outros modos mostram o recorde na ficha de cada um). */
function bestLabel(stats: Stats | undefined, game: GameId): string | null {
  if (!stats) return null;
  const best = bestTenths(stats, game, 'classic');
  if (best <= 0) return 'SEM RECORDE NO CLÁSSICO';
  return `RECORDE CLÁSSICO ${formatBest(game, 'classic', best)}`;
}

/** O recorde do Atravessa!: o da conta (sem conta não há recorde). */
function atravessaBestLabel(stats: Stats | undefined): string | null {
  if (!stats) return null;
  const rows = Math.floor(bestTenths(stats, 'atravessa', 'infinito') / 10);
  return rows > 0 ? `RECORDE ${rows} LINHAS` : 'SEM RECORDE AINDA';
}

/** O recorde do Block's: o da conta (sem conta não há recorde). */
function blocksBestLabel(stats: Stats | undefined): string | null {
  if (!stats) return null;
  const points = Math.floor(bestTenths(stats, 'blocks', 'classic') / 10);
  return points > 0 ? `RECORDE ${points} PTS` : 'SEM RECORDE AINDA';
}

/** Os Dailys de hoje: de onde sai o desafio do dia. */
const DAILIES = [
  { game: 'color', name: 'Mesmíssima', to: '/cor', cls: 'hub-card-color', art: <ColorArt /> },
  { game: 'time', name: 'Já Deu?', to: '/tempo', cls: 'hub-card-time', art: <TimeArt /> },
  { game: 'eco', name: 'Ecooo', to: '/eco', cls: 'hub-card-eco', art: <EcoArt /> },
  { game: 'wclassic', name: "Word's", to: '/words/classic/daily', cls: 'hub-card-words', art: <WordsHubArt /> },
] as const;

/** Um cartão de jogo (a capa). `wide` ocupa a linha inteira, com a capa ao lado do texto. */
function GameCard({
  to,
  search,
  cls,
  art,
  name,
  size,
  lines,
  wide = false,
  badge,
  loading = false,
}: {
  to: string;
  search?: Record<string, string>;
  cls: string;
  art: ReactNode;
  name: string;
  size?: 'mid' | 'long';
  lines: (string | null)[];
  wide?: boolean;
  badge?: string;
  /** A conta ainda carrega: no lugar do recorde vai uma barrinha apagada. */
  loading?: boolean;
}) {
  return (
    <Link
      to={to as '/'}
      search={search as never}
      className={`hub-card ${cls}${wide ? ' wide' : ''}`}
      data-sfx="start"
      data-testid={`card-${cls.replace('hub-card-', '')}`}
    >
      {badge && <span className="hz-badge mono">{badge}</span>}
      <div className="hub-art">{art}</div>
      <div className="hub-card-foot">
        <div className={`hub-card-name${size ? ` ${size}` : ''}`}>{name}</div>
        {loading ? (
          <div className="hub-card-meta skel" aria-hidden="true" />
        ) : (
          lines
            .filter((l): l is string => !!l)
            .map((l) => (
              <div key={l} className="mono hub-card-meta">
                {l}
              </div>
            ))
        )}
      </div>
    </Link>
  );
}

interface GameDef {
  id: string;
  section: 'action' | 'sport' | 'brain';
  to: string;
  search?: Record<string, string>;
  cls: string;
  art: ReactNode;
  name: string;
  tag: string;
  size?: 'mid' | 'long';
  wide?: boolean;
  badge?: string;
}

/** Todos os jogos da tela inicial, em três categorias: Ação, Esportes e duelos, e Palavras, cores e mente. */
const GAMES: GameDef[] = [
  { id: 'counter', section: 'action', to: '/fox-cap/counter-fox', cls: 'hub-card-counter', art: <CounterFoxArt />, name: 'Counter Fox', tag: 'Tiro 3D', size: 'long' },
  { id: 'bola', section: 'sport', to: '/fox-cap', search: { jogo: 'bola' }, cls: 'hub-card-bola', art: <BolaArt />, name: 'Fut Fox', tag: 'Futebol' },
  { id: 'foxgp', section: 'action', to: '/fox-cap', search: { jogo: 'foxgp' }, cls: 'hub-card-foxgp', art: <FoxGpArt />, name: 'Fox GP', tag: 'Corrida', badge: 'NOVO' },
  { id: 'atravessa', section: 'action', to: '/fox-cap', search: { jogo: 'atravessa' }, cls: 'hub-card-atravessa', art: <AtravessaArt />, name: 'Atravessa!', tag: 'Reflexo', size: 'long' },
  { id: 'pingpong', section: 'sport', to: '/fox-cap', search: { jogo: 'pingpong' }, cls: 'hub-card-ping', art: <PingArt />, name: 'Ping Fox!', tag: 'Duelo' },
  { id: 'desmorona', section: 'action', to: '/fox-cap', search: { jogo: 'desmorona' }, cls: 'hub-card-desmorona', art: <DesmoronaArt />, name: 'Desmorona!', tag: 'Sobrevivência', size: 'long' },
  { id: 'minigolf', section: 'sport', to: '/minigolf', cls: 'hub-card-golf', art: <MiniGolfArt />, name: 'Mini Golf', tag: 'Golfe', badge: 'NOVO' },
  { id: 'words', section: 'brain', to: '/words', cls: 'hub-card-words', art: <WordsHubArt />, name: "Word's", tag: 'Palavras', wide: true },
  { id: 'blocks', section: 'brain', to: '/blocks', cls: 'hub-card-blocks', art: <BlocksArt />, name: "Block's", tag: 'Blocos' },
  { id: 'color', section: 'brain', to: '/cor', cls: 'hub-card-color', art: <ColorArt />, name: 'Mesmíssima', tag: 'Cores', size: 'long' },
  { id: 'time', section: 'brain', to: '/tempo', cls: 'hub-card-time', art: <TimeArt />, name: 'Já Deu?', tag: 'Tempo', size: 'mid' },
  { id: 'eco', section: 'brain', to: '/eco', cls: 'hub-card-eco', art: <EcoArt />, name: 'Ecooo', tag: 'Memória' },
];

export function Hub() {
  const user = useAuth((s) => s.user);
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    enabled: !!user,
    retry: false,
  });
  const friends = useQuery({ queryKey: ['friends'], queryFn: fetchFriends, enabled: !!user, retry: false });
  const authStatus = useAuth((s) => s.status);
  const data = user ? stats.data : undefined;
  // a conta (e os números dela) ainda carregando: mostra um carregando, nunca "só com conta"
  const loading = authStatus === 'loading' || (!!user && stats.isPending);
  const streak = data?.visit.current ?? 0;
  const rawName = user?.name?.trim().split(/\s+/)[0] || user?.username || '';
  const firstName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : '';

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const q = norm(query.trim());
  const visible = (g: GameDef) => !q || norm(`${g.name} ${g.tag}`).includes(q);
  const actionGames = GAMES.filter((g) => g.section === 'action' && visible(g));
  const sportGames = GAMES.filter((g) => g.section === 'sport' && visible(g));
  const brainGames = GAMES.filter((g) => g.section === 'brain' && visible(g));

  const today = useMemo(() => {
    const list = DAILIES.map((d) => ({
      ...d,
      done: !!data?.daily[d.game]?.playedToday,
      plays: (data?.modes ?? [])
        .filter((m) => m.game === d.game)
        .reduce((n, m) => n + m.matches, 0),
    }));
    return { list, doneCount: list.filter((d) => d.done).length, total: list.length };
  }, [data]);

  const online = (friends.data?.friends ?? []).filter((f) => f.online);

  const entry = useRoomEntry();
  const [code, setCode] = useState('');
  const [roomOpen, setRoomOpen] = useState(false);
  const join = (e: FormEvent) => {
    e.preventDefault();
    void entry.join(code);
  };

  const cardLines = (id: string): (string | null)[] => {
    if (id === 'atravessa') return [atravessaBestLabel(data)];
    if (id === 'blocks') return [blocksBestLabel(data)];
    if (id === 'color' || id === 'time' || id === 'eco') return [bestLabel(data, id)];
    if (id === 'words') return ['DAILY COM RANKING E CENTENAS DE FASES'];
    return [g_tag(id)];
  };
  const g_tag = (id: string) => (GAMES.find((g) => g.id === id)?.tag ?? '').toUpperCase();
  const needsLoad = (id: string) => ['atravessa', 'blocks', 'color', 'time', 'eco'].includes(id);

  const renderCard = (g: GameDef) => (
    <GameCard
      key={g.id}
      to={g.to}
      search={g.search}
      cls={g.cls}
      art={g.art}
      name={g.name}
      size={g.size}
      wide={g.wide}
      badge={g.badge}
      lines={cardLines(g.id)}
      loading={needsLoad(g.id) && loading}
    />
  );

  return (
    <main className="hub hz">
      <header className="top">
        <div className="logo hub-logo">
          no cap<span>!</span>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="hz-search-btn"
            aria-label={searching ? 'Fechar a busca' : 'Buscar jogo'}
            aria-expanded={searching}
            onClick={() => {
              setSearching((v) => !v);
              setQuery('');
            }}
            data-testid="hub-search-btn"
          >
            <Search />
          </button>
          <ThemeButton />
          <MuteButton />
        </div>
      </header>

      {searching && (
        <div className="hz-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jogo"
            aria-label="Buscar jogo"
            autoFocus
            data-testid="hub-search"
          />
        </div>
      )}

      <RoomBanner />

      <aside className="hz-side">
      {!q && (
        <section className="hz-roomtop" aria-label="Sala com a galera">
          <button
            type="button"
            className="hz-roomtop-btn"
            aria-expanded={roomOpen}
            onClick={() => setRoomOpen((v) => !v)}
            data-testid="hub-room-toggle"
          >
            <Door />
            Monte uma sala com a galera
            <span aria-hidden="true">{roomOpen ? '−' : '+'}</span>
          </button>
          {(
            <div className={`hz-room${roomOpen ? ' open' : ''}`}>
              {entry.error && (
                <p className="acc-failure mono" role="alert">
                  {entry.error}
                </p>
              )}
              <button
                type="button"
                className="btn alt"
                disabled={entry.busy}
                onClick={() => void entry.create('foxcap')}
                data-testid="hub-create-room"
              >
                {entry.busy ? 'Criando...' : 'Criar sala'}
              </button>
              <form className="hz-room-join" onSubmit={join} noValidate>
                <Field
                  label="Ou entre com o código"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    entry.clearError();
                  }}
                  maxLength={4}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  hint="4 letras, como ABCD"
                  data-testid="hub-room-code"
                />
                <button type="submit" className="btn ghost" disabled={entry.busy}>
                  Entrar
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      {!q && (
        <>

          <section className="hz-sec hz-today-sec" aria-label="Desafio do dia">
            <h2 className="hz-h">
              Desafio do dia{' '}
              <small className="mono">
                {loading ? 'DAILYS DE HOJE' : today.doneCount === today.total ? 'TUDO FEITO, VOLTE AMANHÃ' : `${today.doneCount}/${today.total} FEITOS`}
              </small>
            </h2>
            <ul className="hz-dailies" data-testid="daily-row">
              {today.list.map((d) => (
                <li key={d.game}>
                  <Link
                    to={d.to as '/'}
                    search={d.game === 'wclassic' ? undefined : ({ modo: 'daily' } as never)}
                    className={`hz-dt ${d.cls}${d.done ? ' is-done' : ' is-todo'}`}
                    data-sfx="start"
                    data-testid={`daily-${d.game}`}
                    aria-label={`${d.name}: daily ${d.done ? 'feito' : 'para jogar'}`}
                  >
                    <span className="hz-dt-band mono" aria-hidden="true">
                      {d.done ? <><Check size={12} /> FEITO</> : 'DAILY'}
                    </span>
                    <span className="hz-dt-art" aria-hidden="true">
                      {d.art}
                    </span>
                    {!d.done && !loading && <span className="hz-dt-mark todo mono" aria-hidden="true">JOGAR</span>}
                  </Link>
                  <span className="hz-dt-name">{d.name}</span>
                </li>
              ))}
            </ul>
          </section>

          {online.length > 0 && (
            <section className="hz-sec hz-online-sec" aria-label="Amigos online">
              <h2 className="hz-h">
                Amigos online <small className="mono">{online.length} AGORA</small>
                <Link to="/amigos" className="hz-ver mono">
                  Ver
                </Link>
              </h2>
              <ul className="hz-online" data-testid="hub-online">
                {online.slice(0, 6).map((f, i) => (
                  <li key={f.username}>
                    <Link to="/amigos/$username" params={{ username: f.username }} className="hz-friend">
                      <span className="hz-friend-av" data-c={i % 5} aria-hidden="true">
                        {f.username.charAt(0).toUpperCase()}
                        <i />
                      </span>
                      <span className="hz-friend-txt">
                        <span className="hz-friend-name">@{f.username}</span>
                        <small className="hz-friend-st">online</small>
                      </span>
                      <span className="hz-friend-plus" aria-hidden="true">
                        +
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {online.length > 6 && (
                <Link to="/amigos" className="hz-online-more mono">
                  + {online.length - 6} ONLINE
                </Link>
              )}
            </section>
          )}
        </>
      )}
      </aside>

      <div className="hz-games">
      {!q && (
        <section className="hz-hello" aria-label="Resumo">
          <div>
            <h1>{firstName ? `Olá, ${firstName}!` : 'Bora jogar?'}</h1>
            {!user && authStatus === 'ready' && (
              <p className="mono">ENTRE PARA GUARDAR RECORDES E DAILYS</p>
            )}
          </div>
          {streak > 0 && (
            <span className="hz-streak mono" title="Dias seguidos entrando no NoCap">
              <b>{streak}</b> {streakLabel(streak).replace(/^\d+ /, '').toUpperCase()} SEGUIDOS
            </span>
          )}
        </section>
      )}
      {actionGames.length > 0 && (
        <section className="hz-sec" aria-label="Ação">
          <h2 className="hz-h">
            Ação <small className="mono">TIRO, CORRIDA E SOBREVIVÊNCIA</small>
          </h2>
          <div className="hz-grid">{actionGames.map(renderCard)}</div>
        </section>
      )}

      {sportGames.length > 0 && (
        <section className="hz-sec" aria-label="Esportes e duelos">
          <h2 className="hz-h">
            Esportes e duelos <small className="mono">FUTEBOL, PING PONG E GOLFE</small>
          </h2>
          <div className="hz-grid">{sportGames.map(renderCard)}</div>
        </section>
      )}

      {brainGames.length > 0 && (
        <section className="hz-sec" aria-label="Palavras, cores e mente">
          <h2 className="hz-h">
            Palavras, cores e mente <small className="mono">PALAVRAS, BLOCOS, COR, TEMPO E MEMÓRIA</small>
          </h2>
          <div className="hz-grid">{brainGames.map(renderCard)}</div>
        </section>
      )}

      </div>
      {q && actionGames.length === 0 && sportGames.length === 0 && brainGames.length === 0 && (
        <p className="hz-empty mono" data-testid="hub-search-empty">
          NENHUM JOGO COM “{query.trim().toUpperCase()}”
        </p>
      )}

      <NicknameDialog nick={entry.nick} />
      <RoomConflictDialog
        open={!!entry.conflict}
        code={entry.conflict?.code ?? null}
        onBack={entry.backToCurrent}
        onLeave={() => void entry.leaveAndContinue()}
        onCancel={entry.dismissConflict}
      />
    </main>
  );
}
