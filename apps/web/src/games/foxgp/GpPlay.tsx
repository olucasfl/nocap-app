import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  GP_DNF_SEC,
  GP_DT,
  GP_LAPS,
  GP_LIGHTS,
  GP_LIGHTS_HOLD,
  GP_LIGHT_SEC,
  GP_PIT_STOP_SEC,
  GP_QUALI_MAX_SEC,
  GP_ROOM_LIGHTS_MS,
  GpClient,
  GpHost,
  GpWorld,
  createRng,
  gpBotInput,
  gpGear,
  gpKmh,
  newGpBotMemory,
  type GpBotMemory,
  type GpCar,
  type GpEvent,
  type GpInput,
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
import { currentRtt, gameNow, sendRoom, sendRoomQuiet, serverNow, subscribeRoom } from '@/lib/rooms';
import { GpFinal, type GpFinalRow } from './GpFinal';
import { GpControls } from './gp-controls';
import { GpScene, type GpCamMode, type GpPose, type GpQuality } from './GpScene';
import { GpWipe } from './GpWipe';
import { css, gapText, lapClock, raceClock } from './format';
import { drawMinimap } from './minimap';
import './theme.css';
import './foxgp.css';

/** Cores das raposas no treino (a primeira é a sua, se você não escolher outra). */
export const GP_FURS = [0xff7d26, 0xb98cff, 0x4fc3f7, 0x7be07b, 0xffd23f, 0xff6f91, 0xf5f5f5, 0x8d6e63];
const BOT_NAMES = ['Faísca', 'Pipoca', 'Trufa', 'Ruivo', 'Brisa', 'Nuvem', 'Cacau'];
const COUNT_SEC = 3.2;
const GRID_SEC = 3.6;
const TIPS_KEY = 'nocap-gp-tips';
const CAM_KEY = 'nocap-gp-cam';
const QUALITY_KEY = 'nocap-gp-quality';
const SMOOTH = 12;
const CAMS: GpCamMode[] = ['far', 'chase', 'cockpit'];
const CAM_NAME: Record<GpCamMode, string> = { far: 'Distante', chase: 'Atrás do carro', cockpit: 'Cockpit' };
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

const tipRows = (touch: boolean): TipRow[] =>
  touch
    ? [
        { keys: <b className="gm-tag">‹ ›</b>, text: 'Botões da esquerda: virar' },
        { keys: <b className="gm-tag">Acelera</b>, text: 'Botão grande da direita; o Freio fica ao lado (parado, dá ré)' },
        { keys: <b className="gm-tag">Turbo</b>, text: 'Ande no vácuo de outro carro até a barra encher e toque em Turbo' },
        { keys: <b className="gm-tag">Volta</b>, text: 'Classificação: toque em Iniciar volta quando estiver pronto' },
        { keys: <b className="gm-tag">Câmera</b>, text: 'Troca entre distante, atrás do carro e cockpit' },
        { keys: <b className="gm-tag">Box</b>, text: 'Entre na faixa do box e pare na vaga amarela: pneus novos em 3 s' },
      ]
    : [
        {
          keys: (
            <>
              <Keycap k="W" touchHide={false} />
              <Keycap k="S" touchHide={false} />
            </>
          ),
          text: 'Acelerar e frear (parado, S dá ré). Setas também valem',
        },
        {
          keys: (
            <>
              <Keycap k="A" touchHide={false} />
              <Keycap k="D" touchHide={false} />
            </>
          ),
          text: 'Virar',
        },
        { keys: <Keycap k="Espaço" wide touchHide={false} />, text: 'Turbo da cauda: enche no vácuo de outro carro' },
        { keys: <Keycap k="L" touchHide={false} />, text: 'Classificação: iniciar a volta lançada' },
        { keys: <Keycap k="C" touchHide={false} />, text: 'Câmera: distante, atrás do carro ou cockpit' },
        { keys: <b className="gm-tag">Box</b>, text: 'Pare na vaga amarela do box: pneus novos em 3 s' },
        { keys: <Keycap k="Esc" touchHide={false} />, text: 'Menu: câmera, qualidade, som e sair' },
        { keys: <Keycap k="T" touchHide={false} />, text: 'Chat da sala (em sala)' },
      ];

type Stage = 'count' | 'quali' | 'grid' | 'lights' | 'race' | 'over';

/** Partida em sala: a seed, quem corre (na ordem das vagas), quem sou eu (vazio = só assistindo) e quem simula. */
export interface GpOnline {
  seed: string;
  meId: string;
  hostId: string;
  infos: GpPlayerInfo[];
}

/** O que a sala diz agora (muda a cada estado novo). */
export interface GpRoomLive {
  stage: 'quali' | 'grid' | 'race' | null;
  qualiAt: number | null;
  raceAt: number | null;
  grid: string[];
  quali: Record<string, number | null>;
  finish: Record<string, number>;
  gone: string[];
  firstFinishAt: number | null;
}

interface Row {
  id: string;
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
  gear: number;
  rpm: number;
  bar: number;
  turbo: boolean;
  wear: number;
  pit: number;
  inPitLane: boolean;
  rows: Row[];
  note: string;
  qualiLeft: number;
  qualiMs: number | null;
  qualiRun: number | null;
  qualiStarted: boolean;
  pole: number | null;
  sectors: { ms: number; kind: 'best' | 'pb' | 'slow' }[];
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
  const [result, setResult] = useState<GpFinalRow[] | null>(null);
  const [extra, setExtra] = useState<{ fastest: string; passes: string } | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(false);
  menuRef.current = menu;
  const [cam, setCam] = useState<GpCamMode>(() => read(CAM_KEY, CAMS, 'far'));
  const [quality, setQuality] = useState<GpQuality>(() => read(QUALITY_KEY, ['low', 'medium', 'high'], 'medium'));
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
    const t = window.setInterval(() => setPing(Math.round(linkRef.current?.rtt() ?? currentRtt())), 1000);
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
      if (e.code === 'Escape' && !menuRef.current) setMenu(true);
      else if (e.code === 'KeyC' && !e.repeat && !menuRef.current) cycleCam();
      else if (e.code === 'KeyL' && !e.repeat) api.current?.startLap();
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
    if (!el) return undefined;
    const meId = online ? online.meId : 'me';
    const infos: GpPlayerInfo[] = online?.infos ?? [
      { id: 'me', name: 'Você', color, paint },
      ...Array.from({ length: bots }, (_, i) => ({
        id: `bot${i}`,
        name: BOT_NAMES[i] ?? `Raposa ${i + 1}`,
        color: GP_FURS.filter((c) => c !== color)[i % (GP_FURS.length - 1)]!,
        bot: true,
      })),
    ];
    const seed = online?.seed ?? seedOf();
    const world = new GpWorld(seed, infos);
    const isHost = !!online && !!online.meId && online.hostId === meId;
    const isClient = !!online && !isHost && !!world.car(meId);
    const spectator = !!online && !world.car(meId);
    if (online && !isHost) world.goOnline(meId);
    if (isHost) world.autoEnd = false;
    if (import.meta.env.DEV) (window as unknown as { __gp?: GpWorld }).__gp = world;
    const rng = createRng(`${seed}:bots`);
    const mem = new Map<string, GpBotMemory>(
      world.cars.filter((c) => c.bot).map((c, i) => [c.id, newGpBotMemory(0.83 + ((i * 37) % 13) / 100)]),
    );

    // ---- a cena (refeita quando a qualidade muda) ----
    let ro: ResizeObserver | null = null;
    const makeScene = () => {
      ro?.disconnect();
      sceneRef.current?.dispose();
      const reduced =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const scene = new GpScene(el, world, meId, { reduced, quality: qualityRef.current });
      scene.setCamMode(read(CAM_KEY, CAMS, 'far'));
      sceneRef.current = scene;
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
    gpSfx.engine.start();

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
    let note = '';
    let noteUntil = 0;
    let lastCount = 9;
    let started = false;
    let qstartShown = false;
    let wantLap = false;
    let autoMem: GpBotMemory | null = null;
    // medidas de fluidez (só no desenvolvimento): quadros, o maior intervalo, saltos e vai-e-volta do carro em foco
    const stats = { frames: 0, slow: 0, maxDt: 0, backs: 0, maxJump: 0, laps: 0 };
    let lastPose: GpPose | null = null;
    if (import.meta.env.DEV) (window as unknown as { __gpStats?: typeof stats }).__gpStats = stats;
    const sectorRow: Hud['sectors'] = [];
    const say = (text: string, ms = 2600) => {
      note = text;
      noteUntil = performance.now() + ms;
    };
    const others = () => world.cars.filter((c) => !c.gone && c.id !== meId);
    api.current = {
      next: (d) => {
        const list = others();
        if (list.length === 0) return;
        const i = list.findIndex((c) => c.id === focus);
        focus = list[(i + d + list.length) % list.length]!.id;
      },
      startLap: () => {
        if (stage === 'quali') wantLap = true;
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
    const targets = new Map<string, { x: number; z: number; h: number; speed: number; prog: number; at: number }>();
    const unsubs: (() => void)[] = [];
    if (spectator && online) {
      const idOfSlot = new Map(infos.map((p, i) => [i, p.id]));
      unsubs.push(
        subscribeRoom('pos', (m) => {
          if (!Array.isArray(m)) return;
          for (const row of m as number[][]) {
            const id = idOfSlot.get(row[0] as number);
            if (!id) continue;
            targets.set(id, { x: row[1]!, z: row[2]!, h: row[3]!, speed: row[4]!, prog: row[5]!, at: performance.now() });
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
          turbo: false,
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
          if (e >= GP_LIGHTS * GP_LIGHT_SEC + GP_LIGHTS_HOLD) return { st: 'race', target: 0, count: 0, lit: 0 };
          return { st: 'lights', target: 0, count: 0, lit: Math.min(GP_LIGHTS, Math.floor(e / GP_LIGHT_SEC) + 1) };
        }
        return { st: stage, target: 0, count: 0, lit: 0 };
      }
      const l = liveRef.current;
      const gn = gameNow();
      if (!l || l.stage === null || l.qualiAt === null) return { st: 'count', target: 0, count: 3, lit: 0 };
      if (l.stage === 'quali') {
        const left = (l.qualiAt - serverNow()) / 1000;
        if (left > 0) return { st: 'count', target: 0, count: Math.ceil(left - 0.2), lit: 0 };
        return { st: 'quali', target: (gn - l.qualiAt) / 1000, count: 0, lit: 0 };
      }
      const raceAt = l.raceAt ?? gn;
      if (gn < raceAt - GP_ROOM_LIGHTS_MS) return { st: 'grid', target: 0, count: 0, lit: 0 };
      if (gn < raceAt) {
        const e = (gn - (raceAt - GP_ROOM_LIGHTS_MS)) / 1000;
        return { st: 'lights', target: 0, count: 0, lit: Math.min(GP_LIGHTS, Math.floor(e / GP_LIGHT_SEC) + 1) };
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
          color: css(c?.color ?? 0xff7d26),
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
        if (e.type === 'qstart' && mine) {
          if (!qstartShown) {
            qstartShown = true;
            gpSfx.go();
            setLapFlash((n) => n + 1);
          }
        } else if (e.type === 'qtime' && mine) {
          gpSfx.lap(true);
          say(`Seu tempo: ${lapClock(e.ms)}`, 4000);
        } else if (e.type === 'sector' && e.id === focus) {
          const overall = world.cars.every((c) => c.id === e.id || (c.bestSectors[e.sector] ?? Infinity) >= e.ms);
          if (e.sector === 0) sectorRow.length = 0;
          sectorRow[e.sector] = { ms: e.ms, kind: overall && e.best ? 'best' : e.best ? 'pb' : 'slow' };
        } else if (e.type === 'lap' && mine) {
          const c = me();
          gpSfx.lap(c?.bestLap === e.ms);
          if (e.lap < GP_LAPS) say(`Volta ${e.lap}: ${lapClock(e.ms)}${c?.bestLap === e.ms ? ' · melhor volta' : ''}`);
        } else if (e.type === 'finish' && mine) {
          gpSfx.finish(e.place);
          say(`Você terminou em ${e.place}º! Agora assista os outros.`, 5000);
          controls.enabled = false;
          const list = others().filter((o) => !o.finished);
          if (list[0]) focus = list[0].id;
        } else if (e.type === 'turbo' && mine) gpSfx.turbo();
        else if (e.type === 'ready' && mine) {
          gpSfx.ready();
          say(touchDevice ? 'Turbo pronto: toque em Turbo' : 'Turbo pronto: aperte Espaço');
        } else if (e.type === 'pitin' && mine) gpSfx.pitIn();
        else if (e.type === 'pitout' && mine) {
          gpSfx.pitOut();
          say('Pneus novos!', 2000);
        } else if (e.type === 'cut' && e.id === focus && import.meta.env.DEV && !mine) {
          lastPose = null;
        } else if (e.type === 'cut' && mine) {
          // a volta ao último ponto válido é um salto de verdade: não conta como tranco do desenho
          lastPose = null;
          gpSfx.cut();
          say('Cortou caminho: de volta ao último ponto válido');
        } else if (e.type === 'wall' && mine && !fromHost) gpSfx.wall();
        else if (e.type === 'bump' && (e.a === meId || e.b === meId) && !fromHost) gpSfx.bump(true);
        else if (e.type === 'pass' && mine) {
          gpSfx.pass();
          say('Ultrapassagem com o turbo!', 1800);
        }
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
          if (c) sendRoom('gfin', { id: e.id, ms: e.ms, laps: c.laps, passes: c.passes });
        } else if (e.type === 'pass') {
          const c = world.car(e.id);
          if (c) sendRoomQuiet('gstat', { id: e.id, passes: c.passes });
        }
      }
    };

    setHud(initialHud());

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = where(now);
      // ---- troca de fase ----
      const enter = (next: Stage) => {
        if (next === 'quali') {
          gpSfx.go();
          say(
            touchDevice
              ? 'Aqueça os pneus e toque em Iniciar volta quando estiver pronto.'
              : 'Aqueça os pneus e aperte L (ou cruze a linha) para começar a volta lançada.',
            5000,
          );
          setWipe({ key: Date.now(), text: 'Classificação' });
        }
        if ((next === 'grid' || next === 'lights' || next === 'race') && world.phase !== 'race') {
          startRace();
          setWipe({ key: Date.now(), text: 'Grid de largada' });
        }
        if (next === 'grid') gridUntil = now + GRID_SEC * 1000;
        if (next === 'lights') {
          lightsAt = now;
          litShown = -1;
        }
        if (next === 'race') {
          sceneRef.current?.setLights(GP_LIGHTS, true);
          gpSfx.go();
          say('Valendo!', 1400);
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
            for (const [id, ms] of Object.entries(l.finish)) if (id !== meId) world.applyFinish(id, ms);
        }
        if (spectator) driveSpectator(dt, now);
        // líder: o relógio é o da sala; treino e convidado: o do aparelho
        if (isHost) acc = Math.min(Math.max(0, w.target - world.t), 1);
        else if (!menuRef.current || online) acc += dt;
        const mine = me();
        let input: GpInput =
          mine && (!menuRef.current || online) ? controls.read(dt) : { throttle: 0, brake: 0, steer: 0, turbo: false };
        // só no desenvolvimento: piloto automático no seu carro (os testes de tela medem a fluidez com ele)
        if (import.meta.env.DEV && mine && (window as unknown as { __gpAuto?: boolean }).__gpAuto) {
          if (!autoMem) autoMem = newGpBotMemory(0.9);
          input = gpBotInput(world, mine, autoMem, rng);
          if (stage === 'quali' && mine.qualiStartT === null && mine.surface !== 'pit') input.lap = true;
        }
        if (wantLap) {
          input.lap = true;
          wantLap = false;
        }
        let first = true;
        while (acc >= GP_DT) {
          acc -= GP_DT;
          const stepIn: GpInput = first ? input : { ...input, turbo: false, lap: false };
          first = false;
          if (isHost && host) {
            host.step(stepIn);
            if (host.snapDue) hostLink?.sendSnapshot(host.snapshot());
          } else if (client) {
            peerLink?.sendInput(client.local(stepIn));
          } else if (!online) {
            const inputs: Record<string, GpInput> = { me: stepIn };
            for (const c of world.cars) if (c.bot) inputs[c.id] = gpBotInput(world, c, mem.get(c.id)!, rng);
            world.step(GP_DT, inputs);
          }
          remember();
        }
        if (input.turbo) controls.takeTurbo();
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
                  (c.turbo > 0 ? 1 : 0) + (c.surface === 'pit' ? 2 : 0),
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
            .filter((e) => e.type === 'qstart' || e.type === 'wall' || e.type === 'bump');
          if (ev.length) onEvents(ev);
        } else {
          const ev = world.drainEvents();
          if (ev.length) onEvents(ev);
        }
      }
      // o motor do seu carro (ou de quem você assiste)
      const heard = world.car(focus);
      if (heard) {
        const v = Math.abs(heard.speed);
        gpSfx.engine.update(Math.max(0, Math.min(1, heard.rpm)), heard.braking ? 0 : Math.min(1, v / 8), heard.turbo > 0);
      }
      sceneRef.current?.render(dt, focus, pose);
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
        const topPass = [...world.cars].sort((a, b) => b.passes - a.passes)[0];
        setExtra({
          fastest: fastest ? `${world.car(fastest.id)?.name ?? ''} · ${lapClock(fastest.ms)}` : '—',
          passes: topPass && topPass.passes > 0 ? `${topPass.name} · ${topPass.passes}` : 'ninguém',
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
                passes: r.car.passes,
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

      // ---- HUD ----
      if (now - hudAt > 110) {
        hudAt = now;
        if (note && now > noteUntil) note = '';
        const c = me();
        const seen = world.car(focus) ?? c;
        const st = world.standings();
        const myRow = st.find((r) => r.car.id === (c ? meId : focus));
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
          gear: gpGear(seen?.speed ?? 0),
          rpm: seen?.rpm ?? 0,
          bar: c?.bar ?? 0,
          turbo: (c?.turbo ?? 0) > 0,
          wear: c?.wear ?? 0,
          pit: c?.pitHold ?? 0,
          inPitLane: c?.surface === 'pit',
          rows: st.map((r) => ({
            id: r.car.id,
            name: r.car.name,
            color: css(r.car.color),
            gap: r.car.gone
              ? 'fora'
              : world.phase === 'quali'
                ? r.car.qualiMs !== null
                  ? lapClock(r.car.qualiMs)
                  : 'sem tempo'
                : r.pos === 1
                  ? 'Líder'
                  : gapText(r.gap),
            you: r.car.id === meId,
            done: r.car.finished,
            out: r.car.gone || r.car.dnf,
          })),
          note,
          qualiLeft: Math.max(0, GP_QUALI_MAX_SEC - (world.phase === 'quali' ? world.t : 0)),
          qualiMs: c?.qualiMs ?? null,
          qualiRun: c?.qualiStartT != null && c.qualiMs === null ? Math.max(0, (world.t - c.qualiStartT) * 1000) : null,
          qualiStarted: c?.qualiStartT != null,
          pole,
          sectors: [...sectorRow],
          done: c?.finished ? (st.find((r) => r.car.id === meId)?.pos ?? null) : null,
          dnfLeft,
          watching: focus !== meId ? (world.car(focus)?.name ?? '') : '',
          grid: gridShown,
          net,
        });
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
  }, [bots, color, paint, controls, online, touchDevice]);

  const pad = (k: 'gas' | 'brake' | 'left' | 'right') => ({
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
  const turboSegs = 8;
  const turboLit = h ? (h.turbo ? turboSegs : Math.floor(h.bar * turboSegs)) : 0;
  return (
    <div className="gp-play" data-testid="gp-play" data-touch={touchDevice ? '1' : '0'} data-cam={cam}>
      <canvas ref={canvas} className="gp-canvas" aria-label="Pista do Fox GP" />
      {h && (
        <>
          {/* posição, volta e tempo (em cima, à esquerda) */}
          <div className="gpx-tl">
            {racing || h.stage === 'grid' || h.stage === 'lights' ? (
              <>
                <div className="gpx-box gpx-pos" role="status" data-testid="gp-pos">
                  <b>P{h.pos || '-'}</b>
                  <span>/{h.total}</span>
                </div>
                <div className="gpx-box gpx-cell" data-testid="gp-lap">
                  <small>Volta</small>
                  <b>
                    {h.lap}
                    <span>/{GP_LAPS}</span>
                  </b>
                </div>
                <div className="gpx-box gpx-cell">
                  <small>Tempo</small>
                  <b className="gpn">{raceClock(h.raceMs)}</b>
                </div>
                <div className="gpx-box gpx-cell is-wide">
                  <small>Melhor · Δ última</small>
                  <b className="gpn is-small">
                    {h.best !== null ? lapClock(h.best) : '--:--.---'}
                    <span>
                      {' · '}
                      {h.last !== null && h.best !== null ? (h.last === h.best ? 'melhor' : gapText((h.last - h.best) / 1000)) : '--'}
                    </span>
                  </b>
                </div>
              </>
            ) : (
              <>
                <div className="gpx-box gpx-cell" role="status">
                  <small>Classificação</small>
                  <b className="gpn">{Math.ceil(h.qualiLeft)}s</b>
                </div>
                <div className={`gpx-box gpx-cell is-wide${h.qualiRun !== null ? ' is-live' : ''}`} data-testid="gp-qtime">
                  <small>{h.qualiMs !== null ? 'Seu tempo' : h.qualiStarted ? 'Volta lançada' : 'Aquecendo'}</small>
                  <b className="gpn">
                    {h.qualiMs !== null ? lapClock(h.qualiMs) : h.qualiRun !== null ? lapClock(h.qualiRun) : '--:--.---'}
                  </b>
                </div>
                {h.qualiMs !== null && h.pole !== null && (
                  <div className="gpx-box gpx-cell">
                    <small>Δ pole</small>
                    <b className="gpn is-small">{h.qualiMs === h.pole ? 'Pole' : gapText((h.qualiMs - h.pole) / 1000)}</b>
                  </div>
                )}
              </>
            )}
            {h.sectors.length > 0 && (
              <div className="gpx-sectors" aria-label="Setores da volta">
                {[0, 1, 2].map((i) => {
                  const s = h.sectors[i];
                  return (
                    <span key={i} className={`gpx-sector${s ? ` is-${s.kind}` : ''}`}>
                      S{i + 1}
                      {s && <b className="gpn">{(s.ms / 1000).toFixed(2)}</b>}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="gpx-tools">
            <button type="button" className="gpx-tool" onClick={cycleCam} data-testid="gp-cam" aria-label={`Câmera: ${CAM_NAME[cam]}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M3 7h4l2-3h6l2 3h4v13H3z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>{CAM_NAME[cam]}</span>
            </button>
            <button type="button" className="gpx-tool" onClick={() => setMenu(true)} data-testid="gp-menu-btn" aria-label="Abrir o menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              <span>Menu</span>
            </button>
          </div>

          {(racing || quali) && h.rows.length > 1 && (
            <ol className="gpx-board" aria-label="Classificação ao vivo" data-testid="gp-board">
              <li className="gpx-board-h">{quali ? 'Tempos' : 'Classificação'}</li>
              {h.rows.map((r, i) => (
                <li key={r.id} className={`${r.you ? 'is-you' : ''}${r.out ? ' is-out' : ''}`}>
                  <span className="gpx-board-pos">{i + 1}</span>
                  <i style={{ background: r.color }} aria-hidden="true" />
                  <span className="gpx-board-name">{r.you ? 'Você' : r.name}</span>
                  <span className="gpx-board-gap gpn">{r.done ? 'chegou' : r.gap}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="gpx-mini">
            <canvas ref={mini} width={300} height={240} role="img" aria-label="Minimapa do circuito com a posição dos carros" />
          </div>

          {driving && (
            <div className="gpx-turbo" data-full={h.bar >= 1 ? '1' : '0'} data-on={h.turbo ? '1' : '0'} data-testid="gp-dash">
              <div className="gpx-turbo-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
                </svg>
                {h.turbo ? 'Turbo!' : h.bar >= 1 ? 'Turbo da cauda pronto' : 'Turbo da cauda'}
              </div>
              <div className="gpx-segs" aria-hidden="true">
                {Array.from({ length: turboSegs }, (_, i) => (
                  <i key={i} className={i < turboLit ? 'is-on' : ''} />
                ))}
              </div>
            </div>
          )}

          {driving && (
            <div className="gpx-speed">
              <div className="gpx-speed-top">
                <small>Velocidade</small>
                <div className="gpx-gear">
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
              <div className="gpx-tyre" data-low={h.wear > 0.7 ? '1' : '0'}>
                <small>Pneus {Math.round((1 - h.wear) * 100)}%</small>
                <span>
                  <i style={{ transform: `scaleX(${1 - h.wear})` }} />
                </span>
              </div>
            </div>
          )}

          {quali && !h.qualiStarted && h.qualiMs === null && !h.inPitLane && (
            <button type="button" className="gpx-startlap gp-tbtn is-primary" onClick={() => api.current?.startLap()} data-testid="gp-startlap">
              Iniciar volta {!touchDevice && <kbd>L</kbd>}
            </button>
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
                <small>Circuito da Marina</small>
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
          {h.stage === 'lights' && (
            <div className="gpx-lights" aria-label={`${h.lit} luzes acesas`} data-testid="gp-lights">
              {Array.from({ length: GP_LIGHTS }, (_, i) => (
                <i key={i} className={i < h.lit ? 'is-on' : ''} />
              ))}
            </div>
          )}
          {lapFlash > 0 && (
            <div className="gpx-lapflash" key={lapFlash} aria-live="polite" data-testid="gp-lapflash">
              <span className="gpx-lapflash-bar gp-checker" />
              <small>Classificação</small>
              <b>Volta lançada</b>
              <span className="gpx-lapflash-go">Valendo o tempo</span>
            </div>
          )}
          {h.note && h.stage !== 'count' && <div className="gpx-note">{h.note}</div>}
          {h.dnfLeft !== null && h.done === null && racing && (
            <div className="gpx-dnf" role="status">
              O primeiro já chegou: <b>{Math.ceil(h.dnfLeft)}s</b> para cruzar a linha
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
          {h.inPitLane && h.pit <= 0 && driving && <div className="gpx-pitlane">Faixa do box · velocidade limitada</div>}

          {(h.done !== null || h.watching) && !result && (
            <div className="gpx-spec">
              <button type="button" onClick={() => api.current?.next(-1)} aria-label="Carro anterior">
                ‹
              </button>
              <span>
                {h.done !== null ? `Você chegou em ${h.done}º · ` : ''}Assistindo <b>{h.watching || '...'}</b>
              </span>
              <button type="button" onClick={() => api.current?.next(1)} aria-label="Próximo carro">
                ›
              </button>
            </div>
          )}

          {touchDevice && driving && (
            <div className="gp-pads">
              <div className="gp-pads-l">
                <button type="button" className="gp-pad" aria-label="Virar para a esquerda" {...pad('left')}>
                  ‹
                </button>
                <button type="button" className="gp-pad" aria-label="Virar para a direita" {...pad('right')}>
                  ›
                </button>
              </div>
              <div className="gp-pads-r">
                <button
                  type="button"
                  className="gp-pad is-turbo"
                  data-ready={h.bar >= 1 ? '1' : '0'}
                  aria-label="Turbo"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    controls.pressTurbo();
                  }}
                >
                  Turbo
                </button>
                <button type="button" className="gp-pad is-brake" aria-label="Frear" {...pad('brake')}>
                  Freio
                </button>
                <button type="button" className="gp-pad is-gas" aria-label="Acelerar" {...pad('gas')}>
                  Acelera
                </button>
              </div>
            </div>
          )}
          {online && showNet && !result && <NetBadge mode={h.net} items={[{ text: `${ping} ms`, title: 'ida e volta' }]} />}
        </>
      )}
      <GpWipe key={wipe.key} text={wipe.text} />
      {!result && <RotateHint />}
      {h?.stage === 'count' && !result && (
        <GameTips storageKey={TIPS_KEY} rows={tipRows(touchDevice)} testId="gp-tips" markOnShow />
      )}
      <GameChat enabled={!!online && !result} />
      {online && !result && <PauseOverlay />}
      {menu && !result && (
        <GameMenu
          title="Menu"
          testPrefix="gp-menu"
          tipsKey={TIPS_KEY}
          tips={tipRows(touchDevice)}
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
          endMatch={{ label: 'Encerrar a partida', onClick: () => sendRoom('gend'), testId: 'gp-menu-end' }}
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
          ]}
        />
      )}
      {result && !online && (
        <GpFinal rows={result} fastest={extra?.fastest ?? '—'} passes={extra?.passes ?? '—'} mode={{ kind: 'training', onAgain, onExit }} />
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
    gear: 1,
    rpm: 0,
    bar: 0,
    turbo: false,
    wear: 0,
    pit: 0,
    inPitLane: false,
    rows: [],
    note: '',
    qualiLeft: GP_QUALI_MAX_SEC,
    qualiMs: null,
    qualiRun: null,
    qualiStarted: false,
    pole: null,
    sectors: [],
    done: null,
    dnfLeft: null,
    watching: '',
    grid: [],
    net: '',
  };
}
