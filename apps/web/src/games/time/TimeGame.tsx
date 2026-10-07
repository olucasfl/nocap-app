import { useCallback, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { generateTimeRound, scoreTime, timePresets } from '@nocap/games';
import type { GameTab } from '@/components/GameTabs';
import { MuteButton } from '@/components/MuteButton';
import type { Board } from '@/lib/ranking';
import { apiClient } from '@/lib/api-client';
import { isNetworkError } from '@/lib/network';
import { MIN_TAP_GAP_MS } from './format';
import { FinalScreen } from './screens/FinalScreen';
import { ResultScreen } from './screens/ResultScreen';
import { StartScreen } from './screens/StartScreen';
import { RoundScreen } from './screens/RoundScreen';
import type { Mode, RoundResult, Run } from './types';
import './time.css';
import './result.css';

type Phase = 'start' | 'target' | 'counting' | 'result' | 'final';

interface SessionResponse {
  seed: string;
  session: string;
}

/** O servidor sorteia a seed (Daily: a do dia) e assina o instante de início. */
async function newRun(mode: Mode): Promise<Run> {
  const kind = mode === 'daily' ? 'daily' : 'solo';
  const preset = mode === 'daily' ? 'classic' : mode;
  let seed: string;
  let session: string;
  try {
    ({ seed, session } = await apiClient.post<SessionResponse>('/games/time/session', { kind }));
  } catch (e) {
    // Sem internet dá para jogar o Tempo solo, mas sem sessão do servidor a partida não é salva.
    if (kind === 'daily' || !isNetworkError(e)) throw e;
    seed = crypto.randomUUID().slice(0, 12);
    session = '';
  }
  return {
    matchId: crypto.randomUUID(),
    mode,
    kind,
    preset,
    seed,
    session,
    settings: timePresets[preset]!,
  };
}

export function TimeGame({
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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /** Instante do toque que iniciou a contagem (ref: nunca causa renderização durante a contagem). */
  const t0 = useRef(0);

  const start = useCallback(async (m: Mode) => {
    setBusy(true);
    setError('');
    try {
      setRun(await newRun(m));
      setIndex(0);
      setResults([]);
      setPhase('target');
    } catch {
      setError(
        m === 'daily'
          ? 'O Daily precisa de internet.'
          : 'Não deu para começar a partida agora. Tente de novo.',
      );
      setPhase('start');
    } finally {
      setBusy(false);
    }
  }, []);

  const target = run ? generateTimeRound(run.seed, run.settings, index) : null;

  const begin = useCallback(() => {
    t0.current = performance.now();
    setPhase('counting');
  }, []);

  const stop = useCallback(
    (now: number) => {
      if (!run || target === null) return;
      // Um segundo toque colado no primeiro (duplo toque) não encerra a rodada.
      if (now - t0.current < MIN_TAP_GAP_MS) return;
      const answer = Math.round(now - t0.current);
      setResults((r) => [...r, { target, answer, score: scoreTime(target, answer, run.settings) }]);
      setPhase('result');
    },
    [run, target],
  );

  const next = () => {
    if (run && index + 1 < run.settings.rounds) {
      setIndex(index + 1);
      setPhase('target');
    } else {
      setPhase('final');
    }
  };

  const counting = phase === 'counting';
  const playing = phase === 'target' || counting || phase === 'result';
  const last = results[results.length - 1];

  return (
    <div className={`app${counting ? ' tm-silent' : ''}`}>
      <header className="top">
        <Link to="/" className="logo" aria-label="Voltar aos jogos">
          no cap<span>!</span>
        </Link>
        {/* Na contagem o cabeçalho não mostra nada além do logo: sem chip, sem som, sem número. */}
        {!counting && (
          <div className="top-actions">
            {playing && run && (
              <div className="chip y" aria-label="Rodada">
                {index + 1}/{run.settings.rounds}
              </div>
            )}
            <MuteButton />
          </div>
        )}
      </header>

      {phase === 'start' && (
        <StartScreen
          mode={mode}
          busy={busy}
          error={error}
          initialTab={initialTab}
          initialBoard={initialBoard}
          onMode={setMode}
          onStart={(m) => void start(m)}
        />
      )}
      {(phase === 'target' || counting) && target !== null && run && (
        <RoundScreen
          key={index}
          target={target}
          noOvershoot={run.settings.noOvershoot}
          counting={counting}
          onBegin={begin}
          onStop={stop}
        />
      )}
      {phase === 'result' && run && last && (
        <ResultScreen
          key={index}
          result={last}
          run={run}
          isLast={index + 1 >= run.settings.rounds}
          onNext={next}
          onAgain={() => void start('quick')}
        />
      )}
      {phase === 'final' && run && (
        <FinalScreen
          run={run}
          results={results}
          onRematch={() => void start(run.mode === 'daily' ? 'classic' : run.mode)}
        />
      )}
    </div>
  );
}
