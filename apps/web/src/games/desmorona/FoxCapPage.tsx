import { useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { HubCard, HubHero, HubNote, HubTabs } from '@/components/GameHub';
import {
  AtravessaArt,
  BolaArt,
  DesmoronaTrainingArt,
  FoxCapArt,
  FriendsArt,
} from '@/components/HubArt';
import { MuteButton } from '@/components/MuteButton';
import { Page } from '@/components/Page';
import { RoomBanner } from '@/components/RoomBanner';

/**
 * Fox Cap! (spec 049): a área das raposas de boné. A aba "Offline" lista cada modo para jogar já; a aba "Com amigos"
 * cria uma sala SEM jogo escolhido, onde o líder convida a galera e escolhe (e troca) o jogo.
 */
export function FoxCapPage() {
  const [tab, setTab] = useState<'offline' | 'amigos'>('offline');
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
              <HubCard
                tone="red"
                art={<AtravessaArt />}
                name="Atravessa! Infinito"
                desc="Pule, desvie e atravesse tudo. Vale a distância."
                tags={['Offline', 'Ranking']}
                cta="Jogar"
                to="/atravessa"
                search={{ treino: '1' }}
                testId="foxcap-atravessa"
              />
              <HubCard
                tone="orange"
                art={<DesmoronaTrainingArt />}
                name="Desmorona! Treino"
                desc="O chão some debaixo dos pés. Contra raposas do jogo."
                tags={['1 a 7 bots', 'Offline']}
                cta="Jogar"
                to="/fox-cap/desmorona"
                search={{ treino: '1' }}
                testId="foxcap-desmorona"
              />
              <HubCard
                tone="green"
                art={<BolaArt />}
                name="Fut Fox Treino"
                desc="Futebol de raposas contra bots. Escolha o formato."
                tags={['2 a 4 times', 'Offline']}
                cta="Jogar"
                to="/fox-cap/bola"
                search={{ treino: '1' }}
                testId="foxcap-bola"
              />
            </div>
            <HubNote>
              O Atravessa! guarda recorde e ranking. O Desmorona! e o Fut Fox são só diversão: sem
              ranking nem histórico.
            </HubNote>
          </>
        ) : (
          <>
            <div className="gh-modes">
              <HubCard
                tone="blue"
                art={<FriendsArt />}
                name="Criar sala"
                desc="A sala nasce sem jogo. Você convida a galera e escolhe o jogo lá dentro: Fut Fox, Atravessa! ou Desmorona!."
                tags={['Até 15 pessoas', 'Troque de jogo quando quiser']}
                cta="Criar sala"
                to="/sala"
                search={{ jogo: 'foxcap' }}
                testId="foxcap-friends"
              />
            </div>
            <HubNote>
              Já tem um código de 4 letras? Entre na tela da sala e digite. O líder troca o jogo a
              qualquer momento no lobby e as regras e a tela se adaptam ao jogo escolhido.
            </HubNote>
          </>
        )}
        <MuteButton />
      </section>
    </Page>
  );
}
