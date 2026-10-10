import { Loader } from '@/components/Loader';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { BackButton } from '@/components/BackButton';
import { Field } from '@/components/Field';
import { MuteButton } from '@/components/MuteButton';
import { LoadFailed } from '@/components/LoadFailed';
import { RoomBanner } from '@/components/RoomBanner';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { useRoomEntry } from '@/lib/my-room';
import { useAuth } from '@/lib/auth';
import { sfx } from '@/lib/sfx';
import { useOnline } from '@/lib/network';
import { clearLastGame, resumeRoom, useRoom, type RoomGame } from '@/lib/rooms';
import { ChatDock } from '@/components/Chat';
import { Final } from './room/Final';
import { Lobby } from './room/Lobby';
import { Play } from './room/Play';
import './account.css';
import './friends.css';
import './room.css';

/**
 * O logo leva ao início sem tirar a pessoa da sala: lá em cima aparece "Você está na sala" com o
 * caminho de volta. Sair de verdade é com o botão Sair (lobby, pódio e aviso do início).
 */
function Header({ round }: { round?: string }) {
  return (
    <header className="top">
      <Link to="/" className="logo" aria-label="Ir para o início">
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

/** A página de cada jogo (o Intruso é jogado a partir da Mesmíssima). */
const GAME_PAGE = {
  color: '/cor',
  time: '/tempo',
  impostor: '/cor',
  eco: '/eco',
  party: '/nocap',
} as const;

const GAME_NAME: Record<RoomGame, string> = {
  color: 'Mesmíssima',
  time: 'Já Deu?',
  impostor: 'Intruso',
  eco: 'Ecooo',
  party: 'NoCap!',
};

const ENTRY_LEAD: Record<RoomGame, string> = {
  eco: 'Jogue o Ecooo com amigos: Corrida (todo mundo repete a mesma sequência e quem errar sai) ou Siga o Líder (um cria, os outros repetem). Você escolhe dentro da sala.',
  color: 'Jogue Mesmíssima com amigos, todo mundo na mesma rodada ao mesmo tempo.',
  time: 'Jogue Já Deu? com amigos: o mesmo alvo para todos, cada um conta de cabeça.',
  impostor:
    'O Intruso precisa de uma sala com no mínimo 3 pessoas: alguns não veem a cor, só uma dica, e todo mundo vota em quem desconfia.',
  party:
    'Jogue NoCap! com amigos: micro-desafios rápidos e minijogos grandes, todos jogando ao mesmo tempo.',
};

function Entry({
  initialCode,
  game,
  entry,
}: {
  initialCode?: string;
  game: RoomGame;
  entry: ReturnType<typeof useRoomEntry>;
}) {
  const [code, setCode] = useState(initialCode ?? '');
  const message = useRoom((s) => s.message);

  const join = (e: FormEvent) => {
    e.preventDefault();
    void entry.join(code);
  };

  return (
    <section className="screen rm">
      <BackButton
        to={
          game === 'time'
            ? '/tempo'
            : game === 'eco'
              ? '/eco'
              : game === 'party'
                ? '/nocap'
                : '/cor'
        }
        label="Voltar ao jogo"
      />
      <h1>Sala</h1>
      <RoomBanner />
      <p className="lead">{ENTRY_LEAD[game]}</p>
      {(entry.error || message) && (
        <p className="acc-failure mono" role="alert">
          {entry.error || message}
        </p>
      )}
      <button
        type="button"
        className="btn alt"
        disabled={entry.busy}
        onClick={() => void entry.create(game)}
      >
        {entry.busy ? 'Criando...' : `Criar sala de ${GAME_NAME[game]}`}
      </button>
      <form className="rm-join" onSubmit={join} noValidate>
        <Field
          label="Entrar com código"
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
        />
        <button type="submit" className="btn ghost" disabled={entry.busy}>
          {entry.busy ? 'Entrando...' : initialCode && entry.error ? 'Tentar de novo' : 'Entrar'}
        </button>
      </form>
    </section>
  );
}

/** `/sala` e `/sala/ABCD`: entra pelo código do link, ou mostra a sala em que você já está. */
export function RoomPage({ code, game = 'color' }: { code?: string; game?: RoomGame }) {
  const online = useOnline();
  const { user, status: authStatus } = useAuth();
  const { status, snapshot, lastGame, message } = useRoom();
  const navigate = useNavigate();
  const entry = useRoomEntry();
  const [resuming, setResuming] = useState(true);
  const autoJoined = useRef(false);
  const inRoom = !!snapshot;

  // Saiu da sala (por conta própria): volta para a página do jogo dela, na aba de amigos.
  // Se houve um aviso (expulso, sala encerrada), fica na entrada para a pessoa ler.
  useEffect(() => {
    if (snapshot || code || !lastGame || message) return;
    if (status !== 'closed' && status !== 'idle') return;
    clearLastGame();
    void navigate({ to: GAME_PAGE[lastGame], search: { aba: 'friends' } });
  }, [snapshot, code, lastGame, message, status, navigate]);
  useEffect(() => {
    if (inRoom) sfx.roomJoin();
  }, [inRoom]);

  useEffect(() => {
    let alive = true;
    void resumeRoom().finally(() => alive && setResuming(false));
    return () => {
      alive = false;
    };
  }, []);

  // Link ou convite (/sala/ABCD): entra direto, sem digitar o código. Uma tentativa automática;
  // se falhar, a tela mostra o motivo e o botão "Tentar de novo".
  useEffect(() => {
    if (!code || !user || resuming || snapshot || autoJoined.current) return;
    if (status === 'connecting' || status === 'reconnecting') return;
    autoJoined.current = true;
    void entry.join(code);
  }, [code, user, resuming, snapshot, status, entry]);

  if (authStatus === 'loading' || resuming) {
    return (
      <div className="app">
        <Header />
        <Loader />
      </div>
    );
  }

  if (!online && !snapshot) {
    return (
      <div className="app">
        <Header />
        <section className="screen rm">
          <LoadFailed
            what="a sala"
            offlineText="Sem internet não dá para jogar com amigos. Volte quando a conexão voltar."
          />
          <Link to="/" className="btn ghost">
            Voltar aos jogos
          </Link>
        </section>
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
        round={
          snapshot &&
          snapshot.game !== 'party' &&
          snapshot?.round &&
          snapshot.phase !== 'lobby' &&
          snapshot.phase !== 'final'
            ? `${snapshot.round.index + 1}/${snapshot.round.total}`
            : undefined
        }
      />
      {status === 'reconnecting' && (
        <p className="rm-banner mono" role="status">
          RECONECTANDO À SALA...
        </p>
      )}
      {!snapshot && status === 'connecting' && <Loader label="Entrando na sala" />}
      {!snapshot && status !== 'connecting' && !entry.busy && (
        <Entry initialCode={code} game={lastGame ?? game} entry={entry} />
      )}
      {!snapshot && entry.busy && <Loader label="Entrando na sala" />}
      <RoomConflictDialog
        open={!!entry.conflict}
        code={entry.conflict?.code ?? null}
        onBack={entry.backToCurrent}
        onLeave={() => void entry.leaveAndContinue()}
        onCancel={entry.dismissConflict}
      />
      {snapshot?.phase === 'lobby' && <Lobby snapshot={snapshot} />}
      {snapshot &&
        [
          'create',
          'show',
          'pick',
          'play',
          'vote',
          'reveal',
          'intro',
          'micro',
          'ranking',
          'tutorial',
          'big',
        ].includes(snapshot.phase) && <Play snapshot={snapshot} />}
      {snapshot?.phase === 'final' && <Final snapshot={snapshot} />}
      {snapshot && <ChatDock snapshot={snapshot} />}
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
