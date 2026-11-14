import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { GameLanding, type LandingGame } from '@/components/GameLanding';
import { HowToPlay, type HowGame } from '@/components/HowToPlay';
import { Loader } from '@/components/Loader';
import { NicknameDialog } from '@/components/NicknameDialog';
import { Page } from '@/components/Page';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { useRoomEntry } from '@/lib/my-room';
import { BolaPicker } from '../bola/BolaPicker';
import type { BolaSetup } from '../bola/BolaPlay';
import { DesmoronaPicker } from './DesmoronaPicker';
import { PingPicker } from '../pingpong/PingPicker';
import { GpPicker } from '../foxgp/GpPicker';
import { GpHome } from '../foxgp/GpHome';
import { loadGarage } from '../foxgp/garage';
import { gpMarkBack, loadLaps, loadPhysics, loadTrack } from '../foxgp/gp-best';
import type { PpBotName } from '@nocap/games';
import '@/screens/account.css';
import '@/screens/room.css';

// o jogo (Three.js) só baixa quando a partida começa
const BolaPlay = lazy(() => import('../bola/BolaPlay').then((m) => ({ default: m.BolaPlay })));
const DesmoronaPlay = lazy(() =>
  import('./DesmoronaPlay').then((m) => ({ default: m.DesmoronaPlay })),
);
const PingPlay = lazy(() => import('../pingpong/PingPlay').then((m) => ({ default: m.PingPlay })));
const GpPlay = lazy(() => import('../foxgp/GpPlay').then((m) => ({ default: m.GpPlay })));

type Flow =
  | 'bola-pick'
  | 'bola-play'
  | 'dsm-pick'
  | 'dsm-play'
  | 'png-pick'
  | 'png-play'
  | 'gp-pick'
  | 'gp-play'
  | null;

/**
 * Fox Cap! (spec 049): a aba "Offline" tem cada modo com "Jogar" (entra na partida sem passar por outra tela) e
 * "Como jogar?" (um popup curto); a aba "Com amigos" cria a sala sem jogo escolhido ou entra por código, ali mesmo.
 */
export function FoxCapPage() {
  const navigate = useNavigate();
  const wanted = useSearch({ strict: false }) as { aba?: string; jogo?: LandingGame; tela?: string };
  const [flow, setFlow] = useState<Flow>(null);
  const [help, setHelp] = useState<HowGame | null>(null);
  const [bola, setBola] = useState<BolaSetup>({ teams: 2, perTeam: 2, minutes: 3 });
  const [bots, setBots] = useState(5);
  const [pingLevel, setPingLevel] = useState<PpBotName>('medio');
  const [gpBots, setGpBots] = useState(5);
  const [round, setRound] = useState(0);
  /** Tela própria do jogo aberta (Jogar abre a tela do jogo, não a partida). Vem do endereço, para voltar sempre para ela. */
  const hub: LandingGame | null = wanted.jogo ?? null;
  // sair de qualquer jogo do Fox Cap! volta para a tela inicial (a lista antiga do Fox Cap! não existe mais)
  const closeHub = () => void navigate({ to: '/' });
  const entry = useRoomEntry({ resume: true });
  /** "Convidar" numa partida offline: sai dela e abre "Com amigos", onde se cria a sala. */
  const goFriends = () => {
    setFlow(null);
    if (hub) void navigate({ to: '/fox-cap', search: { jogo: hub, tela: 'amigos' } });
  };
  // o Atravessa! baixa em segundo plano: ao clicar em Jogar a partida abre na hora, sem tela de carregamento
  useEffect(() => {
    void import('../atravessa/AtravessaPage');
    void import('../atravessa/AtravessaPlay');
  }, []);

  if (flow === 'bola-play') {
    return (
      <div className="dsm-screen bola-screen">
        <Suspense fallback={<Loader />}>
          <BolaPlay
            key={round}
            setup={bola}
            onExit={() => setFlow(null)}
            onAgain={() => setRound((r) => r + 1)}
            onOfflineInvite={goFriends}
          />
        </Suspense>
      </div>
    );
  }
  if (flow === 'dsm-play') {
    return (
      <div className="dsm-screen">
        <Suspense fallback={<Loader />}>
          <DesmoronaPlay
            bots={bots}
            onExit={() => setFlow(null)}
            // cada partida pergunta de novo contra quantas raposas jogar
            onAgain={() => setFlow('dsm-pick')}
          />
        </Suspense>
      </div>
    );
  }

  if (flow === 'gp-play') {
    return (
      <div className="gp-screen">
        <Suspense fallback={<Loader />}>
          <GpPlay
            key={round}
            bots={gpBots}
            color={loadGarage().fur}
            paint={loadGarage().paint}
            kart={loadGarage().kart}
            physics={loadPhysics()}
            track={loadTrack()}
            laps={loadLaps()}
            onExit={() => {
              gpMarkBack();
              setFlow(null);
            }}
            onAgain={() => setRound((r) => r + 1)}
            onOfflineInvite={goFriends}
          />
        </Suspense>
      </div>
    );
  }

  if (flow === 'png-play') {
    return (
      <div className="png-screen">
        <Suspense fallback={<Loader />}>
          <PingPlay
            key={round}
            level={pingLevel}
            onExit={() => setFlow(null)}
            onAgain={() => setRound((r) => r + 1)}
            onOfflineInvite={goFriends}
          />
        </Suspense>
      </div>
    );
  }

  const offline = () => {
    const g = hub;
    // Atravessa! é outra rota: a tela do jogo fica até a página trocar (sem mostrar o Fox Cap! no meio)
    if (g === 'atravessa') {
      void navigate({ to: '/atravessa', search: { treino: 1 } });
      return;
    }
    // a tela do jogo continua no endereço: sair da partida volta para ela
    if (g === 'bola') setFlow('bola-pick');
    else if (g === 'pingpong') setFlow('png-pick');
    else if (g === 'desmorona') setFlow('dsm-pick');
    else if (g === 'foxgp') setFlow('gp-pick');
  };

  if (hub === 'foxgp' && (!flow || flow.endsWith('-pick'))) {
    return (
      <>
        <GpHome
          onRace={offline}
          onHelp={() => setHelp('foxgp')}
          onExit={closeHub}
          start={wanted.tela === 'amigos' ? 'friends' : 'main'}
          room={{
            busy: entry.busy,
            error: entry.error,
            clearError: entry.clearError,
            create: () => {
              try {
                sessionStorage.setItem('cfx-new-room', 'foxgp');
              } catch {
                /* sem armazenamento: o líder escolhe o jogo na sala */
              }
              void entry.create('foxcap');
            },
            join: (c) => void entry.join(c),
          }}
        />
        {help && <HowToPlay game={help} onClose={() => setHelp(null)} />}
        {/* sem o <Page>, os diálogos de apelido e de sala aberta continuam aqui (criar ou entrar numa sala precisa deles) */}
        <NicknameDialog nick={entry.nick} />
        <RoomConflictDialog
          open={!!entry.conflict}
          code={entry.conflict?.code ?? null}
          onBack={entry.backToCurrent}
          onLeave={() => void entry.leaveAndContinue()}
          onCancel={entry.dismissConflict}
        />
        {flow === 'gp-pick' && (
          <GpPicker
            bots={gpBots}
            onBots={setGpBots}
            onStart={() => setFlow('gp-play')}
            onCancel={() => setFlow(null)}
          />
        )}
      </>
    );
  }

  return (
    <Page>
      {hub && hub !== 'foxgp' && (!flow || flow.endsWith('-pick')) && (
        <GameLanding
          game={hub}
          onOffline={offline}
          onHelp={() => setHelp(hub)}
          onExit={closeHub}
          start={wanted.tela === 'amigos' ? 'friends' : 'main'}
          room={{
            busy: entry.busy,
            error: entry.error,
            clearError: entry.clearError,
            // a sala já nasce com o jogo desta tela escolhido
            create: () => {
              try {
                sessionStorage.setItem('cfx-new-room', hub);
              } catch {
                /* sem armazenamento: o líder escolhe o jogo na sala */
              }
              void entry.create('foxcap');
            },
            join: (c) => void entry.join(c),
          }}
        />
      )}
      <NicknameDialog nick={entry.nick} />
      <RoomConflictDialog
        open={!!entry.conflict}
        code={entry.conflict?.code ?? null}
        onBack={entry.backToCurrent}
        onLeave={() => void entry.leaveAndContinue()}
        onCancel={entry.dismissConflict}
      />
      {help && <HowToPlay game={help} onClose={() => setHelp(null)} />}
      {flow === 'bola-pick' && (
        <BolaPicker
          setup={bola}
          onChange={setBola}
          onStart={() => setFlow('bola-play')}
          onCancel={() => setFlow(null)}
        />
      )}
      {flow === 'png-pick' && (
        <PingPicker
          level={pingLevel}
          onChange={setPingLevel}
          onStart={() => setFlow('png-play')}
          onCancel={() => setFlow(null)}
        />
      )}
      {flow === 'dsm-pick' && (
        <DesmoronaPicker
          bots={bots}
          onChange={setBots}
          onStart={() => setFlow('dsm-play')}
          onCancel={() => setFlow(null)}
        />
      )}
    </Page>
  );
}
