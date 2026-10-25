import { BackButton } from '@/components/BackButton';
import { HubCard, HubHero, HubNote } from '@/components/GameHub';
import { AtravessaArt, DesmoronaArt } from '@/components/HubArt';
import { MuteButton } from '@/components/MuteButton';

/** Fox Cap!: a área das raposas de boné. Aqui moram o Atravessa! e o Desmorona!. */
export function FoxCapPage() {
  return (
    <section className="screen gh">
      <BackButton to="/" label="Jogos" />
      <HubHero accent="orange" art={<AtravessaArt />} title="Fox Cap!" text="Jogos com as raposas de boné. Sozinho ou com os amigos." />
      <div className="gh-modes">
        <HubCard tone="red" art={<AtravessaArt />} name="Atravessa!" desc="Pule, desvie e atravesse · offline e com amigos" cta="Jogar" to="/atravessa" testId="foxcap-atravessa" />
        <HubCard tone="orange" art={<DesmoronaArt />} name="Desmorona!" desc="O chão some · último de pé vence" cta="Jogar" to="/fox-cap/desmorona" testId="foxcap-desmorona" />
      </div>
      <HubNote>O Atravessa! guarda recorde e ranking. O Desmorona! é só diversão: sem ranking nem histórico.</HubNote>
      <MuteButton />
    </section>
  );
}
