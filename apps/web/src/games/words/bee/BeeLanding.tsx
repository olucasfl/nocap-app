import { useEffect, useMemo, useState } from 'react';
import { beeMaxPoints, beeRank, beeScore } from '@nocap/games';
import { useNavigate } from '@tanstack/react-router';
import { MuteButton } from '@/components/MuteButton';
import { loadBeeLevels, tierOf, tierRanges, toBeePuzzle, type BeeLevel } from '../levels/levels';
import { beeProgress, useProgress, type LevelStatus } from '../levels/progress';
import { LevelBrowser, type BrowserCell } from '../landing/LevelBrowser';
import { WlBtn, WlMeter, WlPager, WlPanel, WordsLanding } from '../landing/WordsLanding';

export const BEE_RULES = [
  'Toda palavra tem 4 letras ou mais, usa só as 7 letras do favo e leva a letra do centro (a amarela).',
  '4 letras valem 1 ponto; palavras maiores valem o número de letras. O pangrama, que usa as 7 letras, soma 7 pontos a mais.',
  'Acentos não importam: digite "acao" e o jogo mostra "ação". As letras podem repetir.',
  'Suba de patente: Gênio chega com 70% dos pontos; Rainha das Abelhas é achar todas as palavras.',
  'Seu progresso fica salvo neste aparelho: saia e volte quando quiser, a fase continua de onde parou.',
];

type Screen = 'main' | 'levels' | 'rules' | 'settings';

/** A tela própria do Bee Word's: continuar, escolher fase, como jogar e configurações (spec 065). */
export function BeeLanding({ start = 'main' }: { start?: 'main' | 'levels' }) {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>(start);
  const [levels, setLevels] = useState<BeeLevel[] | null>(null);
  const prog = useProgress(beeProgress);

  useEffect(() => {
    void loadBeeLevels().then(setLevels);
  }, []);

  const info = useMemo(() => {
    if (!levels) return null;
    return levels.map(
      (lv, i): BrowserCell & { at: number; pts: number; max: number; rank: string } => {
        const p = prog[String(i + 1)];
        const status: LevelStatus = !p
          ? 'new'
          : p.closed
            ? 'done'
            : p.found.length > 0
              ? 'open'
              : 'new';
        const puzzle = toBeePuzzle(lv);
        const max = beeMaxPoints(puzzle);
        const pts = p ? beeScore(puzzle, p.found) : 0;
        const rank = status !== 'new' ? beeRank(pts, max).name : '';
        return {
          n: i + 1,
          status,
          sub: status === 'done' ? 'completo' : `${pts}/${max}`,
          label: `Fase ${i + 1}: ${status === 'done' ? `completa, ${rank}` : status === 'open' ? `em andamento, ${pts} de ${max} pontos` : `nova, ${max} pontos no total`}`,
          at: p?.at ?? 0,
          pts,
          max,
          rank,
        };
      },
    );
  }, [levels, prog]);

  const back = () => (screen === 'main' ? void navigate({ to: '/words' }) : setScreen('main'));
  const go = (n: number) => void navigate({ to: '/words/bee/fase/$n', params: { n: String(n) } });

  const done = info?.filter((x) => x.status === 'done').length ?? 0;
  const open = info?.filter((x) => x.status === 'open').length ?? 0;
  const points = info?.reduce((s, x) => s + x.pts, 0) ?? 0;
  const last = info?.filter((x) => x.status === 'open').sort((a, b) => b.at - a.at)[0];
  const next = info?.find((x) => x.status === 'new');
  const pick = last ?? next;
  const total = info?.length ?? 0;

  let left;
  let right;
  if (screen === 'main') {
    left = (
      <>
        <div className="wl-state" data-testid="bee-hero">
          <b>{levels ? `${total} favos` : 'Montando o favo...'}</b>
          <span>Do mais fácil ao mais difícil. Jogue, saia e volte: tudo fica salvo.</span>
        </div>
        {info && <WlMeter done={done} open={open} total={total} />}
        <nav className="gx-menu" aria-label="Menu do Bee Word's" data-testid="wl-main">
          <WlBtn
            main
            title={last ? 'Continuar' : 'Começar'}
            sub={
              pick
                ? last
                  ? `fase ${last.n} · ${last.pts}/${last.max} pontos`
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
            sub={`${total || ''} favos`}
            onClick={() => setScreen('levels')}
            testid="menu-levels"
          />
          <WlBtn
            title="Como jogar"
            sub="pontos e patentes"
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
              <b>{points}</b> pontos somados
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
        <LevelBrowser title="Fases do Bee" cells={info} tiers={tierRanges(levels)} go={go} />
      ) : (
        <div className="wl-board" role="status">
          <h3>Montando o favo...</h3>
        </div>
      );
  } else if (screen === 'rules') {
    left = (
      <WlPanel title="Como jogar" onBack={back} testid="rules">
        <WlPager
          testid="rules-pager"
          pages={BEE_RULES.map((t, n) => ({ title: `Passo ${n + 1}`, body: <p>{t}</p> }))}
        />
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
      game="bee"
      screen={screen}
      onBack={back}
      left={left}
      right={right}
      pane={screen === 'levels' ? 'levels' : 'show'}
    />
  );
}
