import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { BackButton } from '@/components/BackButton';
import { Field } from '@/components/Field';
import { HubHero, HubModeCard, HubNote, HubTabs } from '@/components/GameHub';
import { GameLanding, type LandingGame } from '@/components/GameLanding';
import { HowToPlay, type HowGame } from '@/components/HowToPlay';
import {
  AtravessaArt,
  BolaArt,
  CounterFoxArt,
  DesmoronaTrainingArt,
  FoxCapArt,
  PingArt,
} from '@/components/HubArt';
import { Loader } from '@/components/Loader';
import { MuteButton } from '@/components/MuteButton';
import { NicknameDialog } from '@/components/NicknameDialog';
import { Page } from '@/components/Page';
import { RoomBanner } from '@/components/RoomBanner';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { useRoomEntry } from '@/lib/my-room';
import { BolaPicker } from '../bola/BolaPicker';
import type { BolaSetup } from '../bola/BolaPlay';
import { DesmoronaPicker } from './DesmoronaPicker';
import { PingPicker } from '../pingpong/PingPicker';
import type { PpBotName } from '@nocap/games';
import '@/screens/account.css';
import '@/screens/room.css';

// o jogo (Three.js) só baixa quando a partida começa
const BolaPlay = lazy(() => import('../bola/BolaPlay').then((m) => ({ default: m.BolaPlay })));
const DesmoronaPlay = lazy(() =>
  import('./DesmoronaPlay').then((m) => ({ default: m.DesmoronaPlay })),
);
const PingPlay = lazy(() => import('../pingpong/PingPlay').then((m) => ({ default: m.PingPlay })));

type Flow = 'bola-pick' | 'bola-play' | 'dsm-pick' | 'dsm-play' | 'png-pick' | 'png-play' | null;

/**
 * Fox Cap! (spec 049): a aba "Offline" tem cada modo com "Jogar" (entra na partida sem passar por outra tela) e
 * "Como jogar?" (um popup curto); a aba "Com amigos" cria a sala sem jogo escolhido ou entra por código, ali mesmo.
 */
export function FoxCapPage() {
  const navigate = useNavigate();
  const wanted = useSearch({ strict: false }) as { aba?: string };
  const [tab, setTab] = useState<'offline' | 'amigos'>(
    wanted.aba === 'amigos' ? 'amigos' : 'offline',
  );
  const [flow, setFlow] = useState<Flow>(null);
  const [help, setHelp] = useState<HowGame | null>(null);
  const [bola, setBola] = useState<BolaSetup>({ teams: 2, perTeam: 2, minutes: 3 });
  const [bots, setBots] = useState(5);
  const [pingLevel, setPingLevel] = useState<PpBotName>('medio');
  const [round, setRound] = useState(0);
  /** Tela própria do jogo aberta (Jogar abre a tela do jogo, não a partida). */
  const [hub, setHub] = useState<LandingGame | null>(null);
  const [code, setCode] = useState('');
  const entry = useRoomEntry({ resume: true });
  /** "Convidar" numa partida offline: sai dela e abre "Com amigos", onde se cria a sala. */
  const goFriends = () => {
    setFlow(null);
    setTab('amigos');
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

  const join = (e: FormEvent) => {
    e.preventDefault();
    void entry.join(code);
  };
  const offline = () => {
    const g = hub;
    // Atravessa! é outra rota: a tela do jogo fica até a página trocar (sem mostrar o Fox Cap! no meio)
    if (g === 'atravessa') {
      void navigate({ to: '/atravessa', search: { treino: 1 } });
      return;
    }
    setHub(null);
    if (g === 'bola') setFlow('bola-pick');
    else if (g === 'pingpong') setFlow('png-pick');
    else if (g === 'desmorona') setFlow('dsm-pick');
  };

  return (
    <Page>
      {hub && (
        <GameLanding
          game={hub}
          onOffline={offline}
          onFriends={() => {
            setHub(null);
            setTab('amigos');
          }}
          onHelp={() => setHelp(hub)}
          onExit={() => setHub(null)}
        />
      )}
      <section className="screen gh">
        <BackButton to="/" label="Jogos" />
        <HubHero
          accent="orange"
          art={<FoxCapArt />}
          title="Fox Cap!"
          text="Jogos com as raposas de boné. Sozinho ou com os amigos."
        />
        <RoomBanner />
        <HubTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'offline', label: 'Offline' },
            { id: 'amigos', label: 'Com amigos' },
          ]}
        />
        {tab === 'offline' ? (
          <>
            <div className="gh-modes two">
              <HubModeCard
                tone="night"
                art={<CounterFoxArt />}
                name="Counter Fox"
                desc="Mata-mata das raposas no mapa Duna. Offline, com bots, ou online com os amigos. Tem mapa de treino."
                tags={['Mata-mata', 'Até 10 jogadores', 'Online']}
                onPlay={() => void navigate({ to: '/fox-cap/counter-fox' })}
                testId="foxcap-counterfox"
                cardTestId="foxcap-counterfox-card"
              />
              <HubModeCard
                tone="red"
                art={<AtravessaArt />}
                name="Atravessa! Infinito"
                desc="Pule, desvie e atravesse tudo. Vale a distância."
                tags={['Offline', 'Ranking']}
                // o jogo começa direto; sair da partida volta aqui
                onPlay={() => setHub('atravessa')}
                onHelp={() => setHelp('atravessa')}
                testId="foxcap-atravessa"
                helpTestId="help-atravessa"
              />
              <HubModeCard
                tone="green"
                art={<BolaArt />}
                name="Fut Fox Treino"
                desc="Futebol de raposas contra bots. Escolha o formato."
                tags={['2 a 4 times', 'Offline']}
                onPlay={() => setHub('bola')}
                onHelp={() => setHelp('bola')}
                testId="foxcap-bola"
                helpTestId="help-bola"
              />
              <HubModeCard
                tone="blue"
                art={<PingArt />}
                name="Ping Fox! Treino"
                desc="Pingue-pongue 1 contra 1 contra um bot. A raquete bate de verdade: força, lob e efeito."
                tags={['1x1', 'Offline']}
                onPlay={() => setHub('pingpong')}
                onHelp={() => setHelp('pingpong')}
                testId="foxcap-pingpong"
                helpTestId="help-pingpong"
              />
              <HubModeCard
                tone="orange"
                art={<DesmoronaTrainingArt />}
                name="Desmorona! Treino"
                desc="O chão some debaixo dos pés. Contra raposas do jogo."
                tags={['1 a 7 bots', 'Offline']}
                onPlay={() => setHub('desmorona')}
                onHelp={() => setHelp('desmorona')}
                testId="foxcap-desmorona"
                helpTestId="help-desmorona"
              />
            </div>
            <HubNote>
              O Atravessa! guarda recorde e ranking. O Desmorona!, o Fut Fox e o Ping Fox! são só
              diversão: sem ranking nem histórico.
            </HubNote>
          </>
        ) : (
          <>
            {entry.error && (
              <p className="acc-failure mono" role="alert">
                {entry.error}
              </p>
            )}
            <div className="rm-choices">
              <section className="rm-choice" data-testid="foxcap-create">
                <h2>Criar sala</h2>
                <p className="mono">
                  A sala nasce sem jogo. Você convida a galera e escolhe o jogo lá dentro (Fut Fox,
                  Ping Fox!, Atravessa! ou Desmorona!), e pode trocar quando quiser.
                </p>
                <button
                  type="button"
                  className="btn alt"
                  disabled={entry.busy}
                  onClick={() => void entry.create('foxcap')}
                  data-testid="foxcap-friends"
                >
                  {entry.busy ? 'Criando...' : 'Criar sala'}
                </button>
              </section>
              <form className="rm-choice rm-join" onSubmit={join} noValidate>
                <h2>Entrar com código</h2>
                <p className="mono">Peça ao líder o código de 4 letras.</p>
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
                  {entry.busy ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </div>
          </>
        )}
        <MuteButton />
      </section>
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
