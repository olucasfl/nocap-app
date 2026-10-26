import { BackButton } from '@/components/BackButton';
import { HubCard, HubHero, HubNote } from '@/components/GameHub';
import { AtravessaArt } from '@/components/HubArt';
import { MuteButton } from '@/components/MuteButton';

const ICON = {
  viewBox: '0 0 32 32',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;
const IconHop = () => (
  <svg {...ICON}>
    <path d="M16 27V8M8 15l8-8 8 8" />
  </svg>
);
const IconHex = () => (
  <svg {...ICON}>
    <path d="M16 4 26 10v12l-10 6-10-6V10z" />
  </svg>
);

/** Fox Cap!: a área das raposas de boné. Aqui moram o Atravessa! e o Desmorona!. */
export function FoxCapPage() {
  return (
    <div className="app">
      <section className="screen gh">
        <BackButton to="/" label="Jogos" />
        <HubHero
          accent="orange"
          art={<AtravessaArt />}
          title="Fox Cap!"
          text="Jogos com as raposas de boné. Sozinho ou com os amigos."
        />
        <div className="gh-modes">
          <HubCard
            tone="red"
            art={<IconHop />}
            name="Atravessa!"
            desc="Pule, desvie e atravesse · offline e com amigos"
            cta="Jogar"
            to="/atravessa"
            testId="foxcap-atravessa"
          />
          <HubCard
            tone="orange"
            art={<IconHex />}
            name="Desmorona!"
            desc="O chão some · último de pé vence"
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
    </div>
  );
}
