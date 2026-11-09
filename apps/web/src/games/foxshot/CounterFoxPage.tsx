import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import {
  FS_MAP_NAMES,
  fsMapById,
  fsPreloadMap,
  type FsMapApi,
  type FsMapId,
  FS_MATCH_BOTS,
  FS_MATCH_MINUTES,
  FS_POINTS,
  fsMatchConfig,
  type FsMatchConfig,
} from '@nocap/games';
import { NicknameDialog } from '@/components/NicknameDialog';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { useRoomEntry } from '@/lib/my-room';
import { setReturnTo, useAuth } from '@/lib/auth';
import { FoxShotTestPage } from './FoxShotTestPage';
import { FsMapGate } from './FsMapGate';
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
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<FsMatchConfig>;
    return {
      ...fsMatchConfig(p.minutes ?? 5, p.bots ?? FS_MATCH_BOTS.default),
      mode: p.mode === 'bomb' ? 'bomb' : 'dm',
      side: p.side === 'tr' ? 'tr' : 'ct',
      bomb: p.bomb,
      pvp: p.mode === 'bomb' && p.pvp === true,
      map: p.mode === 'bomb' && p.pvp === true ? 'pvp' : 'duna',
    };
  } catch {
    return fsMatchConfig(5, FS_MATCH_BOTS.default);
  }
}

type Screen = 'main' | 'play' | 'offline' | 'online' | 'options';

/** Miniatura do mapa escolhido, feita do próprio desenho dele (cada altura de chão numa cor). */
function MapCard({ mapId, mode }: { mapId: FsMapId; mode: 'dm' | 'bomb' | 'pvp' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let alive = true;
    void fsPreloadMap(mapId).then(() => alive && draw());
    const draw = () => {
      const map: FsMapApi = fsMapById(mapId);
      const gr = map.grid;
      const S = 6 * gr.cell;
      cv.width = Math.round(gr.cols * S);
      cv.height = Math.round(gr.rows * S);
      const g = cv.getContext('2d')!;
      g.clearRect(0, 0, cv.width, cv.height);
      // a altura vira cor (o mapa chega a uns 6 m)
      const unit = 1;
      for (let r = 0; r < gr.rows && !map.planImage; r++) {
        for (let c = 0; c < gr.cols; c++) {
          if (gr.wall(c, r)) continue;
          const v = Math.min(8, Math.round(gr.height(c, r) / unit));
          g.fillStyle = `rgb(${120 + v * 16},${150 + v * 10},${190 - v * 6})`;
          g.fillRect(c * S, r * S, Math.ceil(S), Math.ceil(S));
        }
      }
      // mapa com planta texturizada: a imagem entra por baixo de tudo o que já foi desenhado (bases, bombas e nomes)
      if (map.planImage) {
        const img = new Image();
        img.onload = () => {
          g.globalCompositeOperation = 'destination-over';
          g.drawImage(img, 0, 0, cv.width, cv.height);
          g.globalCompositeOperation = 'source-over';
        };
        img.src = `${import.meta.env.BASE_URL ?? '/'}models/foxshot/${map.planImage}`.replace(
          '//',
          '/',
        );
      }
      // as bases (áreas tingidas) e as bombas A e B com o nome
      const px = (x: number) => ((x - gr.x0) / gr.cell) * S;
      const pz = (z: number) => ((z - gr.z0) / gr.cell) * S;
      for (const m of map.marks) {
        if (m.kind !== 'base') continue;
        const col = m.id === 'CT' ? '63,130,255' : '255,122,40';
        g.fillStyle = `rgba(${col},0.38)`;
        g.fillRect(px(m.x0), pz(m.z0), px(m.x1) - px(m.x0), pz(m.z1) - pz(m.z0));
        g.strokeStyle = `rgba(${col},1)`;
        g.lineWidth = 2;
        g.setLineDash([8, 5]);
        g.strokeRect(px(m.x0), pz(m.z0), px(m.x1) - px(m.x0), pz(m.z1) - pz(m.z0));
        g.setLineDash([]);
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      // nomes que não se cobrem: cada um tenta a posição e depois sobe/desce até achar um espaço livre
      const taken: [number, number, number, number][] = [];
      const place = (text: string, x: number, y: number, h: number): [number, number] => {
        const w = g.measureText(text).width + 8;
        const half = g.canvas.width / 2;
        for (const d of [0, 20, -20, 40, -40, 60, -60, 80, -80, 100]) {
          for (const dx of [0, -70, 70, -140, 140, -210, 210]) {
            const yy = y + d;
            const xx = Math.max(w / 2 + 4, Math.min(g.canvas.width - w / 2 - 4, x + dx));
            const r: [number, number, number, number] = [
              xx - w / 2,
              yy - h / 2,
              xx + w / 2,
              yy + h / 2,
            ];
            if (!taken.some((t) => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1])) {
              taken.push(r);
              return [xx, yy];
            }
          }
        }
        void half;
        return [x, y];
      };
      // as bolas das bombas entram primeiro (ocupam o espaço delas)
      for (const m of map.marks)
        if (m.kind === 'site') taken.push([px(m.x) - 32, pz(m.z) - 32, px(m.x) + 32, pz(m.z) + 32]);
      for (const m of map.marks) {
        const x = px(m.x);
        const z = pz(m.z);
        if (m.kind === 'site') {
          g.beginPath();
          g.arc(x, z, 30, 0, Math.PI * 2);
          g.fillStyle = 'rgba(10,16,34,0.55)';
          g.fill();
          g.lineWidth = 4;
          g.strokeStyle = '#ffb347';
          g.stroke();
          g.font = '900 38px "Saira Stencil One", Rajdhani, system-ui, sans-serif';
          g.lineWidth = 5;
          g.strokeStyle = 'rgba(5,8,20,.95)';
          g.strokeText(m.short, x, z + 2);
          g.fillStyle = '#ffd27a';
          g.fillText(m.short, x, z + 2);
          g.font = '800 17px Rajdhani, system-ui, sans-serif';
          g.lineWidth = 4;
          const [lx, ly] = place(m.name.toUpperCase(), x, z + 46, 20);
          g.strokeText(m.name.toUpperCase(), lx, ly);
          g.fillText(m.name.toUpperCase(), lx, ly);
        } else {
          g.font = '800 17px Rajdhani, system-ui, sans-serif';
          g.lineWidth = 4;
          g.strokeStyle = 'rgba(5,8,20,.95)';
          const [lx, ly] = place(m.name.toUpperCase(), x, z, 20);
          g.strokeText(m.name.toUpperCase(), lx, ly);
          g.fillStyle = m.id === 'CT' ? '#9cc4ff' : '#ffb98a';
          g.fillText(m.name.toUpperCase(), lx, ly);
        }
      }
    };
    return () => {
      alive = false;
    };
  }, [mapId]);
  return (
    <div className="cfh-map" data-testid="cfh-map">
      <div className="cfh-mapwrap">
        <canvas ref={ref} aria-label={`Mapa ${FS_MAP_NAMES[mapId]} visto de cima`} />
        <div className="cfh-radar" aria-hidden="true">
          <i className="sweep" />
          {[0, 1, 2, 3, 4].map((n) => (
            <i key={n} className={`dot d${n}`} />
          ))}
        </div>
      </div>
      <p>
        {FS_MAP_NAMES[mapId]} · {mode === 'pvp' ? 'PvP' : mode === 'bomb' ? 'Bomba' : 'Mata-mata'}
      </p>
      <span>
        {mapId === 'pvp'
          ? 'Arena de blocos com muros, colunas e caixas: cada time começa numa ponta.'
          : 'Long A, Meio, Túneis e B: duas bombas e as bases nas pontas.'}{' '}
        {mode === 'pvp' ? (
          'Cada round vale um ponto: elimine o outro time.'
        ) : (
          <>
            Abate vale {FS_POINTS.kill} pontos, assistência {FS_POINTS.assist}.
          </>
        )}
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
    <button
      type="button"
      className={cls}
      style={style}
      onClick={onClick}
      disabled={disabled}
      data-sfx="start"
      data-testid={testId}
    >
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
      <button
        type="button"
        className="cfh-back"
        onClick={onBack}
        data-sfx="back"
        data-testid="cfh-back"
      >
        ‹ Voltar
      </button>
      <h2>Opções</h2>
      <div className="cfh-tabs" role="tablist" aria-label="Opções">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`cfh-tab${tab === id ? ' on' : ''}`}
            onClick={() => setTab(id)}
            data-testid={`cfh-tab-${id}`}
          >
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
function CounterFoxInner() {
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

  if (training)
    return (
      <FoxShotTestPage
        key="train"
        onExit={() => {
          setTraining(false);
          setScreen('main');
        }}
      />
    );
  if (playing)
    return (
      <FsMapGate mapId={cfg.pvp ? 'pvp' : cfg.map}>
        <FoxShotTestPage
          key={run}
          match={cfg}
          onExit={() => {
            setPlaying(false);
            setScreen('main');
          }}
          onAgain={() => setRun((r) => r + 1)}
        />
      </FsMapGate>
    );

  return (
    <main className="cfh" data-testid="cfh" data-screen={screen}>
      <Backdrop />
      <div className="cfh-wrap">
        <div className="cfh-left">
          <CounterFoxLogo compact={screen !== 'main'} />
          {screen === 'main' && (
            <nav className="cfh-menu" aria-label="Menu principal" data-testid="cfh-main">
              <Btn
                variant="main"
                delay={120}
                sub="offline ou com amigos"
                onClick={() => setScreen('play')}
                testId="cfh-play"
              >
                Jogar
              </Btn>
              <Btn
                delay={200}
                sub="mira, imagem, comandos"
                onClick={() => setScreen('options')}
                testId="cfh-opt"
              >
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
              <button
                type="button"
                className="cfh-back"
                onClick={back}
                data-sfx="back"
                data-testid="cfh-back"
              >
                ‹ Voltar
              </button>
              <h2>Jogar</h2>
              <p className="lead">Como você quer jogar?</p>
              <div className="cfh-card-grid">
                <button
                  type="button"
                  className="cfh-card"
                  style={{ ['--d' as string]: '40ms' }}
                  onClick={() => setScreen('offline')}
                  data-sfx="start"
                  data-testid="cfh-offline"
                >
                  <b>Offline</b>
                  <span>Contra bots, no seu aparelho. Escolha o tempo e quantos bots.</span>
                </button>
                <button
                  type="button"
                  className="cfh-card"
                  style={{ ['--d' as string]: '140ms' }}
                  onClick={() => setScreen('online')}
                  data-sfx="start"
                  data-testid="cfh-online"
                >
                  <b>Com amigos</b>
                  <span>Crie uma sala ou entre com o código de uma sala de amigos.</span>
                </button>
                <button
                  type="button"
                  className="cfh-card"
                  style={{ ['--d' as string]: '240ms' }}
                  onClick={() => setTraining(true)}
                  data-sfx="start"
                  data-testid="cfh-train"
                >
                  <b>Mapa de Treino</b>
                  <span>
                    Sozinho, sem pressa: alvos, bots, estande de tiro, movimento, granadas e
                    paredes. Todas as armas na loja.
                  </span>
                </button>
              </div>
            </section>
          )}
          {screen === 'offline' && (
            <section className="cfh-panel" data-testid="cfh-setup">
              <button
                type="button"
                className="cfh-back"
                onClick={back}
                data-sfx="back"
                data-testid="cfh-back"
              >
                ‹ Voltar
              </button>
              <h2>Offline · {cfg.mode === 'bomb' ? (cfg.pvp ? 'PvP' : 'Bomba') : 'Mata-mata'}</h2>
              <div className="cfh-grp">Modo</div>
              <div className="cfh-pills" role="radiogroup" aria-label="Modo de jogo">
                <button
                  type="button"
                  role="radio"
                  aria-checked={cfg.mode !== 'bomb'}
                  className={`cfh-pill${cfg.mode !== 'bomb' ? ' on' : ''}`}
                  onClick={() => setCfg({ ...cfg, mode: 'dm', pvp: false, map: 'duna' })}
                  data-testid="cfx-mode-dm"
                >
                  Mata-mata
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={cfg.mode === 'bomb' && !cfg.pvp}
                  className={`cfh-pill${cfg.mode === 'bomb' && !cfg.pvp ? ' on' : ''}`}
                  onClick={() =>
                    setCfg({
                      ...cfg,
                      mode: 'bomb',
                      pvp: false,
                      map: 'duna',
                      bots: 9,
                      bomb: { winRounds: 8, roundSec: 115, allies: 4, foes: 5 },
                    })
                  }
                  data-testid="cfx-mode-bomb"
                >
                  Bomba
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!!cfg.pvp}
                  className={`cfh-pill${cfg.pvp ? ' on' : ''}`}
                  onClick={() =>
                    setCfg({
                      ...cfg,
                      mode: 'bomb',
                      pvp: true,
                      map: 'pvp',
                      bots: 3,
                      bomb: { winRounds: 5, roundSec: 120, allies: 1, foes: 2 },
                    })
                  }
                  data-testid="cfx-mode-pvp"
                >
                  PvP
                </button>
              </div>
              {cfg.mode === 'bomb' ? (
                <>
                  <p className="lead">
                    {cfg.pvp
                      ? 'Dois times, sem bomba, na arena de blocos. Dinheiro infinito: compre qualquer arma na compra. Morreu, você assiste; o round acaba quando um time inteiro cai.'
                      : 'Rounds: terroristas plantam a bomba, contra-terroristas impedem. Compra só na base, dinheiro finito: quem perde ganha menos.'}
                  </p>
                  {cfg.pvp && (
                    <>
                      <div className="cfh-grp">Formato (você + bots contra bots)</div>
                      <div className="cfh-pills" role="radiogroup" aria-label="Formato da partida">
                        {(
                          [
                            [1, 1],
                            [2, 2],
                            [2, 1],
                            [3, 3],
                            [5, 5],
                          ] as const
                        ).map(([a, b]) => (
                          <button
                            key={`${a}x${b}`}
                            type="button"
                            role="radio"
                            aria-checked={
                              (cfg.bomb?.allies ?? 1) + 1 === a && (cfg.bomb?.foes ?? 2) === b
                            }
                            className={`cfh-pill${(cfg.bomb?.allies ?? 1) + 1 === a && (cfg.bomb?.foes ?? 2) === b ? ' on' : ''}`}
                            onClick={() =>
                              setCfg({
                                ...cfg,
                                bots: a - 1 + b,
                                bomb: { ...cfg.bomb, allies: a - 1, foes: b },
                              })
                            }
                            data-testid={`cfx-fmt-${a}x${b}`}
                          >
                            {a}x{b}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="cfh-grp">Seu lado</div>
                  <div className="cfh-pills" role="radiogroup" aria-label="Seu lado">
                    {(['ct', 'tr'] as const).map((sd) => (
                      <button
                        key={sd}
                        type="button"
                        role="radio"
                        aria-checked={cfg.side === sd}
                        className={`cfh-pill${cfg.side === sd ? ' on' : ''}`}
                        onClick={() => setCfg({ ...cfg, side: sd })}
                        data-testid={`cfx-side-${sd}`}
                      >
                        {sd === 'ct' ? 'Contra-terrorista' : 'Terrorista'}
                      </button>
                    ))}
                  </div>
                  <div className="cfh-grp">
                    {cfg.pvp ? 'Pontos para vencer' : 'Rounds para vencer'}
                  </div>
                  <div className="cfh-pills" role="radiogroup" aria-label="Rounds para vencer">
                    {(cfg.pvp ? [1, 3, 5, 10, 15, 20, 30] : [4, 6, 8, 10, 13]).map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={(cfg.bomb?.winRounds ?? 8) === n}
                        className={`cfh-pill${(cfg.bomb?.winRounds ?? 8) === n ? ' on' : ''}`}
                        onClick={() => setCfg({ ...cfg, bomb: { ...cfg.bomb, winRounds: n } })}
                        data-testid={`cfx-rounds-${n}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="cfh-grp">Tempo do round</div>
                  <div className="cfh-pills" role="radiogroup" aria-label="Tempo do round">
                    {(cfg.pvp ? [30, 60, 90, 120, 180, 300] : [60, 90, 115, 150, 180]).map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={(cfg.bomb?.roundSec ?? 115) === n}
                        className={`cfh-pill${(cfg.bomb?.roundSec ?? 115) === n ? ' on' : ''}`}
                        onClick={() => setCfg({ ...cfg, bomb: { ...cfg.bomb, roundSec: n } })}
                        data-testid={`cfx-rsec-${n}`}
                      >
                        {Math.floor(n / 60)}:{String(n % 60).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="lead">
                    Abate = {FS_POINTS.kill} pontos · assistência = {FS_POINTS.assist}. Quem tiver
                    mais pontos no fim vence.
                  </p>
                  <div className="cfh-grp">Duração</div>
                  <div className="cfh-pills" role="radiogroup" aria-label="Duração da partida">
                    {FS_MATCH_MINUTES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={cfg.minutes === m}
                        className={`cfh-pill${cfg.minutes === m ? ' on' : ''}`}
                        onClick={() => setCfg({ ...cfg, ...fsMatchConfig(m, cfg.bots) })}
                        data-testid={`cfx-min-${m}`}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                </>
              )}
              {cfg.mode === 'bomb' ? (
                <>
                  <div className="cfh-grp">Bots aliados (no seu time)</div>
                  <div className="cfh-pills" role="radiogroup" aria-label="Bots aliados">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={(cfg.bomb?.allies ?? 4) === n}
                        className={`cfh-pill${(cfg.bomb?.allies ?? 4) === n ? ' on' : ''}`}
                        onClick={() =>
                          setCfg({
                            ...cfg,
                            bots: n + (cfg.bomb?.foes ?? 5),
                            bomb: { ...cfg.bomb, allies: n },
                          })
                        }
                        data-testid={`cfx-allies-${n}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="cfh-grp">Bots inimigos</div>
                  <div className="cfh-pills" role="radiogroup" aria-label="Bots inimigos">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={(cfg.bomb?.foes ?? 5) === n}
                        className={`cfh-pill${(cfg.bomb?.foes ?? 5) === n ? ' on' : ''}`}
                        onClick={() =>
                          setCfg({
                            ...cfg,
                            bots: (cfg.bomb?.allies ?? 4) + n,
                            bomb: { ...cfg.bomb, foes: n },
                          })
                        }
                        data-testid={`cfx-foes-${n}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="cfh-grp">Bots · {cfg.bots + 1} jogadores com você</div>
                  <div className="cfh-pills" role="radiogroup" aria-label="Quantidade de bots">
                    {Array.from(
                      { length: FS_MATCH_BOTS.max - FS_MATCH_BOTS.min + 1 },
                      (_, i) => i + FS_MATCH_BOTS.min,
                    ).map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={cfg.bots === n}
                        className={`cfh-pill${cfg.bots === n ? ' on' : ''}`}
                        onClick={() => setCfg({ ...cfg, ...fsMatchConfig(cfg.minutes, n) })}
                        data-testid={`cfx-bots-${n}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="cfh-row">
                <Btn variant="main" onClick={start} testId="cfx-start">
                  Entrar
                </Btn>
              </div>
            </section>
          )}
          {screen === 'online' && (
            <section className="cfh-panel" data-testid="cfh-onlinemenu">
              <button
                type="button"
                className="cfh-back"
                onClick={back}
                data-sfx="back"
                data-testid="cfh-back"
              >
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
                <button
                  type="button"
                  className="cfh-card"
                  disabled={entry.busy}
                  onClick={createRoom}
                  data-sfx="start"
                  data-testid="cfh-create"
                >
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
                      setCode(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, '')
                          .slice(0, 4),
                      );
                    }}
                    placeholder="ABCD"
                    inputMode="text"
                    autoCapitalize="characters"
                    aria-label="Código da sala"
                    data-testid="cfh-code"
                  />
                  <button
                    type="submit"
                    className="cfh-btn"
                    disabled={entry.busy || code.length < 4}
                    data-sfx="start"
                    data-testid="cfh-join"
                    style={{ marginTop: 8 }}
                  >
                    <span>{entry.busy ? 'Entrando...' : 'Entrar'}</span>
                  </button>
                </form>
              </div>
            </section>
          )}
          {screen === 'options' && <Options onBack={back} />}
        </div>
        <div className="cfh-right">
          {screen !== 'options' && (
            <MapCard
              mapId={(screen === 'offline' ? cfg.map : 'duna') ?? 'duna'}
              mode={cfg.pvp ? 'pvp' : cfg.mode === 'bomb' ? 'bomb' : 'dm'}
            />
          )}
        </div>
      </div>
      <div className="cfh-foot">COUNTER FOX · FOX CAP!</div>
      <NicknameDialog nick={entry.nick} />
      <RoomConflictDialog
        open={!!entry.conflict}
        code={entry.conflict?.code ?? null}
        onBack={entry.backToCurrent}
        onLeave={() => void entry.leaveAndContinue()}
        onCancel={entry.dismissConflict}
      />
    </main>
  );
}

/** Counter Fox só com conta: sem ela, a tela explica e leva para criar a conta ou entrar (e volta para cá depois). */
export function CounterFoxPage() {
  const user = useAuth((st) => st.user);
  const status = useAuth((st) => st.status);
  if (user) return <CounterFoxInner />;
  if (status === 'loading') return <main className="cfh" data-testid="cfh-auth-loading" />;
  return <CounterFoxGate />;
}

function CounterFoxGate() {
  useEffect(() => {
    const id = 'cfx-fonts';
    if (!document.getElementById(id)) {
      const l = document.createElement('link');
      l.id = id;
      l.rel = 'stylesheet';
      l.href = FONTS;
      document.head.appendChild(l);
    }
  }, []);
  const remember = () => setReturnTo('/fox-cap/counter-fox');
  return (
    <main className="cfh" data-testid="cfh-gate">
      <Backdrop />
      <div className="cfh-wrap">
        <div className="cfh-left">
          <CounterFoxLogo />
          <section className="cfh-panel cfh-gate" role="alert" data-testid="cfh-gate-card">
            <h2>Você precisa de uma conta</h2>
            <p>
              O Counter Fox é jogado com conta no NoCap: assim a partida, os amigos e a sala ficam
              com o seu nome. Criar leva menos de um minuto.
            </p>
            <div className="cfh-gate-btns">
              <Link
                to="/criar-conta"
                className="cfh-btn main"
                onClick={remember}
                data-sfx="start"
                data-testid="cfh-gate-register"
              >
                Criar conta
              </Link>
              <Link
                to="/entrar"
                className="cfh-btn"
                onClick={remember}
                data-sfx="start"
                data-testid="cfh-gate-login"
              >
                Já tenho conta: entrar
              </Link>
              <Link
                to="/fox-cap"
                className="cfh-btn danger"
                data-sfx="back"
                data-testid="cfh-gate-back"
              >
                Voltar ao Fox Cap!
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
