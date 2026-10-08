import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  evaluateSurvival,
  generateTimeRound,
  scoreTime,
  SURVIVAL_MAX_ROUNDS,
  survivalMinScore,
  timePresets,
} from '@nocap/games';
import type { GameTab } from '@/components/GameTabs';
import { useQueryClient } from '@tanstack/react-query';
import { MuteButton } from '@/components/MuteButton';
import { bestTenths, formatBest, isNewRecord, type Stats } from '@/lib/stats';
import { SurvivalBar, SurvivalFinal, SurvivalVerdict } from '@/components/Survival';
import { rankingLink, type Board } from '@/lib/ranking';
import { apiClient } from '@/lib/api-client';
import { isNetworkError } from '@/lib/network';
import { MIN_TAP_GAP_MS, formatSeconds } from './format';
import { FinalScreen } from './screens/FinalScreen';
import { IntroScreen } from './screens/IntroScreen';
import { TimeRoundsTable } from './screens/TimeRoundsTable';
import { SAVE_TEXT, useSaveTime } from './useSaveTime';
import { ResultScreen } from './screens/ResultScreen';
import { StartScreen } from './screens/StartScreen';
import { RoundScreen } from './screens/RoundScreen';
import type { Mode, RoundResult, Run } from './types';
import './time.css';
import './result.css';

type Phase = 'start' | 'intro' | 'target' | 'counting' | 'result' | 'final';

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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /** Instante do toque que iniciou a contagem (ref: nunca causa renderização durante a contagem). */
  const t0 = useRef(0);

  const queryClient = useQueryClient();
  /** Recorde do modo ANTES da partida (décimos); `undefined` = sem estatísticas (convidado/offline). */
  const [prevBest, setPrevBest] = useState<number | undefined>();

  const launch = useCallback(async (m: Mode) => {
    setBusy(true);
    setError('');
    try {
      setRun(await newRun(m));
      setIndex(0);
      setResults([]);
      setPhase('intro');
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

  const start = useCallback(
    async (m: Mode) => {
      const cached = queryClient.getQueryData<Stats>(['stats']);
      setPrevBest(m === 'daily' || !cached ? undefined : bestTenths(cached, 'time', m));
      await launch(m);
    },
    [queryClient, launch],
  );

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
      // O servidor recusa a partida se uma rodada passar de 3x o alvo: o limite vale aqui também.
      const answer = Math.min(Math.round(now - t0.current), target * 3);
      setResults((r) => [...r, { target, answer, score: scoreTime(target, answer, run.settings) }]);
      if (run.preset === 'sequence') {
        // Sequência: sem tela de resultado entre alvos; o próximo já aparece (e o fim mostra tudo).
        if (index + 1 < run.settings.rounds) {
          setIndex(index + 1);
          setPhase('target');
        } else setPhase('final');
        return;
      }
      setPhase('result');
    },
    [run, target, index],
  );

  const survival = !!run?.settings.survival;
  const sv = survival
    ? evaluateSurvival(
        'time',
        results.map((r) => r.score),
      )
    : null;

  const next = () => {
    if (survival ? sv?.ended === null : run && index + 1 < run.settings.rounds) {
      setIndex(index + 1);
      setPhase('target');
    } else {
      setPhase('final');
    }
  };

  const counting = phase === 'counting';
  /** Do fim da partida de volta ao menu do jogo, já na aba (e no quadro do ranking) pedidos. */
  const goMenu = (tab: GameTab, board?: Board) => {
    // O ranking tem página própria: abre já neste jogo e no modo jogado.
    if (tab === 'ranking') {
      void navigate({ to: '/ranking', search: rankingLink('time', board) });
      return;
    }
    setMenu({ tab });
    setPhase('start');
  };

  const playing = phase === 'target' || counting || phase === 'result';
  const survivalInfo = survival
    ? { round: index + 1, lives: sv?.lives ?? 3, minScore: survivalMinScore('time', index) }
    : undefined;
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
                {survival ? `R${index + 1}` : `${index + 1}/${run.settings.rounds}`}
              </div>
            )}
            <MuteButton />
          </div>
        )}
      </header>

      {survival && phase === 'result' && (
        <SurvivalBar
          lives={sv?.lives ?? 3}
          minScore={survivalMinScore('time', index)}
          round={index + 1}
          lost={sv ? !(sv.passed[index] ?? true) : false}
        />
      )}

      {phase === 'start' && (
        <StartScreen
          mode={mode}
          busy={busy}
          error={error}
          initialTab={menu.tab}
          onMode={setMode}
          onStart={(m) => void start(m)}
        />
      )}
      {phase === 'intro' && run && <IntroScreen run={run} onBegin={() => setPhase('target')} />}
      {(phase === 'target' || counting) && target !== null && run && (
        <RoundScreen
          key={index}
          target={target}
          noOvershoot={run.settings.noOvershoot}
          counting={counting}
          onBegin={begin}
          onStop={stop}
          survival={survivalInfo}
          step={
            run.settings.rounds > 1 && !run.settings.survival
              ? `${index + 1}/${run.settings.rounds}`
              : undefined
          }
        />
      )}
      {phase === 'result' && run && last && (
        <ResultScreen
          key={index}
          result={last}
          run={run}
          onMenu={goMenu}
          isLast={survival ? sv?.ended !== null : index + 1 >= run.settings.rounds}
          onNext={next}
          extra={
            sv && (
              <SurvivalVerdict
                passed={sv.passed[index] ?? false}
                lives={sv.lives}
                minScore={survivalMinScore('time', index)}
                over={sv.ended !== null}
              />
            )
          }
          previousBest={prevBest}
          onAgain={() => void start('quick')}
        />
      )}
      {phase === 'final' && run && survival && (
        <SurvivalFinalTime
          run={run}
          onMenu={goMenu}
          results={results}
          previousBest={prevBest}
          onRematch={() => void start('survival')}
        />
      )}
      {phase === 'final' && run && !survival && (
        <FinalScreen
          run={run}
          onMenu={goMenu}
          previousBest={prevBest}
          results={results}
          onRematch={() => void start(run.mode === 'daily' ? 'classic' : run.mode)}
        />
      )}
    </div>
  );
}

/** Sobrevivência: salva a partida (rodadas jogadas; offline não salva) e mostra o resumo. */
function SurvivalFinalTime({
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
  const save = useSaveTime(run, results);
  const state = evaluateSurvival(
    'time',
    results.map((r) => r.score),
  );
  return (
    <SurvivalFinal
      completed={state.ended === 'cap'}
      rows={results.map((r, i) => ({
        detail: `${formatSeconds(r.target)} → ${formatSeconds(r.answer)}`,
        score: r.score,
        passed: state.passed[i] ?? false,
      }))}
      table={(shown) => <TimeRoundsTable rows={results} passed={state.passed} shown={shown} />}
      saveText={SAVE_TEXT[save]}
      limit={SURVIVAL_MAX_ROUNDS.time}
      onMenu={onMenu}
      record={
        isNewRecord(previousBest, state.played * 10)
          ? {
              now: formatBest('time', 'survival', state.played * 10),
              before: formatBest('time', 'survival', previousBest!),
            }
          : null
      }
      onRematch={onRematch}
    />
  );
}
