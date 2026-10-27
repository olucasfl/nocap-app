import { Loader } from '@/components/Loader';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { BackButton } from '@/components/BackButton';
import { Field } from '@/components/Field';
import { MuteButton } from '@/components/MuteButton';
import { LoadFailed } from '@/components/LoadFailed';
import { RoomBanner } from '@/components/RoomBanner';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { NicknameDialog } from '@/components/NicknameDialog';
import { useRoomEntry } from '@/lib/my-room';
import { useAuth } from '@/lib/auth';
import { sfx } from '@/lib/sfx';
import { useOnline } from '@/lib/network';
import { useUpdateNeeded } from '@/lib/update-state';
import { clearLastGame, resumeRoom, useRoom, type RoomGame } from '@/lib/rooms';
import { ChatDock } from '@/components/Chat';
import { Final } from './room/Final';
import { Lobby } from './room/Lobby';
import { Play } from './room/Play';
import { AtravessaRoomPlay } from '@/games/atravessa/AtravessaRoomPlay';
import { DesmoronaRoomPlay } from '@/games/desmorona/DesmoronaRoomPlay';
import { BolaRoomPlay } from '@/games/bola/BolaRoomPlay';
import './account.css';
import './friends.css';
import './room.css';
import { Page } from '@/components/Page';

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
const GAME_PAGE: Record<
  Exclude<RoomGame, 'desmorona' | 'bola' | 'foxcap'>,
  '/cor' | '/tempo' | '/eco' | '/atravessa'
> = {
  color: '/cor',
  time: '/tempo',
  impostor: '/cor',
  eco: '/eco',
  atravessa: '/atravessa',
} as const;

const GAME_NAME: Record<RoomGame, string> = {
  desmorona: 'Desmorona!',
  bola: 'Fut Fox',
  foxcap: 'Fox Cap!',
  color: 'Mesmíssima',
  time: 'Já Deu?',
  impostor: 'Intruso',
  eco: 'Ecooo',
  atravessa: 'Atravessa!',
};

const ENTRY_LEAD: Record<RoomGame, string> = {
  foxcap:
    'Sala do Fox Cap!: a sala nasce sem jogo. Dentro dela você convida a galera e escolhe (e troca) o jogo: Fut Fox, Atravessa! ou Desmorona!.',
  bola: 'Fut Fox com os amigos: futebol de raposas com 2, 3 ou 4 times, até 15 pessoas na sala (12 jogam e o resto assiste). Você escolhe o formato e completa os times com bots dentro da sala.',
  desmorona:
    'Desmorona! com os amigos: todo mundo cai do céu, o chão some a cada passo e vence o último de pé. De 2 a 8 pessoas.',
  eco: 'Jogue o Ecooo com amigos: Corrida (todo mundo repete a mesma sequência e quem errar sai) ou Siga o Líder (um cria, os outros repetem). Você escolhe dentro da sala.',
  color: 'Jogue Mesmíssima com amigos, todo mundo na mesma rodada ao mesmo tempo.',
  time: 'Jogue Já Deu? com amigos: o mesmo alvo para todos, cada um conta de cabeça.',
  impostor:
    'O Intruso precisa de uma sala com no mínimo 3 pessoas: alguns não veem a cor, só uma dica, e todo mundo vota em quem desconfia.',
  atravessa:
    'Atravesse com os amigos no mesmo mapa, cada um com a sua cor: Checkpoint (corrida até o fim, voltando ao último checkpoint ao morrer) ou Infinito (vale a soma dos metros das rodadas). Até 8 pessoas.',
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
              : game === 'atravessa' || game === 'desmorona' || game === 'bola' || game === 'foxcap'
                ? '/fox-cap'
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
      <div className="rm-choices">
        <section className="rm-choice">
          <h2>Criar uma sala</h2>
          <p className="mono">Você é o líder: escolhe as regras, convida a galera e começa.</p>
          <button
            type="button"
            className="btn alt"
            disabled={entry.busy}
            onClick={() => void entry.create(game)}
          >
            {entry.busy ? 'Criando...' : `Criar sala de ${GAME_NAME[game]}`}
          </button>
        </section>
        <form className="rm-choice rm-join" onSubmit={join} noValidate>
          <h2>Entrar com código</h2>
          <p className="mono">
            Peça ao líder o código de 4 letras (ou abra o link que ele mandou).
          </p>
          <Field
            label="Código da sala"
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
      </div>
    </section>
  );
}

/** `/sala` e `/sala/ABCD`: entra pelo código do link, ou mostra a sala em que você já está. */
export function RoomPage({ code, game = 'color' }: { code?: string; game?: RoomGame }) {
  const online = useOnline();
  const { status: authStatus } = useAuth();
  const { status, snapshot, lastGame, message } = useRoom();
  const navigate = useNavigate();
  // com código no endereço a entrada automática já continua depois de atualizar; sem código, retoma o que a pessoa pediu
  const entry = useRoomEntry({ resume: !code });
  const [resuming, setResuming] = useState(true);
  const autoJoined = useRef(false);
  /** A entrada automática pelo link já foi tentada (até lá a tela mostra só o carregando, sem piscar a entrada). */
  const [autoTried, setAutoTried] = useState(false);
  const updateNeeded = useUpdateNeeded((s) => s.needed);
  const inRoom = !!snapshot;

  // Saiu da sala (por conta própria): volta para a página do jogo dela, na aba de amigos.
  // Se houve um aviso (expulso, sala encerrada), fica na entrada para a pessoa ler.
  useEffect(() => {
    if (snapshot || !lastGame || message) return;
    if (status !== 'closed' && status !== 'idle') return;
    clearLastGame();
    // os jogos do Fox Cap! (Fut Fox, Desmorona!, Atravessa!) voltam para a tela do Fox Cap!
    if (
      lastGame === 'desmorona' ||
      lastGame === 'bola' ||
      lastGame === 'foxcap' ||
      lastGame === 'atravessa'
    )
      void navigate({ to: '/fox-cap' });
    else void navigate({ to: GAME_PAGE[lastGame], search: { aba: 'friends' } });
  }, [snapshot, lastGame, message, status, navigate]);
  // Dentro da sala o endereço é sempre o link dela (/sala/ABCD), para copiar do navegador e mandar.
  useEffect(() => {
    if (snapshot && !code)
      void navigate({ to: '/sala/$code', params: { code: snapshot.code }, replace: true });
  }, [snapshot, code, navigate]);
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
    // com versão nova esperando, o aviso de atualizar vem antes de entrar (o link continua valendo depois)
    if (!code || resuming || snapshot || autoJoined.current || updateNeeded) return;
    // já conectada (acabou de entrar e o primeiro estado ainda não chegou): não entra de novo
    if (status === 'connecting' || status === 'reconnecting' || status === 'connected') return;
    autoJoined.current = true;
    setAutoTried(true);
    void entry.join(code);
  }, [code, resuming, snapshot, status, entry, updateNeeded]);

  // Um carregando só: conectando, entrando, ou esperando a entrada automática do link começar.
  const joining =
    !snapshot &&
    (status === 'connecting' ||
      entry.busy ||
      (!!code && !autoTried && !entry.error && !entry.nick.open));

  if (authStatus === 'loading' || resuming) {
    return (
      <Page>
        <Header />
        <Loader />
      </Page>
    );
  }

  if (!online && !snapshot) {
    return (
      <Page>
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
      </Page>
    );
  }

  // A corrida do Atravessa! ocupa a tela toda (sem cabeçalho nem navegação).
  if (snapshot?.game === 'atravessa' && (snapshot.phase === 'show' || snapshot.phase === 'play')) {
    return <AtravessaRoomPlay snapshot={snapshot} />;
  }

  if (snapshot?.game === 'desmorona' && (snapshot.phase === 'show' || snapshot.phase === 'play')) {
    return <DesmoronaRoomPlay snapshot={snapshot} />;
  }

  if (snapshot?.game === 'bola' && (snapshot.phase === 'play' || snapshot.phase === 'final')) {
    return <BolaRoomPlay snapshot={snapshot} />;
  }

  return (
    <Page rail={!snapshot || snapshot.phase === 'lobby' || snapshot.phase === 'final'}>
      <Header
        round={
          snapshot &&
          snapshot.game !== 'atravessa' &&
          snapshot.game !== 'desmorona' &&
          snapshot.game !== 'bola' &&
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
      {joining && <Loader label="Entrando na sala" />}
      {!snapshot && !joining && <Entry initialCode={code} game={lastGame ?? game} entry={entry} />}
      <NicknameDialog nick={entry.nick} />
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
    </Page>
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
