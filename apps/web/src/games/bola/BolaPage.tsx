import { useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { createPortal } from 'react-dom';
import { BOL_TEAM_NAMES, bolFormatLabel, bolFormats } from '@nocap/games';
import { BackButton } from '@/components/BackButton';
import { HubCard, HubHero, HubNote, HubSteps, HubTabs } from '@/components/GameHub';
import { BolaArt, FriendsArt } from '@/components/HubArt';
import { MuteButton } from '@/components/MuteButton';
import { Page } from '@/components/Page';
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
  // vindo do Fox Cap! pelo atalho "Fut Fox Treino": já abre a escolha do formato (spec 049)
  const direct = useSearch({ strict: false }) as { treino?: number };
  const [phase, setPhase] = useState<Phase>(direct.treino ? 'pick' : 'menu');
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
  const formats = bolFormats();
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
        {phase === 'pick' &&
          createPortal(
            <div
              className="dsm-pick"
              role="dialog"
              aria-modal="true"
              aria-label="Formato do treino"
            >
              <div className="dsm-pick-card bola-pick">
                <h2>Formato</h2>
                <p className="mono">
                  {bolFormatLabel(setup)} · você no time {BOL_TEAM_NAMES[0]}, o resto são bots
                </p>
                <div className="bola-chips" role="radiogroup" aria-label="Formato">
                  {formats.map((f) => (
                    <button
                      key={bolFormatLabel(f)}
                      type="button"
                      role="radio"
                      aria-checked={setup.teams === f.teams && setup.perTeam === f.perTeam}
                      className={`dsm-chip${setup.teams === f.teams && setup.perTeam === f.perTeam ? ' is-on' : ''}`}
                      onClick={() =>
                        setSetup((s) => ({ ...s, teams: f.teams, perTeam: f.perTeam }))
                      }
                      data-testid={`bola-fmt-${bolFormatLabel(f)}`}
                    >
                      {bolFormatLabel(f)}
                    </button>
                  ))}
                </div>
                <h3>Duração</h3>
                <div className="bola-chips" role="radiogroup" aria-label="Duração">
                  {[1, 2, 3, 5, 8, 10, 15, 30].map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={setup.minutes === m}
                      className={`dsm-chip${setup.minutes === m ? ' is-on' : ''}`}
                      onClick={() => setSetup((s) => ({ ...s, minutes: m }))}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
                <div className="dsm-over-btns">
                  <button
                    type="button"
                    className="dsm-btn"
                    onClick={() => setPhase('play')}
                    data-testid="bola-start"
                  >
                    Começar
                  </button>
                  <button
                    type="button"
                    className="dsm-btn is-ghost"
                    onClick={() => setPhase('menu')}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}
        <MuteButton />
      </section>
    </Page>
  );
}
