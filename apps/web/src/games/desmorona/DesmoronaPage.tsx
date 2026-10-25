import { useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { HubCard, HubHero, HubNote, HubSteps, HubTabs } from '@/components/GameHub';
import { DesmoronaArt } from '@/components/HubArt';
import { MuteButton } from '@/components/MuteButton';
import { DesmoronaPlay } from './DesmoronaPlay';
import './desmorona.css';

const HOW = [
  'Todo mundo cai do céu na camada de cima. Cada ladrilho que você pisa aguenta um instante e some.',
  'Fique sempre em movimento: ladrilho que racha (treme e fica vermelho) vai cair com você em cima.',
  'Se o chão acabar, você cai para a camada de baixo, que é menor. Cair da última camada é o fim.',
  'Toque em pular de novo no ar para o pulo duplo: um por voo, ajuda a atravessar buracos e a fugir de uma queda.',
  'Vence o último que ficar de pé. Quem cai assiste os outros.',
];

type Phase = 'menu' | 'play';

/** O Desmorona! (spec 044): menu e treino contra bots. As salas com amigos entram na Fase 2. */
export function DesmoronaPage() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [tab, setTab] = useState<'jogar' | 'como'>('jogar');
  const [bots, setBots] = useState(5);
  const [round, setRound] = useState(0);

  if (phase === 'play') {
    return (
      <div className="dsm-screen">
        <DesmoronaPlay key={round} bots={bots} onExit={() => setPhase('menu')} onAgain={() => setRound((r) => r + 1)} />
      </div>
    );
  }
  return (
    <section className="screen gh">
      <BackButton to="/fox-cap" label="Fox Cap!" />
      <HubHero accent="orange" art={<DesmoronaArt />} title="Desmorona!" text="O chão some debaixo dos seus pés. Fique em pé até o fim." />
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
          <section className="gh-panel dsm-bots">
            <h3>Treino contra raposas</h3>
            <label>
              Adversários: <b>{bots}</b>
              <input type="range" min={1} max={7} value={bots} onChange={(e) => setBots(Number(e.target.value))} aria-label="Quantidade de adversários" />
            </label>
          </section>
          <div className="gh-modes">
            <HubCard
              tone="orange"
              art={
                <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 4 26 10v12l-10 6-10-6V10z" />
                </svg>
              }
              name="Treino"
              desc={`Você e ${bots} raposa${bots > 1 ? 's' : ''} · 3 a 4 minutos`}
              cta="Jogar"
              onClick={() => setPhase('play')}
              testId="dsm-play-btn"
            />
            <HubCard
              tone="blue"
              art={
                <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
          <HubNote>Computador: W A S D (ou setas) e Espaço. Celular: joystick na esquerda e botão Pular na direita.</HubNote>
        </>
      ) : (
        <HubSteps title="Como jogar" steps={HOW} />
      )}
      <MuteButton />
    </section>
  );
}
