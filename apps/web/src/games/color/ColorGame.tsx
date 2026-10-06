import { useCallback, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  colorDeltaE,
  colorPresets,
  dailySeed,
  generateColorRound,
  scoreFromDeltaE,
  type Hsb,
} from '@nocap/games';
import { MuteButton } from '@/components/MuteButton';
import { toHex } from './hex';
import { FinalScreen } from './screens/FinalScreen';
import { QuickActions } from './screens/QuickActions';
import { PickScreen } from './screens/PickScreen';
import { ResultScreen } from './screens/ResultScreen';
import { ShowScreen } from './screens/ShowScreen';
import { StartScreen } from './screens/StartScreen';
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

export function ColorGame({ initialMode = 'classic' }: { initialMode?: Mode }) {
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

  const lock = useCallback(
    (guess: Hsb) => {
      if (!target) return;
      const deltaE = colorDeltaE(target, guess);
      setResults((r) => [...r, { target, guess, deltaE, score: scoreFromDeltaE(deltaE) }]);
      setPhase('result');
    },
    [target],
  );

  const next = () => {
    if (run && index + 1 < run.settings.rounds) {
      setIndex(index + 1);
      setPhase('show');
    } else {
      setPhase('final');
    }
  };

  const playing = phase === 'show' || phase === 'pick' || phase === 'result';
  const last = results[results.length - 1];

  return (
    <div className="app">
      <header className="top">
        <Link to="/" className="logo" aria-label="Voltar aos jogos">
          no cap<span>!</span>
        </Link>
        <div className="top-actions">
          {playing && run && (
            <div className="chip y" aria-label="Rodada">
              {index + 1}/{run.settings.rounds}
            </div>
          )}
          <MuteButton />
        </div>
      </header>

      {phase === 'start' && (
        <StartScreen mode={mode} onMode={setMode} onStart={() => start(mode)} />
      )}
      {phase === 'show' && run && target && (
        <ShowScreen
          key={index}
          color={toHex(target)}
          ms={run.settings.showMs}
          onDone={() => setPhase('pick')}
        />
      )}
      {phase === 'pick' && <PickScreen key={index} onLock={lock} />}
      {phase === 'result' && run && last && (
        <ResultScreen
          key={index}
          result={last}
          isLast={index + 1 >= run.settings.rounds}
          onNext={next}
          footer={
            run.mode === 'quick' ? (
              <QuickActions run={run} result={last} onAgain={() => start('quick')} />
            ) : undefined
          }
        />
      )}
      {phase === 'final' && run && (
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
