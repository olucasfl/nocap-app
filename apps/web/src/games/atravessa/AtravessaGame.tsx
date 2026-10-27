import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { AtravessaInput, AtravessaResult } from '@nocap/games';
import { Loader } from '@/components/Loader';
import { MuteButton } from '@/components/MuteButton';
import { SaveNote } from '@/components/GuestNotice';
import { useAuth } from '@/lib/auth';
import { soloSession } from '@/lib/solo-session';
import { fetchStats, type Stats } from '@/lib/stats';
import { AtravessaPlay } from './AtravessaPlay';
import { useSaveAtravessa, type AtravessaRunInfo } from './useSaveAtravessa';
import './atravessa.css';
import { Page } from '@/components/Page';

type Phase = 'menu' | 'play' | 'final';

const BEST_KEY = 'nocap-atravessa-best';

/** O recorde (em linhas) deste aparelho; vale para quem ainda não tem o do servidor. */
function localBest(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
function saveLocalBest(rows: number) {
  try {
    localStorage.setItem(BEST_KEY, String(Math.max(rows, localBest())));
  } catch {
    /* sem storage */
  }
}
/** O recorde da conta, em linhas (o servidor guarda em décimos). */
const serverBest = (stats: Stats | undefined) =>
  Math.floor(
    (stats?.modes.find((m) => m.game === 'atravessa' && m.mode === 'infinito')?.best ?? 0) / 10,
  );

const seedOf = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

const VERDICT: Record<string, string> = {
  veiculo: 'ATROPELADO',
  trem: 'O TREM PASSOU',
  agua: 'CAIU NA ÁGUA',
  arrastado: 'A TORA TE LEVOU',
  afundou: 'AFUNDOU',
  mordido: 'O CROCODILO MORDEU',
  atingido: 'FOI VARRIDO',
  parado: 'PAROU DEMAIS',
};

function AtravessaFinal({
  result,
  before,
  run,
  steps,
  busy,
  onAgain,
  onMenu,
}: {
  result: AtravessaResult;
  before: number;
  run: AtravessaRunInfo;
  steps: AtravessaInput[];
  busy: boolean;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const save = useSaveAtravessa(run, steps);
  const guest = save === 'guest';
  const rows = result.score;
  const isRecord = !guest && rows > before;
  const best = Math.max(rows, before);
  return (
    <section className="screen atf">
      <div className="atf-verdict">
        <span className="mono atf-kicker">ATRAVESSA! · INFINITO</span>
        <h1>{VERDICT[result.end ?? 'parado']}</h1>
      </div>
      <div className="atf-score">
        {isRecord && (
          <span className="atf-badge mono">{before > 0 ? 'NOVO RECORDE' : 'PRIMEIRO RECORDE'}</span>
        )}
        <span className="mono atf-label">LINHAS</span>
        <div className="atf-big">
          <b>{rows}</b>
        </div>
        {!guest && (
          <span className="mono atf-hint">
            {isRecord
              ? before > 0
                ? `+${rows - before} sobre o recorde anterior`
                : 'Esse é o seu primeiro resultado'
              : `Seu recorde: ${best}`}
          </span>
        )}
      </div>
      <SaveNote className="mono atf-note" save={save} />
      <div className="stack atf-actions">
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
          <Link
            to="/ranking"
            search={{ jogo: 'atravessa', modo: 'infinito' } as never}
            className="btn ghost"
            data-sfx="select"
          >
            Ver ranking
          </Link>
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

/** O Atravessa!: menu, partida em tela cheia e fim (spec 028). */
export function AtravessaGame() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [run, setRun] = useState<AtravessaRunInfo>(() => ({
    matchId: crypto.randomUUID(),
    seed: seedOf(),
    session: '',
  }));
  const [result, setResult] = useState<AtravessaResult | null>(null);
  const [steps, setSteps] = useState<AtravessaInput[]>([]);
  const [before, setBefore] = useState(0);
  /** A linha do recorde de quem joga (a faixa dourada): o do servidor ou, sem conta, o deste aparelho. */
  const [record, setRecord] = useState(0);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  // vindo do Fox Cap! pelo atalho "Atravessa! Infinito": já começa a partida (spec 049)
  const direct = useSearch({ strict: false }) as { treino?: number };
  const navigate = useNavigate();
  const started = useRef(false);

  /** O servidor sorteia a seed e assina o início; sem conta ou sem internet vira treino. */
  const begin = async () => {
    if (busy) return;
    setBusy(true);
    const { seed, session } = await soloSession('/games/atravessa/session');
    const signedIn = useAuth.getState().user !== null;
    const local = signedIn ? localBest() : 0;
    setBefore(local);
    setRecord(Math.max(localBest(), local));
    setRun({ matchId: crypto.randomUUID(), seed, session });
    setBusy(false);
    setPhase('play');
    // o recorde do servidor chega depois: a partida não espera por ele para começar
    if (!signedIn) return;
    try {
      const stats = await queryClient.fetchQuery({
        queryKey: ['stats'],
        queryFn: fetchStats,
        staleTime: 0,
      });
      const best = Math.max(local, serverBest(stats));
      setBefore(best);
      setRecord(Math.max(localBest(), best));
    } catch {
      /* sem rede: vale o recorde deste aparelho */
    }
  };

  useEffect(() => {
    if (direct.treino && !started.current) {
      started.current = true;
      void begin();
    }
    // só na primeira vez que a página abre
  }, []);

  // vindo do Fox Cap!: nada de menu enquanto a partida é preparada
  if (direct.treino && phase === 'menu')
    return (
      <div className="at-boot at-boot-fixed">
        <Loader />
      </div>
    );

  if (phase === 'play') {
    return (
      <AtravessaPlay
        key={run.seed}
        seed={run.seed}
        record={record}
        onEnd={(r, s) => {
          saveLocalBest(r.score);
          setResult(r);
          setSteps(s);
          setPhase('final');
        }}
        // vindo do Fox Cap!: sair da partida volta para lá
        onQuit={() => void navigate({ to: '/fox-cap' })}
        onRestart={() => void begin()}
        onOfflineInvite={() => void navigate({ to: '/fox-cap', search: { aba: 'amigos' } })}
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
      {phase === 'final' && result && (
        <AtravessaFinal
          result={result}
          before={before}
          run={run}
          steps={steps}
          busy={busy}
          onAgain={() => void begin()}
          onMenu={() => void navigate({ to: '/fox-cap' })}
        />
      )}
    </Page>
  );
}
