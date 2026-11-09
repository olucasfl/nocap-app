import { useMemo, useState } from 'react';
import { soloSession } from '@/lib/solo-session';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { BlocksGame as Engine, HINTS_PER_GAME, decodeMove, type BlocksMode } from '@nocap/games';
import { BlocksClassicArt, BlocksTowersArt } from '@/components/HubArt';
import { WlBtn, WlPanel, WordsLanding } from '../words/landing/WordsLanding';
import { MuteButton } from '@/components/MuteButton';
import { useAuth } from '@/lib/auth';
import { bestTenths, fetchStats } from '@/lib/stats';
import { BlocksPlay, type BlocksEnd, type BlocksResume } from './BlocksPlay';
import {
  clearSavedRun,
  getBlocksBest,
  getTowersBest,
  loadSavedRun,
  saveRun,
  setBlocksBest,
  setTowersBest,
  type SavedRun,
} from './storage';
import { TowersPlay, type TowersEnd } from './towers/TowersPlay';
import { BlocksFinal, TowersFinal } from './BlocksFinals';
import type { BlocksRunInfo } from './useSaveBlocks';
import './blocks.css';
import { Page } from '@/components/Page';

type Phase = 'menu' | 'play' | 'final';

/** Os modos da aba: o Block Classic (vale no ranking) e o Block Towers (só neste aparelho, por ora). */
type UiMode = BlocksMode | 'towers';

/** Os modos de blocos. O Block Classic e o Block Towers; outros entram aqui depois. */
const MODES: { id: UiMode; label: string; desc: string; lead: string }[] = [
  {
    id: 'classic',
    label: 'Block Classic',
    desc: '8X8 · SEM TEMPO · 3 DICAS',
    lead: 'Encaixe as peças na grade de 8x8 e complete linhas e colunas para fazê-las sumir. Sem tempo: a partida acaba quando nenhuma peça que resta cabe. O recorde são os pontos.',
  },
  {
    id: 'towers',
    label: 'Block Towers',
    desc: 'FÍSICA · 3 VIDAS · MAGIAS',
    lead: 'As peças caem uma por vez e você monta uma torre que balança de verdade. Peça que cai da torre custa uma vida; com 3 vidas perdidas, acabou. O recorde são as peças empilhadas.',
  },
];

const RULES: Record<UiMode, [string, string][]> = {
  classic: [
    ['8x8', 'grade'],
    ['3', 'peças por vez'],
    ['3', 'dicas'],
  ],
  towers: [
    ['3', 'vidas'],
    ['física', 'em tudo'],
    ['magias', 'boas e ruins'],
  ],
};

const HOW: Record<UiMode, string[]> = {
  classic: [
    'Arraste cada uma das 3 peças para a grade. Elas não giram. Quando as 3 estão colocadas, vêm outras 3.',
    'Linha ou coluna inteira cheia some. Várias de uma vez rendem muito mais, e limpar em jogadas seguidas forma um COMBO.',
    'Coloque a peça na melhor posição e ganha um JOINHA. As 3 peças nas melhores posições, e é PERFECT.',
    'Tem 3 dicas por partida. Acabaram, acabou a ajuda. A partida termina quando nada mais cabe.',
  ],
  towers: [
    'A peça desce sozinha. Mova para os lados, gire e acelere a descida para encaixar na torre. O guia no alto mostra a próxima.',
    'Tudo tem física: a torre balança e pode desmoronar. Cada peça que cair custa uma vida, e são 3.',
    'A cada 5 peças chega uma magia. As boas você guarda e usa quando quiser (vinha, cimento, desfazer, vida extra). As ruins caem sobre você sozinhas.',
    'A nota é o máximo de peças que você chegou a ter empilhadas. Ela vale no ranking, no histórico e no perfil.',
  ],
};

const seedOf = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/** Pontos e rodada da partida guardada, refazendo as jogadas (é a mesma conta do servidor). */
function summarize(run: SavedRun): { score: number; sets: number } {
  const g = new Engine(run.seed);
  for (const n of run.moves) {
    const m = decodeMove(n);
    if (!g.play(m.slot, m.row, m.col)) break;
  }
  return { score: g.score, sets: g.sets };
}

/** O hub do Block's: tela própria no estilo das telas de jogo, com os dois jogos, como jogar e configurações (spec 066). */
function BlocksStart({
  onStart,
  onResume,
  busy,
}: {
  onStart: (mode: UiMode) => void;
  onResume: (run: SavedRun) => void;
  busy: boolean;
}) {
  const navigate = useNavigate();
  const user = useAuth((st) => st.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const [screen, setScreen] = useState<'main' | UiMode | 'rules' | 'settings'>('main');
  const saved = useMemo(() => loadSavedRun(user?.id), [user?.id]);
  const savedInfo = useMemo(() => (saved ? summarize(saved) : null), [saved]);

  // Com conta, o recorde é o do servidor (o mesmo do ranking); o do aparelho só vale sem conta.
  const recordOf = (mode: UiMode): number =>
    !user
      ? 0
      : stats.data
        ? Math.floor(bestTenths(stats.data, 'blocks', mode) / 10)
        : mode === 'towers'
          ? getTowersBest()
          : getBlocksBest();
  const unit = (m: UiMode) => (m === 'towers' ? 'peças' : 'pontos');
  const recordTag = (m: UiMode) => {
    const r = recordOf(m);
    return r > 0 ? `recorde ${r.toLocaleString('pt-BR')}` : 'sem recorde ainda';
  };

  const back = () => (screen === 'main' ? void navigate({ to: '/' }) : setScreen('main'));
  const mode = screen === 'classic' || screen === 'towers' ? screen : null;
  const current = MODES.find((m) => m.id === mode);

  let left;
  let right;
  if (screen === 'main') {
    left = (
      <nav className="gx-menu" aria-label="Menu do Block's" data-testid="wl-main">
        <WlBtn
          main
          title="Block Classic"
          sub={
            saved && savedInfo
              ? `continuar · ${savedInfo.score.toLocaleString('pt-BR')} pts`
              : recordTag('classic')
          }
          onClick={() => setScreen('classic')}
          sfx="start"
          testid="mode-classic"
        />
        <WlBtn
          title="Block Towers"
          sub={recordTag('towers')}
          onClick={() => setScreen('towers')}
          sfx="start"
          testid="mode-towers"
        />
        <WlBtn
          title="Como jogar"
          sub="regras dos dois jogos"
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
        <WlBtn danger title="Voltar aos jogos" onClick={back} sfx="back" testid="wl-exit" />
      </nav>
    );
  } else if (mode && current) {
    const resumable = mode === 'classic' && saved && savedInfo;
    const r = recordOf(mode);
    left = (
      <WlPanel
        title={current.label}
        lead={current.desc.replaceAll(' · ', ' · ').toLowerCase()}
        onBack={back}
        testid={`mode-panel-${mode}`}
      >
        <div className="wl-state">
          <b>{r > 0 ? `${r.toLocaleString('pt-BR')} ${unit(mode)}` : 'Sem recorde ainda'}</b>
          <span>
            {user
              ? 'Seu recorde neste jogo'
              : 'Entre na sua conta para guardar recordes, ranking e histórico.'}
          </span>
        </div>
        {resumable && (
          <div className="wl-state" role="group" aria-label="Partida em andamento">
            <span className="wl-badge">Partida em andamento</span>
            <div className="wl-nums" data-testid="resume-info">
              <span>
                <b>{savedInfo.score.toLocaleString('pt-BR')}</b> pontos
              </span>
              <span>
                rodada <b>{savedInfo.sets}</b>
              </span>
              <span>
                <b>
                  {HINTS_PER_GAME - saved.hintsUsed}/{HINTS_PER_GAME}
                </b>{' '}
                dicas
              </span>
            </div>
          </div>
        )}
        {resumable && (
          <button
            type="button"
            className="wl-cta"
            data-sfx="start"
            disabled={busy}
            onClick={() => onResume(saved)}
            data-testid="resume"
          >
            <span>Continuar partida</span>
            <small>→</small>
          </button>
        )}
        <button
          type="button"
          className={resumable ? 'gx-enter' : 'wl-cta'}
          data-sfx="start"
          disabled={busy}
          onClick={() => onStart(mode)}
          data-testid={`play-${mode}`}
        >
          <span>{busy ? 'Preparando...' : resumable ? 'Começar do zero' : 'Jogar'}</span>
          {!resumable && <small>→</small>}
        </button>
      </WlPanel>
    );
    right = (
      <div className="wl-board" data-testid={`mode-board-${mode}`}>
        <h3>{current.label}</h3>
        <div className="wl-board-art" aria-hidden="true">
          {mode === 'classic' ? <BlocksClassicArt /> : <BlocksTowersArt />}
        </div>
        <div className="wl-rulechips">
          {RULES[mode].map(([big, small]) => (
            <div key={small}>
              <b>{big}</b>
              {small}
            </div>
          ))}
        </div>
        <ol className="wl-rules">
          {HOW[mode].map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
        {mode === 'towers' && (
          <p>
            No celular use os botões; no computador, setas ou A/D, cima para girar, baixo para
            descer e E para a magia.
          </p>
        )}
      </div>
    );
  } else if (screen === 'rules') {
    left = (
      <WlPanel title="Como jogar" onBack={back} testid="rules">
        <div className="wl-scroll">
          {MODES.map((m) => (
            <div key={m.id} className="wl-state">
              <b>{m.label}</b>
              <ol className="wl-rules">
                {HOW[m.id].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
          ))}
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
        <p className="lead">
          O Block Classic guarda a partida em andamento e você continua de onde parou. As teclas do
          Towers ficam em Como jogar.
        </p>
      </WlPanel>
    );
  }

  return (
    <WordsLanding
      game="blocks"
      screen={screen}
      onBack={back}
      left={left}
      right={right}
      pane="show"
    />
  );
}

/** O Block's: menu de modos, partida em tela cheia e fim. */
export function BlocksGame() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [mode, setMode] = useState<UiMode>('classic');
  const [towersEnd, setTowersEnd] = useState<TowersEnd | null>(null);
  const [run, setRun] = useState<BlocksRunInfo>(() => ({
    matchId: crypto.randomUUID(),
    seed: seedOf(),
    session: '',
  }));
  const [end, setEnd] = useState<BlocksEnd | null>(null);
  const [resume, setResume] = useState<BlocksResume | undefined>(undefined);
  const [before, setBefore] = useState(0);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  /**
   * O servidor sorteia a seed e assina o início (é isso que deixa a partida valer no ranking).
   * Sem conta ou sem internet dá para jogar do mesmo jeito, só que como treino.
   */
  const begin = async (m: UiMode = mode) => {
    if (busy) return;
    setBusy(true);
    setMode(m);
    // Começar uma partida nova descarta a guardada (é o "Começar do zero" e o "Jogar de novo").
    if (m === 'classic') clearSavedRun();
    setResume(undefined);
    const { seed, session } = await soloSession('/games/blocks/session');
    // Sem conta não há recorde; com conta, o do servidor (e o do aparelho só se ele não responder).
    const signedIn = useAuth.getState().user !== null;
    let best = !signedIn ? 0 : m === 'towers' ? getTowersBest() : getBlocksBest();
    try {
      if (!signedIn) throw new Error('guest');
      const stats = await queryClient.fetchQuery({
        queryKey: ['stats'],
        queryFn: fetchStats,
        staleTime: 0,
      });
      best = Math.floor(bestTenths(stats, 'blocks', m) / 10);
    } catch {
      /* convidado ou sem rede: vale o recorde deste aparelho */
    }
    setBefore(best);
    setRun({ matchId: crypto.randomUUID(), seed, session });
    setBusy(false);
    setPhase('play');
  };

  /** Volta para a partida guardada: o recorde de quando ela começou vale para a tela final. */
  const resumeRun = (saved: SavedRun) => {
    setMode('classic');
    setBefore(saved.before);
    setRun({ matchId: saved.matchId, seed: saved.seed, session: saved.session });
    setResume({
      moves: saved.moves,
      thumbs: saved.thumbs,
      perfects: saved.perfects,
      hintsUsed: saved.hintsUsed,
    });
    setPhase('play');
  };

  // só nos testes de layout (dev): abre a tela final de cada modo sem jogar uma partida inteira
  if (import.meta.env.DEV) {
    (window as unknown as { __blocksFinal?: (m: UiMode, record: boolean) => void }).__blocksFinal =
      (m, record) => {
        setBefore(record ? 900 : 4000);
        setMode(m);
        if (m === 'towers')
          setTowersEnd({
            score: 23,
            pieces: 31,
            time: 412,
            spells: 3,
            falls: 5,
            collapses: 1,
            moves: [],
          });
        else
          setEnd({
            result: { score: 2480, lines: 31, bestStreak: 4, moves: 58 } as BlocksEnd['result'],
            moves: [],
            thumbs: 12,
            perfects: 3,
            hintsUsed: 1,
          });
        setPhase('final');
      };
  }

  if (phase === 'play' && mode === 'towers') {
    return (
      <TowersPlay
        key={run.seed}
        seed={run.seed}
        best={before}
        onEnd={(e) => {
          if (useAuth.getState().user) setTowersBest(e.score);
          setTowersEnd(e);
          setPhase('final');
        }}
        onQuit={() => setPhase('menu')}
        onRestart={() => void begin('towers')}
      />
    );
  }

  if (phase === 'play') {
    return (
      <BlocksPlay
        key={run.seed}
        seed={run.seed}
        resume={resume}
        onProgress={(p) => {
          const user = useAuth.getState().user;
          // Só com conta e com sessão do servidor: treino e convidado não guardam nada.
          if (!user || !run.session) return;
          saveRun({
            v: 1,
            userId: user.id,
            matchId: run.matchId,
            seed: run.seed,
            session: run.session,
            ...p,
            before,
            savedAt: Date.now(),
          });
        }}
        best={before}
        onEnd={(e) => {
          clearSavedRun();
          // O recorde guardado aqui é deste aparelho; o ranking de verdade vem do servidor.
          if (useAuth.getState().user) setBlocksBest(e.result.score);
          setEnd(e);
          setPhase('final');
        }}
        onQuit={() => setPhase('menu')}
        onRestart={() => void begin('classic')}
      />
    );
  }

  return (
    <Page>
      <header className="top">
        <Link to="/" className="logo" aria-label="Voltar aos jogos">
          no cap<span>!</span>
        </Link>
        <div className="top-actions">
          <MuteButton />
        </div>
      </header>
      {phase === 'menu' && (
        <BlocksStart onStart={(m) => void begin(m)} onResume={resumeRun} busy={busy} />
      )}
      {phase === 'final' && mode === 'towers' && towersEnd && (
        <TowersFinal
          end={towersEnd}
          before={before}
          run={run}
          busy={busy}
          onAgain={() => void begin()}
          onMenu={() => setPhase('menu')}
        />
      )}
      {phase === 'final' && mode !== 'towers' && end && (
        <BlocksFinal
          end={end}
          before={before}
          run={run}
          busy={busy}
          onAgain={() => void begin()}
          onMenu={() => setPhase('menu')}
        />
      )}
    </Page>
  );
}
