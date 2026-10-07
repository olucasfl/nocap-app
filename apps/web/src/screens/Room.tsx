import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { Field } from '@/components/Field';
import { MuteButton } from '@/components/MuteButton';
import { useAuth } from '@/lib/auth';
import {
  CODE_RE,
  createRoom,
  joinRoom,
  leaveRoom,
  resumeRoom,
  useRoom,
  type RoomGame,
} from '@/lib/rooms';
import { Final } from './room/Final';
import { Lobby } from './room/Lobby';
import { Play } from './room/Play';
import './account.css';
import './friends.css';
import './room.css';

function Header({ leave, round }: { leave?: boolean; round?: string }) {
  return (
    <header className="top">
      <Link
        to="/"
        className="logo"
        aria-label="Voltar aos jogos"
        onClick={leave ? leaveRoom : undefined}
      >
        no cap<span>!</span>
      </Link>
      <div className="top-actions">
        {round && (
          <div className="chip y" aria-label="Rodada">
            {round}
          </div>
        )}
        <MuteButton />
      </div>
    </header>
  );
}

const GAME_NAME: Record<RoomGame, string> = { color: 'Cor', time: 'Tempo' };

function Entry({
  initialCode,
  initialError,
  game,
}: {
  initialCode?: string;
  initialError?: string;
  game: RoomGame;
}) {
  const navigate = useNavigate();
  const [code, setCode] = useState(initialCode ?? '');
  const [error, setError] = useState(initialError ?? '');
  const [busy, setBusy] = useState(false);
  const message = useRoom((s) => s.message);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await navigate({ to: '/sala' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!CODE_RE.test(c)) return setError('O código tem 4 letras.');
    void run(() => joinRoom(c));
  };

  return (
    <section className="screen rm">
      <h1>Sala</h1>
      <p className="lead">
        {game === 'time'
          ? 'Jogue o Tempo com amigos: o mesmo alvo para todos, cada um conta de cabeça.'
          : 'Jogue a Cor com amigos, todo mundo na mesma rodada ao mesmo tempo.'}
      </p>
      {(error || message) && (
        <p className="acc-failure mono" role="alert">
          {error || message}
        </p>
      )}
      <button
        type="button"
        className="btn alt"
        disabled={busy}
        onClick={() => void run(() => createRoom(game))}
      >
        {busy ? 'Criando...' : `Criar sala de ${GAME_NAME[game]}`}
      </button>
      <form className="rm-join" onSubmit={join} noValidate>
        <Field
          label="Entrar com código"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={4}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          hint="4 letras, como ABCD"
        />
        <button type="submit" className="btn ghost" disabled={busy}>
          Entrar
        </button>
      </form>
    </section>
  );
}

/** `/sala` e `/sala/ABCD`: entra pelo código do link, ou mostra a sala em que você já está. */
export function RoomPage({ code, game = 'color' }: { code?: string; game?: RoomGame }) {
  const { user, status: authStatus } = useAuth();
  const { status, snapshot } = useRoom();
  const [resuming, setResuming] = useState(true);
  const autoJoined = useRef(false);

  useEffect(() => {
    let alive = true;
    void resumeRoom().finally(() => alive && setResuming(false));
    return () => {
      alive = false;
    };
  }, []);

  // Link ou convite (/sala/ABCD): entra direto, sem digitar o código. Uma tentativa só.
  const [joinError, setJoinError] = useState('');
  useEffect(() => {
    if (!code || !user || resuming || snapshot || autoJoined.current) return;
    if (status === 'connecting' || status === 'reconnecting') return;
    autoJoined.current = true;
    joinRoom(code).catch((e: unknown) =>
      setJoinError(e instanceof Error ? e.message : 'Não foi possível entrar.'),
    );
  }, [code, user, resuming, snapshot, status]);

  if (authStatus === 'loading' || resuming) {
    return (
      <div className="app">
        <Header />
        <p className="lead rm-wait">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <Header />
        <section className="screen rm">
          <h1>Sala</h1>
          <p className="lead">
            Para jogar em sala você precisa de uma conta, assim seus amigos sabem quem é quem.
          </p>
          <div className="stack">
            <Link to="/criar-conta" className="btn alt">
              Criar conta
            </Link>
            <Link to="/entrar" className="btn ghost">
              Entrar
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        leave={!!snapshot}
        round={
          snapshot?.round && snapshot.phase !== 'lobby' && snapshot.phase !== 'final'
            ? `${snapshot.round.index + 1}/${snapshot.round.total}`
            : undefined
        }
      />
      {status === 'reconnecting' && (
        <p className="rm-banner mono" role="status">
          RECONECTANDO À SALA...
        </p>
      )}
      {!snapshot && status === 'connecting' && <p className="lead rm-wait">Entrando na sala...</p>}
      {!snapshot && status !== 'connecting' && (
        <Entry initialCode={code} initialError={joinError} game={game} />
      )}
      {snapshot?.phase === 'lobby' && <Lobby snapshot={snapshot} />}
      {snapshot && ['show', 'pick', 'play', 'reveal'].includes(snapshot.phase) && (
        <Play snapshot={snapshot} />
      )}
      {snapshot?.phase === 'final' && <Final snapshot={snapshot} />}
    </div>
  );
}

const searchRoute = getRouteApi('/sala');

/** `/sala?jogo=time`: a entrada já sabe de qual jogo é a sala a criar. */
export function RoomEntryPage() {
  const { jogo } = searchRoute.useSearch();
  return <RoomPage game={jogo} />;
}

const codeRoute = getRouteApi('/sala/$code');

/** `/sala/ABCD`: o link de convite já traz o código. */
export function RoomCodePage() {
  const { code } = codeRoute.useParams();
  return <RoomPage code={code.toUpperCase()} />;
}
