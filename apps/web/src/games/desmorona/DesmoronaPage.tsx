import { useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { HubCard, HubHero, HubNote, HubSteps, HubTabs } from '@/components/GameHub';
import { DesmoronaArt } from '@/components/HubArt';
import { MuteButton } from '@/components/MuteButton';
import { RoomBanner } from '@/components/RoomBanner';
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
                art={
                  <svg
                    viewBox="0 0 32 32"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 4 26 10v12l-10 6-10-6V10z" />
                  </svg>
                }
                name="Treino"
                desc="Você contra raposas · você escolhe quantas"
                cta="Jogar"
                onClick={() => setPhase('pick')}
                testId="dsm-play-btn"
              />
              <HubCard
                tone="blue"
                art={
                  <svg
                    viewBox="0 0 32 32"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="12" r="4" />
                    <circle cx="22" cy="13" r="3.2" />
                    <path d="M3 26c0-4 3.6-7 8-7s8 3 8 7M18 26c.4-3 2.4-5 5-5 3 0 5 2 5 5" />
                  </svg>
                }
                name="Com amigos"
                desc="Sala com código · de 2 a 8 jogadores"
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
          <div
            className="dsm-pick"
            role="dialog"
            aria-modal="true"
            aria-label="Quantas raposas no treino"
          >
            <div className="dsm-pick-card">
              <h2>Contra quantas raposas?</h2>
              <p className="mono">VOCÊ + {bots}</p>
              <div className="dsm-chips" role="radiogroup" aria-label="Quantidade de adversários">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={bots === n}
                    className={`dsm-chip${bots === n ? ' is-on' : ''}`}
                    onClick={() => setBots(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="dsm-over-btns">
                <button
                  type="button"
                  className="dsm-btn"
                  onClick={() => setPhase('play')}
                  data-testid="dsm-start"
                >
                  Começar
                </button>
                <button type="button" className="dsm-btn is-ghost" onClick={() => setPhase('menu')}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
        <MuteButton />
      </section>
    </Page>
  );
}
