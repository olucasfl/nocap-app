import { useEffect, useMemo, useState } from 'react';
import { connectClass, playConnect } from '@nocap/games';
import { useNavigate } from '@tanstack/react-router';
import { MuteButton } from '@/components/MuteButton';
import {
  loadConnectLevels,
  tierOf,
  tierRanges,
  toConnectPuzzle,
  type ConnectLevel,
} from '../levels/levels';
import { connectProgress, useProgress, type LevelStatus } from '../levels/progress';
import { LevelBrowser, type BrowserCell } from '../landing/LevelBrowser';
import { WlBtn, WlMeter, WlPanel, WordsLanding } from '../landing/WordsLanding';

export const CONNECT_RULES = [
  'São 16 palavras e 4 grupos escondidos. Marque 4 palavras que têm algo em comum e toque em Enviar.',
  'Não há vidas: cada palpite errado só soma 1 ao contador de erros. "Falta uma" quer dizer que 3 das 4 palavras estão certas.',
  'Você tem 1 dica por fase: ela mostra o nome de um dos grupos que ainda faltam. Se travar, pode desistir (pede confirmação) e as palavras são reveladas.',
  'A cor do grupo mostra a dificuldade: amarelo é o mais fácil, verde, azul e roxo (o mais difícil).',
  'Cuidado com as palavras que servem a dois grupos: só existe uma divisão certa.',
  'Seu progresso fica salvo neste aparelho: saia e volte quando quiser, a fase continua de onde parou.',
];

type Screen = 'main' | 'levels' | 'rules' | 'settings';

/** A tela própria do Connect Word's: continuar, escolher fase, como jogar e configurações (spec 065). */
export function ConnectLanding({ start = 'main' }: { start?: 'main' | 'levels' }) {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>(start);
  const [levels, setLevels] = useState<ConnectLevel[] | null>(null);
  const prog = useProgress(connectProgress);

  useEffect(() => {
    void loadConnectLevels().then(setLevels);
  }, []);

  const info = useMemo(() => {
    if (!levels) return null;
    return levels.map(
      (lv, i): BrowserCell & { at: number; groups: number; perfect: boolean; won: boolean } => {
        const p = prog[String(i + 1)];
        if (!p || (p.guesses.length === 0 && !p.gaveUp))
          return {
            n: i + 1,
            status: 'new',
            label: `Fase ${i + 1}: nova`,
            at: 0,
            groups: 0,
            perfect: false,
            won: false,
          };
        const state = playConnect(toConnectPuzzle(lv), p.guesses, { gaveUp: p.gaveUp });
        const status: LevelStatus = state.over ? 'done' : 'open';
        const sub = state.over
          ? state.won
            ? state.errors === 0
              ? 'perfeita'
              : `${state.errors} erro${state.errors > 1 ? 's' : ''}`
            : 'desistiu'
          : `${state.found.length}/4`;
        return {
          n: i + 1,
          status,
          sub,
          tone: state.over ? (state.won ? 'won' : 'lost') : undefined,
          label: `Fase ${i + 1}: ${state.over ? (state.won ? `concluída, ${state.errors} ${state.errors === 1 ? 'erro' : 'erros'} (${connectClass(state.won, state.errors, state.gaveUp).name})` : 'desistência') : 'em andamento'}`,
          at: p.at,
          groups: state.found.length,
          perfect: state.won && state.errors === 0,
          won: state.won,
        };
      },
    );
  }, [levels, prog]);

  const back = () => (screen === 'main' ? void navigate({ to: '/words' }) : setScreen('main'));
  const go = (n: number) =>
    void navigate({ to: '/words/connect/fase/$n', params: { n: String(n) } });

  const done = info?.filter((x) => x.status === 'done').length ?? 0;
  const open = info?.filter((x) => x.status === 'open').length ?? 0;
  const perfect = info?.filter((x) => x.perfect).length ?? 0;
  const last = info?.filter((x) => x.status === 'open').sort((a, b) => b.at - a.at)[0];
  const next = info?.find((x) => x.status === 'new');
  const pick = last ?? next;
  const total = info?.length ?? 0;

  let left;
  let right;
  if (screen === 'main') {
    left = (
      <>
        <div className="wl-state" data-testid="connect-hero">
          <b>{levels ? `${total} puzzles` : 'Carregando...'}</b>
          <span>Do mais fácil ao mais difícil. Tudo fica salvo.</span>
        </div>
        {info && <WlMeter done={done} open={open} total={total} />}
        <nav className="gx-menu" aria-label="Menu do Connect Word's" data-testid="wl-main">
          <WlBtn
            main
            title={last ? 'Continuar' : 'Começar'}
            sub={
              pick
                ? last
                  ? `fase ${last.n} · ${last.groups} de 4 grupos`
                  : `fase ${pick.n} · ${tierOf(levels![pick.n - 1]!)}`
                : levels
                  ? 'tudo concluído'
                  : '...'
            }
            onClick={() => pick && go(pick.n)}
            sfx="start"
            testid="continue"
          />
          <WlBtn
            title="Escolher fase"
            sub={`${total || ''} puzzles`}
            onClick={() => setScreen('levels')}
            testid="menu-levels"
          />
          <WlBtn
            title="Como jogar"
            sub="regras e dicas"
            onClick={() => setScreen('rules')}
            testid="menu-rules"
          />
          <WlBtn
            title="Configurações"
            sub="som do jogo"
            onClick={() => setScreen('settings')}
            testid="menu-settings"
          />
          <div className="gx-gap" />
          <WlBtn danger title="Voltar aos Word's" onClick={back} sfx="back" testid="wl-exit" />
        </nav>
      </>
    );
  } else if (screen === 'levels') {
    left = (
      <WlPanel
        title="Escolher fase"
        lead="Do mais fácil ao mais difícil. Escolha qualquer uma logo abaixo."
        onBack={back}
        testid="levels-panel"
      >
        {info && <WlMeter done={done} open={open} total={total} />}
        {info && (
          <div className="wl-nums">
            <span>
              <b>{perfect}</b> perfeitas
            </span>
          </div>
        )}
        {pick && (
          <button
            type="button"
            className="wl-cta"
            onClick={() => go(pick.n)}
            data-sfx="start"
            data-testid="continue"
          >
            <span>
              {last ? 'Continuar' : 'Começar'} fase {pick.n}
            </span>
            <small>→</small>
          </button>
        )}
      </WlPanel>
    );
    right =
      info && levels ? (
        <LevelBrowser title="Fases do Connect" cells={info} tiers={tierRanges(levels)} go={go} />
      ) : (
        <div className="wl-board" role="status">
          <h3>Montando as fases...</h3>
        </div>
      );
  } else if (screen === 'rules') {
    left = (
      <WlPanel title="Como jogar" onBack={back} testid="rules">
        <div className="wl-scroll">
          <ol className="wl-rules">
            {CONNECT_RULES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      </WlPanel>
    );
  } else {
    left = (
      <WlPanel title="Configurações" onBack={back} testid="wl-settings">
        <div className="gx-row">
          <span>Som do jogo</span>
          <MuteButton />
        </div>
        <p className="lead">Seu progresso fica salvo neste aparelho.</p>
      </WlPanel>
    );
  }

  return (
    <WordsLanding
      game="connect"
      screen={screen}
      onBack={back}
      left={left}
      right={right}
      pane={screen === 'levels' ? 'levels' : 'show'}
    />
  );
}
