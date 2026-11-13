import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  GP_DNF_SEC,
  GP_DT,
  GP_GO_SEC,
  GP_LAPS,
  GP_LIGHTS,
  GP_LIGHT_SEC,
  GP_PIT_STOP_SEC,
  GP_QUALI_MAX_SEC,
  GP_ROOM_LIGHTS_MS,
  GpClient,
  GpHost,
  GpWorld,
  createRng,
  gpBotInput,
  gpBotProfile,
  gpKmh,
  gpVmaxOf,
  GP_BOT_LEVEL_SKILL,
  type GpBotLevel,
  GP_BOX_SIGN_FAR,
  GP_BOX_SIGN_NEAR,
  GP_PIT_LIMIT,
  GP_TYRE_ALERT,
  GP_TYRE_CRIT,
  GP_TYRE_WARN,
  gpLightsHold,
  gpSnapshotFor,
  newGpBotMemory,
  type GpBotMemory,
  type GpCar,
  type GpEvent,
  type GpInput,
  type GpPaint,
  type GpPhysicsMode,
  type GpPlayerInfo,
} from '@nocap/games';
import { GameChat } from '@/components/GameChat';
import { GameMenu, Keycap, NetBadge } from '@/components/GameMenu';
import { GameTips, type TipRow } from '@/components/GameTips';
import { PauseOverlay } from '@/components/PauseOverlay';
import { RotateHint } from '@/components/RotateHint';
import { gameChatOpen } from '@/lib/game-chat-state';
import { gpSfx } from '@/lib/foxgp-audio';
import { GpHostLink, GpPeerLink } from '@/lib/foxgp-net';
import {
  currentRtt,
  gameNow,
  sendRoom,
  sendRoomQuiet,
  serverNow,
  subscribeRoom,
} from '@/lib/rooms';
import { GpFinal, type GpFinalRow } from './GpFinal';
import { GpControls } from './gp-controls';
import { GpScene, type GpCamMode, type GpPose, type GpQuality } from './GpScene';
import { GpWipe } from './GpWipe';
import { GpCommands } from './GpCommands';
import { css, gapText, lapClock } from './format';
import { drawMinimap } from './minimap';
import { GpNoticeQueue, NOTICE_FADE_MS, type GpNotice, type GpNoticeKind } from './notices';
import { PHYSICS_NAME, saveBest } from './gp-best';
import { gpActionOf, gpKeyName, useGpControls, useGpShake, type GpBinds } from './gp-settings';
import './theme.css';
import './foxgp.css';
import './gp-hud.css';
import { gpPerfOn, gpPerfText, newGpPerf } from './perf';
import { kartReady, preloadKart } from './kart-model';

/** Cores das raposas no treino (a primeira é a sua, se você não escolher outra). */
export const GP_FURS = [
  0xff7d26, 0xb98cff, 0x4fc3f7, 0x7be07b, 0xffd23f, 0xff6f91, 0xf5f5f5, 0x8d6e63, 0x8b93a3,
  0xe5303a,
];
/** Os 11 adversários do treino (spec 081: você mais 11 bots, 12 carros). */
const BOT_NAMES = [
  'Faísca',
  'Pipoca',
  'Trufa',
  'Ruivo',
  'Brisa',
  'Nuvem',
  'Cacau',
  'Pimenta',
  'Gengibre',
  'Raposão',
  'Ventania',
  'Canela',
  'Bolota',
  'Tufo',
  'Cometa',
  'Chama',
  'Amora',
  'Paçoca',
  'Granizo',
];
/** Pinturas dos bots (cada um com a sua: no grid de 20 os carros não ficam iguais). */
const BOT_BODIES = [
  0x2f5bff, 0xe5303a, 0x33c27f, 0xffd23f, 0x7a3cff, 0x25c7e8, 0xf1ede4, 0x1a1a1a, 0xff9ecf,
  0x0c7a5a,
];
const BOT_PATTERNS: GpPaint['pattern'][] = ['faixa', 'listras', 'chevron', 'solida'];
const botPaint = (i: number): GpPaint => ({
  body: BOT_BODIES[i % BOT_BODIES.length]!,
  accent: BOT_BODIES[(i * 3 + 4) % BOT_BODIES.length]!,
  pattern: BOT_PATTERNS[i % BOT_PATTERNS.length]!,
  number: i + 2,
});
const COUNT_SEC = 3.2;
const GRID_SEC = 3.6;
const TIPS_KEY = 'nocap-gp-tips';
const CAM_KEY = 'nocap-gp-cam';
const QUALITY_KEY = 'nocap-gp-quality';
const SMOOTH = 12;
const CAMS: GpCamMode[] = ['far', 'chase', 'cockpit'];
const CAM_NAME: Record<GpCamMode, string> = {
  far: 'Distante',
  chase: 'Atrás do carro',
  cockpit: 'Cockpit',
};
const QUALITY_NAME: Record<GpQuality, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };

const read = <T extends string>(key: string, ok: readonly T[], fallback: T): T => {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && ok.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, v: string) => {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* sem armazenamento: vale só agora */
  }
};

/** Dicas do kart (Arcade, spec 081): drift e turbo no lugar de DRS e box. */
const kartTips = (touch: boolean, b: GpBinds): TipRow[] => [
  touch
    ? { keys: <b className="gm-tag">‹ ›</b>, text: 'Botões da esquerda: virar; Acelera e Freio à direita' }
    : {
        keys: (
          <>
            <Keycap k={gpKeyName('gas', b)} touchHide={false} />
            <Keycap k={gpKeyName('left', b)} touchHide={false} />
            <Keycap k={gpKeyName('right', b)} touchHide={false} />
          </>
        ),
        text: 'Acelerar e virar',
      },
  {
    keys: touch ? <b className="gm-tag">Drift</b> : <Keycap k={gpKeyName('drift', b)} touchHide={false} />,
    text: 'Segure virando, rápido: o kart pula e derrapa. Volante para dentro fecha a curva; enche a barra de turbo',
  },
  {
    keys: touch ? <b className="gm-tag">Turbo</b> : <Keycap k={gpKeyName('drs', b)} touchHide={false} />,
    text: 'Gasta a barra toda: no 1º terço (azul) curto, no 2º (laranja) médio, no 3º (rosa) longo',
  },
  {
    keys: touch ? <b className="gm-tag">Volta</b> : <Keycap k={gpKeyName('lap', b)} touchHide={false} />,
    text: 'Classificação: ir para a largada da volta lançada',
  },
  {
    keys: touch ? <b className="gm-tag">Câmera</b> : <Keycap k={gpKeyName('cam', b)} touchHide={false} />,
    text: 'Câmera: distante, atrás do carro ou cockpit',
  },
];

const tipRows = (touch: boolean, b: GpBinds, kart = false): TipRow[] =>
  kart
    ? kartTips(touch, b)
    : touch
    ? [
        { keys: <b className="gm-tag">‹ ›</b>, text: 'Botões da esquerda: virar' },
        {
          keys: <b className="gm-tag">Acelera</b>,
          text: 'Botão grande da direita; o Freio fica ao lado (parado, dá ré)',
        },
        {
          keys: <b className="gm-tag">DRS</b>,
          text: 'Na zona verde da reta, abre a asa (fecha ao frear). Atrás de outro carro, o vácuo ajuda',
        },
        {
          keys: <b className="gm-tag">Volta</b>,
          text: 'Classificação: o botão grande leva você para a largada da volta lançada',
        },
        {
          keys: <b className="gm-tag">Câmera</b>,
          text: 'Troca entre distante, atrás do carro e cockpit',
        },
        {
          keys: <b className="gm-tag">Box</b>,
          text: 'Entre na faixa do box e pare na vaga amarela: pneus novos em 3 s',
        },
      ]
    : [
        {
          keys: (
            <>
              <Keycap k={gpKeyName('gas', b)} touchHide={false} />
              <Keycap k={gpKeyName('brake', b)} touchHide={false} />
            </>
          ),
          text: 'Acelerar e frear (parado, dá ré)',
        },
        {
          keys: (
            <>
              <Keycap k={gpKeyName('left', b)} touchHide={false} />
              <Keycap k={gpKeyName('right', b)} touchHide={false} />
            </>
          ),
          text: 'Virar',
        },
        {
          keys: <Keycap k={gpKeyName('drs', b)} touchHide={false} />,
          text: 'DRS: abre a asa na zona verde da reta (fecha ao frear)',
        },
        {
          keys: <Keycap k={gpKeyName('lap', b)} touchHide={false} />,
          text: 'Classificação: ir para a largada da volta lançada',
        },
        {
          keys: <Keycap k={gpKeyName('cam', b)} touchHide={false} />,
          text: 'Câmera: distante, atrás do carro ou cockpit',
        },
        {
          keys: <b className="gm-tag">Box</b>,
          text: 'Pare na vaga amarela do box: pneus novos em 3 s',
        },
        {
          keys: <Keycap k="Esc" touchHide={false} />,
          text: 'Menu: câmera, qualidade, comandos, som e sair',
        },
        { keys: <Keycap k="T" touchHide={false} />, text: 'Chat da sala (em sala)' },
      ];

type Stage = 'count' | 'quali' | 'grid' | 'lights' | 'race' | 'over';

/** Partida em sala: a seed, quem corre (na ordem das vagas), quem sou eu (vazio = só assistindo) e quem simula. */
export interface GpOnline {
  seed: string;
  meId: string;
  hostId: string;
  infos: GpPlayerInfo[];
  /** Modo de física da sala (todos correm no mesmo: quem simula é o líder). */
  physics: GpPhysicsMode;
  /** Dificuldade dos bots da sala (o líder simula os bots). */
  botLevel?: GpBotLevel;
}

/** O que a sala diz agora (muda a cada estado novo). */
export interface GpRoomLive {
  stage: 'quali' | 'grid' | 'race' | null;
  qualiAt: number | null;
  raceAt: number | null;
  /** Espera sorteada pela sala com as luzes acesas (ms). */
  holdMs: number | null;
  grid: string[];
  quali: Record<string, number | null>;
  finish: Record<string, number>;
  gone: string[];
  firstFinishAt: number | null;
}

interface Row {
  id: string;
  pos: number;
  name: string;
  color: string;
  gap: string;
  you: boolean;
  done: boolean;
  out: boolean;
}

interface Hud {
  stage: Stage;
  count: number;
  lit: number;
  pos: number;
  total: number;
  lap: number;
  raceMs: number;
  best: number | null;
  last: number | null;
  kmh: number;
  /** Linhas de velocidade nas bordas (0 a 1): só no Realista, acima de ~60 % da máxima. */
  rush: number;
  gear: number;
  rpm: number;
  /** DRS: 'off' indisponível, 'avail' liberado, 'open' aberto. */
  drs: 'off' | 'avail' | 'open';
  /** Kart: barra de turbo (0 a 3), nível do turbo em uso (0 = nenhum) e o drift ('off', 'avail' liberado, 'on'). */
  bar: number;
  boost: number;
  drift: 'off' | 'avail' | 'on';
  slip: number;
  wear: number;
  pit: number;
  inPitLane: boolean;
  rows: Row[];
  /** Tempo da volta de agora (ms) na corrida. */
  lapMs: number;
  qualiLeft: number;
  /** Contagem parado na largada antes da volta lançada (s; 0 = nenhuma). */
  qualiHold: number;
  qualiMs: number | null;
  qualiRun: number | null;
  qualiStarted: boolean;
  /** Realista (spec 081, Fase 10): faixa do pneu (0 a 3) e a distância até a entrada do box quando é hora de parar. */
  tyreLevel: number;
  boxDist: number | null;
  /** Lembrete da volta lançada (spec 081, 9.1): 0 nenhum, 1 depois de 30 s sem começar, 2 no último minuto. */
  lapUrgent: number;
  pole: number | null;
  sectors: { ms: number; kind: 'best' | 'pb' | 'slow' }[];
  /** As luzes acabaram de apagar: "Vai!" na tela. */
  go: boolean;
  done: number | null;
  dnfLeft: number | null;
  watching: string;
  grid: { id: string; name: string; color: string; ms: number | null; you: boolean }[];
  net: string;
}

const seedOf = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/** Uma partida do Fox GP: treino contra bots, ou corrida em sala (como líder que simula, como piloto ou assistindo). */
export function GpPlay({
  bots = 0,
  color = GP_FURS[0]!,
  paint,
  kart,
  physics = 'arcade',
  online,
  live,
  onExit,
  onAgain,
  onOfflineInvite,
}: {
  bots?: number;
  /** Cor do seu pelo no treino. */
  color?: number;
  paint?: GpPlayerInfo['paint'];
  /** A pintura do kart (Arcade). */
  kart?: GpPlayerInfo['kart'] | null;
  /** Modo de física no treino (online vem da sala). */
  physics?: GpPhysicsMode;
  online?: GpOnline;
  live?: GpRoomLive;
  onExit: () => void;
  onAgain?: () => void;
  onOfflineInvite?: () => void;
}) {
  const liveRef = useRef<GpRoomLive | undefined>(live);
  liveRef.current = live;
  const canvas = useRef<HTMLCanvasElement>(null);
  const mini = useRef<HTMLCanvasElement>(null);
  const controls = useMemo(() => new GpControls(), []);
  const [hud, setHud] = useState<Hud | null>(null);
  /** Assistindo alguém agora (as teclas trocam o piloto assistido). */
  const watchingRef = useRef(false);
  watchingRef.current = !!hud && (hud.done !== null || !!hud.watching);
  const [perfText, setPerfText] = useState('');
  /** Kart: a barra pisca ao completar um terço; balança no "sem turbo". */
  const [barPulse, setBarPulse] = useState(0);
  const [noTurbo, setNoTurbo] = useState(0);
  const shakeOn = useGpShake((st) => st.on);
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.shakeOn = shakeOn;
  }, [shakeOn]);
  const [result, setResult] = useState<GpFinalRow[] | null>(null);
  const [extra, setExtra] = useState<{ fastest: string } | null>(null);
  const [menu, setMenu] = useState(false);
  // offline (treino): abrir o menu, esconder a aba ou tirar o foco calam todos os sons do carro na hora; online a
  // corrida continua e o som também (spec 081, 12.3)
  useEffect(() => {
    if (online) return undefined;
    const apply = () => (menu || document.hidden ? gpSfx.pause() : gpSfx.resume());
    apply();
    const blur = () => gpSfx.pause();
    const focus = () => !menu && gpSfx.resume();
    document.addEventListener('visibilitychange', apply);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    if (import.meta.env.DEV)
      (window as unknown as { __gpEngineGain?: () => number }).__gpEngineGain = () => gpSfx.engine.gainNow();
    return () => {
      document.removeEventListener('visibilitychange', apply);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
    };
  }, [menu, online]);
  const [commands, setCommands] = useState(false);
  const binds = useGpControls((st) => st.binds);
  const [notice, setNotice] = useState<GpNotice | null>(null);
  const mode: GpPhysicsMode = online?.physics ?? physics;
  /** O kart só baixa quando o Arcade é jogado (spec 081, Fase 6): a cena espera ele. */
  const [kartOk, setKartOk] = useState(() => mode !== 'arcade' || kartReady());
  useEffect(() => {
    if (kartOk) return;
    let alive = true;
    preloadKart()
      .catch(() => undefined)
      .finally(() => alive && setKartOk(true));
    return () => {
      alive = false;
    };
  }, [kartOk]);
  const menuRef = useRef(false);
  menuRef.current = menu;
  const [cam, setCam] = useState<GpCamMode>(() => read(CAM_KEY, CAMS, 'chase'));
  const [quality, setQuality] = useState<GpQuality>(() =>
    read(QUALITY_KEY, ['low', 'medium', 'high'], 'medium'),
  );
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const [wipe, setWipe] = useState<{ key: number; text: string }>({ key: 1, text: 'Fox GP' });
  const [lapFlash, setLapFlash] = useState(0);
  const sceneRef = useRef<GpScene | null>(null);
  const remakeScene = useRef<(() => void) | null>(null);
  const api = useRef<{ next: (d: number) => void; startLap: () => void } | null>(null);
  const touchDevice = useMemo(
    () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    [],
  );
  const [showNet, setShowNet] = useState(() => {
    try {
      return localStorage.getItem('nocap-gp-net') !== '0';
    } catch {
      return true;
    }
  });
  const [ping, setPing] = useState(0);
  const linkRef = useRef<{ rtt: () => number } | null>(null);
  useEffect(() => {
    if (!online || !showNet) return undefined;
    const t = window.setInterval(
      () => setPing(Math.round(linkRef.current?.rtt() ?? currentRtt())),
      1000,
    );
    return () => window.clearInterval(t);
  }, [online, showNet]);
  const cycleCam = () =>
    setCam((c) => {
      const n = CAMS[(CAMS.indexOf(c) + 1) % CAMS.length]!;
      save(CAM_KEY, n);
      return n;
    });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (gameChatOpen()) return;
      if (e.code === 'Escape' && !menuRef.current) {
        setMenu(true);
        return;
      }
      if (e.repeat || menuRef.current) return;
      const a = gpActionOf(e.code);
      if (a === 'cam') cycleCam();
      else if (a === 'lap') api.current?.startLap();
      // assistindo (terminou ou entrou com a corrida andando): ← → trocam o piloto
      else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && watchingRef.current)
        api.current?.next(e.code === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    sceneRef.current?.setCamMode(cam);
  }, [cam]);
  // qualidade nova: refaz só a cena (a corrida continua)
  const firstQuality = useRef(true);
  useEffect(() => {
    if (firstQuality.current) {
      firstQuality.current = false;
      return;
    }
    remakeScene.current?.();
  }, [quality]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !kartOk) return undefined;
    const meId = online ? online.meId : 'me';
    const infos: GpPlayerInfo[] = online?.infos ?? [
      { id: 'me', name: 'Você', color, paint, kart: kart ?? undefined },
      ...Array.from({ length: bots }, (_, i) => ({
        id: `bot${i}`,
        name: BOT_NAMES[i] ?? `Raposa ${i + 1}`,
        color: GP_FURS.filter((c) => c !== color)[i % (GP_FURS.length - 1)]!,
        paint: botPaint(i),
        bot: true,
      })),
    ];
    const seed = online?.seed ?? seedOf();
    const world = new GpWorld(seed, infos, undefined, mode);
    // a espera com as luzes acesas: sorteada pela seed no treino (na sala, quem sorteia é o servidor)
    const holdSec = gpLightsHold(createRng(`${seed}:lights`)());
    const isHost = !!online && !!online.meId && online.hostId === meId;
    const isClient = !!online && !isHost && !!world.car(meId);
    const spectator = !!online && !world.car(meId);
    if (online && !isHost) world.goOnline(meId);
    if (isHost) world.autoEnd = false;
    if (import.meta.env.DEV) (window as unknown as { __gp?: GpWorld }).__gp = world;
    const rng = createRng(`${seed}:bots`);
    // cada bot com o seu perfil (Agressivo, Consistente, Defensivo, Rápido e errático, Novato), pela seed
    const mem = new Map<string, GpBotMemory>(
      world.cars
        .filter((c) => c.bot)
        .map((c, i) => {
          // na sala, a dificuldade escolhida pelo líder mexe no talento (12.4)
          const prof = gpBotProfile(seed, i);
          const add = GP_BOT_LEVEL_SKILL[online?.botLevel ?? 'medio'];
          return [c.id, newGpBotMemory({ ...prof, skill: Math.max(0.7, Math.min(0.99, prof.skill + add)) })];
        }),
    );

    // ---- a cena (refeita quando a qualidade muda) ----
    let ro: ResizeObserver | null = null;
    const makeScene = () => {
      ro?.disconnect();
      sceneRef.current?.dispose();
      const reduced =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const scene = new GpScene(el, world, meId, { reduced, quality: qualityRef.current });
      scene.setCamMode(read(CAM_KEY, CAMS, 'chase'));
      scene.shakeOn = useGpShake.getState().on;
      sceneRef.current = scene;
      if (import.meta.env.DEV) (window as unknown as { __gpScene?: GpScene }).__gpScene = scene;
      const resize = () => {
        const r = el.getBoundingClientRect();
        scene.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
      };
      resize();
      ro = new ResizeObserver(resize);
      ro.observe(el);
    };
    makeScene();
    remakeScene.current = makeScene;

    // ---- rede ----
    const host = isHost ? new GpHost(world, meId) : null;
    const client = isClient ? new GpClient(world, meId) : null;
    const hostLink = isHost ? new GpHostLink(meId) : null;
    const peerLink = isClient ? new GpPeerLink(online!.hostId) : null;
    if (hostLink && host) {
      hostLink.setRacers(infos.map((p) => p.id));
      hostLink.onInput((id, p) => host.receive(id, p));
      linkRef.current = { rtt: () => currentRtt() };
    }
    controls.attach();
    gpSfx.engine.setVehicle(mode === 'arcade' ? 'kart' : 'f1');
    gpSfx.resume();
    gpSfx.engine.start(mode === 'arcade' ? 'kart' : 'f1');

    const me = () => world.car(meId);
    let focus = spectator ? (world.cars[0]?.id ?? '') : meId;
    let stage: Stage = 'count';
    const mountAt = performance.now();
    let gridUntil = 0;
    let lightsAt = 0;
    let litShown = -1;
    let acc = 0;
    let last = performance.now();
    let hudAt = 0;
    let miniAt = 0;
    let posAt = 0;
    let raf = 0;
    const notices = new GpNoticeQueue();
    let lastCount = 9;
    let goAt = 0;
    let started = false;
    let qstartShown = false;
    /** Distância até a entrada do box (m), quando o pneu passou de 55 % e a entrada está a até 350 m. */
    const boxDistOf = (c: GpCar | undefined): number | null => {
      const pit = world.track.pit;
      if (mode !== 'real' || !c || !pit || world.phase !== 'race' || c.finished || c.wear < GP_TYRE_WARN) return null;
      if (c.surface === 'pit') return null;
      const d = world.track.delta(c.s, world.track.wrap(pit.inStart));
      const ahead = d < 0 ? d + world.track.length : d;
      return ahead <= GP_BOX_SIGN_FAR ? ahead : null;
    };
    /** O box passou sem entrar (pneu gasto): avisa uma vez por volta. */
    let boxWas: number | null = null;
    /** Lembretes da volta lançada já dados (1 = aos 30 s, 2 = último minuto). */
    let remind = 0;
    let wantLap = false;
    let autoMem: GpBotMemory | null = null;
    // medidas de fluidez (só no desenvolvimento): quadros, o maior intervalo, saltos e vai-e-volta do carro em foco
    const stats = { frames: 0, slow: 0, maxDt: 0, backs: 0, maxJump: 0, laps: 0 };
    let lastPose: GpPose | null = null;
    if (import.meta.env.DEV) (window as unknown as { __gpStats?: typeof stats }).__gpStats = stats;
    // painel de desempenho (spec 081, Fase 2.2): só no desenvolvimento, com ?perf=1 (ou ligado pelo teste)
    const perf = import.meta.env.DEV ? newGpPerf() : null;
    if (perf) (window as unknown as { __gpPerf?: typeof perf }).__gpPerf = perf;
    let perfAt = 0;
    const clock = () => (perf ? performance.now() : 0);
    const sectorRow: Hud['sectors'] = [];
    /** Todo aviso passa pela fila (um não atropela o outro). */
    const say = (text: string, ms = 2600, kind: GpNoticeKind = 'info', sub?: string) =>
      notices.push(kind, text, ms, sub);
    const others = () => world.cars.filter((c) => !c.gone && c.id !== meId);
    api.current = {
      next: (d) => {
        const list = others();
        if (list.length === 0) return;
        const i = list.findIndex((c) => c.id === focus);
        focus = list[(i + d + list.length) % list.length]!.id;
      },
      startLap: () => {
        const c = me();
        if (
          stage === 'quali' &&
          c &&
          c.qualiStartT === null &&
          c.qualiMs === null &&
          c.qualiHold <= 0
        )
          wantLap = true;
      },
    };

    // pose de desenho: entre o estado anterior e o atual (o passo da simulação é fixo; a tela não): sem vai e volta
    const prev = new Map<string, GpPose>();
    const curr = new Map<string, GpPose>();
    const remember = () => {
      for (const c of world.cars) {
        const p = curr.get(c.id);
        if (p) prev.set(c.id, p);
        curr.set(c.id, { x: c.x, z: c.z, h: c.h });
      }
    };
    remember();
    let alpha = 0;
    const pose = (c: GpCar): GpPose => {
      const simulated = !online || isHost || c.id === meId;
      if (!simulated) return { x: c.x, z: c.z, h: c.h };
      const a = prev.get(c.id);
      const b = curr.get(c.id) ?? { x: c.x, z: c.z, h: c.h };
      let x = b.x;
      let z = b.z;
      let h = b.h;
      if (a && Math.hypot(b.x - a.x, b.z - a.z) < 4) {
        x = a.x + (b.x - a.x) * alpha;
        z = a.z + (b.z - a.z) * alpha;
        h = a.h + Math.atan2(Math.sin(b.h - a.h), Math.cos(b.h - a.h)) * alpha;
      }
      if (client && c.id === meId) {
        x += client.error.x;
        z += client.error.z;
        h += client.error.h;
      }
      return { x, z, h };
    };

    // ---- assistindo (quem entrou com a corrida andando): posições pelo fluxo da sala ----
    const targets = new Map<
      string,
      { x: number; z: number; h: number; speed: number; prog: number; at: number }
    >();
    const unsubs: (() => void)[] = [];
    if (spectator && online) {
      const idOfSlot = new Map(infos.map((p, i) => [i, p.id]));
      unsubs.push(
        subscribeRoom('pos', (m) => {
          if (!Array.isArray(m)) return;
          for (const row of m as number[][]) {
            const id = idOfSlot.get(row[0] as number);
            if (!id) continue;
            targets.set(id, {
              x: row[1]!,
              z: row[2]!,
              h: row[3]!,
              speed: row[4]!,
              prog: row[5]!,
              at: performance.now(),
            });
          }
        }),
      );
    }
    const driveSpectator = (dt: number, now: number) => {
      const k = 1 - Math.exp(-dt * SMOOTH);
      for (const c of world.cars) {
        const t = targets.get(c.id);
        if (!t || c.gone) continue;
        const age = Math.min(0.15, (now - t.at) / 1000);
        const tx = t.x + Math.sin(t.h) * t.speed * age;
        const tz = t.z - Math.cos(t.h) * t.speed * age;
        const far = Math.hypot(c.x - tx, c.z - tz) > 8;
        const f = far ? 1 : k;
        const dh = Math.atan2(Math.sin(t.h - c.h), Math.cos(t.h - c.h));
        world.setRemote(c.id, {
          x: c.x + (tx - c.x) * f,
          z: c.z + (tz - c.z) * f,
          h: c.h + dh * f,
          speed: t.speed,
          prog: t.prog,
          drs: false,
          pit: false,
          slip: 0,
          wear: 0,
          steer: 0,
        });
      }
    };

    /** A fase em que a partida está e quanto tempo de jogo já passou nela (s). */
    const where = (now: number): { st: Stage; target: number; count: number; lit: number } => {
      if (!online) {
        if (stage === 'count') {
          const left = COUNT_SEC - (now - mountAt) / 1000;
          if (left > 0) return { st: 'count', target: 0, count: Math.ceil(left - 0.2), lit: 0 };
          return { st: 'quali', target: 0, count: 0, lit: 0 };
        }
        if (stage === 'lights') {
          const e = (now - lightsAt) / 1000;
          if (e >= GP_LIGHTS * GP_LIGHT_SEC + holdSec)
            return { st: 'race', target: 0, count: 0, lit: 0 };
          return {
            st: 'lights',
            target: 0,
            count: 0,
            lit: Math.min(GP_LIGHTS, Math.floor(e / GP_LIGHT_SEC) + 1),
          };
        }
        return { st: stage, target: 0, count: 0, lit: 0 };
      }
      const l = liveRef.current;
      const gn = gameNow();
      if (!l || l.stage === null || l.qualiAt === null)
        return { st: 'count', target: 0, count: 3, lit: 0 };
      if (l.stage === 'quali') {
        const left = (l.qualiAt - serverNow()) / 1000;
        if (left > 0) return { st: 'count', target: 0, count: Math.ceil(left - 0.2), lit: 0 };
        return { st: 'quali', target: (gn - l.qualiAt) / 1000, count: 0, lit: 0 };
      }
      const raceAt = l.raceAt ?? gn;
      // as luzes começam a acender antes da espera sorteada pela sala
      const lightsFrom = raceAt - (l.holdMs ?? 0) - GP_ROOM_LIGHTS_MS;
      if (gn < lightsFrom) return { st: 'grid', target: 0, count: 0, lit: 0 };
      if (gn < raceAt) {
        const e = (gn - lightsFrom) / 1000;
        return {
          st: 'lights',
          target: 0,
          count: 0,
          lit: Math.min(GP_LIGHTS, Math.floor(e / GP_LIGHT_SEC) + 1),
        };
      }
      return { st: 'race', target: (gn - raceAt) / 1000, count: 0, lit: 0 };
    };

    const gridRows = () => {
      const l = liveRef.current;
      const order = online && l ? l.grid : world.gridOrder();
      return order.map((id) => {
        const c = world.car(id);
        return {
          id,
          name: c?.name ?? '',
          color: css(c?.paint?.body ?? c?.color ?? 0xff7d26),
          ms: (online && l ? l.quali[id] : c?.qualiMs) ?? null,
          you: id === meId,
        };
      });
    };
    let gridShown: Hud['grid'] = [];

    const startRace = () => {
      const l = liveRef.current;
      gridShown = gridRows();
      world.beginRace(online && l ? l.grid : world.gridOrder());
      prev.clear();
      curr.clear();
      remember();
      sceneRef.current?.setLights(0);
      sectorRow.length = 0;
    };

    /** Eventos da simulação (local, ou do líder): som, avisos e efeitos. */
    const onEvents = (events: GpEvent[], fromHost = false) => {
      sceneRef.current?.handle(events);
      for (const e of events) {
        const mine = 'id' in e && e.id === meId;
        if (e.type === 'qready' && mine) {
          // o carro foi levado para a largada: a faixa de transição cobre o salto
          setWipe({ key: Date.now(), text: 'Volta lançada' });
          gpSfx.light();
        } else if (e.type === 'qstart' && mine) {
          if (!qstartShown) {
            qstartShown = true;
            gpSfx.go();
            setLapFlash((n) => n + 1);
          }
        } else if (e.type === 'qtime' && mine) {
          gpSfx.lap(true);
          if (saveBest(mode, e.ms))
            say(lapClock(e.ms), 4000, 'result', `Recorde do aparelho no ${PHYSICS_NAME[mode]}`);
          else say(lapClock(e.ms), 4000, 'result', 'Seu tempo da volta lançada');
        } else if (e.type === 'bar' && mine) {
          // cada terço da barra: aviso curto e a nota do nível (mais alta a cada terço)
          gpSfx.bar(e.level);
          setBarPulse((n) => n + 1);
          const name = ['', 'azul', 'laranja', 'rosa'][e.level] ?? '';
          say('Turbo pronto', 1400, 'turbo', `Nível ${e.level} · ${name}`);
        } else if (e.type === 'noturbo' && mine) {
          gpSfx.noTurbo();
          setNoTurbo((n) => n + 1);
        } else if (e.type === 'drsready' && mine) {
          gpSfx.drs();
          say(
            'DRS disponível',
            2000,
            'drs',
            touchDevice ? 'Toque em DRS' : `Aperte ${gpKeyName('drs')}`,
          );
        } else if (e.type === 'sector' && e.id === focus) {
          const overall = world.cars.every(
            (c) => c.id === e.id || (c.bestSectors[e.sector] ?? Infinity) >= e.ms,
          );
          if (e.sector === 0) sectorRow.length = 0;
          sectorRow[e.sector] = {
            ms: e.ms,
            kind: overall && e.best ? 'best' : e.best ? 'pb' : 'slow',
          };
        } else if (e.type === 'lap' && mine) {
          const c = me();
          gpSfx.lap(c?.bestLap === e.ms);
          saveBest(mode, e.ms);
          const fastest = world.fastest?.id === meId && world.fastest.ms === e.ms;
          if (fastest) say('Volta mais rápida', 2600, 'highlight', lapClock(e.ms));
          if (e.lap === GP_LAPS - 1) say('Última volta', 2400, 'highlight');
          else if (e.lap < GP_LAPS)
            say(`Volta ${e.lap + 1}/${GP_LAPS}`, 2000, 'info', lapClock(e.ms));
        } else if (e.type === 'finish' && mine) {
          gpSfx.finish(e.place);
          say(`Você terminou em ${e.place}º`, 5000, 'result', 'Agora assista os outros');
          controls.enabled = false;
          const list = others().filter((o) => !o.finished);
          if (list[0]) focus = list[0].id;
        } else if (e.type === 'tyre' && mine) {
          // Fase 10: pneu desgastado, no limite (entre no box) e acabando (repete a cada volta)
          if (e.level === 1) say('Pneus desgastados', 2600, 'info', 'Menos aderência e freio');
          else if (e.level === 2) {
            gpSfx.drs();
            say('Pneus no limite: entre no box', 4200, 'alert', 'Menos aderência e freio');
          } else {
            gpSfx.drs();
            say('Pneus acabando! Box agora', 4200, 'alert', 'Menos aderência e freio');
          }
        } else if (e.type === 'pitin' && mine) gpSfx.pitIn();
        else if (e.type === 'pitout' && mine) {
          gpSfx.pitOut();
          say('Pneus novos', 2000, 'info');
        } else if (e.type === 'cut' && e.id === focus && import.meta.env.DEV && !mine) {
          lastPose = null;
        } else if (e.type === 'cut' && mine) {
          // a volta ao último ponto válido é um salto de verdade: não conta como tranco do desenho
          lastPose = null;
          gpSfx.cut();
          say('Cortou caminho', 2600, 'alert', 'De volta ao último ponto válido');
        } else if (e.type === 'wall' && mine && !fromHost) {
          gpSfx.wall(mode === 'arcade');
          if (e.speed > 14) say('Batida', 2000, 'alert');
        } else if (e.type === 'bump' && (e.a === meId || e.b === meId) && !fromHost) gpSfx.bump(true);
        else if (e.type === 'turbo' && e.id === focus) gpSfx.turbo(e.level);
        else if (e.type === 'pad' && e.id === focus) gpSfx.turbo(1);
        else if (e.type === 'drift' && e.id === focus) gpSfx.hop();
      }
    };
    if (peerLink && client) {
      peerLink.onSnapshot((s) => client.receive(s, performance.now()));
      peerLink.onEvents((ev) => onEvents(ev, true));
      linkRef.current = { rtt: () => (peerLink.mode === 'direto' ? peerLink.rtt : currentRtt()) };
    }

    /** O líder relata à sala os tempos de todos. */
    const report = (events: GpEvent[]) => {
      for (const e of events) {
        if (e.type === 'qtime') sendRoom('gq', { id: e.id, ms: e.ms });
        else if (e.type === 'lap') sendRoom('glap', { id: e.id, lap: e.lap, ms: e.ms });
        else if (e.type === 'finish') {
          const c = world.car(e.id);
          if (c) sendRoom('gfin', { id: e.id, ms: e.ms, laps: c.laps });
        }
      }
    };

    setHud(initialHud());

    const frame = (now: number) => {
      const gapMs = now - last;
      const dt = Math.min(0.05, gapMs / 1000);
      last = now;
      const f0 = clock();
      const w = where(now);
      // ---- troca de fase ----
      const enter = (next: Stage) => {
        if (next === 'quali') {
          gpSfx.go();
          say('Classificação', 2600, 'info', `5 minutos · 1 volta · ${PHYSICS_NAME[mode]}`);
          setWipe({ key: Date.now(), text: 'Classificação' });
        }
        if ((next === 'grid' || next === 'lights' || next === 'race') && world.phase !== 'race') {
          startRace();
          setWipe({ key: Date.now(), text: 'Grid de largada' });
        }
        if (next === 'grid') {
          gridUntil = now + GRID_SEC * 1000;
          say('Prepare-se para a largada', 2600, 'info');
        }
        if (next === 'lights') {
          lightsAt = now;
          litShown = -1;
        }
        if (next === 'race') {
          sceneRef.current?.setLights(GP_LIGHTS, true);
          gpSfx.go();
          goAt = now;
          started = true;
        }
        stage = next;
        if (import.meta.env.DEV) (window as unknown as { __gpStage?: Stage }).__gpStage = next;
      };
      if (online) {
        if (w.st !== stage) enter(w.st);
      } else if (stage === 'count' && w.st === 'quali') enter('quali');
      else if (stage === 'quali' && world.qualiDone()) enter('grid');
      else if (stage === 'grid' && now >= gridUntil) enter('lights');
      else if (stage === 'lights' && w.st === 'race') enter('race');
      if (w.st === 'count' && w.count !== lastCount) {
        lastCount = w.count;
        if (w.count >= 1 && w.count <= 3) gpSfx.count(w.count);
      }
      if (stage === 'lights' && w.lit !== litShown) {
        litShown = w.lit;
        sceneRef.current?.setLights(w.lit);
        if (w.lit > 0) gpSfx.light();
      }

      // ---- simulação ----
      const driving = stage === 'quali' || stage === 'race';
      if (driving && !world.ended && !document.hidden) {
        const l = liveRef.current;
        if (online && l) {
          for (const id of l.gone) world.markGone(id);
          if (!isHost && world.phase === 'race')
            for (const [id, ms] of Object.entries(l.finish))
              if (id !== meId) world.applyFinish(id, ms);
        }
        if (spectator) driveSpectator(dt, now);
        // líder: o relógio é o da sala; treino e convidado: o do aparelho
        if (isHost) acc = Math.min(Math.max(0, w.target - world.t), 1);
        else if (!menuRef.current || online) acc += dt;
        const mine = me();
        let input: GpInput =
          mine && (!menuRef.current || online)
            ? controls.read(dt)
            : { throttle: 0, brake: 0, steer: 0 };
        // kart (spec 081): a mesma tecla do DRS é o turbo (os modos não se misturam)
        if (mode === 'arcade') input = { ...input, turbo: !!input.drs, drs: false };
        // só no desenvolvimento: piloto automático no seu carro (os testes de tela medem a fluidez com ele)
        if (import.meta.env.DEV && mine && (window as unknown as { __gpAuto?: boolean }).__gpAuto) {
          if (!autoMem) autoMem = newGpBotMemory(0.9);
          input = gpBotInput(world, mine, autoMem, rng);
        }
        // pedido de um toque só (iniciar a volta, DRS de toque): fica guardado até um passo da simulação usar (num
        // quadro sem passo, com a tela mais rápida que 60/s, ele não se perde)
        if (wantLap) input.lap = true;
        if (acc >= GP_DT) wantLap = false;
        else if (input.drs) controls.keepDrs();
        let first = true;
        while (acc >= GP_DT) {
          acc -= GP_DT;
          const stepIn: GpInput = first ? input : { ...input, lap: false };
          first = false;
          if (isHost && host) {
            const s0 = clock();
            // os bots da sala: quem simula é o líder, como no treino
            const botIn: Record<string, GpInput> = {};
            for (const c of world.cars) if (c.bot && !c.gone) botIn[c.id] = gpBotInput(world, c, mem.get(c.id)!, rng);
            host.step(stepIn, botIn);
            const n0 = clock();
            if (host.snapDue) hostLink?.sendSnapshot(host.snapshot(), gpSnapshotFor);
            if (perf) {
              perf.add('sim', n0 - s0);
              perf.add('net', clock() - n0);
            }
          } else if (client) {
            peerLink?.sendInput(client.local(stepIn));
          } else if (!online) {
            const inputs: Record<string, GpInput> = { me: stepIn };
            const b0 = clock();
            for (const c of world.cars)
              if (c.bot) inputs[c.id] = gpBotInput(world, c, mem.get(c.id)!, rng);
            const s0 = clock();
            world.step(GP_DT, inputs);
            if (perf) {
              perf.add('bots', s0 - b0);
              perf.add('sim', clock() - s0);
            }
          }
          remember();
        }
        alpha = Math.max(0, Math.min(1, acc / GP_DT));
        client?.frame(dt, now);
        // eventos
        if (host) {
          const ev = host.drainEvents();
          if (ev.length) {
            hostLink?.sendEvents(ev);
            report(ev);
            onEvents(ev);
          }
          // posições de todos para a sala (quem assiste e o juiz da sala)
          if (now - posAt > 100) {
            posAt = now;
            sendRoomQuiet(
              'gall',
              world.cars
                .filter((c) => !c.gone)
                .map((c) => [
                  c.slot,
                  c.x,
                  c.z,
                  c.h,
                  c.speed,
                  c.prog,
                  (c.drsOpen ? 1 : 0) + (c.surface === 'pit' ? 2 : 0),
                  c.slip,
                  c.wear,
                  c.steer,
                ]),
            );
          }
        } else if (client) {
          // da previsão do próprio carro só vale o visual; a verdade dos tempos vem do líder
          const ev = world
            .drainEvents()
            .filter(
              (e) =>
                e.type === 'qready' ||
                e.type === 'qstart' ||
                e.type === 'wall' ||
                e.type === 'bump',
            );
          if (ev.length) onEvents(ev);
        } else {
          const ev = world.drainEvents();
          if (ev.length) onEvents(ev);
        }
      }
      // o motor do seu carro (ou de quem você assiste); no grid e nas luzes o acelerador só sobe o giro
      const heard = world.car(focus);
      const silent = menuRef.current && !online;
      if (heard && (stage === 'grid' || stage === 'lights') && focus === meId) {
        const thr = controls.throttle();
        gpSfx.engine.update(0, thr, silent, true);
      } else if (heard) {
        const v = Math.abs(heard.speed);
        const load = heard.braking
          ? 0
          : heard.id === meId
            ? controls.throttle()
            : Math.min(1, v / 8);
        gpSfx.engine.update(Math.max(0, Math.min(1, heard.rpm)), load, silent || stage === 'over', v < 0.3, {
          gear: heard.gear,
          speed: heard.speed,
          drift: heard.driftDir !== 0 ? Math.min(1, heard.driftT * 2 + 0.4) : 0,
          boost: heard.boostT > 0 ? heard.boostLevel : 0,
        });
      }
      // "Vai!" no meio da tela logo que as luzes apagam
      if (goAt && now - goAt > GP_GO_SEC * 1000) goAt = 0;
      // fila de avisos
      if (notices.tick(now)) setNotice(notices.current);
      const r0 = clock();
      sceneRef.current?.render(dt, focus, pose);
      if (perf) perf.add('render', clock() - r0);
      if (import.meta.env.DEV && (stage === 'quali' || stage === 'race')) {
        const fc = world.car(focus);
        if (fc) {
          const p = pose(fc);
          stats.frames += 1;
          stats.maxDt = Math.max(stats.maxDt, dt);
          if (dt > 0.034) stats.slow += 1;
          if (lastPose) {
            const dx = p.x - lastPose.x;
            const dz = p.z - lastPose.z;
            const jump = Math.hypot(dx, dz);
            stats.maxJump = Math.max(stats.maxJump, jump);
            // andou para trás em relação ao nariz, andando para a frente: é o vai-e-volta
            const along = dx * Math.sin(p.h) - dz * Math.cos(p.h);
            if (fc.speed > 3 && along < -0.02) stats.backs += 1;
          }
          lastPose = p;
          stats.laps = fc.laps.length;
        }
      }

      // ---- fim (treino) ----
      if (!online && world.ended && stage !== 'over') {
        stage = 'over';
        controls.enabled = false;
        setWipe({ key: Date.now(), text: 'Bandeirada' });
        const st = world.standings();
        const fastest = world.fastest;
        setExtra({
          fastest: fastest ? `${world.car(fastest.id)?.name ?? ''} · ${lapClock(fastest.ms)}` : '—',
        });
        window.setTimeout(
          () =>
            setResult(
              st.map((r) => ({
                id: r.car.id,
                name: r.car.name,
                color: css(r.car.color),
                fur: r.car.color,
                paint: r.car.paint,
                you: r.car.id === meId,
                bot: r.car.bot,
                ms: r.car.finishMs,
                best: r.car.bestLap,
                dnf: !r.car.finished,
              })),
            ),
          650,
        );
      }

      // ---- minimapa ----
      if (now - miniAt > 100 && mini.current) {
        miniAt = now;
        drawMinimap(mini.current, world, meId, focus);
      }

      // ---- lembrete da volta lançada (spec 081, 9.1): aviso forte aos 30 s e de novo no último minuto ----
      {
        const c = me();
        if (world.phase === 'quali' && c && c.qualiStartT === null && c.qualiMs === null && c.qualiHold <= 0) {
          const how = touchDevice ? 'Toque em Iniciar a volta lançada' : `Aperte ${gpKeyName('lap')} para fazer a sua volta lançada`;
          if (world.t >= 30 && remind < 1) {
            remind = 1;
            say(how, 4200, 'alert', 'A classificação dura 5 minutos');
          } else if (GP_QUALI_MAX_SEC - world.t <= 60 && remind < 2) {
            remind = 2;
            say('Última chance', 4200, 'alert', how);
          }
        }
      }
      // ---- box perdido: a distância à entrada pulou de perto para longe sem a faixa do box ----
      {
        const c = me();
        const bd = boxDistOf(c);
        if (boxWas !== null && boxWas < 25 && (bd === null || bd > 200) && c && c.surface !== 'pit' && c.pitHold <= 0)
          say('Box perdido: próxima volta', 2400, 'info');
        boxWas = bd;
      }
      // ---- HUD ----
      const h0 = clock();
      if (now - hudAt > 110) {
        hudAt = now;
        const c = me();
        const seen = world.car(focus) ?? c;
        const st = world.standings();
        // quem assiste (terminou ou entrou com a corrida andando) vê a posição do piloto assistido
        const myRow = st.find((r) => r.car.id === (c && focus === meId ? meId : focus));
        const l = liveRef.current;
        let dnfLeft: number | null = null;
        if (world.phase === 'race') {
          const firstT =
            online && l?.firstFinishAt
              ? (serverNow() - l.firstFinishAt) / 1000
              : world.firstFinishT !== null
                ? world.t - world.firstFinishT
                : null;
          if (firstT !== null && firstT >= 0) dnfLeft = Math.max(0, GP_DNF_SEC - firstT);
        }
        if (stage === 'grid' && gridShown.length === 0) gridShown = gridRows();
        const pole = world.cars.reduce<number | null>(
          (m, x) => (x.qualiMs !== null && (m === null || x.qualiMs < m) ? x.qualiMs : m),
          null,
        );
        const net = isHost
          ? (() => {
              const s = hostLink!.stats();
              return `líder · ${s.direct} direto${s.relay ? ` · ${s.relay} pela sala` : ''}`;
            })()
          : peerLink
            ? peerLink.mode === 'direto'
              ? 'direto'
              : peerLink.mode === 'sala'
                ? 'pela sala'
                : 'conectando'
            : 'servidor';
        setHud({
          stage,
          count: w.count,
          lit: w.lit,
          pos: myRow?.pos ?? 0,
          total: world.cars.filter((x) => !x.gone).length,
          lap: Math.min(GP_LAPS, (seen?.laps.length ?? 0) + 1),
          raceMs: world.phase === 'race' && started ? world.t * 1000 : 0,
          best: seen?.bestLap ?? null,
          last: seen?.laps.length ? seen.laps[seen.laps.length - 1]! : null,
          kmh: gpKmh(seen?.speed ?? 0),
          rush: mode === 'real' ? Math.max(0, Math.min(1, (Math.abs(seen?.speed ?? 0) / gpVmaxOf('real') - 0.6) / 0.35)) : 0,
          gear: seen ? (seen.speed < -0.3 ? 0 : Math.max(1, seen.gear)) : 1,
          rpm: seen?.rpm ?? 0,
          drs: c?.drsOpen ? 'open' : c?.drsAvail ? 'avail' : 'off',
          bar: seen?.bar ?? 0,
          boost: seen && seen.boostT > 0 ? seen.boostLevel : 0,
          drift: seen?.driftDir ? 'on' : seen?.driftAvail ? 'avail' : 'off',
          slip: c?.slip ?? 0,
          wear: c?.wear ?? 0,
          pit: c?.pitHold ?? 0,
          inPitLane: c?.surface === 'pit',
          rows: st.map((r, i) => {
            const ahead = st[i - 1];
            const L = world.track.length;
            const behind =
              ahead && !r.car.finished ? Math.floor((st[0]!.car.prog - r.car.prog) / L) : 0;
            return {
              id: r.car.id,
              pos: r.pos,
              name: r.car.name,
              color: css(r.car.paint?.body ?? r.car.color),
              // diferença para o carro da frente (não para o líder): é o que se disputa na pista
              gap: r.car.gone
                ? 'fora'
                : world.phase === 'quali'
                  ? r.car.qualiMs !== null
                    ? lapClock(r.car.qualiMs)
                    : r.car.qualiStartT !== null
                      ? 'na volta'
                      : 'sem tempo'
                  : r.pos === 1
                    ? 'Líder'
                    : behind >= 1
                      ? `+${behind} ${behind === 1 ? 'volta' : 'voltas'}`
                      : gapText(
                          r.gap !== null && ahead?.gap != null
                            ? Math.max(0, r.gap - ahead.gap)
                            : r.gap,
                        ).replace('.', ','),
              you: r.car.id === meId,
              done: r.car.finished,
              out: r.car.gone || r.car.dnf,
            };
          }),
          lapMs:
            world.phase === 'race' && started && seen && !seen.finished
              ? Math.max(0, (world.t - seen.lapStartT) * 1000)
              : 0,
          qualiLeft: Math.max(0, GP_QUALI_MAX_SEC - (world.phase === 'quali' ? world.t : 0)),
          qualiHold: c?.qualiHold ?? 0,
          qualiMs: c?.qualiMs ?? null,
          qualiRun:
            c?.qualiStartT != null && c.qualiMs === null
              ? Math.max(0, (world.t - c.qualiStartT) * 1000)
              : null,
          qualiStarted: c?.qualiStartT != null,
          tyreLevel:
            mode === 'real' && c
              ? c.wear >= GP_TYRE_CRIT
                ? 3
                : c.wear >= GP_TYRE_ALERT
                  ? 2
                  : c.wear >= GP_TYRE_WARN
                    ? 1
                    : 0
              : 0,
          boxDist: boxDistOf(c),
          lapUrgent:
            world.phase === 'quali' && c && c.qualiStartT === null && c.qualiMs === null
              ? GP_QUALI_MAX_SEC - world.t <= 60
                ? 2
                : world.t >= 30
                  ? 1
                  : 0
              : 0,
          pole,
          sectors: [...sectorRow],
          go: goAt > 0,
          done: c?.finished ? (st.find((r) => r.car.id === meId)?.pos ?? null) : null,
          dnfLeft,
          watching: focus !== meId ? (world.car(focus)?.name ?? '') : '',
          grid: gridShown,
          net,
        });
      }
      if (perf) {
        perf.add('hud', clock() - h0);
        perf.add('frame', clock() - f0);
        if (stage === 'quali' || stage === 'race') perf.tick(gapMs);
        if (now - perfAt > 500 && gpPerfOn()) {
          perfAt = now;
          setPerfText(gpPerfText(perf));
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      for (const off of unsubs) off();
      hostLink?.dispose();
      peerLink?.dispose();
      controls.detach();
      gpSfx.engine.stop();
      ro?.disconnect();
      sceneRef.current?.dispose();
      sceneRef.current = null;
      remakeScene.current = null;
    };
  }, [bots, color, paint, kart, controls, online, touchDevice, mode, kartOk]);

  const pad = (k: 'gas' | 'brake' | 'left' | 'right' | 'drs' | 'drift') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      controls.press(k, true);
    },
    onPointerUp: () => controls.press(k, false),
    onPointerCancel: () => controls.press(k, false),
    onLostPointerCapture: () => controls.press(k, false),
  });

  const h = hud;
  const racing = h?.stage === 'race' || h?.stage === 'over';
  const quali = h?.stage === 'quali';
  const driving = h && (h.stage === 'quali' || h.stage === 'race') && h.done === null && !result;
  const segs = 9;
  const rpmLit = h ? Math.round(h.rpm * segs) : 0;
  const myIdx = h ? h.rows.findIndex((r) => r.you) : -1;
  // celular deitado: não cabem 20 linhas; fica o líder e uma janela de cinco em volta de você
  const mid = h ? Math.max(2, Math.min(h.rows.length - 3, myIdx < 0 ? 2 : myIdx)) : 0;
  const boardRows = h
    ? touchDevice && h.rows.length > 6
      ? h.rows.filter((_, i) => i === 0 || Math.abs(i - mid) <= 2)
      : h.rows
    : [];
  const lapKey = gpKeyName('lap', binds);
  const drsKey = gpKeyName('drs', binds);
  const camKey = gpKeyName('cam', binds);
  const clock = (sec: number) =>
    `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  return (
    <div
      className="gp-play"
      data-testid="gp-play"
      data-touch={touchDevice ? '1' : '0'}
      data-cam={cam}
      data-physics={mode}
    >
      <canvas ref={canvas} className="gp-canvas" aria-label="Pista do Fox GP" />
      {/* sensação de velocidade do F1: riscos nas bordas que aparecem com a velocidade (só opacidade) */}
      {mode === 'real' && cam !== 'far' && (
        <div className="gpx-rush" aria-hidden="true" style={{ opacity: hud?.rush ?? 0 }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            {RUSH_LINES.map((l, i) => (
              <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />
            ))}
          </svg>
        </div>
      )}
      {perfText && (
        <pre className="gp-perf" data-testid="gp-perf">
          {perfText}
        </pre>
      )}
      {h && (
        <>
          {/* em cima à esquerda: a classificação (volta no cabeçalho; diferença para o carro da frente) */}
          {h.rows.length > 0 && h.stage !== 'count' && (
            <ol
              className="gpx-board"
              aria-label={quali ? 'Tempos da classificação' : 'Classificação ao vivo'}
              data-testid="gp-board"
              data-compact={touchDevice ? '1' : '0'}
            >
              <li className="gpx-board-h">
                {quali ? (
                  <>
                    <span>Classificação</span>
                    <b className="gpn" data-testid="gp-qleft">
                      {clock(h.qualiLeft)}
                    </b>
                  </>
                ) : (
                  <>
                    <span>Volta</span>
                    <b className="gpn" data-testid="gp-lap">
                      {h.lap}/{GP_LAPS}
                    </b>
                  </>
                )}
              </li>
              {boardRows.map((r, i) => (
                <li
                  key={r.id}
                  className={`${r.you ? 'is-you' : ''}${r.out ? ' is-out' : ''}${i > 0 && boardRows[i - 1]!.pos < r.pos - 1 ? ' is-skip' : ''}`}
                >
                  <span className="gpx-board-pos">{r.pos}</span>
                  <i style={{ background: r.color }} aria-hidden="true" />
                  <span className="gpx-board-name">{r.you ? 'Você' : r.name}</span>
                  <span className="gpx-board-gap gpn">{r.done ? 'chegou' : r.gap}</span>
                </li>
              ))}
            </ol>
          )}

          {/* em cima à direita: botões (com a tecla) e os seus dados */}
          <div className="gpx-tr">
            <div className="gpx-tools">
              <button
                type="button"
                className="gpx-tool"
                onClick={cycleCam}
                data-testid="gp-cam"
                aria-label={`Câmera: ${CAM_NAME[cam]}`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M3 7h4l2-3h6l2 3h4v13H3z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>{CAM_NAME[cam]}</span>
                {!touchDevice && <kbd>{camKey}</kbd>}
              </button>
              <button
                type="button"
                className="gpx-tool"
                onClick={() => setMenu(true)}
                data-testid="gp-menu-btn"
                aria-label="Abrir o menu"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
                <span>Menu</span>
                {!touchDevice && <kbd>Esc</kbd>}
              </button>
            </div>
            {h.stage !== 'count' && (
              <div className="gpx-me" data-testid="gp-me">
                {quali ? (
                  <div
                    className={`gpx-me-times${h.qualiRun !== null ? ' is-live' : ''}`}
                    data-testid="gp-qtime"
                  >
                    <small>
                      {h.qualiMs !== null
                        ? 'Seu tempo'
                        : h.qualiRun !== null
                          ? 'Volta lançada'
                          : 'Andando livre'}
                    </small>
                    <b className="gpn">
                      {h.qualiMs !== null
                        ? lapClock(h.qualiMs)
                        : h.qualiRun !== null
                          ? lapClock(h.qualiRun)
                          : '-:--.---'}
                    </b>
                    {h.qualiMs !== null && h.pole !== null && (
                      <span className="gpx-me-sub">
                        Pole{' '}
                        <b className="gpn">
                          {h.qualiMs === h.pole
                            ? 'é sua'
                            : gapText((h.qualiMs - h.pole) / 1000).replace('.', ',')}
                        </b>
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="gpx-me-pos" data-testid="gp-pos">
                      <b>P{h.pos || '-'}</b>
                      <span>/{h.total}</span>
                    </div>
                    <div className="gpx-me-times">
                      <small>Volta atual</small>
                      <b className="gpn">{lapClock(h.lapMs)}</b>
                      <span className="gpx-me-sub">
                        <span>
                          Última{' '}
                          <b className="gpn">{h.last !== null ? lapClock(h.last) : '-:--.---'}</b>
                        </span>
                        <span>
                          Melhor{' '}
                          <b className="gpn">{h.best !== null ? lapClock(h.best) : '-:--.---'}</b>
                        </span>
                      </span>
                    </div>
                  </>
                )}
                {h.sectors.length > 0 && (
                  <div className="gpx-sectors" aria-label="Setores da volta">
                    {[0, 1, 2].map((i) => {
                      const sc = h.sectors[i];
                      return (
                        <span key={i} className={`gpx-sector${sc ? ` is-${sc.kind}` : ''}`}>
                          S{i + 1}
                          {sc && (
                            <b className="gpn">{(sc.ms / 1000).toFixed(2).replace('.', ',')}</b>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* em cima no meio: os avisos, um por vez */}
          {notice && (
            <div
              key={notice.id}
              className="gpx-notice"
              data-kind={notice.kind}
              style={{
                ['--dur' as string]: `${notice.ms}ms`,
                ['--fade' as string]: `${NOTICE_FADE_MS}ms`,
              }}
              role="status"
              aria-live="polite"
              data-testid="gp-notice"
            >
              <NoticeIcon kind={notice.kind} />
              <div>
                <b>{notice.text}</b>
                {notice.sub && <small>{notice.sub}</small>}
              </div>
            </div>
          )}

          <div className="gpx-mini">
            <canvas
              ref={mini}
              width={300}
              height={240}
              role="img"
              aria-label="Minimapa do circuito com os carros e as zonas de DRS"
            />
          </div>

          {/* kart: embaixo no meio, o drift e a barra de turbo em 3 terços (no lugar do DRS) */}
          {driving && mode === 'arcade' && (
            <div className="gpx-kart" data-testid="gp-kart-hud" role="status">
              <div className="gpx-drift" data-state={h.drift} data-testid="gp-drift">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 17c4-1 6-4 7-8M20 17c-4-1-6-4-7-8M8 20h8" />
                </svg>
                <span>{h.drift === 'on' ? 'Drift' : h.drift === 'avail' ? 'Liberado' : 'Drift'}</span>
              </div>
              <div
                className="gpx-turbo"
                data-boost={h.boost}
                data-testid="gp-turbo"
                key={`nt${noTurbo}`}
                data-no={noTurbo > 0 ? '1' : undefined}
                aria-label={`Turbo: ${Math.floor(h.bar)} de 3 terços`}
              >
                {[0, 1, 2].map((i) => (
                  <i key={i} className={`gpx-third is-${i + 1}`} data-full={h.bar >= i + 1 ? '1' : undefined}>
                    <b style={{ transform: `scaleX(${Math.max(0, Math.min(1, h.bar - i))})` }} />
                  </i>
                ))}
                <span className="gpx-turbo-key" key={`bp${barPulse}`}>
                  {h.boost ? 'Turbo!' : touchDevice ? 'Turbo' : gpKeyName('drs', binds)}
                </span>
              </div>
            </div>
          )}
          {driving && mode === 'arcade' && h.boost > 0 && (
            <div className="gpx-boost" data-level={h.boost} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          {/* embaixo no meio: o indicador do DRS */}
          {driving && mode === 'real' && (
            <div className="gpx-drs" data-state={h.drs} data-testid="gp-drs" role="status">
              <b>DRS</b>
              <span>
                {h.drs === 'open'
                  ? 'Aberto'
                  : h.drs === 'avail'
                    ? touchDevice
                      ? 'Liberado'
                      : `Aperte ${drsKey}`
                    : 'Fechado'}
              </span>
            </div>
          )}
          {driving && h.slip > 0.15 && (
            <div
              className="gpx-wind"
              aria-hidden="true"
              style={{ opacity: Math.min(1, h.slip * 1.4) }}
            >
              <i />
              <i />
              <i />
              <i />
            </div>
          )}

          {driving && (
            <div className="gpx-speed" data-testid="gp-dash">
              <div className="gpx-speed-top">
                <small>Velocidade</small>
                <span className="gpx-tags">
                  <span className="gpx-mode" data-testid="gp-mode">
                    {PHYSICS_NAME[mode]}
                  </span>
                  {h.slip > 0.15 && (
                    <span className="gpx-slip" data-testid="gp-slip">
                      Vácuo
                    </span>
                  )}
                </span>
                <div className="gpx-gear" hidden={mode === 'arcade'}>
                  <small>Marcha</small>
                  <b>{h.gear === 0 ? 'R' : h.gear}</b>
                </div>
              </div>
              <div className="gpx-speed-num">
                <b className="gpn" data-testid="gp-kmh">
                  {h.kmh}
                </b>
                <span>km/h</span>
              </div>
              <div className="gpx-rpm" aria-hidden="true">
                {Array.from({ length: segs }, (_, i) => (
                  <i key={i} className={i < rpmLit ? (i < 4 ? 'g' : i < 6 ? 'y' : 'o') : ''} />
                ))}
              </div>
              <div
                className="gpx-tyre"
                data-low={h.wear > 0.7 ? '1' : '0'}
                data-level={h.tyreLevel}
                hidden={mode === 'arcade'}
                data-testid="gp-tyre"
              >
                <small>
                  {h.tyreLevel >= 2 && (
                    <svg className="gpx-tyre-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="8" />
                      <circle cx="12" cy="12" r="3.5" />
                    </svg>
                  )}
                  Pneus {Math.round((1 - h.wear) * 100)}%
                </small>
                <span>
                  <i style={{ transform: `scaleX(${1 - h.wear})` }} />
                </span>
              </div>
            </div>
          )}

          {/* classificação: a chamada da volta lançada (fixa, embaixo no meio) e a contagem na largada */}
          {quali && !h.qualiStarted && h.qualiMs === null && h.qualiHold <= 0 && driving && (
            <button
              type="button"
              className="gpx-lapcall"
              data-urgent={h.lapUrgent || undefined}
              onClick={() => api.current?.startLap()}
              data-testid="gp-startlap"
            >
              {h.lapUrgent === 2 && <b className="gpx-lapcall-last">Última chance · </b>}
              {touchDevice ? (
                'Iniciar a volta lançada'
              ) : (
                <>
                  Aperte <kbd>{lapKey}</kbd> para iniciar a volta lançada
                </>
              )}
            </button>
          )}
          {quali && h.qualiHold > 0 && (
            <div className="gpx-center" aria-live="assertive" data-testid="gp-lapcount">
              <small>Volta lançada</small>
              <b>{Math.ceil(h.qualiHold)}</b>
            </div>
          )}

          {h.stage === 'count' && (
            <div className="gpx-center" aria-live="assertive">
              <small>Classificação</small>
              <b>{h.count > 0 ? h.count : 'Já!'}</b>
            </div>
          )}
          {h.stage === 'grid' && (
            <div className="gpx-grid" data-testid="gp-grid">
              <div className="gpx-grid-h">
                <small>Circuito da Marina · {PHYSICS_NAME[mode]}</small>
                <h2>Grid de largada</h2>
              </div>
              <ol>
                {h.grid.map((g, i) => (
                  <li key={g.id} className={g.you ? 'is-you' : ''}>
                    <span className="gpx-grid-pos">{i + 1}</span>
                    <i style={{ background: g.color }} aria-hidden="true" />
                    <b>{g.you ? 'Você' : g.name}</b>
                    <span className="gpn">{g.ms !== null ? lapClock(g.ms) : 'sem tempo'}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {(h.stage === 'lights' || h.go) && (
            <div
              className="gpx-lights"
              aria-label={h.go ? 'Luzes apagadas: vai' : `${h.lit} luzes acesas`}
              data-testid="gp-lights"
              data-go={h.go ? '1' : '0'}
            >
              {Array.from({ length: GP_LIGHTS }, (_, i) => (
                <span key={i} className="gpx-light-col">
                  <i className={!h.go && i < h.lit ? 'is-on' : ''} />
                  <i className={!h.go && i < h.lit ? 'is-on' : ''} />
                </span>
              ))}
            </div>
          )}
          {h.go && (
            <div className="gpx-go" aria-live="assertive" data-testid="gp-go">
              Vai!
            </div>
          )}
          {lapFlash > 0 && (
            <div
              className="gpx-lapflash"
              key={lapFlash}
              aria-live="polite"
              data-testid="gp-lapflash"
            >
              <span className="gpx-lapflash-bar gp-checker" />
              <small>Classificação</small>
              <b>Volta lançada</b>
              <span className="gpx-lapflash-go">Valendo o tempo</span>
            </div>
          )}
          {h.dnfLeft !== null && (racing || h.done !== null || !!h.watching) && (
            <div className="gpx-dnf" role="status" data-hot={h.dnfLeft <= 30 ? '1' : undefined} data-testid="gp-dnf">
              {h.done !== null ? 'Aguardando os outros terminarem' : 'O primeiro já chegou'}:{' '}
              <b className="gpn">{clock(Math.ceil(h.dnfLeft))}</b>
              {h.done === null && !h.watching ? ' para cruzar a linha' : ''}
            </div>
          )}
          {h.pit > 0 && (
            <div className="gpx-pit" role="status" data-testid="gp-pit">
              <small>Box</small>
              <b>Pit stop</b>
              <span className="gpx-pit-bar">
                <i style={{ transform: `scaleX(${1 - h.pit / GP_PIT_STOP_SEC})` }} />
              </span>
              <span className="gpx-pit-text">Trocando os pneus · {h.pit.toFixed(1)}s</span>
            </div>
          )}
          {/* Fase 10: o box é ali (só no Realista, com o pneu gasto): distância, barra e, perto, "entre no box" */}
          {mode === 'real' && h.boxDist !== null && driving && (
            <div className="gpx-box" data-near={h.boxDist <= GP_BOX_SIGN_NEAR ? '1' : undefined} role="status" data-testid="gp-box-sign">
              <span className="gpx-box-arrow" aria-hidden="true">
                ›
              </span>
              {h.boxDist <= GP_BOX_SIGN_NEAR ? (
                <>
                  <b>Entre no box!</b>
                  <small>Reduza: {gpKmh(GP_PIT_LIMIT)} km/h na faixa do box</small>
                </>
              ) : (
                <>
                  <b>Box à frente · {Math.round(h.boxDist / 10) * 10} m</b>
                  <span className="gpx-box-bar">
                    <i style={{ transform: `scaleX(${1 - h.boxDist / GP_BOX_SIGN_FAR})` }} />
                  </span>
                </>
              )}
            </div>
          )}
          {mode === 'real' && h.inPitLane && h.pit <= 0 && driving && (
            <div className="gpx-pitlane">Faixa do box · velocidade limitada</div>
          )}

          {(h.done !== null || h.watching) && !result && (
            <div className="gpx-spec">
              <button
                type="button"
                onClick={() => api.current?.next(-1)}
                aria-label="Carro anterior"
              >
                ‹
              </button>
              <span>
                {h.done !== null ? `Você chegou em ${h.done}º · ` : ''}Assistindo{' '}
                <b>{h.watching || '...'}</b>
              </span>
              <button type="button" onClick={() => api.current?.next(1)} aria-label="Próximo carro">
                ›
              </button>
            </div>
          )}

          {touchDevice && driving && (
            <div className="gp-pads">
              <div className="gp-pads-l">
                <button
                  type="button"
                  className="gp-pad"
                  aria-label="Virar para a esquerda"
                  {...pad('left')}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="gp-pad"
                  aria-label="Virar para a direita"
                  {...pad('right')}
                >
                  ›
                </button>
              </div>
              <div className="gp-pads-r">
                {mode === 'arcade' ? (
                  <>
                    <button
                      type="button"
                      className="gp-pad is-drift"
                      data-state={h.drift}
                      aria-label="Drift (segurar)"
                      data-testid="gp-pad-drift"
                      {...pad('drift')}
                    >
                      Drift
                    </button>
                    <button
                      type="button"
                      className="gp-pad is-turbo"
                      data-ready={h.bar >= 1 ? '1' : undefined}
                      aria-label="Turbo"
                      data-testid="gp-pad-turbo"
                      {...pad('drs')}
                    >
                      Turbo
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="gp-pad is-drs"
                    data-state={h.drs}
                    aria-label="DRS"
                    {...pad('drs')}
                  >
                    DRS
                  </button>
                )}
                <button
                  type="button"
                  className="gp-pad is-brake"
                  aria-label="Frear"
                  {...pad('brake')}
                >
                  Freio
                </button>
                <button
                  type="button"
                  className="gp-pad is-gas"
                  aria-label="Acelerar"
                  {...pad('gas')}
                >
                  Acelera
                </button>
              </div>
            </div>
          )}
          {online && showNet && !result && (
            <NetBadge mode={h.net} items={[{ text: `${ping} ms`, title: 'ida e volta' }]} />
          )}
        </>
      )}
      <GpWipe key={wipe.key} text={wipe.text} />
      {!result && <RotateHint />}
      {h?.stage === 'count' && !result && (
        <GameTips
          storageKey={TIPS_KEY}
          rows={tipRows(touchDevice, binds, mode === 'arcade')}
          testId="gp-tips"
          markOnShow
        />
      )}
      <GameChat enabled={!!online && !result} />
      {online && !result && <PauseOverlay />}
      {menu && !result && (
        <GameMenu
          title="Menu"
          testPrefix="gp-menu"
          tipsKey={TIPS_KEY}
          tips={tipRows(touchDevice, binds, mode === 'arcade')}
          online={!!online}
          net={
            online
              ? {
                  on: showNet,
                  toggle: () =>
                    setShowNet((v) => {
                      save('nocap-gp-net', v ? '0' : '1');
                      return !v;
                    }),
                }
              : undefined
          }
          onClose={() => setMenu(false)}
          onExit={onExit}
          onOfflineInvite={onOfflineInvite}
          endMatch={{
            label: 'Encerrar a partida',
            onClick: () => sendRoom('gend'),
            testId: 'gp-menu-end',
          }}
          actions={[
            {
              id: 'cam',
              icon: <span aria-hidden="true">C</span>,
              label: 'Câmera',
              hint: CAM_NAME[cam],
              onClick: cycleCam,
              testId: 'gp-menu-cam',
            },
            {
              id: 'quality',
              icon: <span aria-hidden="true">Q</span>,
              label: 'Qualidade gráfica',
              hint: QUALITY_NAME[quality],
              onClick: () =>
                setQuality((q) => {
                  const n: GpQuality = q === 'low' ? 'medium' : q === 'medium' ? 'high' : 'low';
                  save(QUALITY_KEY, n);
                  return n;
                }),
              testId: 'gp-menu-quality',
            },
            {
              id: 'commands',
              icon: <span aria-hidden="true">K</span>,
              label: 'Comandos',
              hint: touchDevice ? 'Botões de toque' : 'Trocar as teclas',
              onClick: () => setCommands(true),
              testId: 'gp-menu-commands',
            },
          ]}
        />
      )}
      {commands && <GpCommands touch={touchDevice} onClose={() => setCommands(false)} />}
      {result && !online && (
        <GpFinal
          rows={result}
          fastest={extra?.fastest ?? '—'}
          physics={PHYSICS_NAME[mode]}
          mode={{ kind: 'training', onAgain, onExit }}
        />
      )}
    </div>
  );
}

function initialHud(): Hud {
  return {
    stage: 'count',
    count: 3,
    lit: 0,
    pos: 0,
    total: 0,
    lap: 1,
    raceMs: 0,
    best: null,
    last: null,
    kmh: 0,
    rush: 0,
    gear: 1,
    rpm: 0,
    drs: 'off',
    bar: 0,
    boost: 0,
    drift: 'off',
    slip: 0,
    wear: 0,
    pit: 0,
    inPitLane: false,
    rows: [],
    lapMs: 0,
    qualiLeft: GP_QUALI_MAX_SEC,
    qualiHold: 0,
    qualiMs: null,
    qualiRun: null,
    qualiStarted: false,
    lapUrgent: 0,
    tyreLevel: 0,
    boxDist: null,
    pole: null,
    sectors: [],
    go: false,
    done: null,
    dnfLeft: null,
    watching: '',
    grid: [],
    net: '',
  };
}

/** Ícone pequeno de cada tipo de aviso (SVG, sem emoji). */
function NoticeIcon({ kind }: { kind: GpNoticeKind }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (kind === 'turbo')
    return (
      <svg {...common}>
        <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
      </svg>
    );
  if (kind === 'drs')
    return (
      <svg {...common}>
        <path d="M3 9h18M5 9l2 6h10l2-6M9 15v4M15 15v4" />
      </svg>
    );
  if (kind === 'alert')
    return (
      <svg {...common}>
        <path d="M12 3l10 18H2zM12 10v5M12 18v.5" />
      </svg>
    );
  if (kind === 'highlight')
    return (
      <svg {...common}>
        <path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z" />
      </svg>
    );
  if (kind === 'result')
    return (
      <svg {...common}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l3 2M9 2h6" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

/** Riscos de velocidade (coordenadas 0 a 100): raios do centro, só perto das bordas da tela. */
const RUSH_LINES: readonly [number, number, number, number][] = Array.from({ length: 28 }, (_, i) => {
  const a = (i / 28) * Math.PI * 2 + (i % 2) * 0.07;
  const r0 = 0.62 + (i % 3) * 0.06;
  const r1 = 1.05;
  return [50 + Math.cos(a) * 50 * r0, 50 + Math.sin(a) * 50 * r0, 50 + Math.cos(a) * 50 * r1, 50 + Math.sin(a) * 50 * r1];
});
