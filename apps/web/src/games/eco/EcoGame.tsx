import { useCallback, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ecoPresets, lengthAt } from '@nocap/games';
import type { GameTab } from '@/components/GameTabs';
import { MuteButton } from '@/components/MuteButton';
import { apiClient } from '@/lib/api-client';
import { isNetworkError } from '@/lib/network';
import type { Board } from '@/lib/ranking';
import { bestTenths, type Stats } from '@/lib/stats';
import { EcoPlay } from './EcoPlay';
import { FinalScreen } from './screens/FinalScreen';
import { IntroScreen } from './screens/IntroScreen';
import { StartScreen } from './screens/StartScreen';
import type { EndReason, Mode, Run } from './types';
import './eco.css';

type Phase = 'start' | 'intro' | 'play' | 'final';

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
    ({ seed, session } = await apiClient.post<SessionResponse>('/games/eco/session', { kind }));
  } catch (e) {
    // Sem internet dá para jogar o Eco solo, mas sem sessão do servidor a partida não é salva.
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
    settings: ecoPresets[preset],
  };
}

export function EcoGame({
  initialMode = 'classic',
  initialTab,
  initialBoard,
}: {
  initialMode?: Mode;
  initialTab?: GameTab;
  initialBoard?: Board;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  /** Aba e quadro com que o menu abre: vêm da rota e mudam ao sair de uma partida ("Ver ranking"). */
  const [menu, setMenu] = useState<{ tab?: GameTab; board?: Board }>({
    tab: initialTab,
    board: initialBoard,
  });
  const [phase, setPhase] = useState<Phase>('start');
  const [run, setRun] = useState<Run | null>(null);
  const [round, setRound] = useState(1);
  const [ending, setEnding] = useState<{ taps: number[]; reason: EndReason } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const queryClient = useQueryClient();
  /** Recorde do modo ANTES da partida (décimos); `undefined` = sem estatísticas (convidado/offline). */
  const [prevBest, setPrevBest] = useState<number | undefined>();

  const start = useCallback(
    async (m: Mode) => {
      const cached = queryClient.getQueryData<Stats>(['stats']);
      setPrevBest(m === 'daily' || !cached ? undefined : bestTenths(cached, 'eco', m));
      setBusy(true);
      setError('');
      try {
        setRun(await newRun(m));
        setRound(1);
        setEnding(null);
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
    },
    [queryClient],
  );

  /** Do fim da partida de volta ao menu do jogo, já na aba (e no quadro do ranking) pedidos. */
  const goMenu = (tab: GameTab, board?: Board) => {
    setMenu({ tab, board });
    setPhase('start');
  };

  const playing = phase === 'play';

  return (
    <div className="app">
      <header className="top">
        <Link to="/" className="logo" aria-label="Voltar aos jogos">
          no cap<span>!</span>
        </Link>
        <div className="top-actions">
          {playing && run && (
            <div className="chip y" aria-label="Passos da rodada">
              {lengthAt(run.settings, round)}{' '}
              {lengthAt(run.settings, round) === 1 ? 'PASSO' : 'PASSOS'}
            </div>
          )}
          <MuteButton />
        </div>
      </header>

      {phase === 'start' && (
        <StartScreen
          mode={mode}
          busy={busy}
          error={error}
          initialTab={menu.tab}
          initialBoard={menu.board}
          onMode={setMode}
          onStart={(m) => void start(m)}
        />
      )}
      {phase === 'intro' && run && <IntroScreen run={run} onBegin={() => setPhase('play')} />}
      {phase === 'play' && run && (
        <EcoPlay
          key={run.matchId}
          run={run}
          onRound={setRound}
          onEnd={(taps, reason) => {
            setEnding({ taps, reason });
            setPhase('final');
          }}
        />
      )}
      {phase === 'final' && run && ending && (
        <FinalScreen
          run={run}
          taps={ending.taps}
          reason={ending.reason}
          previousBest={prevBest}
          onMenu={goMenu}
          onRematch={() => void start(run.mode === 'daily' ? 'classic' : run.mode)}
        />
      )}
    </div>
  );
}
