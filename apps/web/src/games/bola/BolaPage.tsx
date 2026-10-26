import { useState } from 'react';

import { BackButton } from '@/components/BackButton';
import { HubCard, HubHero, HubNote, HubSteps, HubTabs } from '@/components/GameHub';
import { BolaArt, FriendsArt } from '@/components/HubArt';
import { MuteButton } from '@/components/MuteButton';
import { Page } from '@/components/Page';
import { BolaPicker } from './BolaPicker';
import { BolaPlay, type BolaSetup } from './BolaPlay';
import '../desmorona/desmorona.css';
import './bola.css';

const HOW = [
  'Mova a raposa com W A S D (ou o joystick no celular) e empurre a bola para o gol dos outros times.',
  'Pule e pule de novo no ar para o pulo duplo. Com uma direção apertada, o segundo pulo vira um mortal que chuta a bola.',
  'O gol vale para o time de quem tocou na bola por último, até gol contra.',
  'A bola nunca sai do campo. Depois de cada gol, todo mundo volta ao lugar e a bola ao centro, depois de 3 segundos.',
  'Empate no fim do tempo vai para o gol de ouro: quem marcar primeiro ganha.',
];

type Phase = 'menu' | 'pick' | 'play';

/** O Fut Fox (spec 046): menu e treino contra bots. As salas com amigos vêm na Fase 2. */
export function BolaPage() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [tab, setTab] = useState<'jogar' | 'como'>('jogar');
  const [setup, setSetup] = useState<BolaSetup>({ teams: 2, perTeam: 2, minutes: 3 });
  const [round, setRound] = useState(0);

  if (phase === 'play') {
    return (
      <div className="dsm-screen bola-screen">
        <BolaPlay
          key={round}
          setup={setup}
          onExit={() => setPhase('menu')}
          onAgain={() => setRound((r) => r + 1)}
        />
      </div>
    );
  }
  return (
    <Page>
      <section className="screen gh">
        <BackButton to="/fox-cap" label="Fox Cap!" />
        <HubHero
          accent="green"
          art={<BolaArt />}
          title="Fut Fox"
          text="Futebol de raposas com 2, 3 ou 4 times. Quem tocou por último, marca."
          stats={[
            { label: 'Times', value: '2 a 4' },
            { label: 'Jogadores', value: 'até 12' },
            { label: 'Ranking', value: 'não' },
          ]}
        />
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
                tone="green"
                art={<BolaArt />}
                name="Treino"
                desc="Jogue contra bots. Escolha o formato e a duração."
                tags={['Offline', 'Bots']}
                cta="Escolher formato"
                onClick={() => setPhase('pick')}
                testId="bola-play-btn"
              />
              <HubCard
                tone="blue"
                art={<FriendsArt />}
                name="Com amigos"
                desc="Crie uma sala, escolha o formato e os times, complete com bots e chame a galera."
                tags={['2 a 12 jogadores', 'Até 15 na sala']}
                cta="Jogar com amigos"
                to="/sala"
                search={{ jogo: 'bola' }}
                testId="bola-friends"
              />
            </div>
            <HubNote>
              Computador: W A S D, Espaço para pular (duas vezes para o mortal) e F para prender ou
              soltar a câmera na bola. Espectando: Q e E trocam quem acompanhar e B segue a bola.
              Celular: joystick, botão Pular e botão da câmera.
            </HubNote>
          </>
        ) : (
          <HubSteps title="Como jogar" steps={HOW} />
        )}
        {phase === 'pick' && (
          <BolaPicker
            setup={setup}
            onChange={setSetup}
            onStart={() => setPhase('play')}
            onCancel={() => setPhase('menu')}
          />
        )}
        <MuteButton />
      </section>
    </Page>
  );
}
