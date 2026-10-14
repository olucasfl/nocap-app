import { useCallback, useState } from 'react';
import { soloSession } from '@/lib/solo-session';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { SinalInput, SinalMode, SinalResult } from '@nocap/games';
import { BackButton } from '@/components/BackButton';
import { GameTabs, type GameTab } from '@/components/GameTabs';
import { ModePicker } from '@/components/ModePicker';
import { ModeSheet } from '@/components/ModeSheet';
import { FriendsPanel } from '@/components/FriendsPanel';
import { MuteButton } from '@/components/MuteButton';
import { useAuth } from '@/lib/auth';
import { bestTenths, fetchStats } from '@/lib/stats';
import { SaveNote } from '@/components/GuestNotice';
import { useSaveSinal, type SinalRunInfo } from './useSaveSinal';
import { ArrowRight } from '@/components/icons';
import { SinalPlay } from './SinalPlay';
import { getSinalBest, setSinalBest } from './storage';

type Phase = 'menu' | 'play' | 'final';

/** Os modos de partida (o Daily e o online ainda não existem). */
const MODES: { id: SinalMode; label: string; desc: string; lead: string }[] = [
  {
    id: 'classico',
    label: 'Clássico',
    desc: 'FASES · MAPAS · SEM FIM',
    lead: 'Fases cada vez mais difíceis: a cada uma vêm mais obstáculos, corredores mais estreitos e uma escuridão mais ligeira. A cada 5 fases o mapa muda. O recorde é a distância total.',
  },
  {
    id: 'infinito',
    label: 'Infinito',
    desc: 'NÃO ACABA · CADA VEZ PIOR',
    lead: 'Um mapa só, sem linha de chegada. O corredor estreita e alarga, e a escuridão não para de chegar. O recorde são os metros do ponto mais longe que você foi.',
  },
];

const RULES: Record<SinalMode, [string, string][]> = {
  classico: [
    ['5', 'fases por mapa'],
    ['3', 'mapas'],
    ['mais', 'coisas a cada fase'],
  ],
  infinito: [
    ['sem', 'linha de chegada'],
    ['1', 'mapa sorteado'],
    ['corredor', 'que estreita'],
  ],
};

const HOW = [
  'O Vigia fica no topo da tela. De costas, você corre. Quando ele olha, fique parado: se mexer, acabou.',
  'Ele canta SI-NAL-VER-ME-LHO de costas. Quando o LHO fica comprido, é o aviso: pare antes de ele virar.',
  'O anel no chão é um esconderijo: dentro dele você se mexe mesmo com o Vigia olhando. Mas ele quebra se você ficar demais.',
  'A escuridão vem de trás. Ela nunca é mais rápida que você: só pega quem para demais.',
];

/** O menu do jogo: as abas, os modos como cartões e a ficha do modo (como jogar e Jogar). */
function SinalStart({ onStart, busy }: { onStart: (mode: SinalMode) => void; busy: boolean }) {
  const user = useAuth((st) => st.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const [tab, setTab] = useState<GameTab>('modes');
  const [open, setOpen] = useState<SinalMode | null>(null);
  const close = useCallback(() => setOpen(null), []);
  // O recorde da conta (servidor) ou, sem conta, o deste aparelho.
  const best =
    !open || !user
      ? 0
      : Math.max(getSinalBest(open), Math.floor(bestTenths(stats.data, 'sinal', open) / 10));

  return (
    <section className="screen">
      <BackButton to="/" label="Jogos" />
      <h1 className="sv-title">Sinal Vermelho</h1>
      <GameTabs game="sinal" tab={tab} onTab={setTab} />
      {tab === 'modes' && (
        <>
          <ModePicker game="sinal" modes={MODES} onOpen={(id) => setOpen(id as SinalMode)} />
          {open && (
            <ModeSheet
              game="sinal"
              modeId={open}
              title={MODES.find((m) => m.id === open)?.label ?? ''}
              lead={MODES.find((m) => m.id === open)?.lead ?? ''}
              record={best > 0 ? `Seu recorde aqui é de ${Math.floor(best)} m` : null}
              onClose={close}
              rules={RULES[open].map(([big, small]) => (
                <div className="sv-rule" key={small}>
                  <b>{big}</b>
                  {small}
                </div>
              ))}
            >
              <ol className="sv-howto">
                {HOW.map((t, i) => (
                  <li key={i}>
                    <b>{i + 1}</b>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
              <p className="mono sv-meta">
                NO CELULAR, O ANALÓGICO FICA EMBAIXO, NO CENTRO. NO COMPUTADOR, W A S D OU AS SETAS.
              </p>
              <button
                type="button"
                className="btn"
                data-sfx="start"
                disabled={busy}
                onClick={() => onStart(open)}
              >
                {busy ? 'Preparando...' : 'Jogar'} <ArrowRight />
              </button>
              {!user && (
                <p className="mono sv-meta">
                  ENTRE NA SUA CONTA PARA SALVAR NO RANKING, NO HISTÓRICO E NOS RECORDES.
                </p>
              )}
            </ModeSheet>
          )}
        </>
      )}
      {tab === 'friends' && <FriendsPanel game="sinal" />}
    </section>
  );
}

const seedOf = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/** O fim da partida: o veredito, a distância, o recorde e o que fazer a seguir. */
function SinalFinal({
  mode,
  result,
  before,
  run,
  inputs,
  busy,
  onAgain,
  onMenu,
}: {
  mode: SinalMode;
  result: SinalResult;
  before: number;
  run: SinalRunInfo;
  inputs: SinalInput[];
  busy: boolean;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const save = useSaveSinal(run, mode, inputs);
  const guest = save === 'guest';
  const classic = mode === 'classico';
  const meters = Math.floor(result.meters);
  const prev = Math.floor(before);
  // Sem conta não há recorde: só a distância desta partida.
  const isRecord = !guest && meters > prev;
  const best = Math.max(meters, prev);
  const seen = result.ended === 'vigia';
  const diff = meters - prev;
  const pct = best > 0 ? Math.round((meters / best) * 100) : 0;
  return (
    <section className="screen svf">
      <div className={`svf-verdict ${seen ? 'vigia' : 'dark'}`}>
        <span className="mono svf-kicker">
          SINAL VERMELHO · {classic ? 'CLÁSSICO' : 'INFINITO'}
        </span>
        <h1>{seen ? 'O VIGIA TE VIU' : 'A ESCURIDÃO TE PEGOU'}</h1>
        <p className="mono">
          {seen
            ? 'Você se mexeu na hora errada. Pare assim que o aviso tocar.'
            : 'Você demorou demais parado ou se escondeu muito. Ande quando o Vigia estiver de costas.'}
        </p>
      </div>

      <div className="svf-score">
        {isRecord && (
          <span className="svf-badge mono">{prev > 0 ? 'NOVO RECORDE' : 'PRIMEIRO RECORDE'}</span>
        )}
        <span className="mono svf-label">{classic ? 'DISTÂNCIA TOTAL' : 'METROS'}</span>
        <div className="svf-big">
          <b>{meters}</b>
          <span>m</span>
        </div>
        {!guest && (
          <>
            <div className="svf-meter" aria-label={`${pct}% do seu recorde`}>
              <i style={{ transform: `scaleX(${Math.min(1, pct / 100)})` }} />
            </div>
            <span className="mono svf-hint">
              {isRecord
                ? prev > 0
                  ? `+${diff} m sobre o recorde anterior`
                  : 'Esse é o seu primeiro resultado neste modo'
                : `${pct}% do seu recorde`}
            </span>
          </>
        )}
      </div>

      <dl className="svf-stats">
        {classic && (
          <div>
            <dt className="mono">FASES CUMPRIDAS</dt>
            <dd>{result.phases}</dd>
          </div>
        )}
        {!guest && (
          <>
            <div>
              <dt className="mono">SEU RECORDE</dt>
              <dd>{best} m</dd>
            </div>
            <div>
              <dt className="mono">RECORDE ANTERIOR</dt>
              <dd>{prev > 0 ? `${prev} m` : '-'}</dd>
            </div>
          </>
        )}
        <div>
          <dt className="mono">TEMPO DE CORRIDA</dt>
          <dd>{Math.floor(result.endedTick / 60)} s</dd>
        </div>
      </dl>

      <SaveNote className="mono svf-note" save={save} />

      <div className="stack svf-actions">
        <button
          type="button"
          className="btn alt"
          data-sfx="start"
          disabled={busy}
          onClick={onAgain}
        >
          {busy ? 'Preparando...' : 'Jogar de novo'}
        </button>
        {!guest && (
          <>
            <Link
              to="/ranking"
              search={{ jogo: 'sinal', modo: mode }}
              className="btn ghost"
              data-sfx="select"
            >
              Ver ranking
            </Link>
            <Link
              to="/ranking"
              search={{ jogo: 'sinal', modo: mode, quem: 'friends' }}
              className="btn ghost"
              data-sfx="select"
            >
              Ranking dos amigos
            </Link>
          </>
        )}
        <button type="button" className="btn ghost" data-sfx="back" onClick={onMenu}>
          Voltar ao menu
        </button>
        <Link to="/" className="btn ghost">
          Voltar aos jogos
        </Link>
      </div>
    </section>
  );
}

/** O Sinal Vermelho: menu (modo e cor do boneco), partida em tela cheia e fim. */
export function SinalGame() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [mode, setMode] = useState<SinalMode>('classico');
  const [run, setRun] = useState<SinalRunInfo>(() => ({
    matchId: crypto.randomUUID(),
    seed: seedOf(),
    session: '',
  }));
  const [result, setResult] = useState<SinalResult | null>(null);
  const [before, setBefore] = useState(0);
  const [inputs, setInputs] = useState<SinalInput[]>([]);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  /**
   * O servidor sorteia a seed e assina o instante de início (é isso que deixa a partida valer no
   * ranking). Sem conta ou sem internet dá para jogar do mesmo jeito, só que como treino.
   */
  const begin = async (m: SinalMode = mode) => {
    if (busy) return;
    setBusy(true);
    setMode(m);
    const { seed, session } = await soloSession('/games/sinal/session');
    const signedIn = useAuth.getState().user !== null;
    let best = signedIn ? getSinalBest(m) : 0;
    try {
      if (!signedIn) throw new Error('guest');
      const stats = await queryClient.fetchQuery({
        queryKey: ['stats'],
        queryFn: fetchStats,
        staleTime: 0,
      });
      best = Math.max(best, Math.floor(bestTenths(stats, 'sinal', m) / 10));
    } catch {
      /* convidado: vale o recorde deste aparelho */
    }
    setBefore(best);
    setRun({ matchId: crypto.randomUUID(), seed, session });
    setBusy(false);
    setPhase('play');
  };

  if (phase === 'play') {
    return (
      <SinalPlay
        key={run.seed}
        mode={mode}
        seed={run.seed}
        best={useAuth.getState().user ? getSinalBest(mode) : 0}
        onEnd={(r, inp) => {
          // O recorde guardado aqui é deste aparelho; o ranking de verdade vem do servidor.
          if (useAuth.getState().user) setSinalBest(mode, r.meters);
          setResult(r);
          setInputs(inp);
          setPhase('final');
        }}
        onQuit={() => setPhase('menu')}
        onRestart={() => void begin(mode)}
      />
    );
  }

  return (
    <div className="app">
      <header className="top">
        <Link to="/" className="logo" aria-label="Voltar aos jogos">
          no cap<span>!</span>
        </Link>
        <div className="top-actions">
          <MuteButton />
        </div>
      </header>

      {phase === 'menu' && <SinalStart onStart={(m) => void begin(m)} busy={busy} />}

      {phase === 'final' && result && (
        <SinalFinal
          mode={mode}
          result={result}
          before={before}
          run={run}
          inputs={inputs}
          busy={busy}
          onAgain={() => void begin()}
          onMenu={() => setPhase('menu')}
        />
      )}
    </div>
  );
}
