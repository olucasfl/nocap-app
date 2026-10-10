import { useCallback, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { SONGS, batidaMode, ecoPresets, lengthAt, type BatidaTap, type SongId } from '@nocap/games';
import type { GameTab } from '@/components/GameTabs';
import { MuteButton } from '@/components/MuteButton';
import { apiClient } from '@/lib/api-client';
import { isNetworkError } from '@/lib/network';
import { rankingLink, type Board } from '@/lib/ranking';
import { bestTenths, type Stats } from '@/lib/stats';
import { BatidaPlay } from './BatidaPlay';
import { EcoPlay } from './EcoPlay';
import { BatidaFinal } from './screens/BatidaFinal';
import { BatidaIntro } from './screens/BatidaIntro';
import { FinalScreen } from './screens/FinalScreen';
import { IntroScreen } from './screens/IntroScreen';
import { StartScreen } from './screens/StartScreen';
import type { BatidaRunInfo, EndReason, Mode, Run } from './types';
import './eco.css';

type Phase = 'start' | 'intro' | 'play' | 'final';

interface SessionResponse {
  seed: string;
  session: string;
}

/** Batida: a seed e a sessão vêm do servidor; sem internet joga-se só como treino. */
async function newBatida(): Promise<BatidaRunInfo> {
  let seed: string;
  let session: string;
  try {
    ({ seed, session } = await apiClient.post<SessionResponse>('/games/eco/session', {
      kind: 'solo',
    }));
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    seed = crypto.randomUUID().slice(0, 12);
    session = '';
  }
  // A música é escolhida na abertura (`BatidaIntro`); até lá vale a mais calma.
  return { matchId: crypto.randomUUID(), seed, session, song: 'passo' };
}

/** O servidor sorteia a seed (Daily: a do dia) e assina o instante de início. */
async function newRun(mode: Exclude<Mode, 'batida'>): Promise<Run> {
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
  /** Partida do Batida (modo de ritmo): no lugar de `run`, que é das sequências. */
  const [batida, setBatida] = useState<{ info: BatidaRunInfo; taps?: BatidaTap[] } | null>(null);
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
      setPrevBest(
        m === 'daily' || m === 'batida' || !cached ? undefined : bestTenths(cached, 'eco', m),
      );
      setBusy(true);
      setError('');
      try {
        if (m === 'batida') {
          setRun(null);
          setBatida({ info: await newBatida() });
        } else {
          setBatida(null);
          setRun(await newRun(m));
        }
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
    // O ranking tem página própria: abre já neste jogo e no modo jogado.
    if (tab === 'ranking') {
      void navigate({ to: '/ranking', search: rankingLink('eco', board) });
      return;
    }
    setMenu({ tab });
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
          onMode={setMode}
          onStart={(m) => void start(m)}
        />
      )}
      {phase === 'intro' && batida && (
        <BatidaIntro
          onBegin={(song: SongId) => {
            // O recorde que vale é o da música escolhida, antes desta partida.
            const cached = queryClient.getQueryData<Stats>(['stats']);
            setPrevBest(cached ? bestTenths(cached, 'eco', batidaMode(song)) : undefined);
            setBatida({ info: { ...batida.info, song } });
            setPhase('play');
          }}
        />
      )}
      {phase === 'intro' && run && <IntroScreen run={run} onBegin={() => setPhase('play')} />}
      {phase === 'play' && batida && (
        <BatidaPlay
          key={batida.info.matchId}
          seed={batida.info.seed}
          song={SONGS[batida.info.song]}
          onEnd={(taps) => {
            setBatida({ ...batida, taps });
            setPhase('final');
          }}
          onQuit={() => {
            setBatida(null);
            setMenu({ tab: 'modes' });
            setPhase('start');
          }}
        />
      )}
      {phase === 'final' && batida?.taps && (
        <BatidaFinal
          run={batida.info}
          taps={batida.taps}
          previousBest={prevBest}
          onMenu={goMenu}
          onRematch={() => void start('batida')}
        />
      )}
      {phase === 'play' && run && !batida && (
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
      {phase === 'final' && run && !batida && ending && (
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
