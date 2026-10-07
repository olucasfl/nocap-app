import { useCallback, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  colorDeltaE,
  colorPresets,
  dailySeed,
  evaluateSurvival,
  generateColorRound,
  scoreFromDeltaE,
  survivalMinScore,
  survivalShowMs,
  type Hsb,
} from '@nocap/games';
import { MuteButton } from '@/components/MuteButton';
import { SurvivalBar, SurvivalFinal, SurvivalVerdict } from '@/components/Survival';
import { toHex } from './hex';
import { FinalScreen } from './screens/FinalScreen';
import { QuickActions } from './screens/QuickActions';
import { PickScreen } from './screens/PickScreen';
import { ResultScreen } from './screens/ResultScreen';
import { ShowScreen } from './screens/ShowScreen';
import type { GameTab } from '@/components/GameTabs';
import type { Board } from '@/lib/ranking';
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
    settings: colorPresets[preset]!,
  };
}

export function ColorGame({
  initialMode = 'classic',
  initialTab,
  initialBoard,
}: {
  initialMode?: Mode;
  initialTab?: GameTab;
  initialBoard?: Board;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [phase, setPhase] = useState<Phase>('start');
  const [run, setRun] = useState<Run | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);

  const start = useCallback((m: Mode) => {
    setRun(newRun(m));
    setIndex(0);
    setResults([]);
    setPhase('show');
  }, []);

  const target: Hsb | null = run ? generateColorRound(run.seed, run.settings, index) : null;

  const survival = !!run?.settings.survival;
  const blind = !!run?.settings.blind;
  // Sobrevivência: o estado (vidas, fim) vem sempre das notas já jogadas.
  const sv = survival ? evaluateSurvival(results.map((r) => r.score)) : null;

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
          minScore={survivalMinScore(index)}
          round={index + 1}
          lost={phase === 'result' && !(sv?.passed[index] ?? true)}
        />
      )}

      {phase === 'start' && (
        <StartScreen
          mode={mode}
          initialTab={initialTab}
          initialBoard={initialBoard}
          onMode={setMode}
          onStart={start}
        />
      )}
      {phase === 'show' && run && target && (
        <ShowScreen
          key={index}
          color={toHex(target)}
          ms={survival ? survivalShowMs(index) : run.settings.showMs}
          onDone={() => setPhase('pick')}
        />
      )}
      {phase === 'pick' && <PickScreen key={index} onLock={lock} blind={blind} />}
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
                minScore={survivalMinScore(index)}
                over={sv.ended !== null}
              />
            )
          }
          footer={
            run.mode === 'quick' ? (
              <QuickActions run={run} result={last} onAgain={() => start('quick')} />
            ) : undefined
          }
        />
      )}
      {phase === 'final' && run && survival && sv && (
        <SurvivalFinalColor run={run} results={results} onRematch={() => start('survival')} />
      )}
      {phase === 'final' && run && !survival && (
        <FinalScreen
          run={run}
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
  onRematch,
}: {
  run: Run;
  results: RoundResult[];
  onRematch: () => void;
}) {
  const save = useSaveMatch(run, results);
  const state = evaluateSurvival(results.map((r) => r.score));
  return (
    <SurvivalFinal
      played={state.played}
      completed={state.ended === 'cap'}
      rows={results.map((r, i) => ({
        detail: `ΔE ${r.deltaE.toFixed(1)}`,
        score: r.score,
        passed: state.passed[i] ?? false,
      }))}
      saveText={SAVE_TEXT[save]}
      game="cor"
      onRematch={onRematch}
    />
  );
}
