import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AtravessaInput, AtravessaResult } from '@nocap/games';
import { BackButton } from '@/components/BackButton';
import { HubCard, HubHero, HubNote, HubSteps, HubTabs } from '@/components/GameHub';
import { AtravessaArt } from '@/components/HubArt';
import { MuteButton } from '@/components/MuteButton';
import { SaveNote } from '@/components/GuestNotice';
import { RoomBanner } from '@/components/RoomBanner';
import { useAuth } from '@/lib/auth';
import { soloSession } from '@/lib/solo-session';
import { fetchStats, type Stats } from '@/lib/stats';
import { AtravessaPlay } from './AtravessaPlay';
import { useSaveAtravessa, type AtravessaRunInfo } from './useSaveAtravessa';
import './atravessa.css';

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
  Math.floor((stats?.modes.find((m) => m.game === 'atravessa' && m.mode === 'infinito')?.best ?? 0) / 10);

const HOW = [
  'Pule de faixa em faixa e chegue o mais longe que der. Cada linha nova vale um ponto.',
  'Desvie dos carros e do trem (a luz vermelha avisa). No rio, pise nas toras e nas pedras, nunca na água.',
  'Parado numa faixa de descanso, um perigo desce pela sua coluna: pule para o lado.',
  'O cenário muda a cada trecho: grama, deserto e, mais longe, a noite.',
];

const seedOf = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

function AtravessaMenu({ onStart, busy }: { onStart: () => void; busy: boolean }) {
  const [tab, setTab] = useState<'jogar' | 'como'>('jogar');
  const user = useAuth((s) => s.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const best = user ? Math.max(localBest(), serverBest(stats.data)) : 0;
  return (
    <section className="screen gh">
      <BackButton to="/" label="Jogos" />
      <HubHero
        accent="red"
        art={<AtravessaArt />}
        title="Atravessa!"
        text="Pule, desvie e atravesse tudo. Sem fim: vale a distância."
        stats={best > 0 ? [{ label: 'Seu recorde', value: `${best} linhas` }] : undefined}
      />
      <RoomBanner />
      <HubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'jogar', label: 'Jogar' },
          { id: 'como', label: 'Como jogar' },
        ]}
      />
      {tab === 'jogar' ? (
        <>
          <div className="gh-modes">
            <HubCard
              tone="red"
              art={
                <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 27V8M8 15l8-8 8 8" />
                </svg>
              }
              name="Infinito"
              desc="Sem fim · vale a distância"
              tag={best > 0 ? `Recorde ${best} linhas` : 'Sem recorde ainda'}
              cta={busy ? 'Preparando...' : 'Jogar'}
              disabled={busy}
              onClick={onStart}
              testId="atravessa-play"
            />
            <HubCard
              tone="blue"
              art={
                <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="12" r="4" />
                  <circle cx="22" cy="13" r="3.2" />
                  <path d="M3 26c0-4 3.6-7 8-7s8 3 8 7M18 26c.4-3 2.4-5 5-5 3 0 5 2 5 5" />
                </svg>
              }
              name="Com amigos"
              desc="Corrida em sala · até 8 jogadores"
              cta="Jogar com amigos"
              to="/sala"
              search={{ jogo: 'atravessa' }}
              testId="atravessa-friends"
            />
          </div>
          {!user && <HubNote>Entre na sua conta para salvar no ranking, no histórico e nos recordes.</HubNote>}
        </>
      ) : (
        <>
          <HubSteps title="Como jogar" steps={HOW} />
          <HubNote>
            No celular: toque pula para a frente e deslizar vai para o lado ou para trás. No computador: W A S D.
          </HubNote>
        </>
      )}
    </section>
  );
}

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
        {isRecord && <span className="atf-badge mono">{before > 0 ? 'NOVO RECORDE' : 'PRIMEIRO RECORDE'}</span>}
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
        <button type="button" className="btn alt" data-sfx="start" disabled={busy} onClick={onAgain}>
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

  /** O servidor sorteia a seed e assina o início; sem conta ou sem internet vira treino. */
  const begin = async () => {
    if (busy) return;
    setBusy(true);
    const { seed, session } = await soloSession('/games/atravessa/session');
    const signedIn = useAuth.getState().user !== null;
    let best = signedIn ? localBest() : 0;
    try {
      if (!signedIn) throw new Error('guest');
      const stats = await queryClient.fetchQuery({ queryKey: ['stats'], queryFn: fetchStats, staleTime: 0 });
      best = Math.max(best, serverBest(stats));
    } catch {
      /* convidado: vale o recorde deste aparelho */
    }
    setBefore(best);
    setRecord(Math.max(localBest(), best));
    setRun({ matchId: crypto.randomUUID(), seed, session });
    setBusy(false);
    setPhase('play');
  };

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
        onQuit={() => setPhase('menu')}
        onRestart={() => void begin()}
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
      {phase === 'menu' && <AtravessaMenu onStart={() => void begin()} busy={busy} />}
      {phase === 'final' && result && (
        <AtravessaFinal
          result={result}
          before={before}
          run={run}
          steps={steps}
          busy={busy}
          onAgain={() => void begin()}
          onMenu={() => setPhase('menu')}
        />
      )}
    </div>
  );
}
