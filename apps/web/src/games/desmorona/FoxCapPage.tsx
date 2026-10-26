import { BackButton } from '@/components/BackButton';
import { HubCard, HubHero, HubNote } from '@/components/GameHub';
import { AtravessaArt, BolaArt, DesmoronaArt, FoxCapArt } from '@/components/HubArt';
import { MuteButton } from '@/components/MuteButton';
import { Page } from '@/components/Page';

/** Fox Cap!: a área das raposas de boné. Aqui moram o Atravessa! e o Desmorona!. */
export function FoxCapPage() {
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
        <div className="gh-modes">
          <HubCard
            tone="red"
            art={<AtravessaArt />}
            name="Atravessa!"
            desc="Pule, desvie e atravesse a estrada e o rio."
            tags={['Offline', 'Com amigos', 'Ranking']}
            cta="Jogar"
            to="/atravessa"
            testId="foxcap-atravessa"
          />
          <HubCard
            tone="orange"
            art={<DesmoronaArt />}
            name="Desmorona!"
            desc="O chão some debaixo dos pés. Vence o último de pé."
            tags={['2 a 8 jogadores', 'Treino com bots']}
            cta="Jogar"
            to="/fox-cap/desmorona"
            testId="foxcap-desmorona"
          />
          <HubCard
            tone="green"
            art={<BolaArt />}
            name="Bola Maluca!"
            desc="Futebol de raposas com 2 a 4 times e bola de verdade."
            tags={['Com amigos', 'Treino com bots']}
            cta="Jogar"
            to="/fox-cap/bola"
            testId="foxcap-bola"
          />
        </div>
        <HubNote>
          O Atravessa! guarda recorde e ranking. O Desmorona! e o Bola Maluca! são só diversão: sem
          ranking nem histórico.
        </HubNote>
        <MuteButton />
      </section>
    </Page>
  );
}
