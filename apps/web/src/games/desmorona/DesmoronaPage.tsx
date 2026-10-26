import { useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { HubCard, HubHero, HubNote, HubSteps, HubTabs } from '@/components/GameHub';
import { DesmoronaArt, DesmoronaTrainingArt, FriendsArt } from '@/components/HubArt';
import { MuteButton } from '@/components/MuteButton';
import { RoomBanner } from '@/components/RoomBanner';
import { DesmoronaPicker } from './DesmoronaPicker';
import { DesmoronaPlay } from './DesmoronaPlay';
import './desmorona.css';
import { Page } from '@/components/Page';

const HOW = [
  'Todo mundo cai do céu na camada de cima. Cada ladrilho que você pisa aguenta um instante e some.',
  'Fique sempre em movimento: ladrilho que racha (treme e fica vermelho) vai cair com você em cima.',
  'Se o chão acabar, você cai para a camada de baixo, que é menor. Cair da última camada é o fim.',
  'Toque em pular de novo no ar para o pulo duplo: um por voo, ajuda a atravessar buracos e a fugir de uma queda.',
  'Vence o último que ficar de pé. Quem cai assiste os outros.',
];

type Phase = 'menu' | 'pick' | 'play';

/** O Desmorona! (spec 044): menu e treino contra bots. As salas com amigos entram na Fase 2. */
export function DesmoronaPage() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [tab, setTab] = useState<'jogar' | 'como'>('jogar');
  const [bots, setBots] = useState(5);

  if (phase === 'play') {
    return (
      <div className="dsm-screen">
        <DesmoronaPlay
          bots={bots}
          onExit={() => setPhase('menu')}
          // cada partida pergunta de novo contra quantas raposas jogar
          onAgain={() => setPhase('pick')}
        />
      </div>
    );
  }
  return (
    <Page>
      <section className="screen gh">
        <BackButton to="/fox-cap" label="Fox Cap!" />
        <HubHero
          accent="orange"
          art={<DesmoronaArt />}
          title="Desmorona!"
          text="O chão some debaixo dos seus pés. Fique em pé até o fim."
          stats={[
            { label: 'Jogadores', value: '2 a 8' },
            { label: 'Camadas', value: '7' },
            { label: 'Partida', value: '~1 min' },
          ]}
        />
        <RoomBanner />
        <HubTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'jogar', label: 'Jogar' },
            { id: 'como', label: 'Como jogar' },
          ]}
        />
        {tab === 'jogar' ? (
          <>
            <div className="gh-modes">
              <HubCard
                tone="orange"
                art={<DesmoronaTrainingArt />}
                name="Treino"
                desc="Jogue sozinho contra raposas controladas pelo jogo."
                tags={['1 a 7 raposas', 'Offline']}
                cta="Jogar"
                onClick={() => setPhase('pick')}
                testId="dsm-play-btn"
              />
              <HubCard
                tone="blue"
                art={<FriendsArt />}
                name="Com amigos"
                desc="Crie uma sala e chame a galera."
                tags={['2 a 8 jogadores', 'Sala com código']}
                cta="Jogar com amigos"
                to="/sala"
                search={{ jogo: 'desmorona' }}
                testId="dsm-friends"
              />
            </div>
            <HubNote>
              Computador: W A S D e Espaço; o mouse gira a câmera. Celular: joystick à esquerda e
              dedo à direita para girar.
            </HubNote>
          </>
        ) : (
          <HubSteps title="Como jogar" steps={HOW} />
        )}
        {phase === 'pick' && (
          <DesmoronaPicker
            bots={bots}
            onChange={setBots}
            onStart={() => setPhase('play')}
            onCancel={() => setPhase('menu')}
          />
        )}
        <MuteButton />
      </section>
    </Page>
  );
}
