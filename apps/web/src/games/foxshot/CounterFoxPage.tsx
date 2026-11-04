import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import {
  FS_DUST_COLS,
  FS_DUST_GRID,
  FS_DUST_ROWS,
  FS_MATCH_BOTS,
  FS_MATCH_MINUTES,
  FS_POINTS,
  fsMatchConfig,
  type FsMatchConfig,
} from '@nocap/games';
import { NicknameDialog } from '@/components/NicknameDialog';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { useRoomEntry } from '@/lib/my-room';
import { FoxShotTestPage } from './FoxShotTestPage';
import { CounterFoxLogo } from './CounterFoxLogo';
import { CounterFoxBackdrop as Backdrop } from './CounterFoxBackdrop';
import { Commands, Customize } from './FsMenu';
import './foxshot.css';
import './counterfox-hub.css';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Saira+Stencil+One&display=swap';
const KEY = 'nocap-fs-match';
/** Marca na sessão: a sala que acabou de ser criada pelo Counter Fox já nasce com o jogo dele escolhido. */
export const CFX_NEW_ROOM = 'cfx-new-room';

function saved(): FsMatchConfig {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { minutes?: number; bots?: number };
    return fsMatchConfig(p.minutes ?? 5, p.bots ?? FS_MATCH_BOTS.default);
  } catch {
    return fsMatchConfig(5, FS_MATCH_BOTS.default);
  }
}

type Screen = 'main' | 'play' | 'offline' | 'online' | 'options';

/** Miniatura do Duna feita do próprio desenho do mapa (cada nível de chão numa cor). */
function MapCard() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const S = 6;
    cv.width = FS_DUST_COLS * S;
    cv.height = FS_DUST_ROWS * S;
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, cv.width, cv.height);
    for (let r = 0; r < FS_DUST_ROWS; r++) {
      for (let c = 0; c < FS_DUST_COLS; c++) {
        const ch = FS_DUST_GRID[r]![c]!;
        if (ch === '#') continue;
        if (ch === 'c' || ch === 'C') g.fillStyle = '#a0642f';
        else {
          const v = Number(ch);
          g.fillStyle = `rgb(${120 + v * 22},${150 + v * 14},${190 - v * 6})`;
        }
        g.fillRect(c * S, r * S, S, S);
      }
    }
  }, []);
  return (
    <div className="cfh-map" data-testid="cfh-map">
      <canvas ref={ref} aria-label="Mapa Duna visto de cima" />
      <p>Duna · Mata-mata</p>
      <span>
        Três rotas, dois pátios de bomba, túneis e portas. Abate vale {FS_POINTS.kill} pontos, assistência {FS_POINTS.assist}.
      </span>
    </div>
  );
}

function Btn({
  children,
  sub,
  onClick,
  to,
  delay = 0,
  variant,
  testId,
  disabled,
}: {
  children: string;
  sub?: string;
  onClick?: () => void;
  to?: string;
  delay?: number;
  variant?: 'main' | 'danger';
  testId?: string;
  disabled?: boolean;
}) {
  const cls = `cfh-btn${variant ? ` ${variant}` : ''}`;
  const style = { ['--d' as string]: `${delay}ms` };
  const inner = (
    <>
      <span>{children}</span>
      {sub && <small>{sub}</small>}
    </>
  );
  if (to)
    return (
      <Link to={to} className={cls} style={style} data-sfx="back" data-testid={testId}>
        {inner}
      </Link>
    );
  return (
    <button type="button" className={cls} style={style} onClick={onClick} disabled={disabled} data-sfx="start" data-testid={testId}>
      {inner}
    </button>
  );
}

function Options({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'aim' | 'screen' | 'keys'>('aim');
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const TABS: ['aim' | 'screen' | 'keys', string][] = [
    ['aim', 'Mira e câmera'],
    ['screen', 'Imagem e som'],
    ['keys', 'Comandos'],
  ];
  return (
    <section className="cfh-panel cfh-opt" data-testid="cfh-options">
      <button type="button" className="cfh-back" onClick={onBack} data-sfx="back" data-testid="cfh-back">
        ‹ Voltar
      </button>
      <h2>Opções</h2>
      <div className="cfh-tabs" role="tablist" aria-label="Opções">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`cfh-tab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)} data-testid={`cfh-tab-${id}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="cfh-optbody fsm-body">
        {tab === 'aim' && <Customize only="aim" />}
        {tab === 'screen' && <Customize only="screen" />}
        {tab === 'keys' && <Commands touch={touch} />}
      </div>
    </section>
  );
}

/** Counter Fox: menu principal, jogar (offline ou com amigos), opções e a partida contra bots no Duna (spec 057). */
export function CounterFoxPage() {
  const [screen, setScreen] = useState<Screen>('main');
  const [cfg, setCfg] = useState<FsMatchConfig>(saved);
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [training, setTraining] = useState(false);
  const [code, setCode] = useState('');
  const entry = useRoomEntry({ resume: true });

  useEffect(() => {
    if (document.querySelector('link[data-cfh-fonts]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONTS;
    l.setAttribute('data-cfh-fonts', '1');
    document.head.appendChild(l);
  }, []);

  const back = () => setScreen((s) => (s === 'offline' || s === 'online' ? 'play' : 'main'));
  useEffect(() => {
    if (playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && screen !== 'main') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, screen]);

  const start = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
    } catch {
      /* sem armazenamento: só não lembra da escolha */
    }
    setRun((r) => r + 1);
    setPlaying(true);
  };
  const createRoom = () => {
    try {
      sessionStorage.setItem(CFX_NEW_ROOM, '1');
    } catch {
      /* sem armazenamento: o líder escolhe o jogo na sala */
    }
    void entry.create('foxcap');
  };
  const join = (e: FormEvent) => {
    e.preventDefault();
    void entry.join(code);
  };

  if (training) return <FoxShotTestPage key="train" onExit={() => setTraining(false)} />;
  if (playing) return <FoxShotTestPage key={run} match={cfg} onExit={() => setPlaying(false)} onAgain={() => setRun((r) => r + 1)} />;

  return (
    <main className="cfh" data-testid="cfh" data-screen={screen}>
      <Backdrop />
      <div className="cfh-wrap">
        <div className="cfh-left">
          <CounterFoxLogo compact={screen !== 'main'} />
          {screen === 'main' && (
            <nav className="cfh-menu" aria-label="Menu principal" data-testid="cfh-main">
              <Btn variant="main" delay={120} sub="offline ou com amigos" onClick={() => setScreen('play')} testId="cfh-play">
                Jogar
              </Btn>
              <Btn delay={200} sub="mira, imagem, comandos" onClick={() => setScreen('options')} testId="cfh-opt">
                Opções
              </Btn>
              <div className="cfh-spacer" />
              <Btn delay={300} variant="danger" to="/fox-cap" testId="cfh-exit">
                Sair do Counter Fox
              </Btn>
            </nav>
          )}
          {screen === 'play' && (
            <section className="cfh-panel" data-testid="cfh-playmenu">
              <button type="button" className="cfh-back" onClick={back} data-sfx="back" data-testid="cfh-back">
                ‹ Voltar
              </button>
              <h2>Jogar</h2>
              <p className="lead">Como você quer jogar?</p>
              <div className="cfh-card-grid">
                <button type="button" className="cfh-card" style={{ ['--d' as string]: '40ms' }} onClick={() => setScreen('offline')} data-sfx="start" data-testid="cfh-offline">
                  <b>Offline</b>
                  <span>Contra bots, no seu aparelho. Escolha o tempo e quantos bots.</span>
                </button>
                <button type="button" className="cfh-card" style={{ ['--d' as string]: '140ms' }} onClick={() => setScreen('online')} data-sfx="start" data-testid="cfh-online">
                  <b>Com amigos</b>
                  <span>Crie uma sala ou entre com o código de uma sala de amigos.</span>
                </button>
                <button type="button" className="cfh-card" style={{ ['--d' as string]: '240ms' }} onClick={() => setTraining(true)} data-sfx="start" data-testid="cfh-train">
                  <b>Mapa de Treino</b>
                  <span>Sozinho, sem pressa: alvos, bots, estande de tiro, movimento, granadas e paredes. Todas as armas na loja.</span>
                </button>
              </div>
            </section>
          )}
          {screen === 'offline' && (
            <section className="cfh-panel" data-testid="cfh-setup">
              <button type="button" className="cfh-back" onClick={back} data-sfx="back" data-testid="cfh-back">
                ‹ Voltar
              </button>
              <h2>Offline · Mata-mata</h2>
              <p className="lead">
                Abate = {FS_POINTS.kill} pontos · assistência = {FS_POINTS.assist}. Quem tiver mais pontos no fim vence.
              </p>
              <div className="cfh-grp">Duração</div>
              <div className="cfh-pills" role="radiogroup" aria-label="Duração da partida">
                {FS_MATCH_MINUTES.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={cfg.minutes === m} className={`cfh-pill${cfg.minutes === m ? ' on' : ''}`} onClick={() => setCfg(fsMatchConfig(m, cfg.bots))} data-testid={`cfx-min-${m}`}>
                    {m} min
                  </button>
                ))}
              </div>
              <div className="cfh-grp">Bots · {cfg.bots + 1} jogadores com você</div>
              <div className="cfh-pills" role="radiogroup" aria-label="Quantidade de bots">
                {Array.from({ length: FS_MATCH_BOTS.max - FS_MATCH_BOTS.min + 1 }, (_, i) => i + FS_MATCH_BOTS.min).map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={cfg.bots === n} className={`cfh-pill${cfg.bots === n ? ' on' : ''}`} onClick={() => setCfg(fsMatchConfig(cfg.minutes, n))} data-testid={`cfx-bots-${n}`}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="cfh-row">
                <Btn variant="main" onClick={start} testId="cfx-start">
                  Entrar
                </Btn>
              </div>
            </section>
          )}
          {screen === 'online' && (
            <section className="cfh-panel" data-testid="cfh-onlinemenu">
              <button type="button" className="cfh-back" onClick={back} data-sfx="back" data-testid="cfh-back">
                ‹ Voltar
              </button>
              <h2>Com amigos</h2>
              <p className="lead">Todo mundo na mesma sala, no mesmo mata-mata.</p>
              {entry.error && (
                <p className="cfh-err" role="alert" data-testid="cfh-error">
                  {entry.error}
                </p>
              )}
              <div className="cfh-card-grid">
                <button type="button" className="cfh-card" disabled={entry.busy} onClick={createRoom} data-sfx="start" data-testid="cfh-create">
                  <b>{entry.busy ? 'Criando...' : 'Criar sala'}</b>
                  <span>Você é o líder: escolhe o modo, convida e começa.</span>
                </button>
                <form className="cfh-card" onSubmit={join} style={{ cursor: 'default' }}>
                  <b>Entrar com código</b>
                  <input
                    className="cfh-input"
                    value={code}
                    onChange={(e) => {
                      entry.clearError();
                      setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
                    }}
                    placeholder="ABCD"
                    inputMode="text"
                    autoCapitalize="characters"
                    aria-label="Código da sala"
                    data-testid="cfh-code"
                  />
                  <button type="submit" className="cfh-btn" disabled={entry.busy || code.length < 4} data-sfx="start" data-testid="cfh-join" style={{ marginTop: 8 }}>
                    <span>{entry.busy ? 'Entrando...' : 'Entrar'}</span>
                  </button>
                </form>
              </div>
            </section>
          )}
          {screen === 'options' && <Options onBack={back} />}
        </div>
        <div className="cfh-right">{screen !== 'options' && <MapCard />}</div>
      </div>
      <div className="cfh-foot">COUNTER FOX · FOX CAP!</div>
      <NicknameDialog nick={entry.nick} />
      <RoomConflictDialog open={!!entry.conflict} code={entry.conflict?.code ?? null} onBack={entry.backToCurrent} onLeave={() => void entry.leaveAndContinue()} onCancel={entry.dismissConflict} />
    </main>
  );
}
