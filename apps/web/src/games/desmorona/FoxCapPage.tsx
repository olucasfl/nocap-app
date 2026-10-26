import { lazy, Suspense, useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { BackButton } from '@/components/BackButton';
import { Field } from '@/components/Field';
import { HubHero, HubModeCard, HubNote, HubTabs } from '@/components/GameHub';
import { HowToPlay, type HowGame } from '@/components/HowToPlay';
import { AtravessaArt, BolaArt, DesmoronaTrainingArt, FoxCapArt } from '@/components/HubArt';
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
import '@/screens/account.css';
import '@/screens/room.css';

// o jogo (Three.js) só baixa quando a partida começa
const BolaPlay = lazy(() => import('../bola/BolaPlay').then((m) => ({ default: m.BolaPlay })));
const DesmoronaPlay = lazy(() =>
  import('./DesmoronaPlay').then((m) => ({ default: m.DesmoronaPlay })),
);

type Flow = 'bola-pick' | 'bola-play' | 'dsm-pick' | 'dsm-play' | null;

/**
 * Fox Cap! (spec 049): a aba "Offline" tem cada modo com "Jogar" (entra na partida sem passar por outra tela) e
 * "Como jogar?" (um popup curto); a aba "Com amigos" cria a sala sem jogo escolhido ou entra por código, ali mesmo.
 */
export function FoxCapPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'offline' | 'amigos'>('offline');
  const [flow, setFlow] = useState<Flow>(null);
  const [help, setHelp] = useState<HowGame | null>(null);
  const [bola, setBola] = useState<BolaSetup>({ teams: 2, perTeam: 2, minutes: 3 });
  const [bots, setBots] = useState(5);
  const [round, setRound] = useState(0);
  const [code, setCode] = useState('');
  const entry = useRoomEntry();

  if (flow === 'bola-play') {
    return (
      <div className="dsm-screen bola-screen">
        <Suspense fallback={<Loader />}>
          <BolaPlay
            key={round}
            setup={bola}
            onExit={() => setFlow(null)}
            onAgain={() => setRound((r) => r + 1)}
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

  const join = (e: FormEvent) => {
    e.preventDefault();
    void entry.join(code);
  };

  return (
    <Page>
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
            <div className="gh-modes">
              <HubModeCard
                tone="red"
                art={<AtravessaArt />}
                name="Atravessa! Infinito"
                desc="Pule, desvie e atravesse tudo. Vale a distância."
                tags={['Offline', 'Ranking']}
                // o jogo começa direto; sair da partida volta aqui
                onPlay={() => void navigate({ to: '/atravessa', search: { treino: 1 } })}
                onHelp={() => setHelp('atravessa')}
                testId="foxcap-atravessa"
                helpTestId="help-atravessa"
              />
              <HubModeCard
                tone="orange"
                art={<DesmoronaTrainingArt />}
                name="Desmorona! Treino"
                desc="O chão some debaixo dos pés. Contra raposas do jogo."
                tags={['1 a 7 bots', 'Offline']}
                onPlay={() => setFlow('dsm-pick')}
                onHelp={() => setHelp('desmorona')}
                testId="foxcap-desmorona"
                helpTestId="help-desmorona"
              />
              <HubModeCard
                tone="green"
                art={<BolaArt />}
                name="Fut Fox Treino"
                desc="Futebol de raposas contra bots. Escolha o formato."
                tags={['2 a 4 times', 'Offline']}
                onPlay={() => setFlow('bola-pick')}
                onHelp={() => setHelp('bola')}
                testId="foxcap-bola"
                helpTestId="help-bola"
              />
            </div>
            <HubNote>
              O Atravessa! guarda recorde e ranking. O Desmorona! e o Fut Fox são só diversão: sem
              ranking nem histórico.
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
                  Atravessa! ou Desmorona!), e pode trocar quando quiser.
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
