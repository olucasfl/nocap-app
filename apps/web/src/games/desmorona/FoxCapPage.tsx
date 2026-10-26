import { BackButton } from '@/components/BackButton';
import { HubCard, HubHero, HubNote } from '@/components/GameHub';
import { AtravessaArt, DesmoronaArt, FoxCapArt } from '@/components/HubArt';
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
        </div>
        <HubNote>
          O Atravessa! guarda recorde e ranking. O Desmorona! é só diversão: sem ranking nem
          histórico.
        </HubNote>
        <MuteButton />
      </section>
    </Page>
  );
}
