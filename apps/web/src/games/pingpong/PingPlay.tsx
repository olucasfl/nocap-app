import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PP_BOT_LEVELS,
  PP_TICK,
  PpBot,
  PpMatch,
  PpNetSim,
  createRng,
  ppIdleInput,
  PP_PAD_X,
  PP_PAD_Z,
  PP_REACH_NET,
  PP_REACH_BACK,
  PP_REST_Y,
  ppPadStepZ,
  ppParseNetEvent,
  ppPredictCross,
  type PpBotName,
  type PpEvent,
  type PpInput,
  type PpTimedEvent,
} from '@nocap/games';
import { GameChat } from '@/components/GameChat';
import { PauseOverlay } from '@/components/PauseOverlay';
import { GameMenu, GearButton, Keycap, NetBadge } from '@/components/GameMenu';
import { IcFlag, IcTable } from '@/games/bola/BolaIcons';
import { GameTips, type TipRow } from '@/components/GameTips';
import { RotateHint } from '@/components/RotateHint';
import { pingSfx } from '@/lib/ping-audio';
import { BUILD_ID } from '@/lib/build-id';
import {
  currentRtt,
  getGuestNickname,
  sendRoom,
  sendRoomQuiet,
  serverNow,
  pausedMs,
  subscribeRoom,
  useMeId,
  useRoom,
} from '@/lib/rooms';
import { useAuth } from '@/lib/auth';
import { PingPeer, type PingPeerMsg } from '@/lib/ping-p2p';
import { PingFinal, type PingStats } from './PingFinal';
import { PingScene } from './PingScene';
import './ping.css';

const TIPS_KEY = 'nocap-ping-tips';
const GUIDE_KEY = 'nocap-ping-guide';
const readGuide = (): boolean => {
  try {
    return localStorage.getItem(GUIDE_KEY) !== '0';
  } catch {
    return true;
  }
};

/** O nome de quem joga aqui: o da conta, o apelido da sala ou, na falta dos dois, "Você". */
function myDisplayName(online?: { me: number; names: [string, string] }): string {
  if (online && online.me >= 0) return online.names[online.me] ?? 'Você';
  return useAuth.getState().user?.username || getGuestNickname() || 'Você';
}

/** O nome do golpe que aparece junto da velocidade (o golpe comum não aparece). */
const STROKE_TAG: Record<string, string | undefined> = {
  drive: 'DRIVE',
  topspin: 'TOPSPIN',
  corte: 'CORTE',
  curva: 'CURVA',
  curta: 'CURTINHA',
  bloqueio: 'BLOQUEIO',
  lob: 'LOB',
  smash: 'SMASH',
  subida: 'MAL PEGADA',
};
const TIER_TAG = ['', 'SMASH FRACO', 'SMASH FORTE', 'SMASH PERFEITO'];

const tipRows = (touch: boolean): TipRow[] =>
  touch
    ? [
        {
          keys: <b className="gm-tag">Arraste</b>,
          text: 'Para os lados move a raquete; para a frente ela avança até a rede (parou, ela recolhe)',
        },
        {
          keys: <b className="gm-tag">Impulso</b>,
          text: 'A força da batida é a rapidez com que você joga a raquete para a frente; a direção é para onde você bate',
        },
        {
          keys: <b className="gm-tag">Golpes</b>,
          text: 'Devagar = corte; médio = topspin; muito rápido = drive; varrer para o lado = curva; bater perto da rede = curtinha; bola alta + forte = smash',
        },
        {
          keys: <b className="gm-tag">Defesa</b>,
          text: 'Contra uma bola forte, deixe a raquete mansa: bloqueio. Recuada (para trás) a bola sobe em lob',
        },
        {
          keys: <b className="gm-tag">Smash</b>,
          text: 'Se uma bola forte pegar na borda da raquete, ela sobe e o jogo vai em câmera lenta: quem recebe aperta na hora em que a barra passa pelo verde para dar um smash',
        },
        {
          keys: <b className="gm-tag">Saque</b>,
          text: 'Clique (ou toque) para lançar a bola e bata nela com a raquete na descida',
        },
      ]
    : [
        {
          keys: <b className="gm-tag">Mouse</b>,
          text: 'A raquete anda com o mouse, até a rede e para trás. O cursor fica preso no jogo: Esc solta e abre o menu',
        },
        {
          keys: <b className="gm-tag">Impulso</b>,
          text: 'A força da batida é a rapidez com que você leva o mouse para a frente; a direção é para onde você bate',
        },
        {
          keys: <b className="gm-tag">Golpes</b>,
          text: 'Devagar = corte; médio = topspin; muito rápido = drive; varrer para o lado = curva; bater perto da rede = curtinha; bola alta + forte = smash',
        },
        {
          keys: <b className="gm-tag">Defesa</b>,
          text: 'Contra uma bola forte, deixe a raquete mansa: bloqueio. Recuada (para trás) a bola sobe em lob',
        },
        {
          keys: <b className="gm-tag">Smash</b>,
          text: 'Se uma bola forte pegar na borda da raquete, ela sobe e o jogo vai em câmera lenta: quem recebe aperta na hora em que a barra passa pelo verde para dar um smash',
        },
        {
          keys: <b className="gm-tag">Saque</b>,
          text: 'A bola fica parada na sua frente: jogue a raquete para a frente e bata nela',
        },
        { keys: <Keycap k="Esc" touchHide={false} />, text: 'Menu' },
      ];

interface Hud {
  phase: 'ready' | 'play' | 'over';
  count: number;
  score: [number, number];
  server: number;
  rally: number;
  matchPhase: string;
  banner: { text: string; sub?: string; id: number; tone: 'win' | 'lose' | 'info' } | null;
  speed: { kmh: number; id: number; mine: boolean; tag?: string } | null;
  /** Bola mal pegada: câmera lenta (todos veem) e, para quem recebe, a barra do smash (`on`) e o nível já apertado. */
  slow: boolean;
  smash: { on: boolean; tier: number };
  /** Onde o adversário apertou o smash dele (some sozinho). */
  oppTap: { tier: number; id: number } | null;
}

const BOT_NAMES: Record<PpBotName, string> = {
  facil: 'Raposa Fácil',
  medio: 'Raposa Média',
  dificil: 'Raposa Difícil',
};
const BOT_COLORS: Record<PpBotName, number> = {
  facil: 0x6fd3a0,
  medio: 0xff9bd0,
  dificil: 0x9a6bff,
};

/** A partida em sala: quem joga (0 ou 1; -1 assiste), quem saca primeiro e a hora da largada no relógio da sala. */
export interface PingOnline {
  me: number;
  firstServer: number;
  startAt: number;
  names: [string, string];
  colors: [number, number];
  /** Quem joga em cada vaga (para abrir o canal direto com o outro aparelho). */
  ids?: [string, string];
}

/** Quantos ticks (200 ms) um ponto espera antes de aparecer: uma batida atrasada ainda pode desfazê-lo. */
const POINT_GRACE = 12;
/** O nome do saque pela altura em que a bola foi batida (a qualidade do saque vem da altura). */
const SERVE_TAG: Record<string, string> = {
  sweet: 'SAQUE PERFEITO',
  normal: 'SAQUE BOM',
  edge: 'SAQUE ALTO',
};
/** Quanto o dedo pode se mexer (px) e ainda valer como toque para lançar a bola. */
const TAP_SLOP = 26;
/** Dedo parado por este tempo (ms) no começo do saque lança a bola sem soltar. */
const HOLD_LAUNCH_MS = 220;
const GAUGE_TOP = 3;
const GAUGE_BOTTOM = 1.2;

/**
 * Uma partida do Ping Fox!: contra um bot (treino, `level`) ou em sala (`online`). Roda o motor num passo fixo de 60 Hz
 * e desenha com interpolação. Na sala a partida é a mesma `PpNetSim` da sala: só as batidas e os saques viajam.
 */
export function PingPlay({
  level = 'medio',
  online,
  onExit,
  onAgain,
  onOfflineInvite,
}: {
  level?: PpBotName;
  online?: PingOnline;
  onExit: () => void;
  onAgain?: () => void;
  onOfflineInvite?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<Hud>({
    phase: 'ready',
    count: 3,
    score: [0, 0],
    server: 0,
    rally: 0,
    matchPhase: 'serve',
    slow: false,
    smash: { on: false, tier: 0 },
    oppTap: null,
    banner: null,
    speed: null,
  });
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(false);
  const sceneRef = useRef<PingScene | null>(null);
  const gaugeRef = useRef<HTMLElement | null>(null);
  const gaugeBoxRef = useRef<HTMLDivElement | null>(null);
  const oppBarRef = useRef<HTMLDivElement | null>(null);
  const oppCurRef = useRef<HTMLSpanElement | null>(null);
  const [guide, setGuide] = useState(readGuide);
  // só o líder da sala encerra a partida
  const myUserId = useMeId();
  const hostId = useRoom((s) => s.snapshot?.hostId);
  const isLeader = !!online && !!myUserId && hostId === myUserId;
  // painel de rede e fps (desligado por padrão; liga no menu)
  const [showNet, setShowNet] = useState(() => {
    try {
      return localStorage.getItem('nocap-ping-net') === '1';
    } catch {
      return false;
    }
  });
  const toggleNet = () =>
    setShowNet((v) => {
      try {
        localStorage.setItem('nocap-ping-net', v ? '0' : '1');
      } catch {
        /* sem armazenamento: vale só nesta partida */
      }
      return !v;
    });
  const showNetRef = useRef(showNet);
  showNetRef.current = showNet;
  /** O que o painel mostra (atualizado duas vezes por segundo só com o painel ligado). */
  const [netInfo, setNetInfo] = useState({
    fps: 0,
    ping: 0,
    direct: false,
    late: 0,
    lateMax: 0,
    fixes: 0,
    rejected: 0,
  });
  /** Contas da rede, escritas pela partida e lidas pelo painel. */
  const netStats = useRef({
    frames: 0,
    late: [] as { at: number; ms: number }[],
    rejected: 0,
    peer: null as { open: boolean } | null,
  });
  const lockTriedRef = useRef(false);
  const [locked, setLocked] = useState(false);
  /** O navegador não prendeu o cursor (ou a pessoa não quer): o aviso some e o mouse funciona solto. */
  const [lockFailed, setLockFailed] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  menuRef.current = menu;
  const [result, setResult] = useState<{
    winner: number;
    score: [number, number];
    stats: PingStats;
  } | null>(null);
  const touchDevice = useMemo(
    () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    [],
  );
  // o cursor só fica preso durante a partida: no menu, nos comandos do começo e na tela do fim ele volta a aparecer
  useEffect(() => {
    if ((menu || result || hud.phase !== 'play') && document.pointerLockElement)
      document.exitPointerLock?.();
    // depois do menu (ou do fim), o primeiro clique volta a só prender o cursor
    if (menu || result) lockTriedRef.current = false;
  }, [menu, result, hud.phase]);
  const closeMenu = () => setMenu(false);

  useEffect(() => {
    const cv = canvas.current;
    const zn = zone.current;
    if (!cv || !zn) return undefined;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seed = crypto.randomUUID();
    const rng = createRng(seed);
    // treino: a partida e o bot ficam aqui; sala: a `PpNetSim` é a mesma da sala e só as batidas viajam
    const net = online ? new PpNetSim(online.firstServer, online.me) : null;
    const match = net ? net.match : new PpMatch(rng() < 0.5 ? 0 : 1);
    const bot = net ? null : new PpBot(PP_BOT_LEVELS[level], rng);
    /** Quem sou eu na partida (quem assiste vê a mesa como o jogador 0). */
    const myIdx = online ? Math.max(0, online.me) : 0;
    const oppIdx = 1 - myIdx;
    const spectator = !!online && online.me < 0;
    const oppName = online ? (online.names[oppIdx] ?? 'Adversário') : BOT_NAMES[level];
    const myName = myDisplayName(online);
    const scene = new PingScene(cv, match, {
      oppColor: online ? (online.colors[oppIdx] ?? 0x9a6bff) : BOT_COLORS[level],
      oppName,
      reduced,
      me: myIdx,
    });

    sceneRef.current = scene;
    scene.setGuide(readGuide());
    const me: PpInput = { ...ppIdleInput(), manual: false };
    // controle: x pela mão; z (alcance, de volta até a rede) pelo movimento "para a frente" da mão
    let zt = 0;
    let pointerDown = false;
    // o toque que pode virar saque: onde começou e se já arrastou
    let tap: { x: number; y: number; t: number; launched: boolean; moved: boolean } | null = null;
    const clampZ = (v: number) => Math.max(-PP_REACH_BACK, Math.min(PP_REACH_NET, v));
    const keys = { l: false, r: false, u: false, d: false };
    let ready = 3;
    const readyAt = performance.now();
    let phase: Hud['phase'] = 'ready';
    let acc = 0;
    let slow = 1;
    let slowUntil = 0;
    let bannerId = 0;
    let speedId = 0;
    const stats: PingStats = {
      seconds: 0,
      longest: 0,
      fastest: 0,
      smashes: 0,
      points: [0, 0],
      hits: [0, 0],
    };
    let finished = false;

    // ---- entrada: a raquete fica sempre embaixo do dedo (ou do mouse): o ponto tocado, projetado na altura da raquete,
    // é para onde ela vai (x para os lados, z para a frente/trás). A força da batida é o impulso do avanço; a direção,
    // para onde a mão vai ----
    // saque: o clique (ou toque, ou Espaço) lança a bola para cima e a raquetada na descida é o saque
    // quadros em que o saque fica apertado: contado em quadros (e não em milissegundos) para um quadro lento não perder o toque
    let serveFrames = 0;
    const canServe = () =>
      !spectator &&
      phase === 'play' &&
      !finished &&
      match.phase === 'serve' &&
      match.server === myIdx;
    const triggerServe = () => {
      if (canServe()) serveFrames = 2;
    };
    let primaryId: number | null = null;
    // bola mal pegada: quem recebe aperta (mouse, outro dedo, toque ou Espaço) e o nível vem de onde a barra está
    const smashWindow = () =>
      !spectator && phase === 'play' && !finished && match.popup && match.expect === myIdx;
    let tapValue = -1;
    const tapSmash = () => {
      if (!smashWindow()) return false;
      const c = match.smashCursor();
      const tier = match.smashTap(myIdx);
      if (tier > 0) {
        tapValue = c;
        pingSfx.toss();
        if ('vibrate' in navigator) navigator.vibrate?.(14);
        setHud((h) => ({ ...h, smash: { on: true, tier } }));
      }
      return true;
    };
    const aim = (e: PointerEvent) => {
      const r = zn.getBoundingClientRect();
      const p = scene.pointerToTable(
        (e.clientX - r.left) / r.width,
        (e.clientY - r.top) / r.height,
        PP_REST_Y,
      );
      me.x = Math.max(-PP_PAD_X, Math.min(PP_PAD_X, scene.simX(p.x)));
      zt = clampZ(PP_PAD_Z - p.z);
      pointerDown = true;
    };
    const primaryAlive = (): boolean => {
      if (primaryId === null) return false;
      try {
        return zn.hasPointerCapture(primaryId);
      } catch {
        return false;
      }
    };
    // volta ao estado de "ninguém tocando": o toque que a raquete seguia acabou (ou nunca avisou que acabou)
    const resetPointers = () => {
      pointerDown = false;
      primaryId = null;
      tap = null;
      serveFrames = 0;
    };
    const onDown = (e: PointerEvent) => {
      if (menuRef.current) return;
      // com o cursor preso o navegador pode recusar a captura: isso não pode impedir o saque
      try {
        zn.setPointerCapture?.(e.pointerId);
      } catch {
        /* sem captura */
      }
      tapSmash();
      // outro dedo (o que aperta o smash) não leva a raquete: só o primeiro dedo mexe nela
      // o dedo que mexia a raquete pode ter sumido sem avisar (o app foi para o segundo plano): sem a captura dele, o
      // dedo novo assume a raquete
      if (primaryId !== null && !primaryAlive()) resetPointers();
      if (e.pointerType !== 'mouse' && primaryId !== null && e.pointerId !== primaryId) return;
      primaryId = e.pointerId;
      // com o cursor preso o ponteiro não diz onde a raquete está: o clique não mexe nela
      if (!(e.pointerType === 'mouse' && document.pointerLockElement === zn)) aim(e);
      // mouse: o primeiro clique prende o cursor no jogo (ele não sai da tela no meio da batida); Esc solta e abre o menu
      if (
        e.pointerType === 'mouse' &&
        e.isTrusted &&
        phase === 'play' &&
        !finished &&
        typeof zn.requestPointerLock === 'function' &&
        !lockTriedRef.current &&
        document.pointerLockElement !== zn
      ) {
        // só a primeira vez: se o navegador não prender o cursor, o clique seguinte já saca (não fica preso nesse passo)
        lockTriedRef.current = true;
        window.setTimeout(() => {
          if (document.pointerLockElement !== zn) setLockFailed(true);
        }, 500);
        try {
          void (zn.requestPointerLock() as Promise<void> | undefined)?.catch?.(() => undefined);
        } catch {
          /* sem suporte: o mouse segue absoluto */
        }
        return;
      }
      // dedo: arrastar leva a raquete para outro lugar; só um toque (soltar sem arrastar) lança a bola
      if (e.pointerType !== 'mouse') {
        // a hora do próprio evento (não a do processamento): um quadro lento não pode transformar o toque em "toque longo"
        tap = { x: e.clientX, y: e.clientY, t: e.timeStamp, launched: false, moved: false };
        // dedo pousado e parado: a bola sobe e o dedo continua na raquete (não precisa soltar); arrastar antes disso só
        // reposiciona
        const mine = tap;
        window.setTimeout(() => {
          if (tap === mine && !mine.launched && !mine.moved && canServe()) {
            mine.launched = true;
            triggerServe();
          }
        }, HOLD_LAUNCH_MS);
        return;
      }
      triggerServe();
    };
    const onMove = (e: PointerEvent) => {
      if (menuRef.current) return;
      if (e.pointerType !== 'mouse' && (!pointerDown || e.pointerId !== primaryId)) return;
      // arrastou antes de a bola subir: é reposicionar a raquete, não lançar
      if (tap && !tap.launched && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_SLOP)
        tap.moved = true;
      if (e.pointerType === 'mouse' && document.pointerLockElement === zn) {
        // cursor preso: a raquete anda o que o mouse andou (cada pixel vira uma fração de metro)
        me.x = Math.max(-PP_PAD_X, Math.min(PP_PAD_X, me.x + scene.simX(e.movementX * 0.0125)));
        zt = clampZ(zt - e.movementY * 0.0145);
        return;
      }
      aim(e);
    };
    // soltar o cursor (Esc) no meio da partida abre o menu; abrir o menu solta o cursor
    let wasLocked = false;
    const onLockChange = () => {
      const locked = document.pointerLockElement === zn;
      if (wasLocked && !locked && !menuRef.current && !finished && phase === 'play') setMenu(true);
      if (locked) setLockFailed(false);
      wasLocked = locked;
      setLocked(locked);
    };
    document.addEventListener('pointerlockchange', onLockChange);
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerId === primaryId) {
        const t = tap;
        tap = null;
        // toque = o dedo sobe perto de onde desceu (um tremidinha não conta); arrastar de verdade, não
        if (
          t &&
          !t.launched &&
          Math.hypot(e.clientX - t.x, e.clientY - t.y) <= TAP_SLOP &&
          e.timeStamp - t.t < 3000
        )
          triggerServe();
        pointerDown = false;
        primaryId = null;
      }
    };
    const onCtx = (e: Event) => e.preventDefault();
    // Segurar na tela abria a lupa/seleção do iOS: bloqueia o toque longo e a seleção.
    const onTouch = (e: TouchEvent) => e.preventDefault();
    zn.addEventListener('touchstart', onTouch, { passive: false });
    zn.addEventListener('selectstart', onCtx);
    zn.addEventListener('pointerdown', onDown);
    zn.addEventListener('pointermove', onMove);
    zn.addEventListener('pointerup', onUp);
    // iOS cancela o toque (e solta a captura) quando o app sai da tela ou outro app interrompe: sem isso a raquete
    // ficava esperando um dedo que não existe mais
    const onCancel = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerId === primaryId) resetPointers();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') resetPointers();
    };
    const onPageShow = () => resetPointers();
    zn.addEventListener('pointercancel', onCancel);
    zn.addEventListener('lostpointercapture', onCancel);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('blur', resetPointers);
    zn.addEventListener('contextmenu', onCtx);

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.key === 'Escape' && down && !e.repeat) {
        setMenu((v) => !v);
        return;
      }
      if (menuRef.current) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (down && !e.repeat) {
          tapSmash();
          triggerServe();
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') keys.l = down;
      else if (k === 'arrowright' || k === 'd') keys.r = down;
      else if (k === 'arrowup' || k === 'w') keys.u = down;
      else if (k === 'arrowdown' || k === 's') keys.d = down;
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const ro = new ResizeObserver(() => {
      const r = zn.getBoundingClientRect();
      scene.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    });
    ro.observe(zn);
    // girar o aparelho: o navegador demora a informar o tamanho novo, então confere de novo logo depois
    const remeasure = () => {
      for (const ms of [60, 300, 800]) {
        setTimeout(() => {
          const rr = zn.getBoundingClientRect();
          scene.resize(Math.max(1, Math.round(rr.width)), Math.max(1, Math.round(rr.height)));
        }, ms);
      }
    };
    window.addEventListener('orientationchange', remeasure);
    window.addEventListener('resize', remeasure);
    const r0 = zn.getBoundingClientRect();
    scene.resize(Math.max(1, Math.round(r0.width)), Math.max(1, Math.round(r0.height)));

    const react = (events: PpEvent[]) => {
      for (const e of events) {
        if (e.type === 'toss') pingSfx.toss();
        else if (e.type === 'hit') {
          const power = Math.max(0, Math.min(1, (e.kmh - 20) / 80));
          const mine = e.p === myIdx && !spectator;
          pingSfx.hit(power, e.smash, mine);
          stats.hits[e.p === 0 ? 0 : 1]++;
          if (e.smash && mine) stats.smashes++;
          if (e.tier > 0 && !mine) {
            const id = ++speedId;
            setHud((h) => ({ ...h, oppTap: { tier: e.tier, id } }));
            window.setTimeout(
              () => setHud((h) => (h.oppTap?.id === id ? { ...h, oppTap: null } : h)),
              1500,
            );
          }
          if (e.kmh > stats.fastest) stats.fastest = e.kmh;
          if (mine && 'vibrate' in navigator) navigator.vibrate?.(e.smash ? 18 : 8);
          setHud((h) => ({
            ...h,
            rally: match.rally,
            speed: {
              kmh: e.kmh,
              id: ++speedId,
              mine,
              tag:
                e.tier > 0
                  ? TIER_TAG[e.tier]
                  : e.smash
                    ? 'SMASH'
                    : e.serve
                      ? SERVE_TAG[e.quality]
                      : (STROKE_TAG[e.stroke] ?? (e.quality === 'sweet' ? 'PERFEITA' : undefined)),
            },
          }));
        } else if (e.type === 'bounce') pingSfx.bounce(e.impact);
        else if (e.type === 'net') pingSfx.net();
        else if (e.type === 'fault') {
          pingSfx.fault();
          const mine = e.p === myIdx && !spectator;
          setHud((h) => ({
            ...h,
            banner: {
              text: 'Falta de saque',
              sub: mine ? 'Mais uma e o ponto é dele' : 'Errou o saque',
              id: ++bannerId,
              tone: 'info',
            },
          }));
        } else if (e.type === 'point') {
          const won = e.winner === myIdx && !spectator;
          pingSfx.point(won);
          stats.points[e.winner === 0 ? 0 : 1]++;
          if (e.rally > stats.longest) stats.longest = e.rally;
          const near = Math.max(e.score[0], e.score[1]) >= 10;
          if (near && !reduced && !net) {
            slow = 0.35;
            slowUntil = performance.now() + 900;
          }
          const who = spectator
            ? (online?.names[e.winner === 0 ? 0 : 1] ?? '')
            : e.winner === myIdx
              ? myName
              : oppName;
          setHud((h) => ({
            ...h,
            score: e.score,
            rally: 0,
            banner: {
              text: `Ponto de ${who}`,
              sub: e.best > 0 ? `${e.best} km/h na melhor batida` : undefined,
              id: ++bannerId,
              tone: won ? 'win' : spectator ? 'info' : 'lose',
            },
          }));
        } else if (e.type === 'game') {
          pingSfx.win(e.winner === myIdx && !spectator);
          finished = true;
          // fim da partida: o cursor volta a aparecer (a tela do fim e os botões precisam dele)
          if (document.pointerLockElement) document.exitPointerLock?.();
          stats.seconds = match.tick / 60;
          // na sala o servidor leva ao pódio sozinho (a tela de fim é a da sala)
          if (!net) {
            window.setTimeout(() => {
              phase = 'over';
              setHud((h) => ({ ...h, phase: 'over' }));
              setResult({ winner: e.winner, score: e.score, stats: { ...stats } });
            }, 1500);
          }
        }
      }
      scene.handle(events, spectator ? -1 : myIdx);
    };

    // ---- sala: eventos de batida, raquete do outro e histórico ----
    const unsubs: (() => void)[] = [];
    /** Pontos esperando a folga de 200 ms (uma batida atrasada ainda pode desfazê-los). */
    const waiting: PpTimedEvent[] = [];
    const feed = (list: PpTimedEvent[]) => {
      const now: PpEvent[] = [];
      for (const t of list) {
        // o que aconteceu há mais de ~300 ms (voltou à sala, aba parada) não faz som nem aviso: só o placar acerta
        if (t.tick < match.tick - 20) continue;
        if (t.e.type === 'point' || t.e.type === 'game') waiting.push(t);
        else now.push(t.e);
      }
      if (now.length) react(now);
    };
    scene.online = !!net;
    /**
     * Move a raquete do outro até o alvo. A mola dela só é estável até uns 36 ms por passo: em quadro lento (celular a 30 fps
     * ou menos) um passo só passava do ponto e oscilava (o boneco do adversário piscando). Aqui o quadro vira passos de no
     * máximo ~8 ms.
     */
    const stepOppPad = (frameDt: number) => {
      const steps = Math.max(1, Math.min(20, Math.ceil(frameDt * 120)));
      for (let i = 0; i < steps; i++)
        ppPadStepZ(match.pad(oppIdx), oppSmooth.x, oppSmooth.y, oppSmooth.z, frameDt / steps);
    };
    scene.sim = net;
    const oppTarget = { x: 0, y: 1.3, z: 0 };
    const oppVel = { x: 0, y: 0, z: 0 };
    const oppSmooth = { x: 0, y: 1.3, z: 0 };
    /** Quem assiste: alvo da raquete do jogador que ele vê como "meu" (ninguém a move localmente). */
    const specTarget = { x: 0, y: 1.3, z: 0 };
    // a raquete do outro chega ~50 vezes por segundo: aqui ela segue o alvo com a velocidade que ele vinha tendo e um
    // suavizado curto (sem degraus a cada pacote e sem atraso grande)
    let oppAt = performance.now();
    /** Já chegou o histórico da sala (quem entra no meio ou volta só começa a andar depois dele). */
    let synced = !net;
    let padSendAt = 0;
    let clockOff: number | null = null;
    /** Uma batida ou lançamento que chegou (da sala ou direto do outro aparelho; repetido não conta). */
    const onNetEvent = (raw: unknown) => {
      if (!net) return;
      const ev = ppParseNetEvent(raw);
      if (!ev) return;
      const late = ev.t <= net.tick;
      const r = net.add(ev);
      if (late && r.ok) {
        scene.absorb(net.tick - ev.t);
        // a batida chegou depois do tick dela: quanto atrasou (ms) e uma correção a mais
        netStats.current.late.push({
          at: performance.now(),
          ms: (net.tick - ev.t) * PP_TICK * 1000,
        });
      }
      feed(r.events);
    };
    /** A raquete do outro (da sala ou direto): o alvo e a velocidade dele. */
    const setOppPad = (nx: number, ny: number, nz: number, senderDt?: number) => {
      const t = performance.now();
      // a velocidade vem da hora de quem mandou (um pacote que chega colado no outro, em rajada, não vira velocidade
      // enorme); sem hora, da hora em que o pacote chegou
      const dtp = senderDt !== undefined ? senderDt : Math.max(0.008, (t - oppAt) / 1000);
      if (dtp > 0.008 && dtp < 0.3) {
        const lim = (v: number, m: number) => Math.max(-m, Math.min(m, v));
        const lx = senderDt !== undefined ? 14 : 25;
        oppVel.x = lim((nx - oppTarget.x) / dtp, lx);
        oppVel.y = lim((ny - oppTarget.y) / dtp, 6);
        oppVel.z = lim((nz - oppTarget.z) / dtp, lx);
      }
      oppTarget.x = nx;
      oppTarget.y = ny;
      oppTarget.z = nz;
      oppAt = t;
    };
    // canal direto com o outro aparelho (WebRTC, sem espera de retransmissão): a sala continua valendo como reserva
    let peerPadAt = 0;
    // pacotes da raquete dele pela hora de quem mandou: a tela desenha ~40 ms atrás, interpolando entre eles, e a
    // chegada irregular (jitter, pacote fora de ordem, rajada) não vira tranco
    const padBuf: { ts: number; x: number; y: number; z: number }[] = [];
    let padOff = Infinity;
    const PAD_DELAY = 40;
    const peer =
      net &&
      online &&
      online.ids &&
      online.ids[1 - online.me] !== 'bot' &&
      online.me >= 0 &&
      !spectator &&
      !(window as unknown as { __pingNoP2P?: boolean }).__pingNoP2P
        ? new PingPeer(online.ids[1 - online.me] as string, online.me === 0, (m: PingPeerMsg) => {
            if (Array.isArray(m.e)) for (const raw of m.e) onNetEvent(raw);
            // canal sem ordem: cada pacote entra no buffer pela hora de quem mandou, na ordem certa
            if (
              m.p &&
              m.p.length === 3 &&
              m.p.every((n) => Number.isFinite(n)) &&
              m.t !== undefined
            ) {
              const arrived = performance.now();
              peerPadAt = arrived;
              // a diferença entre a hora local e a do outro: o menor valor visto é o pacote mais rápido (sem atraso extra)
              padOff = Math.min(
                padOff === Infinity ? arrived - m.t : padOff + 0.002,
                arrived - m.t,
              );
              if (!padBuf.some((q) => q.ts === m.t)) {
                const item = { ts: m.t, x: m.p[0], y: m.p[1], z: m.p[2] };
                let i = padBuf.length;
                while (i > 0 && padBuf[i - 1]!.ts > item.ts) i--;
                padBuf.splice(i, 0, item);
                if (padBuf.length > 40) padBuf.shift();
              }
            } else if (m.p && m.p.length === 3 && m.p.every((n) => Number.isFinite(n))) {
              peerPadAt = performance.now();
              setOppPad(m.p[0], m.p[1], m.p[2]);
            }
          })
        : null;
    peer?.start();
    if (peer) unsubs.push(() => peer.close());
    netStats.current.peer = peer;
    // o painel de rede: contas a cada meio segundo (só quando ele está ligado)
    {
      let framesAt = 0;
      const iv = window.setInterval(() => {
        const st = netStats.current;
        const fps = (st.frames - framesAt) * 2;
        framesAt = st.frames;
        if (!showNetRef.current) return;
        const now = performance.now();
        st.late = st.late.filter((l) => now - l.at < 10_000);
        const ms = st.late.map((l) => l.ms);
        setNetInfo({
          fps,
          ping: Math.round(currentRtt()),
          direct: !!st.peer?.open,
          late: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0,
          lateMax: ms.length ? Math.round(Math.max(...ms)) : 0,
          fixes: st.late.length * 6,
          rejected: st.rejected,
        });
      }, 500);
      unsubs.push(() => window.clearInterval(iv));
    }
    if (net && online) {
      unsubs.push(
        subscribeRoom('pev', (m) => {
          if (!Array.isArray(m)) return;
          synced = true;
          for (const raw of m) onNetEvent(raw);
        }),
        subscribeRoom('prej', (m) => {
          const ev = ppParseNetEvent(m);
          if (ev) {
            netStats.current.rejected++;
            const evs = net.remove(ev);
            scene.absorb();
            feed(evs);
          }
        }),
        subscribeRoom('ppads', (m) => {
          if (!Array.isArray(m)) return;
          for (const row of m as number[][]) {
            // com o canal direto aberto, a raquete vem dele (a da sala é mais velha e repetida)
            if (row[0] === oppIdx && performance.now() - peerPadAt > 600)
              setOppPad(row[1] ?? 0, row[2] ?? 1.3, row[3] ?? 0);
            // quem assiste não joga: as DUAS raquetes vêm da sala (a do jogador 0 não tem dono local)
            if (spectator && row[0] === myIdx) {
              specTarget.x = row[1] ?? 0;
              specTarget.y = row[2] ?? 1.3;
              specTarget.z = row[3] ?? 0;
            }
          }
        }),
      );
      sendRoomQuiet('psync');
    }
    const flushWaiting = () => {
      while (waiting.length > 0) {
        const t = waiting[0] as PpTimedEvent;
        if (match.tick < t.tick + POINT_GRACE) break;
        waiting.shift();
        // o ponto só vale se, passada a folga, a partida ainda o tem (senão uma batida atrasada o desfez)
        if (t.e.type === 'point') {
          const total = match.score[0] + match.score[1];
          if (total < t.e.score[0] + t.e.score[1]) continue;
        }
        react([t.e]);
      }
    };

    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      netStats.current.frames++;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const paused = !net && menuRef.current;
      if (phase === 'ready') {
        const left = online
          ? Math.ceil((online.startAt - serverNow()) / 1000)
          : 3 - Math.floor((now - readyAt) / 700);
        const shown = online ? Math.min(3, left) : left;
        if (shown !== ready) {
          ready = shown;
          if (shown >= 0 && shown <= 3) pingSfx.count(shown);
          setHud((h) => ({ ...h, count: Math.max(0, shown) }));
        }
        if (online ? serverNow() >= online.startAt : left < 0) {
          phase = 'play';
          setHud((h) => ({ ...h, phase: 'play' }));
        }
      }
      let alpha = 1;
      if (phase === 'play' && !finished) {
        // setas e WASD: lado a lado e para a frente / para trás
        const kx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
        const ky = (keys.u ? 1 : 0) - (keys.d ? 1 : 0);
        if (kx) me.x = Math.max(-PP_PAD_X, Math.min(PP_PAD_X, me.x + scene.simX(kx) * 3.2 * dt));
        if (ky) zt = clampZ(zt + ky * 9 * dt);
        me.z = zt;
        me.serve = serveFrames > 0;
        if (serveFrames > 0) serveFrames--;
        // só nos testes: uma entrada de bot (ou de um "jogador" programado) no lugar do mouse
        const forced = (window as unknown as { __pingForce?: PpInput }).__pingForce;
        if (forced) {
          me.x = forced.x;
          me.y = forced.y;
          me.serve = forced.serve;
          me.swing = forced.swing;
          me.z = undefined;
        }
        if (net && online) {
          // hora da partida pelo relógio da sala; o passo é fixo e a tela interpola entre os dois últimos
          // relógio suavizado: o relógio da sala é uma mediana que de vez em quando salta alguns ms; a partida não pode
          // dar um pulo de ticks por isso (a bola "teletransportava"), então ele só é seguido devagar
          const pn = performance.now();
          const raw = serverNow() - pn;
          if (clockOff === null || Math.abs(raw - clockOff) > 400) clockOff = raw;
          else clockOff += Math.max(-0.4, Math.min(0.4, raw - clockOff));
          const exact = (pn + clockOff - pausedMs() - online.startAt) / (PP_TICK * 1000);
          const target = Math.floor(exact);
          const input = spectator ? null : me;
          const timed: PpTimedEvent[] = [];
          let guard = 0;
          // sem o histórico não anda (uma batida antiga que chegasse depois não teria como ser aplicada)
          while (synced && net.tick < target && guard++ < 1500) {
            if (net.tick === target - 1) scene.snap();
            // alcançando o passado (voltou à sala, aba parada): ninguém "bate" no que já passou, vale só o registro
            net.match.replay = target - net.tick > 30;
            timed.push(...net.advanceTo(net.tick + 1, input));
          }
          net.match.replay = false;
          feed(timed);
          const fresh = net.outgoing();
          for (const ev of fresh) sendRoomQuiet(ev.k === 'toss' ? 'ptoss' : 'phit', ev);
          if (fresh.length > 0) peer?.send(fresh);
          flushWaiting();
          alpha = Math.max(0, Math.min(1, exact - target));
          // a raquete do outro chega a 30 vezes por segundo: aqui ela suaviza até lá
          {
            // canal direto: a raquete dele sai do buffer (hora de quem mandou, ~40 ms atrás, interpolada); sem pacote novo
            // por um tempo, vale o caminho de sempre (a sala)
            if (padBuf.length >= 2 && performance.now() - peerPadAt < 500) {
              const tt = performance.now() - padOff - PAD_DELAY;
              let k0 = padBuf.length - 1;
              while (k0 > 0 && padBuf[k0 - 1]!.ts > tt) k0--;
              const a0 = padBuf[Math.max(0, k0 - 1)]!;
              const b0 = padBuf[Math.min(padBuf.length - 1, k0)]!;
              let f = b0.ts > a0.ts ? (tt - a0.ts) / (b0.ts - a0.ts) : 1;
              // passou do último pacote (atraso na rede): segue a mesma direção por pouco tempo e depois segura
              f = Math.max(0, Math.min(1.6, f));
              const kk = 1 - Math.exp(-dt * 60);
              oppSmooth.x += (a0.x + (b0.x - a0.x) * f - oppSmooth.x) * kk;
              oppSmooth.y += (a0.y + (b0.y - a0.y) * f - oppSmooth.y) * kk;
              oppSmooth.z += (a0.z + (b0.z - a0.z) * f - oppSmooth.z) * kk;
              stepOppPad(dt);
            } else {
              // alvo = último pacote + o que ele andaria desde então (no máximo 60 ms), e o desenho persegue esse alvo
              const ahead = Math.min(0.04, (performance.now() - oppAt) / 1000);
              const k = 1 - Math.exp(-dt * 26);
              oppSmooth.x += (oppTarget.x + oppVel.x * ahead - oppSmooth.x) * k;
              oppSmooth.y += (oppTarget.y + oppVel.y * ahead - oppSmooth.y) * k;
              oppSmooth.z += (oppTarget.z + oppVel.z * ahead - oppSmooth.z) * k;
              stepOppPad(dt);
            }
          }
          if (!spectator && now - padSendAt > 20) {
            padSendAt = now;
            {
              const mine = match.pad(myIdx);
              const row: [number, number, number] = [
                Math.round(mine.x * 100) / 100,
                Math.round(mine.y * 100) / 100,
                Math.round(mine.reach * 100) / 100,
              ];
              // o canal direto leva a raquete (e repete as batidas recentes); a sala só quando ele não está aberto
              if (peer?.open) peer.send([], row);
              else sendRoomQuiet('ppad', row);
            }
          }
        } else if (!paused && bot) {
          if (slow < 1 && now > slowUntil) slow = 1;
          acc += dt * slow;
          let guard = 0;
          while (acc >= 1 / 60 && guard++ < 6) {
            scene.snap();
            match.step([me, bot.input(match, 1)]);
            const ev = match.drain();
            if (ev.length) react(ev);
            acc -= 1 / 60;
          }
          if (guard >= 6) acc = 0;
          alpha = acc * 60;
        }
      }
      if (spectator) {
        const steps = Math.max(1, Math.min(20, Math.ceil(dt * 120)));
        for (let i = 0; i < steps; i++) ppPadStepZ(match.pad(myIdx), specTarget.x, specTarget.y, specTarget.z, dt / steps);
      }
      scene.render(dt, phase === 'play' && !paused ? alpha : 1);
      // a barra do smash do adversário fica em cima da cabeça dele, com onde ele apertou
      if (oppBarRef.current && root.current) {
        const bar = oppBarRef.current;
        const show =
          phase === 'play' && !finished && !spectator && match.popup && match.expect === oppIdx;
        if (!show) bar.style.visibility = 'hidden';
        else {
          const pt = scene.project(0, 2.95, -(PP_PAD_Z + 2.3));
          const W = root.current.clientWidth;
          const H = root.current.clientHeight;
          const bw = bar.clientWidth || 150;
          bar.style.transform = `translate(${(pt.nx * W - bw / 2).toFixed(1)}px, ${(pt.ny * H - 30).toFixed(1)}px)`;
          const tapped = (match.smashQ[oppIdx === 0 ? 0 : 1] ?? 0) > 0;
          const c = tapped ? (match.smashCur[oppIdx === 0 ? 0 : 1] ?? 0.5) : match.smashCursor();
          if (oppCurRef.current) {
            const tw = oppCurRef.current.parentElement?.clientWidth ?? 0;
            oppCurRef.current.style.transform = `translateX(${(c * Math.max(0, tw - 6)).toFixed(1)}px)`;
          }
          bar.classList.toggle('is-tapped', tapped);
          bar.style.visibility = 'visible';
        }
      }
      // medidor do saque: o marcador desce com a bola (só transform)
      if (gaugeRef.current && match.phase === 'toss') {
        const g = gaugeRef.current;
        const f = Math.max(0, Math.min(1, (GAUGE_TOP - match.ball.y) / (GAUGE_TOP - GAUGE_BOTTOM)));
        g.style.transform = `translateY(${(f * (g.parentElement?.clientHeight ?? 0)).toFixed(1)}px)`;
      }
      // e o medidor fica ao lado da bola (do lado da tela com mais espaço), na altura dela
      if (gaugeBoxRef.current && root.current && match.phase === 'toss') {
        const box = gaugeBoxRef.current;
        const W = root.current.clientWidth;
        const H = root.current.clientHeight;
        const pt = scene.project(match.ball.x, 2.1, match.ball.z);
        const gh = box.clientHeight || 120;
        const side = pt.nx * W > W * 0.6 ? -1 : 1;
        const x = pt.nx * W + side * 56 - (side < 0 ? 12 : 0);
        const y = Math.max(8, Math.min(H - gh - 8, pt.ny * H - gh / 2));
        box.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        box.style.visibility = 'visible';
      }
      {
        const win = smashWindow();
        const slowNow = match.popup && phase === 'play';
        if (win && cursorRef.current && trackRef.current) {
          const c = tapValue >= 0 ? tapValue : match.smashCursor();
          const w = Math.max(0, trackRef.current.offsetWidth - cursorRef.current.offsetWidth);
          cursorRef.current.style.transform = `translateX(${(c * w).toFixed(1)}px)`;
        }
        if (!match.popup) tapValue = -1;
        setHud((h) =>
          h.slow === slowNow && h.smash.on === win && (win || h.smash.tier === 0)
            ? h
            : { ...h, slow: slowNow, smash: { on: win, tier: win ? h.smash.tier : 0 } },
        );
      }
      if (now - hudAt > 120) {
        hudAt = now;
        const sync = !net || waiting.length === 0;
        setHud((h) =>
          h.server === match.server &&
          h.matchPhase === match.phase &&
          h.rally === match.rally &&
          (!sync || (h.score[0] === match.score[0] && h.score[1] === match.score[1]))
            ? h
            : {
                ...h,
                server: match.server,
                matchPhase: match.phase,
                rally: match.rally,
                // o placar da sala acompanha a partida (vale depois da folga de cada ponto)
                score: sync && net ? [match.score[0], match.score[1]] : h.score,
              },
        );
      }
    };
    raf = requestAnimationFrame(frame);

    (window as unknown as { __ping?: unknown }).__ping = {
      match,
      scene,
      net,
      peer,
      predict: ppPredictCross,
      Bot: PpBot,
      levels: PP_BOT_LEVELS,
    };
    return () => {
      cancelAnimationFrame(raf);
      for (const off of unsubs) off();
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('orientationchange', remeasure);
      window.removeEventListener('resize', remeasure);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (document.pointerLockElement === zn) document.exitPointerLock?.();
      zn.removeEventListener('pointerdown', onDown);
      zn.removeEventListener('pointermove', onMove);
      zn.removeEventListener('pointerup', onUp);
      zn.removeEventListener('pointercancel', onCancel);
      zn.removeEventListener('lostpointercapture', onCancel);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('blur', resetPointers);
      zn.removeEventListener('contextmenu', onCtx);
      zn.removeEventListener('touchstart', onTouch);
      zn.removeEventListener('selectstart', onCtx);
      ro.disconnect();
      scene.dispose();
      delete (window as unknown as { __ping?: unknown }).__ping;
    };
  }, [level, online]);

  const myIdx = online ? Math.max(0, online.me) : 0;
  const spectating = !!online && online.me < 0;
  const oppIdx = 1 - myIdx;
  const myServe =
    !spectating &&
    (hud.matchPhase === 'serve' || hud.matchPhase === 'toss') &&
    hud.server === myIdx &&
    hud.phase === 'play';
  const names = online
    ? [
        spectating ? (online.names[0] ?? '') : myDisplayName(online),
        spectating ? (online.names[1] ?? '') : (online.names[oppIdx] ?? 'Adversário'),
      ]
    : [myDisplayName(), BOT_NAMES[level]];

  return (
    <div ref={root} className="png-play" data-testid="png-play">
      <canvas ref={canvas} className="png-canvas" aria-label="Mesa de pingue-pongue" />
      <div ref={zone} className="png-zone" aria-hidden="true" />
      <div className="png-hud">
        <div className="png-score" role="status" aria-label="Placar" data-testid="png-score">
          <span className={`png-side${hud.server === myIdx ? ' is-serving' : ''}`}>
            <i aria-hidden="true" />
            <small>{names[0]}</small>
            <b>{hud.score[myIdx] ?? 0}</b>
          </span>
          <span className="png-sep" aria-hidden="true">
            :
          </span>
          <span className={`png-side is-right${hud.server === oppIdx ? ' is-serving' : ''}`}>
            <b>{hud.score[oppIdx] ?? 0}</b>
            <small>{names[1]}</small>
            <i aria-hidden="true" />
          </span>
        </div>
        <div className="png-hud-end">
          <GearButton onClick={() => setMenu(true)} testId="png-menu-btn" />
        </div>
      </div>
      {hud.rally >= 4 && hud.matchPhase === 'rally' && (
        <div className="png-rally" key={`rally-${hud.rally}`} aria-hidden="true">
          Troca <b>{hud.rally}</b>
        </div>
      )}
      {hud.speed && (
        <div
          className={`png-speed${hud.speed.mine ? ' is-mine' : ''}`}
          key={`speed-${hud.speed.id}`}
          aria-hidden="true"
        >
          {hud.speed.tag && <em>{hud.speed.tag}</em>}
          <b>{hud.speed.kmh}</b> km/h
        </div>
      )}
      {hud.banner && (
        <div
          className={`png-banner is-${hud.banner.tone}`}
          key={`banner-${hud.banner.id}`}
          role="status"
        >
          <b>{hud.banner.text}</b>
          {hud.banner.sub && <span>{hud.banner.sub}</span>}
        </div>
      )}
      {hud.phase === 'ready' && (
        <div className="png-count" aria-live="assertive">
          {hud.count > 0 ? hud.count : 'Já!'}
        </div>
      )}
      <div className={`png-slowfx${hud.slow ? ' on' : ''}`} aria-hidden="true" />
      {showNet && (
        <NetBadge
          mode={online ? (netInfo.direct ? 'direto' : 'pela sala') : 'treino'}
          items={[
            { text: `${netInfo.fps} fps`, title: 'quadros desenhados por segundo neste aparelho' },
            ...(online
              ? [
                  { text: `${netInfo.ping} ms`, title: 'ida e volta até a sala' },
                  {
                    text: `batida +${netInfo.late} ms (máx ${netInfo.lateMax})`,
                    title: 'quanto a batida do outro demorou a chegar nos últimos 10 s',
                  },
                  {
                    text: `${netInfo.fixes} corr./min`,
                    title: 'vezes em que a partida voltou no tempo por uma batida atrasada',
                  },
                  { text: `${netInfo.rejected} recus.`, title: 'batidas que a sala recusou' },
                ]
              : []),
            { text: `v${BUILD_ID}`, title: 'versão do app' },
          ]}
        />
      )}
      <div ref={oppBarRef} className="png-opp-smash" aria-hidden="true">
        <small>SMASH: {names[1] ? names[1].toUpperCase() : 'ADVERSÁRIO'}</small>
        <div className="png-opp-track">
          <i className="r" />
          <i className="g" />
          <i className="p" />
          <span ref={oppCurRef} />
        </div>
      </div>
      {hud.oppTap && (
        <div key={hud.oppTap.id} className={`png-opp-tap is-${hud.oppTap.tier}`}>
          {hud.oppTap.tier === 3
            ? 'PERFEITO!'
            : hud.oppTap.tier === 2
              ? 'ACERTOU O VERDE'
              : 'ERROU: VERMELHO'}
        </div>
      )}
      {hud.smash.on && (
        <div className="png-smash" data-testid="png-smash" data-tier={hud.smash.tier}>
          <b>
            {hud.smash.tier === 3
              ? 'PERFEITO!'
              : hud.smash.tier === 2
                ? 'VERDE! SMASH FORTE'
                : hud.smash.tier === 1
                  ? 'VERMELHO: SMASH FRACO'
                  : 'TOQUE NA TELA: SMASH NO VERDE!'}
          </b>
          <div className="png-smash-track" ref={trackRef}>
            <i className="png-smash-red" />
            <i className="png-smash-green" />
            <i className="png-smash-perfect" />
            <span className="png-smash-cursor" ref={cursorRef} />
          </div>
          <small>
            {touchDevice
              ? 'Toque na tela com o outro dedo quando a barrinha estiver no verde'
              : 'Clique na tela (ou Espaço) quando a barrinha estiver no verde'}
          </small>
        </div>
      )}
      {!touchDevice &&
        !locked &&
        !lockFailed &&
        hud.phase === 'play' &&
        !menu &&
        !result &&
        !spectating &&
        typeof document !== 'undefined' &&
        'requestPointerLock' in document.documentElement && (
          <div className="png-lock-hint" data-testid="png-lock-hint">
            <svg viewBox="0 0 24 32" width="26" height="34" aria-hidden="true">
              <rect
                x="3"
                y="2"
                width="18"
                height="28"
                rx="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
              />
              <line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="2.4" />
              <rect x="10.4" y="5" width="3.2" height="5" rx="1.6" fill="currentColor" />
            </svg>
            <b>CLIQUE NA TELA</b>
            <span>para prender o mouse e jogar com mais imersão</span>
          </div>
        )}
      {myServe && (
        <div className="png-serve-hint" data-testid="png-serve-hint">
          {hud.matchPhase === 'toss' ? (
            <>
              <b>Espere a bola descer até a zona verde</b>
              <span>
                {touchDevice
                  ? 'Com o dedo na raquete, arraste para o lado que quer sacar'
                  : 'Arraste para o lado que quer sacar e bata'}
              </span>
            </>
          ) : (
            <>
              <b>{touchDevice ? 'Segure o dedo parado' : 'Clique'} para lançar a bola</b>
              <span>
                {touchDevice
                  ? 'sem soltar: depois arraste para sacar (arrastar antes só muda o lugar)'
                  : 'depois arraste a raquete quando a bola descer'}
              </span>
            </>
          )}
        </div>
      )}
      {myServe && hud.matchPhase === 'toss' && (
        <div
          ref={gaugeBoxRef}
          className="png-serve-gauge"
          data-testid="png-serve-gauge"
          aria-hidden="true"
        >
          <i className="z-high" />
          <i className="z-good" />
          <i className="z-best" />
          <b ref={gaugeRef as React.RefObject<HTMLElement>} />
        </div>
      )}
      {!spectating &&
        hud.matchPhase === 'serve' &&
        hud.server === oppIdx &&
        hud.phase === 'play' &&
        !hud.banner && (
          <div className="png-serve-hint is-them">
            <b>{names[1]} vai sacar</b>
            <span>Prepare a raquete</span>
          </div>
        )}
      {online && <GameChat enabled />}
      {online && <PauseOverlay />}
      <RotateHint />
      {hud.phase === 'ready' && (
        <GameTips storageKey={TIPS_KEY} rows={tipRows(touchDevice)} testId="png-tips" markOnShow />
      )}
      {menu && !result && (
        <GameMenu
          title="Menu"
          testPrefix="png-menu"
          tipsKey={TIPS_KEY}
          tips={tipRows(touchDevice)}
          online={!!online}
          onClose={closeMenu}
          onExit={onExit}
          onOfflineInvite={onOfflineInvite}
          net={{ on: showNet, toggle: toggleNet }}
          endMatch={{
            label: 'Encerrar a partida',
            onClick: () => sendRoom('pend'),
            testId: 'png-menu-end',
          }}
          actions={[
            {
              id: 'guide',
              icon: <IcTable size={20} />,
              label: 'Guia de posição',
              hint: <span className="gm-cur">{guide ? 'Ligado' : 'Desligado'}</span>,
              pressed: guide,
              testId: 'png-menu-guide',
              onClick: () => {
                const next = !guide;
                setGuide(next);
                sceneRef.current?.setGuide(next);
                try {
                  localStorage.setItem(GUIDE_KEY, next ? '1' : '0');
                } catch {
                  /* sem storage: vale só nesta partida */
                }
              },
            },
          ]}
        />
      )}
      {result && (
        <PingFinal
          winner={result.winner}
          score={result.score}
          names={[names[0] as string, names[1] as string]}
          stats={result.stats}
          mode={{ kind: 'training', onAgain, onExit }}
        />
      )}
    </div>
  );
}
