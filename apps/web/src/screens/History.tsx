import { LoadFailed } from '@/components/LoadFailed';
import { Loader } from '@/components/Loader';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { GameArt, GAME_LABEL } from '@/components/GameArt';
import { FilterChips } from '@/components/FilterChips';
import { Choice } from '@/components/RankingList';
import { toHex } from '@/games/color/hex';
import { formatDiff, formatSeconds } from '@/games/time/format';
import { useAuth } from '@/lib/auth';
import {
  classifyMatch,
  colorRounds,
  fetchHistory,
  fetchRoomPlayers,
  formatPlayedAt,
  kindLabel,
  scoreParts,
  modeLabel,
  timeRounds,
  NO_FILTERS,
  activeFilters,
  type HistoryFilters,
  type HistoryItem,
} from '@/lib/history';
import type { GameId } from '@/lib/stats';
import './history.css';

/** Modos de cada jogo para filtrar (as salas entram pelo filtro de tipo). */
const MODE_FILTERS: Record<GameId, { id: string; label: string }[]> = {
  color: [
    { id: 'classic', label: 'Clássico' },
    { id: 'flash', label: 'Flash' },
    { id: 'quick', label: 'Rápido' },
    { id: 'blind', label: 'Às cegas' },
    { id: 'survival', label: 'Sobrevivência' },
  ],
  time: [
    { id: 'classic', label: 'Clássico' },
    { id: 'quick', label: 'Rápido' },
    { id: 'strict', label: 'Sem estourar' },
    { id: 'sequence', label: 'Sequência' },
    { id: 'survival', label: 'Sobrevivência' },
  ],
  eco: [
    { id: 'classic', label: 'Clássico' },
    { id: 'escalada', label: 'Escalada' },
    { id: 'velocidade', label: 'Velocidade' },
    { id: 'reverso', label: 'Reverso' },
  ],
};

const KIND_FILTERS: { id: 'all' | 'solo' | 'daily' | 'room'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'solo', label: 'Solo' },
  { id: 'daily', label: 'Daily' },
  { id: 'room', label: 'Sala' },
];

const PERIOD_FILTERS: { id: 'all' | 'day' | 'week'; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'day', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
];

const GAMES: { id: GameId; label: string }[] = [
  { id: 'color', label: 'Mesmíssima' },
  { id: 'time', label: 'Já Deu?' },
  { id: 'eco', label: 'Ecooo' },
];

function ColorDetail({ item }: { item: HistoryItem }) {
  const rounds = colorRounds(item);
  if (!rounds) return <Expired />;
  return (
    <ol className="hist-rounds">
      {rounds.map((r, i) => (
        <li key={i} className="hist-round">
          <span className="mono hist-round-n">{i + 1}</span>
          <span
            className="hist-swatch"
            style={{ background: toHex(r.target) }}
            title={toHex(r.target)}
          />
          <span className="mono hist-vs">×</span>
          <span
            className="hist-swatch"
            style={{ background: toHex(r.guess) }}
            title={toHex(r.guess)}
          />
          <span className="mono hist-round-score">{r.score.toFixed(1)}</span>
        </li>
      ))}
    </ol>
  );
}

function TimeDetail({ item }: { item: HistoryItem }) {
  const rounds = timeRounds(item);
  if (!rounds) return <Expired />;
  return (
    <ol className="hist-rounds">
      {rounds.map((r, i) => (
        <li key={i} className="hist-round">
          <span className="mono hist-round-n">{i + 1}</span>
          <span className="mono hist-time">
            {formatSeconds(r.target)} → {formatSeconds(r.answer)}
          </span>
          <span className="mono hist-vs">{formatDiff(r.answer - r.target)}</span>
          <span className="mono hist-round-score">{r.score.toFixed(1)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Eco: o que sobra guardado é a lista de toques; o resumo diz até onde a pessoa chegou. */
function EcoDetail({ item }: { item: HistoryItem }) {
  if (!item.answers) return <Expired />;
  return (
    <p className="mono hist-note">
      {Math.round(item.totalScore / 10)} PASSOS · {item.answers.length} TOQUES
    </p>
  );
}

function Expired() {
  return <p className="mono hist-note">DETALHE EXPIRADO: SÓ O RESUMO FICA GUARDADO.</p>;
}

/** Partida de sala: todos os jogadores, com a colocação e a nota de cada um. */
function RoomPlayers({ item }: { item: HistoryItem }) {
  const q = useQuery({
    queryKey: ['room-players', item.matchId],
    queryFn: () => fetchRoomPlayers(item.matchId),
    staleTime: Infinity,
  });
  if (q.isPending) return <Loader inline />;
  if (q.isError) return <p className="mono hist-note">NÃO DEU PARA CARREGAR QUEM JOGOU.</p>;
  return (
    <ol className="hist-players" aria-label="Quem jogou">
      {q.data.players.map((p, i) => (
        <li key={i} className={`hist-player${p.isMe ? ' me' : ''}`}>
          <span className="mono hist-player-pos">{p.placement ?? '-'}º</span>
          <span className="hist-player-name">{p.username ? `@${p.username}` : 'Ex-jogador'}</span>
        </li>
      ))}
    </ol>
  );
}

function MatchRow({ item }: { item: HistoryItem }) {
  const [open, setOpen] = useState(false);
  const cls = classifyMatch(item);
  return (
    <li className="hist-item">
      <button
        type="button"
        className="hist-row"
        data-sfx="select"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="hist-row-main">
          <span className="hist-row-title">
            {modeLabel(item.mode)}
            <span className="mono hist-badge">{kindLabel(item.kind).toUpperCase()}</span>
          </span>
          <span className="mono hist-row-date">{formatPlayedAt(item.playedAt)}</span>
          <span className={`mono hist-class ${cls.tone}`}>{cls.label}</span>
        </span>
        <span className="hist-row-score">
          {scoreParts(item).main}
          <small className="mono">{scoreParts(item).unit}</small>
        </span>
      </button>
      {open && item.kind === 'room' && <RoomPlayers item={item} />}
      {open &&
        item.kind !== 'room' &&
        (item.game === 'time' ? (
          <TimeDetail item={item} />
        ) : item.game === 'eco' ? (
          <EcoDetail item={item} />
        ) : (
          <ColorDetail item={item} />
        ))}
    </li>
  );
}

/** Histórico separado por jogo; cada partida mostra a classificação (colocação na sala ou faixa da nota). */
export function History() {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const [game, setGame] = useState<GameId>('color');
  /** Página mostrada (0 = a mais recente). As já vistas ficam em cache; a próxima vem do servidor. */
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<HistoryFilters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const active = activeFilters(filters);

  /** Muda um filtro e volta para a primeira página (o resultado é outro). */
  const setFilter = (patch: Partial<HistoryFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };
  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setPage(0);
  };

  const q = useInfiniteQuery({
    queryKey: ['history', game, filters],
    queryFn: ({ pageParam }) => fetchHistory(game, pageParam, filters),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!user,
  });

  const items = q.data?.pages[page]?.items ?? [];
  const hasNext = page + 1 < (q.data?.pages.length ?? 0) || !!q.hasNextPage;
  const goNext = async () => {
    if (page + 1 >= (q.data?.pages.length ?? 0)) await q.fetchNextPage();
    setPage((p) => p + 1);
  };

  if (status !== 'loading' && !user) {
    return (
      <main className="hist">
        <h1>Histórico</h1>
        <p className="lead">
          O histórico guarda as suas partidas de cada jogo. Entre na sua conta para ver o seu.
        </p>
        <div className="hist-guest">
          <Link to="/entrar" className="btn alt">
            Entrar
          </Link>
          <Link to="/criar-conta" className="btn ghost">
            Criar conta
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="hist">
      <h1>Histórico</h1>
      <Choice
        label="Jogo"
        value={game}
        options={GAMES}
        onChange={(g) => {
          setGame(g);
          setPage(0);
          // Os modos mudam de um jogo para o outro: o filtro de modo não vale mais.
          setFilters((f) => ({ ...f, mode: undefined }));
        }}
      />

      <div className="hist-filter">
        <button
          type="button"
          className="hist-filter-toggle"
          aria-expanded={showFilters}
          data-sfx="select"
          onClick={() => setShowFilters((v) => !v)}
        >
          <span>Filtrar</span>
          {active > 0 && <b className="hist-filter-count">{active}</b>}
          <span className="mono hist-filter-hint">{showFilters ? 'FECHAR' : 'ABRIR'}</span>
        </button>
        {active > 0 && (
          <button type="button" className="hist-filter-clear mono" onClick={clearFilters}>
            LIMPAR
          </button>
        )}
      </div>
      {showFilters && (
        <div className="hist-filters">
          <FilterChips
            label="MODO"
            value={filters.mode ?? 'all'}
            options={[{ id: 'all', label: 'Todos' }, ...MODE_FILTERS[game]]}
            onChange={(v) => setFilter({ mode: v === 'all' ? undefined : v })}
          />
          <FilterChips
            label="TIPO"
            value={filters.kind ?? 'all'}
            options={KIND_FILTERS}
            onChange={(v) => setFilter({ kind: v === 'all' ? undefined : v })}
          />
          <FilterChips
            label="PERÍODO"
            value={filters.period}
            options={PERIOD_FILTERS}
            onChange={(v) => setFilter({ period: v })}
          />
        </div>
      )}
      {active > 0 && !showFilters && (
        <p className="mono hist-filter-summary">
          {[
            filters.mode && modeLabel(filters.mode),
            filters.kind && kindLabel(filters.kind),
            filters.period !== 'all' && PERIOD_FILTERS.find((p) => p.id === filters.period)?.label,
          ]
            .filter(Boolean)
            .join(' · ')
            .toUpperCase()}
        </p>
      )}
      <div className="hist-game">
        <GameArt game={game} size="sm" />
        <div className="mono hist-game-name">PARTIDAS DE {GAME_LABEL[game].toUpperCase()}</div>
      </div>
      {q.isPending && q.fetchStatus !== 'paused' && <Loader inline />}
      {(q.isError || (q.isPending && q.fetchStatus === 'paused')) && (
        <LoadFailed what="o histórico" onRetry={() => void q.refetch()} />
      )}
      {q.isSuccess && items.length === 0 && active > 0 && (
        <div className="hist-state">
          <p className="lead">Nenhuma partida de {GAME_LABEL[game]} com esses filtros.</p>
          <button type="button" className="btn ghost" onClick={clearFilters}>
            Limpar filtros
          </button>
        </div>
      )}
      {q.isSuccess && items.length === 0 && active === 0 && (
        <p className="lead">
          Nenhuma partida de {GAME_LABEL[game]} ainda. Jogue uma e ela aparece aqui.
        </p>
      )}
      {items.length > 0 && (
        <ul className="hist-list">
          {items.map((item) => (
            <MatchRow key={item.matchId} item={item} />
          ))}
        </ul>
      )}
      {(page > 0 || hasNext) && (
        <nav className="hist-pager" aria-label="Páginas do histórico">
          <button
            type="button"
            className="btn ghost"
            data-sfx="page"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span className="mono hist-page">PÁGINA {page + 1}</span>
          <button
            type="button"
            className="btn ghost"
            data-sfx="page"
            disabled={!hasNext || q.isFetchingNextPage}
            onClick={() => void goNext()}
          >
            {q.isFetchingNextPage ? 'Carregando...' : 'Próxima'}
          </button>
        </nav>
      )}
    </main>
  );
}
