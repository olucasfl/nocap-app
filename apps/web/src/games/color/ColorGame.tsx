import { useCallback, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  colorDeltaE,
  colorDailySettings,
  colorPresets,
  dailySeed,
  evaluateSurvival,
  generateColorRound,
  generateColorStart,
  scoreFromDeltaE,
  SURVIVAL_MAX_ROUNDS,
  survivalMinScore,
  survivalShowMs,
  type Hsb,
} from '@nocap/games';
import { useQueryClient } from '@tanstack/react-query';
import { MuteButton } from '@/components/MuteButton';
import { bestTenths, formatBest, isNewRecord, type Stats } from '@/lib/stats';
import { SurvivalBar, SurvivalFinal, SurvivalVerdict } from '@/components/Survival';
import { toHex } from './hex';
import { FinalScreen } from './screens/FinalScreen';
import { QuickActions } from './screens/QuickActions';
import { PickScreen } from './screens/PickScreen';
import { ResultScreen } from './screens/ResultScreen';
import { ShowScreen } from './screens/ShowScreen';
import type { GameTab } from '@/components/GameTabs';
import { rankingLink, type Board } from '@/lib/ranking';
import { StartScreen } from './screens/StartScreen';
import { SAVE_TEXT, useSaveMatch } from './useSaveMatch';
import type { Mode, RoundResult, Run } from './types';
import './color.css';

type Phase = 'start' | 'show' | 'pick' | 'result' | 'final';

function newRun(mode: Mode): Run {
  const preset = mode === 'daily' ? 'classic' : mode;
  return {
    matchId: crypto.randomUUID(),
    mode,
    kind: mode === 'daily' ? 'daily' : 'solo',
    preset,
    // Daily: seed do dia (calculada no aparelho, funciona offline). Solo: seed aleatória.
    seed: mode === 'daily' ? dailySeed('color') : crypto.randomUUID().slice(0, 12),
    settings: mode === 'daily' ? colorDailySettings : colorPresets[preset]!,
  };
}

export function ColorGame({
  initialMode = 'classic',
  initialTab,
}: {
  initialMode?: Mode;
  initialTab?: GameTab;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const navigate = useNavigate();
  /** Aba com que o menu abre: vem da rota e muda ao sair de uma partida ("Modos do jogo"). */
  const [menu, setMenu] = useState<{ tab?: GameTab }>({
    tab: initialTab,
  });
  const [phase, setPhase] = useState<Phase>('start');
  const [run, setRun] = useState<Run | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);

  const queryClient = useQueryClient();
  /** Recorde do modo ANTES da partida (décimos); `undefined` = sem estatísticas (convidado/offline). */
  const [prevBest, setPrevBest] = useState<number | undefined>();

  const begin = useCallback((m: Mode) => {
    setRun(newRun(m));
    setIndex(0);
    setResults([]);
    setPhase('show');
  }, []);

  const start = useCallback(
    (m: Mode) => {
      const cached = queryClient.getQueryData<Stats>(['stats']);
      setPrevBest(m === 'daily' || !cached ? undefined : bestTenths(cached, 'color', m));
      begin(m);
    },
    [queryClient, begin],
  );

  const target: Hsb | null = run ? generateColorRound(run.seed, run.settings, index) : null;

  const survival = !!run?.settings.survival;
  const blind = !!run?.settings.blind;
  // Sobrevivência: o estado (vidas, fim) vem sempre das notas já jogadas.
  const sv = survival
    ? evaluateSurvival(
        'color',
        results.map((r) => r.score),
      )
    : null;

  const lock = useCallback(
    (guess: Hsb) => {
      if (!target || !run) return;
      const deltaE = colorDeltaE(target, guess);
      setResults((r) => [...r, { target, guess, deltaE, score: scoreFromDeltaE(deltaE) }]);
      if (run.settings.blind) {
        // Às cegas: nada de nota entre as rodadas; tudo aparece no final.
        if (index + 1 < run.settings.rounds) {
          setIndex(index + 1);
          setPhase('show');
        } else setPhase('final');
        return;
      }
      setPhase('result');
    },
    [target, run, index],
  );

  const next = () => {
    if (survival ? sv?.ended === null : run && index + 1 < run.settings.rounds) {
      setIndex(index + 1);
      setPhase('show');
    } else {
      setPhase('final');
    }
  };

  /** Do fim da partida de volta ao menu do jogo, já na aba (e no quadro do ranking) pedidos. */
  const goMenu = (tab: GameTab, board?: Board) => {
    // O ranking tem página própria: abre já neste jogo e no modo jogado.
    if (tab === 'ranking') {
      void navigate({ to: '/ranking', search: rankingLink('color', board) });
      return;
    }
    setMenu({ tab });
    setPhase('start');
  };

  const playing = phase === 'show' || phase === 'pick' || phase === 'result';
  const last = results[results.length - 1];
  const lives = sv?.lives ?? 0;

  return (
    <div className="app">
      <header className="top">
        <Link to="/" className="logo" aria-label="Voltar aos jogos">
          no cap<span>!</span>
        </Link>
        <div className="top-actions">
          {playing && run && (
            <div className="chip y" aria-label="Rodada">
              {survival ? `R${index + 1}` : `${index + 1}/${run.settings.rounds}`}
            </div>
          )}
          <MuteButton />
        </div>
      </header>

      {survival && playing && (
        <SurvivalBar
          lives={lives}
          minScore={survivalMinScore('color', index)}
          round={index + 1}
          lost={phase === 'result' && !(sv?.passed[index] ?? true)}
        />
      )}

      {phase === 'start' && (
        <StartScreen mode={mode} initialTab={menu.tab} onMode={setMode} onStart={start} />
      )}
      {phase === 'show' && run && target && (
        <ShowScreen
          key={index}
          color={toHex(target)}
          ms={survival ? survivalShowMs(index) : run.settings.showMs}
          onDone={() => setPhase('pick')}
        />
      )}
      {phase === 'pick' && run && target && (
        <PickScreen
          key={index}
          onLock={lock}
          blind={blind}
          start={generateColorStart(run.seed, target, index)}
        />
      )}
      {phase === 'result' && run && last && (
        <ResultScreen
          key={index}
          result={last}
          isLast={survival ? sv?.ended !== null : index + 1 >= run.settings.rounds}
          onNext={next}
          extra={
            sv && (
              <SurvivalVerdict
                passed={sv.passed[index] ?? false}
                lives={sv.lives}
                minScore={survivalMinScore('color', index)}
                over={sv.ended !== null}
              />
            )
          }
          footer={
            run.mode === 'quick' ? (
              <QuickActions
                run={run}
                onMenu={goMenu}
                result={last}
                previousBest={prevBest}
                onAgain={() => start('quick')}
              />
            ) : undefined
          }
        />
      )}
      {phase === 'final' && run && survival && sv && (
        <SurvivalFinalColor
          run={run}
          onMenu={goMenu}
          results={results}
          previousBest={prevBest}
          onRematch={() => start('survival')}
        />
      )}
      {phase === 'final' && run && !survival && (
        <FinalScreen
          run={run}
          onMenu={goMenu}
          previousBest={prevBest}
          results={results}
          // Revanche depois do Daily vira partida solo clássica (o Daily é uma seed só).
          onRematch={() => start(run.mode === 'daily' ? 'classic' : run.mode)}
        />
      )}
    </div>
  );
}

/** Sobrevivência: salva a partida (rodadas jogadas) e mostra o resumo. */
function SurvivalFinalColor({
  run,
  results,
  previousBest,
  onMenu,
  onRematch,
}: {
  run: Run;
  results: RoundResult[];
  previousBest?: number;
  onMenu: (tab: GameTab, board?: Board) => void;
  onRematch: () => void;
}) {
  const save = useSaveMatch(run, results);
  const state = evaluateSurvival(
    'color',
    results.map((r) => r.score),
  );
  return (
    <SurvivalFinal
      completed={state.ended === 'cap'}
      rows={results.map((r, i) => ({
        detail: `ΔE ${r.deltaE.toFixed(1)}`,
        score: r.score,
        passed: state.passed[i] ?? false,
      }))}
      saveText={SAVE_TEXT[save]}
      limit={SURVIVAL_MAX_ROUNDS.color}
      onMenu={onMenu}
      record={
        isNewRecord(previousBest, state.played * 10)
          ? {
              now: formatBest('color', 'survival', state.played * 10),
              before: formatBest('color', 'survival', previousBest!),
            }
          : null
      }
      onRematch={onRematch}
    />
  );
}
