import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  FS_TEAMS_ACTIVE,
  fsClearLine,
  FsIntel,
  FS_GRENADES,
  FS_WEAPONS,
  FsLoadout,
  fsBuy,
  fsShopPrice,
  fsDir,
  fsDmHeading,
  fsEyeHeight,
  fsFlinch,
  fsFlinchAt,
  fsMatchScore,
  fsNetWeaponId,
  fsNewMover,
  fsShopItem,
  fsSpreadDeg,
  fsStepMover,
  fsTrace,
  type FsBody,
  type FsGrenadeId,
  type FsMover,
  type FsNetEvent,
  type FsShopItem,
  type FsWeaponId,
} from '@nocap/games';
import { fsAudio } from '@/lib/foxshot-audio';
import { leaveRoom, sendRoom, serverNow, type RoomSnapshot } from '@/lib/rooms';
import { FsNetClient } from '@/lib/foxshot-link';
import { GameChat } from '@/components/GameChat';
import { PauseOverlay } from '@/components/PauseOverlay';
import { useGameChat } from '@/lib/game-chat-state';
import { InviteDialog } from '@/components/InviteDialog';
import { FoxShotScene, fsWorldFor, type Quality } from './FoxShotScene';
import { FsControls } from './fs-controls';
import { bindLabel, fsSettings, useFsSettings } from './fs-settings';

const bombKey = () => bindLabel(fsSettings().binds.bomb);
import { FsMenu } from './FsMenu';
import { FsShop } from './FsShop';
import { FsBombHud, type BombHud } from './FsBombHud';
import { fsMapById } from '@nocap/games';
import { FsBigMap, FsTelemetry, FsAmmo, FsCrosshair, FsKillFeed, FsMinimap, FsScoreboard, FsTopBar, FsVitals, type FeedItem, type FsIntelDot, type FsPlayerRow, type MinimapData } from './FsHud';
import { FoxShotRoomFinal } from './FoxShotRoomFinal';
import { FsShield } from './FsShield';
import { fsMapPlan } from './FsMapPlan';
import { FsPreMatch } from './FsPreMatch';
import './foxshot.css';
import './counterfox-hub.css';

/** Passo da simulação (igual ao servidor) e atraso da interpolação dos outros jogadores. */
const TICK = 1 / 60;

interface Row {
  idx: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  armor: number;
  flags: number;
  weapon: number;
  crouch: number;
  seq: number;
  kills: number;
  assists: number;
  deaths: number;
  damage: number;
  hs: number;
}
interface SelfState {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; og: boolean; ck: number; seq: number; yaw: number; pitch: number;
  hp: number; armor: number; helmet: boolean; alive: boolean; respawnIn: number; shield?: number;
  cur: number; held: FsGrenadeId | null; ammo: number; reloading: boolean; slots: number[]; nades: Record<FsGrenadeId, number>;
  /** Modo Bomba: dinheiro, progresso de plantar/desarmar, ganho do último round, seu lado e rounds para vencer. */
  bomb?: { money: number; plant: number; defuse: number; gain: number; side: 'tr' | 'ct'; win: number; kit?: boolean; buy?: boolean; held?: boolean; mates?: Record<number, number> };
}
interface Frame {
  f: { k: number; left: number; p: number[][]; g: number[][]; b?: number[] };
  s: SelfState | null;
  e: FsNetEvent[];
}
interface RoomHud {
  hp: number; armor: number; helmet: boolean; hurtKey: number; heavyKey: number; hurtAge: number; heavyAge: number; dead: boolean; respawnIn: number; shield?: number; deadAge: number;
  ammo: number; mag: number; weapon: string; weaponId: FsWeaponId; heldNade: FsGrenadeId | null;
  nades: { id: FsGrenadeId; name: string; count: number; key: string }[];
  speed: number; slots: { id: FsWeaponId | null; name: string; key: number }[]; current: number; reloading: boolean; scoped: boolean; spreadPx: number;
  spec: string | null;
  /** Modo Bomba: quem você assiste depois de morrer. */
  follow: string | null;
  bomb: BombHud | null;
  fps: number; timeLeft: number; players: FsPlayerRow[]; points: number; tris: number; calls: number; level: Quality; dpr: number; pos: number[]; k: number;
}
interface Snap {
  t: number;
  x: number; y: number; z: number; yaw: number; pitch: number; crouch: number; flags: number;
}
interface Pending {
  seq: number; fwd: number; strafe: number; jump: boolean; yaw: number; mul: number; crouch: boolean; walk: boolean;
}

const toRow = (r: number[]): Row => ({
  idx: r[0]!, x: r[1]! / 100, y: r[2]! / 100, z: r[3]! / 100, yaw: r[4]! / 10, pitch: r[5]! / 10, hp: r[6]!, armor: r[7]!, flags: r[8]!, weapon: r[9]!, crouch: r[10]! / 100, seq: r[11]!, kills: r[12]!, assists: r[13]!, deaths: r[14]!, damage: r[15] ?? 0, hs: r[16] ?? 0,
});

/** Counter Fox online (spec 057): a partida do mata-mata na sala. O servidor manda; aqui se prevê o próprio movimento, se interpola o resto e se mostra tudo. */
export function FoxShotRoomPlay({ snapshot }: { snapshot: RoomSnapshot }) {
  if (snapshot.phase === 'final') return <FoxShotRoomFinal snapshot={snapshot} />;
  return <Match snapshot={snapshot} />;
}

function Match({ snapshot }: { snapshot: RoomSnapshot }) {
  // quem chega com a partida rolando começa espectando; escolhe entrar para jogar ou seguir espectando
  const mePlayer = (snapshot.foxshot?.roster ?? []).some((r) => r.id === snapshot.me && !r.bot);
  const [decided, setDecided] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteRef = useRef(false);
  inviteRef.current = inviteOpen;
  const root = useRef<HTMLDivElement>(null);
  const stickEl = useRef<HTMLDivElement>(null);
  const touchUi = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const [portrait, setPortrait] = useState(false);
  const press = useCallback(
    (name: 'fire' | 'ads' | 'jump' | 'reload' | 'cycle' | 'use' | 'buy' | 'bombslot', down: boolean) => ctl.current?.setTouch(name, down),
    [],
  );
  useEffect(() => {
    const onResize = () => setPortrait(touchUi && window.innerHeight > window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [touchUi]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const blindEl = useRef<HTMLDivElement>(null);
  const scopeEl = useRef<HTMLDivElement>(null);
  const hitEl = useRef<HTMLDivElement>(null);
  const ctl = useRef<FsControls | null>(null);
  const pausedRef = useRef(mePlayer);
  const shopRef = useRef(false);
  const buyRef = useRef<(item: FsShopItem) => void>(() => undefined);
  const resumeRef = useRef<() => void>(() => undefined);
  const suicideRef = useRef<() => void>(() => undefined);
  const mini = useRef<MinimapData>({ x: 0, z: 0, yaw: 0, targets: [] });
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  // por onde a partida chega: a sala, ou o aparelho do líder por WebRTC (spec 060)
  const netRef = useRef<FsNetClient | null>(null);
  if (!netRef.current) netRef.current = new FsNetClient();
  const fxs = snapshot.foxshot;
  useEffect(() => {
    netRef.current?.update({ me: snapshot.me ?? '', phase: snapshot.phase, foxshot: snapRef.current.foxshot });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.me, snapshot.phase, fxs?.net, fxs?.p2pHost, fxs?.startAt, fxs?.setup]);
  useEffect(() => () => netRef.current?.dispose(), []);
  const settings = useFsSettings();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // a partida abre jogando (o menu só abre com o Esc); no celular não há mouse para prender
  const [paused, setPausedState] = useState(false);
  const [needClick, setNeedClick] = useState(false);
  const [shop, setShopState] = useState(false);
  const [board, setBoard] = useState(false);
  const [bigMap, setBigMap] = useState(false);
  const bigMapRef = useRef(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [marker, setMarker] = useState<{ key: number; kind: 'body' | 'head' | 'kill' | 'armor'; text: string } | null>(null);
  const [hud, setHud] = useState<RoomHud | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const getMini = useCallback(() => mini.current, []);

  const setPaused = useCallback((v: boolean) => {
    pausedRef.current = v;
    setPausedState(v);
    if (ctl.current) ctl.current.enabled = !v;
    if (v) {
      setNeedClick(false);
      shopRef.current = false;
      setShopState(false);
    }
  }, []);
  const setMap = useCallback((v: boolean) => {
    bigMapRef.current = v;
    setBigMap(v);
    if (v) ctl.current?.releaseLock();
    else window.setTimeout(() => !bigMapRef.current && !shopRef.current && !pausedRef.current && ctl.current?.requestLock(), 160);
  }, []);
  const setShop = useCallback((v: boolean) => {
    shopRef.current = v;
    setShopState(v);
    if (v) ctl.current?.releaseLock();
    else window.setTimeout(() => !shopRef.current && !pausedRef.current && ctl.current?.requestLock(), 160);
  }, []);

  useEffect(() => {
    const el = root.current!;
    const cv = canvas.current!;
    const info = snapRef.current.foxshot!;
    // a lista de jogadores muda no meio da partida (alguém toma o lugar de um bot): sempre se lê a mais nova
    const rosterNow = () => snapRef.current.foxshot?.roster ?? [];
    const meId = snapRef.current.me ?? '';
    const isPlayerNow = () => rosterNow().some((r) => r.id === meId && !r.bot);
    const nameOf = (id: string) => rosterNow().find((r) => r.id === id)?.name ?? '?';
    // a cena guarda uma raposa por posição na lista (não por pessoa), então trocar de dono não mexe nela
    const SLOTS = Array.from({ length: 10 }, (_, i) => `s${i}`);
    const slotOf = (id: string) => {
      const i = rosterNow().findIndex((r) => r.id === id);
      return i < 0 ? null : `s${i}`;
    };
    let wasPlayer = isPlayerNow();
    let followId: string | null = null;
    const cam = { x: 0, y: 0, z: 0, yaw: 0, ok: false };
    let camPitch = 0;
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    let dead = false;
    let raf = 0;
    let lastResumeAt = 0;

    const controls = new FsControls();
    ctl.current = controls;
    controls.enabled = false;
    controls.attach(
      el,
      (s) => {
        // marca do joystick de toque
        const d = stickEl.current;
        if (!d) return;
        if (!s) {
          d.style.opacity = '0';
          return;
        }
        d.style.opacity = '1';
        d.style.transform = `translate(${s.ox - 56}px, ${s.oy - 56}px)`;
        const k = d.firstElementChild as HTMLElement | null;
        if (k) {
          const dx = Math.max(-40, Math.min(40, s.x - s.ox));
          const dy = Math.max(-40, Math.min(40, s.y - s.oy));
          k.style.transform = `translate(${dx}px, ${dy}px)`;
        }
      },
      (locked) => {
        // abrir o chat solta o mouse de propósito: não é pedido de menu; e logo depois de começar, soltar o mouse só pede o clique
        if (!locked && !pausedRef.current && !shopRef.current && !bigMapRef.current && !useGameChat.getState().open) {
          if (performance.now() - lastResumeAt > 1500) setPaused(true);
          else setNeedClick(true);
        }
        if (locked) {
          setPaused(false);
          setNeedClick(false);
        }
      },
    );
    /** Modo Bomba: quem morreu assiste aos aliados vivos até o fim do round. */
    const isAllyRow = (id: string) => ((rows.get(id)?.flags ?? 0) & 128 ? 'tr' : 'ct') === bombSelf?.side;
    const cycleFollow = (d: 1 | -1) => {
      const live = rosterNow().filter((r) => r.id !== meId && remotes.get(slotOf(r.id) ?? '')?.alive && (!bf || isAllyRow(r.id)));
      if (!live.length) return;
      const at = live.findIndex((r) => r.id === followId);
      followId = live[(at + d + live.length) % live.length]!.id;
    };
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[data-testid="invite-dialog"]')) return;
      if ((!isPlayerNow() || (!!bf && !!self && !self.alive)) && !e.repeat) {
        if (e.code === 'ArrowRight' || e.code === 'KeyD') cycleFollow(1);
        else if (e.code === 'ArrowLeft' || e.code === 'KeyA') cycleFollow(-1);
        else if (e.code === 'KeyM' && !pausedRef.current) setMap(!bigMapRef.current);
        else if (e.code === 'Tab' && !pausedRef.current) {
          e.preventDefault();
          setBoard(true);
        }
      }
      // Esc fecha só a janela de Convidar e volta ao menu que estava aberto
      if (e.code === 'Escape' && inviteRef.current) {
        e.preventDefault();
        setInviteOpen(false);
        return;
      }
      if (e.code === 'Escape' && bigMapRef.current) {
        e.preventDefault();
        setMap(false);
        return;
      }
      if (e.code === 'Escape' && shopRef.current) {
        e.preventDefault();
        setShop(false);
        return;
      }
      if (e.code === 'Escape' && !pausedRef.current && !e.repeat) {
        e.preventDefault();
        setPaused(true);
        controls.releaseLock();
        return;
      }
      if (e.code === 'Escape' && pausedRef.current && !e.repeat && !document.querySelector('.fsm-binds .listen')) {
        e.preventDefault();
        resume();
      }
    };
    window.addEventListener('keydown', onKey);
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab' && !isPlayerNow()) setBoard(false);
    };
    window.addEventListener('keyup', onKeyUp);
    const resume = () => {
      lastResumeAt = performance.now();
      setPaused(false);
      fsAudio.init();
      if (!isPlayerNow()) return;
      if (!touch) {
        if (fsSettings().fullscreenLock) {
          const rootEl = document.documentElement;
          const nav = navigator as Navigator & { keyboard?: { lock?: (keys: string[]) => Promise<void> } };
          const lock = () => nav.keyboard?.lock?.(['KeyA', 'KeyB', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyN', 'KeyQ', 'KeyR', 'KeyS', 'KeyT', 'KeyW', 'Digit1', 'Digit2', 'Digit3', 'Tab', 'Escape']).catch(() => undefined);
          if (document.fullscreenElement) void lock();
          else void rootEl.requestFullscreen?.().then(lock).catch(() => undefined);
        }
        controls.requestLock();
        window.setTimeout(() => {
          if (!controls.locked && !pausedRef.current) setNeedClick(true);
        }, 350);
      }
    };
    resumeRef.current = resume;
    suicideRef.current = () => {
      cmdQueue.push({ t: 'suicide' });
    };
    // a partida abre jogando (sem o menu do Esc); se o navegador negar prender o mouse, aparece "Clique na tela"
    if (mePlayer && !touch) resume();

    // o mapa da sala (a Duna)
    const map = fsMapById(snapRef.current.foxshot?.map);
    const plan = fsMapPlan(map);
    const ARENA = map.solids;
    const world = fsWorldFor(map, SLOTS.map((id) => ({ id, x: 0, z: 0 })));
    const scene = new FoxShotScene(cv, world);
    const resize = () => scene.resize(el.clientWidth, el.clientHeight);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let appliedQ = '';
    const applyQuality = () => {
      const q = fsSettings().quality;
      if (q === appliedQ) return;
      appliedQ = q;
      scene.setQuality(q === 'auto' ? (touch ? 'mid' : 'high') : q);
    };
    applyQuality();

    // ---- estado local (previsto) e o que veio do servidor
    const mover: FsMover = fsNewMover(0, 0);
    const prev = { x: 0, y: 0, z: 0 };
    // degraus finos do mapa (0,15 m) não podem fazer a câmera tremer: o olho suaviza só enquanto anda no chão
    let smY = Number.NaN;
    const smoothY = (raw: number, dt: number) => {
      if (!Number.isFinite(smY) || !mover.onGround || Math.abs(raw - smY) > 0.7) smY = raw;
      else smY += (raw - smY) * (1 - Math.exp(-dt * 18));
      return smY;
    };
    const errOff = { x: 0, y: 0, z: 0 };
    const view = { yaw: 0, pitch: 0, rYaw: 0, rPitch: 0 };
    const loadout = new FsLoadout(null, 'pistol');
    let self: SelfState | null = null;
    let haveSelf = false;
    let wasAlive = true;
    let pendingSelf: SelfState | null = null;
    const inbox: Frame[] = [];
    const pending: Pending[] = [];
    const outbox: Record<string, unknown>[] = [];
    const cmdQueue: Record<string, unknown>[] = [];
    let seq = 0;
    let acc = 0;
    let sendT = 0;
    let jumpBuf = 0;
    let lastK = 0;
    // ---- modo Bomba: quadro da bomba (fase, tempo, round, placar...), o que só você recebe e os avisos
    let bf: number[] | null = null;
    let bombSelf: SelfState['bomb'] | null = null;
    let bPhasePrev = -1;
    let bombBanner: { text: string; until: number } | null = null;
    let bombHint: { text: string; until: number } | null = null;
    let beepIn = 0;
    let specWeapon: FsWeaponId | null = null;
    let swapKey = 0;
    let bombHeld = false;
    let bombHeldAt = -9;
    let sidePrev: 'tr' | 'ct' | null = null;
    let dropPrev = 0;
    let carrierPrev = -1;
    let plantActPrev = 0;
    const sayHint = (text: string, ms = 2500) => {
      bombHint = { text, until: clock + ms / 1000 };
    };
    const inBaseNow = () => {
      const m = map.marks.find((k) => k.kind === 'base' && k.id === (bombSelf?.side === 'tr' ? 'T' : 'CT'));
      return !!m && mover.x >= m.x0 - 1 && mover.x <= m.x1 + 1 && mover.z >= m.z0 - 1 && mover.z <= m.z1 + 1;
    };
    const bombFrozen = () => !!bf && (bf[0] === 0 || bf[0] === 4);
    let lastFrameAt = 0;
    let timeLeft = info.minutes * 60;
    const remotes = new Map<string, { buf: Snap[]; alive: boolean; shown: boolean; weapon: number; team?: 'ct' | 't'; teamBit?: 0 | 1; ally?: boolean; allyName?: string; allyTeam?: "ct" | "t"; allyGhost?: boolean }>();
    for (const id of SLOTS) remotes.set(id, { buf: [], alive: true, shown: false, weapon: 0 });
    const rows = new Map<string, Row>();
    const nades = new Map<number, number>();
    const nadeLast = new Map<number, number[]>();
    let flinch = { mul: 1, dur: 0 };
    let flinchAt = -1e9;
    let clock = 0;
    let markerKey = 0;
    let feedKey = 0;
    let hurtKey = 0;
    let heavyKey = 0;
    let hurtAt = -1e9;
    let heavyAt = -1e9;
    let shake = 0;
    let adsHold = 0;
    // sniper: clique alterna zoom 1, zoom 2 e fora (não é de segurar)
    let zoomLvl = 0;
    let adsPrev = false;
    let aimHeld = false;
    const zoomFov = (adsFov: number) => (zoomLvl >= 2 ? 11 : adsFov);
    let recent: { t: number; d: number }[] = [];
    let blindTotal = 0;
    let blindUntil = 0;
    let deadSince = -1;
    const hitMarks: { x: number; z: number; at: number }[] = [];
    let magInPlayed = false;
    let chargePlayed = false;
    let boltAt = -1;
    let stepT = 0;
    let hudT = 0;
    let fps = 60;
    let last = performance.now();
    let forced: { fwd: number; strafe: number } | null = null;
    const killFrom = new Map<string, [number, number]>();
    const intel = new FsIntel();
    let intelT = 0;
    let intelDots: FsIntelDot[] = [];

    const showMarker = (kind: 'body' | 'head' | 'kill' | 'armor', text: string) => setMarker({ key: ++markerKey, kind, text });
    const pushFeed = (it: Omit<FeedItem, 'key'>) => {
      const key = ++feedKey;
      setFeed((f) => [...f.slice(-4), { key, ...it }]);
      window.setTimeout(() => setFeed((f) => f.filter((x) => x.key !== key)), 6000);
    };

    // ---- mensagens do servidor
    /** Atraso de desenho dos outros: o servidor precisa de mais que a conexão direta (e o líder, de menos). */
    const interpMs = () => netRef.current?.link.minDelay ?? 100;
    let lastEvN = 0;
    const onFss = (m: unknown) => {
      const fr = m as Frame;
      if (!fr?.f) return;
      inbox.push(fr);
      if (inbox.length > 60) inbox.shift();
    };
    const unsub = netRef.current!.link.onFrame(onFss);

    const bodiesNow = (t: number): FsBody[] => {
      const out: FsBody[] = [];
      for (const [id, r] of remotes) {
        const p = sample(r.buf, t);
        if (!p || !r.alive) continue;
        out.push({ id, pos: [p.x, p.y, p.z], alive: true, armor: 0, helmet: false, crouch: p.crouch });
      }
      return out;
    };
    function sample(buf: Snap[], t: number): Snap | null {
      if (buf.length === 0) return null;
      if (t <= buf[0]!.t) return buf[0]!;
      for (let i = buf.length - 1; i > 0; i--) {
        const b = buf[i]!;
        const a = buf[i - 1]!;
        if (t >= a.t && t <= b.t) {
          const k = (t - a.t) / Math.max(1, b.t - a.t);
          let dy = b.yaw - a.yaw;
          if (dy > 180) dy -= 360;
          if (dy < -180) dy += 360;
          return { t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: a.yaw + dy * k, pitch: a.pitch + (b.pitch - a.pitch) * k, crouch: a.crouch + (b.crouch - a.crouch) * k, flags: b.flags };
        }
      }
      return buf[buf.length - 1]!;
    }

    /** Aplica um quadro do servidor: corpos dos outros, tabela, granadas, eventos e a conferência do próprio corpo. */
    const applyFrame = (fr: Frame, now: number) => {
      lastK = fr.f.k;
      lastFrameAt = now;
      bf = fr.f.b ?? null;
      if (bf) {
        const ph = bf[0]!;
        if (ph !== bPhasePrev) {
          if (ph === 3) {
            const why = ['', 'time eliminado', 'a bomba explodiu', 'a bomba foi desarmada', 'acabou o tempo'][bf[10]!] ?? '';
            const gain = fr.s?.bomb?.gain ?? 0;
            bombBanner = { text: `${bf[9] === 1 ? 'Terroristas' : 'Contra-terroristas'} vencem · ${why}${gain ? ` · +US$ ${gain}` : ''}`, until: clock + 5 };
          } else if (ph === 2) {
            bombBanner = { text: `A bomba foi plantada na bomba ${bf[7] === 1 ? 'A' : bf[7] === 2 ? 'B' : ''}`.trim(), until: clock + 3.5 };
            fsAudio.bombPlanted();
            beepIn = 0;
          }
          if (ph === 0) sayHint(snapRef.current.foxshot?.pvp ? 'Compre qualquer arma (B): dinheiro infinito. Depois elimine o outro time' : 'Compre na base (B). A bomba é dos terroristas: pátios A e B', 4500);
          bPhasePrev = ph;
        }
        if (!bombSelf?.buy && ph !== 0 && shopRef.current) setShop(false);
      }
      timeLeft = fr.f.left / 60;
      for (const raw of fr.f.p) {
        const r = toRow(raw);
        const id = rosterNow()[r.idx]?.id;
        if (!id) continue;
        rows.set(id, r);
        const key = `s${r.idx}`;
        const rm = remotes.get(key);
        if (!rm) continue;
        if (id === meId) {
          // este corpo agora é meu (entrei no lugar de um bot): some da cena dos outros
          if (rm.shown) {
            rm.shown = false;
            rm.alive = false;
            scene.hideTarget(key);
          }
          continue;
        }
        const alive = (r.flags & 1) !== 0;
        rm.buf.push({ t: now, x: r.x, y: r.y, z: r.z, yaw: r.yaw, pitch: r.pitch, crouch: r.crouch, flags: r.flags });
        if (rm.buf.length > 24) rm.buf.shift();
        rm.weapon = r.weapon;
        const team = (r.flags & 128) !== 0 ? 't' : 'ct';
        if (rm.team !== team) {
          rm.team = team;
          scene.setTeam(key, team);
        }
        rm.teamBit = (r.flags & 128) !== 0 ? 1 : 0;
        if (alive && (!rm.alive || !rm.shown)) {
          rm.alive = true;
          rm.shown = true;
          scene.reviveTarget(key);
          scene.setBot(key, r.x, r.y, r.z, fsDmHeading(r.yaw), 'idle', 1);
        } else if (!alive && rm.alive) {
          rm.alive = false;
          const from = killFrom.get(id) ?? [r.x, r.z + 1];
          scene.killTarget(key, from[0], from[1], 1.4);
        }
      }
      // aliados (mesmo time que eu): nome em cima da cabeça e silhueta por trás das paredes, como no CS
      const mine = rows.get(meId);
      const myBit = mine && isPlayerNow() ? ((mine.flags & 128) !== 0 ? 1 : 0) : undefined;
      for (const [key, rm] of remotes) {
        const idx = Number(key.slice(1));
        const who = rosterNow()[idx];
        // hoje é todos contra todos: sem aliados (nome em cima da cabeça e silhueta por trás da parede só quando houver times)
        // morto não mostra nome nem silhueta; a silhueta só aparece quando há parede no meio (de frente o próprio corpo basta)
        const ally = (FS_TEAMS_ACTIVE || !!bf) && !!who && who.id !== meId && myBit !== undefined && rm.teamBit === myBit && rm.alive && rm.shown;
        let ghost = false;
        if (ally) {
          const row = rows.get(who!.id);
          if (row) ghost = !fsClearLine(ARENA, [mover.x, mover.y + fsEyeHeight(mover), mover.z], [row.x, row.y + 0.9, row.z]);
        }
        if (rm.ally !== ally || rm.allyGhost !== ghost || (ally && (rm.allyName !== who?.name || rm.allyTeam !== rm.team))) {
          rm.ally = ally;
          rm.allyGhost = ghost;
          rm.allyName = who?.name;
          rm.allyTeam = rm.team;
          scene.setAlly(key, ally, who?.name ?? '', rm.team === 't' ? 't' : 'ct', ghost);
        }
      }
      // granadas no ar
      const seen = new Set<number>();
      for (const g of fr.f.g) {
        const id = g[0]!;
        seen.add(id);
        const kind: FsGrenadeId = g[1] === 0 ? 'frag' : 'flash';
        let h = nades.get(id);
        if (h === undefined) {
          h = scene.addGrenade(kind);
          nades.set(id, h);
        }
        scene.setGrenade(h, g[2]! / 100, g[3]! / 100, g[4]! / 100, now * 0.01);
        nadeLast.set(id, [g[2]! / 100, g[3]! / 100, g[4]! / 100]);
      }
      for (const [id, h] of [...nades]) {
        if (!seen.has(id)) {
          scene.removeGrenade(h);
          nades.delete(id);
        }
      }
      for (const e of fr.e ?? []) {
        const n = (e as { n?: number }).n;
        if (typeof n === 'number') {
          if (n <= lastEvN) continue;
          lastEvN = n;
        }
        onEvent(e);
      }
      if (fr.s) pendingSelf = fr.s;
    };

    const onEvent = (e: FsNetEvent) => {
      const px = mover.x;
      const pz = mover.z;
      if (e.k === 'shot') {
        if (e.by === meId) return;
        // escutei o tiro de alguém (ao alcance do som da arma): aparece no radar e vai atualizando enquanto atira
        if (isPlayerNow() && e.by !== meId) intel.hearShot(e.by, e.from[0], e.from[2], e.w, mover.x, mover.z, performance.now() / 1000, rows.get(e.by)?.yaw ?? 0);
        const o = new THREE.Vector3(e.from[0], e.from[1], e.from[2]);
        scene.tracer(o, new THREE.Vector3(e.to[0], e.to[1], e.to[2]), e.w);
        scene.puff(o, 0xffd27a, 0.25, 0.1);
        fsAudio.shotAt(e.w, e.from[0], 1, e.from[2], px, pz);
      } else if (e.k === 'hit') {
        if (e.by === meId) {
          if (e.kill) {
            fsAudio.hit('kill');
          } else {
            fsAudio.hit(e.head ? 'head' : e.armor ? 'armor' : 'body');
            showMarker(e.head ? 'head' : e.armor ? 'armor' : 'body', `-${e.dmg}`);
          }
        }
        if (e.vic !== meId) {
          const k = slotOf(e.vic);
          if (k) scene.hitTarget(k);
        }
      } else if (e.k === 'hurt') {
        if (e.vic !== meId) return;
        hurtKey++;
        hurtAt = performance.now();
        shake = Math.max(shake, e.head ? 2.6 : 0.5);
        recent = recent.filter((r) => clock - r.t < 1.2);
        recent.push({ t: clock, d: e.dmg });
        if (e.dmg >= 35 || recent.reduce((s, r) => s + r.d, 0) >= 55) {
          heavyKey++;
          heavyAt = performance.now();
        }
        flinch = fsFlinch(e.dmg);
        flinchAt = clock;
        hitMarks.push({ x: e.x, z: e.z, at: performance.now() });
        if (hitMarks.length > 4) hitMarks.shift();
      } else if (e.k === 'kill') {
        const kr = rows.get(e.killer);
        const vr = rows.get(e.victim);
        if (kr && e.victim !== meId) killFrom.set(e.victim, [kr.x, kr.z]);
        else if (vr) killFrom.set(e.victim, [vr.x, vr.z + 1]);
        if (e.victim !== meId) {
          const vk = slotOf(e.victim);
          const rm = vk ? remotes.get(vk) : undefined;
          if (vk && rm && rm.alive && kr) {
            rm.alive = false;
            scene.killTarget(vk, kr.x, kr.z, 1.4);
          }
        }
        if (e.killer === meId) showMarker('kill', e.head ? 'CABEÇA' : 'ABATE');
        else if (e.assist === meId) showMarker('body', 'ASSISTÊNCIA');
        pushFeed({ killer: nameOf(e.killer), weapon: e.w, victim: nameOf(e.victim), head: e.head, you: e.killer === meId, youVictim: e.victim === meId, assist: e.assist ? nameOf(e.assist) : undefined, youAssist: e.assist === meId, wall: e.wall, noscope: e.noscope, blindKiller: e.blind });
      } else if (e.k === 'boom') {
        scene.explosion(e.kind, e.x, e.y, e.z);
        fsAudio.nadeAt(e.kind === 'frag' ? 'boom-frag' : 'boom-flash', e.x, e.y, e.z, px, pz);
      } else if (e.k === 'flash') {
        if (e.vic !== meId) return;
        if (e.blind > 0) {
          blindTotal = e.blind;
          blindUntil = clock + e.blind;
        }
        if (e.deaf > 0) fsAudio.deafen(e.deaf);
      } else if (e.k === 'spawn') {
        if (e.id === meId) {
          deadSince = -1;
          // todo nascimento (inclusive novo round da Bomba) volta com os pentes cheios; granadas, colete e capacete ficam como estão
          loadout.refillAmmo();
        }
      }
    };

    /** Confere o próprio corpo com o do servidor e refaz as entradas que ele ainda não viu (previsão com correção). */
    const reconcile = (s: SelfState) => {
      const aliveNow = s.alive;
      if (!aliveNow || (aliveNow && !wasAlive)) blindUntil = 0;
      if (!haveSelf || (aliveNow && !wasAlive) || !aliveNow) {
        mover.x = s.x; mover.y = s.y; mover.z = s.z;
        mover.vx = s.vx; mover.vy = s.vy; mover.vz = s.vz;
        mover.onGround = s.og;
        mover.crouchK = s.ck;
        prev.x = mover.x; prev.y = mover.y; prev.z = mover.z;
        pending.length = 0;
        errOff.x = errOff.y = errOff.z = 0;
        if (!haveSelf || (aliveNow && !wasAlive)) {
          // renasceu: pentes cheios (as granadas gastas não voltam)
          if (haveSelf) loadout.refillAmmo();
          view.yaw = s.yaw;
          view.pitch = 0;
          view.rPitch = view.rYaw = 0;
        }
        haveSelf = true;
        wasAlive = aliveNow;
        return;
      }
      while (pending.length && pending[0]!.seq <= s.seq) pending.shift();
      const ox = mover.x, oy = mover.y, oz = mover.z;
      const m: FsMover = { x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, onGround: s.og, crouchK: s.ck };
      for (const p of pending) stepPred(m, p);
      const dx = ox - m.x, dy = oy - m.y, dz = oz - m.z;
      if (Math.hypot(dx, dz) > 3 || Math.abs(dy) > 2) {
        // erro grande: encaixa na hora
        errOff.x = errOff.y = errOff.z = 0;
      } else {
        // erro pequeno: o corpo vai para o valor certo e a câmera desliza até lá
        errOff.x += dx; errOff.y += dy; errOff.z += dz;
      }
      Object.assign(mover, m);
      prev.x += 0; // a posição anterior da interpolação acompanha
      wasAlive = aliveNow;
    };
    const stepPred = (m: FsMover, p: Pending) => {
      for (let i = 0; i < 2; i++) fsStepMover(m, { fwd: p.fwd, strafe: p.strafe, jump: p.jump && i === 0, yaw: p.yaw, speedMul: p.mul, crouch: p.crouch, walk: p.walk }, 1 / 120, ARENA);
    };

    // ---- armas locais (para a animação, o som e o recuo); quem decide acerto e munição é o servidor
    const afterEquip = () => scene.selectWeapon(loadout.weapon.id);
    const handle = (events: ReturnType<FsLoadout['update']>) => {
      for (const e of events) {
        if (e.type === 'fire') fireLocal(e.weapon.id, e.shot);
        else if (e.type === 'melee') {
          scene.knifeSwing(e.kind);
          fsAudio.shot('knife');
        } else if (e.type === 'inspect') {
          if (e.weapon.id === 'knife') scene.knifeInspect(true, e.weapon.inspect);
          else scene.gunInspect(true, e.weapon.inspect);
        } else if (e.type === 'dry') fsAudio.dry();
        else if (e.type === 'reload') {
          fsAudio.magOut();
          scene.startReload();
          magInPlayed = false;
          chargePlayed = false;
        } else if (e.type === 'reloaded') {
          scene.endReload();
          if (e.weapon.id === 'sniper') fsAudio.bolt();
        } else if (e.type === 'draw') {
          fsAudio.draw();
          scene.selectNade(null);
          scene.selectWeapon(loadout.weapon.id);
        } else if (e.type === 'grenadeDraw') {
          fsAudio.draw();
          scene.selectNade(e.grenade);
        } else if (e.type === 'pin') {
          fsAudio.nade('pin');
          scene.nadePin();
        } else if (e.type === 'throw') {
          fsAudio.nade('throw');
          scene.nadeThrow(e.style);
        } else if (e.type === 'bolt') boltAt = clock + 0.45;
      }
    };
    const fireLocal = (id: FsWeaponId, shot: { kickPitch: number; kickYaw: number; devYaw: number; devPitch: number; pellets?: { devYaw: number; devPitch: number }[] }) => {
      const w = FS_WEAPONS[id];
      const eye: [number, number, number] = [mover.x, mover.y + fsEyeHeight(mover), mover.z];
      const from = scene.muzzleWorld();
      const bodies = bodiesNow(performance.now() - interpMs());
      for (const ray of shot.pellets ?? [{ devYaw: shot.devYaw, devPitch: shot.devPitch }]) {
        const dir = fsDir(view.yaw + view.rYaw + ray.devYaw, view.pitch + view.rPitch + ray.devPitch);
        const tr = fsTrace(w, eye, dir, ARENA, bodies);
        const to = new THREE.Vector3(tr.point[0], tr.point[1], tr.point[2]);
        scene.tracer(from, to, id);
        if (tr.kind === 'world') {
          scene.puff(to, 0xd8c8a8, 0.3, 0.4);
          fsAudio.impact();
        } else if (tr.kind === 'player') scene.puff(to, tr.zone === 'head' ? 0xffd45a : 0xff9a4a, 0.4, 0.3);
      }
      scene.fireFx(({ sniper: 2.4, shotgun: 3.2, pistol: 0.5, usp: 0.28, smg: 0.8, m4: 0.95, ak: 1, knife: 0 } as Record<FsWeaponId, number>)[id]);
      fsAudio.shot(id);
      view.rPitch += shot.kickPitch;
      view.rYaw += shot.kickYaw;
    };
    const switchTo = (i: number) => {
      const ev = loadout.switchTo(i);
      if (!ev.length) return;
      cmdQueue.push({ t: 'slot', i });
      scene.selectWeapon(loadout.weapon.id);
      handle(ev);
    };
    buyRef.current = (item) => {
      if (bf) {
        if (!bombSelf?.buy || !inBaseNow()) return sayHint('Só dá para comprar na base, no tempo de compra');
        const cost = fsShopPrice(item, self?.armor ?? 0, self?.helmet ?? false);
        if (item.id === 'vesthelm' && cost === 0) return sayHint('Você já tem colete e capacete');
        if (cost > (bombSelf?.money ?? 0)) return sayHint('Dinheiro insuficiente');
        if (item.kit) {
          if (bombSelf?.side !== 'ct') return sayHint('O alicate é só dos contra-terroristas');
          if (bombSelf.kit) return sayHint('Você já tem o alicate');
          bombSelf.kit = true;
          bombSelf.money -= item.price;
          cmdQueue.push({ t: 'buy', id: item.id });
          fsAudio.draw();
          return;
        }
      }
      const r = fsBuy(loadout, item.id);
      if (!r.ok) return;
      if (bombSelf) bombSelf.money -= fsShopPrice(item, self?.armor ?? 0, self?.helmet ?? false);
      cmdQueue.push({ t: 'buy', id: item.id });
      if (!fsShopItem(item.id)?.grenade) afterEquip();
      fsAudio.draw();
    };

    /** Mantém o que a pessoa tem (armas, munição, granadas) igual ao do servidor. */
    const syncLoadout = (s: SelfState) => {
      s.slots.forEach((w, i) => {
        const have = loadout.slots[i]?.id ?? null;
        const want = w >= 0 ? fsNetWeaponId(w) : null;
        if (want && have !== want) {
          loadout.equip(want);
          if (i === loadout.current) afterEquip();
        } else if (!want && have && i !== 2) {
          // o servidor tirou a arma (morreu e perdeu tudo): some também aqui, e a mão vai para a que sobrou
          loadout.slots[i] = null;
          if (loadout.current === i) {
            const next = loadout.slots.findIndex((x) => !!x);
            loadout.switchTo(next < 0 ? 2 : next);
            loadout.drawT = 0;
            afterEquip();
          }
        }
      });
      loadout.grenades.frag = s.nades.frag;
      loadout.grenades.flash = s.nades.flash;
      if (!loadout.held && !loadout.reloading && !loadout.inspecting && Math.abs(loadout.slot.ammo - s.ammo) > 0 && loadout.cooldown <= 0) loadout.slot.ammo = s.ammo;
    };

    // ---- laço do quadro
    const frame = (now: number) => {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      const dtReal = Math.min(0.25, (now - last) / 1000);
      const dt = Math.min(0.05, dtReal);
      last = now;
      fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
      const st = fsSettings();
      applyQuality();
      const phase = snapRef.current.phase;
      const live = phase === 'play';
      const player = isPlayerNow();
      if (player !== wasPlayer) {
        wasPlayer = player;
        if (player) {
          // virou jogador: o corpo vem do servidor e a pessoa clica em Continuar para prender o mouse
          haveSelf = false;
          self = null;
          wasAlive = true;
          pendingSelf = null;
          pending.length = 0;
          setPaused(true);
          bigMapRef.current = false;
          setBigMap(false);
        }
      }
      const isPaused = pausedRef.current;
      const inpRaw = controls.read();
      const inp = forced ? { ...inpRaw, fwd: forced.fwd, strafe: forced.strafe } : inpRaw;
      const perfNow = performance.now();

      // quadros do servidor
      while (inbox.length) applyFrame(inbox.shift()!, perfNow);
      if (pendingSelf) {
        const s = pendingSelf;
        pendingSelf = null;
        const wasDead = !!self && !self.alive;
        self = s;
        bombSelf = s.bomb ?? null;
        if (bombSelf && clock - bombHeldAt > 0.5) bombHeld = !!bombSelf.held;
        if (bombSelf) {
          if (sidePrev && sidePrev !== bombSelf.side) swapKey++;
          sidePrev = bombSelf.side;
        }
        reconcile(s);
        syncLoadout(s);
        if (!s.alive && deadSince < 0) deadSince = clock;
        if (s.alive && wasDead) deadSince = -1;
      }
      const alive = !self || self.alive;
      const deathK = !alive && deadSince >= 0 ? Math.min(1, (clock - deadSince) / 0.7) : 0;
      scene.hideViewmodel = !player || deathK > 0.15;

      let adsOn = false;
      const w = loadout.weapon;
      if (!isPaused) clock += dt;
      if (live && haveSelf && !isPaused) {
        // o botão de mirar segurado não pode piscar: uma queda de 0,12 s no sinal não solta a mira
        const sn = w.adsFov > 0;
        if (!sn || loadout.reloading || loadout.held) zoomLvl = 0;
        if (!alive) zoomLvl = 0;
        if (sn && !loadout.reloading && inp.ads && !adsPrev) zoomLvl = (zoomLvl + 1) % 3;
        adsPrev = inp.ads;
        aimHeld = sn ? zoomLvl > 0 : inp.ads;
        adsHold = aimHeld ? 0.12 : Math.max(0, adsHold - dt);
        adsOn = alive && (aimHeld || adsHold > 0) && !loadout.reloading && !w.melee;
        const adsScale = Math.min(1, (zoomFov(w.adsFov) || 62) / st.fov) * st.adsSens;
        const look = controls.takeLook(adsOn ? adsScale : 1);
        view.yaw += look.yaw;
        view.pitch = Math.max(-88, Math.min(88, view.pitch + look.pitch));
        if (inp.map) setMap(!bigMapRef.current);
        if (inp.buy) {
          if (!bf) setShop(!shopRef.current);
          else if (shopRef.current) setShop(false);
          else if (!bombSelf?.buy) sayHint('A loja só abre no tempo de compra, na base');
          else if (!inBaseNow()) sayHint('Volte para a base para comprar');
          else setShop(true);
        }
        const shopOpen = shopRef.current;
        if (alive) {
          if (inp.bombSlot && !shopOpen) {
            const myI = rosterNow().findIndex((r) => r.id === meId);
            if (bf && bf[8] === myI && myI >= 0 && (bf[0] === 0 || bf[0] === 1)) {
              bombHeld = !bombHeld;
              bombHeldAt = clock;
              cmdQueue.push({ t: 'bombslot' });
              fsAudio.draw();
              sayHint(bombHeld ? `C4 na mão: vá a um pátio e segure ${bombKey()} para plantar` : 'C4 guardada', 1800);
            } else if (bf) sayHint('Só o terrorista que leva a bomba pode pegá-la na mão', 1800);
          }
          if (inp.pick >= 0 && !shopOpen) {
            bombHeld = false;
            switchTo(inp.pick);
          }
          else if (inp.cycle && !shopOpen) {
            bombHeld = false;
            cmdQueue.push({ t: 'cycle', d: 1 });
            handle(loadout.cycleAll(1));
          }
          if (inp.drop && bf && bf[8] === rosterNow().findIndex((r) => r.id === meId) && bf[8]! >= 0) cmdQueue.push({ t: 'dropbomb' });
          if (inp.grenade) {
            bombHeld = false;
            cmdQueue.push({ t: 'nade', k: 'next' });
            handle(loadout.selectGrenade('next'));
          }
          if (inp.grenadeFrag) {
            cmdQueue.push({ t: 'nade', k: 'frag' });
            handle(loadout.selectGrenade('frag'));
          }
          if (inp.grenadeFlash) {
            cmdQueue.push({ t: 'nade', k: 'flash' });
            handle(loadout.selectGrenade('flash'));
          }
        }
        if (inp.jump) jumpBuf = 0.15;
        // o relógio da simulação segue o tempo real (o servidor não espera): numa tela lenta roda vários passos por quadro
        acc += dtReal;
        let reloadOnce = inp.reload;
        let inspectOnce = inp.inspect;
        while (acc >= TICK) {
          acc -= TICK;
          prev.x = mover.x; prev.y = mover.y; prev.z = mover.z;
          const mul = loadout.weapon.moveMul * (adsOn ? 0.65 : 1) * fsFlinchAt(flinch, clock - flinchAt);
          const frozen = bombFrozen();
          const p: Pending = { seq: ++seq, fwd: alive && !frozen ? inp.fwd : 0, strafe: alive && !frozen ? inp.strafe : 0, jump: alive && !frozen && jumpBuf > 0, yaw: view.yaw, mul, crouch: alive && inp.crouch, walk: alive && inp.walk };
          const wasGround = mover.onGround;
          if (alive) {
            stepPred(mover, p);
            pending.push(p);
            if (pending.length > 120) pending.shift();
          }
          if (wasGround && !mover.onGround && jumpBuf > 0) jumpBuf = 0;
          jumpBuf = Math.max(0, jumpBuf - TICK);
          const cmds = cmdQueue.splice(0, 4);
          outbox.push({
            seq: p.seq, fwd: p.fwd, strafe: p.strafe, jump: p.jump, crouch: p.crouch, walk: p.walk,
            yaw: view.yaw + view.rYaw, pitch: view.pitch + view.rPitch,
            trigger: alive && inp.trigger && !shopOpen && !bombFrozen(), alt: alive && aimHeld && !shopOpen, reload: alive && reloadOnce, inspect: alive && inspectOnce, use: alive && inp.use,
            viewTick: Math.round(lastK + ((perfNow - lastFrameAt) / 1000) * 60 - (interpMs() / 1000) * 60),
            cmds,
          });
          reloadOnce = false;
          inspectOnce = false;
          if (outbox.length > 8) outbox.shift();
          sendT++;
          if (sendT >= 2) {
            sendT = 0;
            netRef.current!.link.sendInput(outbox.slice(-4));
          }
        }
        // movimento local de som: passos
        const speed = Math.hypot(mover.vx, mover.vz);
        const quiet = inp.crouch || inp.walk;
        if (alive && mover.onGround && speed > 1.5 && !quiet) {
          stepT -= dt * (speed / 3.4);
          if (stepT <= 0) {
            fsAudio.step();
            stepT = 0.5;
          }
        }
        // armas locais
        if (alive) {
          const mv = { moving: speed > 0.8, speed, airborne: !mover.onGround, ads: adsOn, crouch: mover.crouchK > 0.5 };
          const wasInspecting = loadout.inspecting;
          handle(loadout.update(dt, { trigger: inp.trigger && !shopOpen, reload: inp.reload, alt: aimHeld && !shopOpen, inspect: inp.inspect }, mv, meId));
          if (wasInspecting && !loadout.inspecting) {
            scene.knifeInspect(false);
            scene.gunInspect(false);
          }
          if (loadout.reloading) {
            const pr = 1 - loadout.reloadT / loadout.weapon.reload;
            scene.setReloadProgress(pr);
            if (pr > 0.68 && !magInPlayed) {
              magInPlayed = true;
              fsAudio.magIn();
            }
            if (pr > 0.82 && !chargePlayed) {
              chargePlayed = true;
              fsAudio.bolt();
            }
          }
          if (boltAt > 0 && clock >= boltAt) {
            boltAt = -1;
            fsAudio.bolt();
          }
          if (loadout.slot.gun.since > 0.08) {
            const rec = loadout.weapon.recoilRecover * dt;
            const dec = (v: number) => (Math.abs(v) <= rec ? 0 : v - Math.sign(v) * rec);
            view.rPitch = dec(view.rPitch);
            view.rYaw = dec(view.rYaw);
          }
          if (loadout.held) scene.nadeCharge(loadout.pinOut ? (loadout.throwStyle === 'far' ? 1 : loadout.throwStyle === 'mid' ? 0.6 : 0.1) : 0);
        }
      }

      // jogadores remotos: posição interpolada 100 ms atrás
      const rt = perfNow - interpMs();
      // assistindo em primeira pessoa: a raposa seguida some (a câmera está dentro da cabeça dela)
      const followSlot = (!player || (!!bf && !alive)) && followId ? slotOf(followId) : null;
      for (const [id, rm] of remotes) {
        if (id === followSlot) {
          scene.hideTarget(id);
          continue;
        }
        if (!rm.shown || !rm.alive) {
          scene.setShield(id, false);
          continue;
        }
        const p = sample(rm.buf, rt);
        if (!p) continue;
        const moving = (p.flags & 64) !== 0;
        const shooting = (p.flags & 8) !== 0;
        const crouching = p.crouch > 0.5;
        const anim = shooting ? 'shoot' : moving ? (crouching ? 'crouchwalk' : 'run') : crouching ? 'crouchwalk' : 'idle';
        scene.setBot(id, p.x, p.y, p.z, fsDmHeading(p.yaw), anim, moving ? 1 : crouching ? 0 : 1);
        scene.setShield(id, (p.flags & 256) !== 0);
      }

      // câmera: interpola o passo de 1/60 e desliza o erro de previsão
      errOff.x *= Math.exp(-12 * dt); errOff.y *= Math.exp(-12 * dt); errOff.z *= Math.exp(-12 * dt);
      const alpha = isPaused || !live ? 1 : Math.min(1, acc / TICK);
      const scoped = adsOn && loadout.weapon.adsFov > 0;
      const fov = st.fov + ((zoomFov(loadout.weapon.adsFov) || 62) - st.fov) * (adsOn ? 1 : 0);
      if (blindEl.current) {
        const left = isPaused ? 0 : blindUntil - clock;
        const o = left <= 0 ? 0 : left > blindTotal * 0.45 ? 1 : left / (blindTotal * 0.45);
        blindEl.current.style.opacity = String(Math.max(0, Math.min(1, o)));
      }
      // luneta da sniper: o círculo escuro e a cruz abrem junto com a mira fechando
      if (scopeEl.current) {
        const on = player && loadout.weapon.adsFov > 0 && !loadout.reloading && !isPaused && scene.adsAmount > 0.93 && adsOn && alive;
        scopeEl.current.style.opacity = on ? '1' : '0';
      }
      const arcs = hitEl.current?.children;
      for (let i = 0; arcs && i < arcs.length; i++) {
        const elA = arcs[i] as HTMLElement;
        const m = hitMarks[i];
        const age = m ? (perfNow - m.at) / 1000 : 9;
        if (!m || age > 1.6 || !alive) {
          elA.style.opacity = '0';
          continue;
        }
        const bearing = (Math.atan2(-(m.x - mover.x), -(m.z - mover.z)) * 180) / Math.PI;
        elA.style.transform = `rotate(${-(bearing - view.yaw)}deg)`;
        elA.style.opacity = String(Math.min(1, (1.6 - age) / 0.9));
      }
      if (!isPaused) shake *= Math.exp(-6 * dt);
      const sk = shake > 0.02 ? shake : 0;
      const e = deathK * deathK * (3 - 2 * deathK);
      const allyLive = !!bf && !alive && rosterNow().some((r) => r.id !== meId && remotes.get(slotOf(r.id) ?? '')?.alive && isAllyRow(r.id));
      if (!player || allyLive) {
        // espectando (ou morto no modo Bomba): câmera atrás da raposa que se segue (Esquerda e Direita trocam)
        const alivePeers = rosterNow().filter((r) => r.id !== meId && remotes.get(slotOf(r.id) ?? '')?.alive && (!bf || isAllyRow(r.id)));
        const cur = followId ? remotes.get(slotOf(followId) ?? '') : undefined;
        if (!cur || !cur.alive || !cur.shown) {
          const best = alivePeers.map((r) => ({ id: r.id, pts: fsMatchScore({ kills: rows.get(r.id)?.kills ?? 0, assists: rows.get(r.id)?.assists ?? 0 }) })).sort((a, b) => b.pts - a.pts)[0];
          if (best) followId = best.id;
        }
        const tr = followId ? remotes.get(slotOf(followId) ?? '') : undefined;
        const tp = tr ? sample(tr.buf, rt) : null;
        if (tp) {
          // primeira pessoa: exatamente a visão de quem está sendo seguido (olhos, direção e inclinação dele)
          cam.x = tp.x;
          cam.y = tp.y + fsEyeHeight({ ...mover, crouchK: tp.crouch });
          cam.z = tp.z;
          cam.yaw = tp.yaw;
          camPitch = tp.pitch;
          cam.ok = true;
        }
        if (cam.ok) {
          mover.x = cam.x;
          mover.y = cam.y - fsEyeHeight(mover);
          mover.z = cam.z;
          scene.setView(cam.x, cam.y, cam.z, cam.yaw, camPitch, st.fov, 0);
          view.yaw = cam.yaw;
          fsAudio.listener(cam.x, cam.y, cam.z, fsDir(cam.yaw, 0));
          // a arma de quem se assiste aparece na mão, como na visão dele
          if (tr && tp) {
            const wid = fsNetWeaponId(tr.weapon);
            if (wid && specWeapon !== wid) {
              specWeapon = wid;
              scene.selectWeapon(wid, true);
            }
            scene.hideViewmodel = !wid;
          }
        }
      } else {
        if (specWeapon) {
          // voltou a jogar: a sua própria arma de volta na mão
          specWeapon = null;
          scene.selectWeapon(loadout.weapon.id, true);
        }
      scene.setView(
        prev.x + (mover.x - prev.x) * alpha + errOff.x,
        smoothY(prev.y + (mover.y - prev.y) * alpha, dt) + errOff.y + fsEyeHeight(mover) - e * (fsEyeHeight(mover) - 0.22),
        prev.z + (mover.z - prev.z) * alpha + errOff.z,
        view.yaw + view.rYaw + (sk ? Math.sin(clock * 83) * sk : 0),
        view.pitch + view.rPitch + (sk ? Math.cos(clock * 71) * sk : 0) + e * 18,
        THREE.MathUtils.lerp(scene.fovNow ?? st.fov, fov, Math.min(1, dt * 12)),
        (sk ? Math.sin(clock * 97) * sk * 0.6 : 0) + e * 24,
      );
      }
      if (player) fsAudio.listener(mover.x, mover.y + fsEyeHeight(mover), mover.z, fsDir(view.yaw + view.rYaw, view.pitch + view.rPitch));
      scene.update(isPaused ? 0 : dt, { speed: Math.hypot(mover.vx, mover.vz), adsTarget: adsOn ? 1 : 0, airborne: !mover.onGround });
      // modo Bomba: C4 na cena. Plantando e desarmando aparecem para todos; plantada pisca e apita (o som sai dela)
      if (bf) {
        const myI = rosterNow().findIndex((r) => r.id === meId);
        const bx = bf[5]! / 100;
        const bz = bf[6]! / 100;
        const act = bf[16] ?? 0;
        if (bf[0] === 2) {
          scene.setBomb(bx, map.floorY(bx, bz), bz, act === 2 ? 'defusing' : 'armed', { left: bf[1]! / 10, now: clock, progress: (bf[15] ?? 0) / 100 });
          beepIn -= dt;
          if (beepIn <= 0) {
            const left = bf[1]! / 10;
            beepIn = left > 20 ? 1 : left > 10 ? 0.6 : left > 5 ? 0.35 : 0.16;
            fsAudio.bombBeep(bx, map.floorY(bx, bz) + 0.2, bz, mover.x, mover.z, 1 - Math.min(1, left / 40));
          }
        } else if (bf[0] === 1 && act === 1) {
          const actor = rows.get(rosterNow()[bf[14] ?? -1]?.id ?? '');
          const yr = actor ? (actor.yaw * Math.PI) / 180 : 0;
          const px = bx - Math.sin(yr) * 0.7;
          const pz = bz - Math.cos(yr) * 0.7;
          scene.setBomb(px, map.floorY(px, pz), pz, 'planting', { progress: (bf[15] ?? 0) / 100, now: clock, yaw: yr });
          if (plantActPrev !== 1 && bf[14] !== myI && bombSelf?.side === 'ct') sayHint('Terrorista plantando a bomba!', 2000);
        } else scene.setBomb(0, 0, 0, 'off');
        plantActPrev = bf[0] === 1 ? act : 0;
        const dropped = bf[11] === 1 && bf[0] !== 2 && bf[0] !== 3;
        scene.setBombDrop(bf[12]! / 100, map.floorY(bf[12]! / 100, bf[13]! / 100), bf[13]! / 100, dropped, clock);
        if ((dropped ? 1 : 0) !== dropPrev) {
          dropPrev = dropped ? 1 : 0;
          if (dropped && bf[0] !== 0) sayHint(bombSelf?.side === 'tr' ? `A bomba caiu no chão: ande até ela ou segure ${bombKey()}` : 'A bomba caiu', 2500);
        }
        const carrier = bf[8] ?? -1;
        if (carrier !== carrierPrev) {
          if (carrier === myI && myI >= 0 && carrierPrev !== -1) sayHint('Você pegou a bomba', 2000);
          carrierPrev = carrier;
        }
        // dicas de quem leva a C4
        if (carrier === myI && myI >= 0 && bf[0] === 1 && act !== 1) {
          const site = map.siteAt(mover.x, mover.z);
          const zKey = bindLabel(fsSettings().binds.bombSlot);
          if (!bombHeld) sayHint(site ? `Aperte ${zKey} para pegar a bomba na mão` : `Você tem a bomba: vá a um pátio A ou B e aperte ${zKey}`, 400);
          else if (!site) sayHint('Vá a um pátio A ou B para plantar', 400);
          else if (!inp.use) sayHint(`Segure ${bombKey()} para plantar a bomba`, 400);
          else sayHint('Fique parado para plantar', 400);
        }
        scene.setBombInHand(bombHeld && alive && carrier === myI, bombSelf?.plant ?? 0);
        if (carrier !== myI) bombHeld = false;
        if (dropped && bombSelf?.side === 'tr' && Math.hypot(mover.x - bf[12]! / 100, mover.z - bf[13]! / 100) < 6) sayHint(`Pegue a bomba: ande até ela ou segure ${bombKey()}`, 400);
      } else scene.setBomb(0, 0, 0, 'off');
      scene.render();

      if (st.quality === 'auto' && !isPaused) {
        const cap = (touch ? 'mid' : 'high') as Quality;
        if (dt > 1 / 42) {
          slowT += dt;
          fastT = 0;
        } else if (dt < 1 / 56) {
          fastT += dt;
          slowT = Math.max(0, slowT - dt);
        }
        if (slowT > 1.6 && scene.level !== 'low') {
          scene.setQuality(scene.level === 'high' ? 'mid' : 'low');
          slowT = 0;
        } else if (fastT > 8 && ((scene.level === 'low' && cap !== ('low' as Quality)) || (scene.level === 'mid' && cap === 'high'))) {
          scene.setQuality(scene.level === 'low' ? 'mid' : 'high');
          fastT = 0;
        }
      }

      // radar como o do CS: inimigos vistos ou escutados (e os aliados, quando houver times)
      intelT += dt;
      if (intelT > 0.06) {
        intelT = 0;
        const nowS = performance.now() / 1000;
        {
          const mineRow = rows.get(meId);
          const myTeam = ((mineRow?.flags ?? 0) & 128) !== 0 ? 1 : 0;
          const others = rosterNow().flatMap((r, idx) => {
            if (r.id === meId) return [];
            const row = rows.get(r.id);
            const rm = remotes.get(`s${idx}`);
            if (!row || !rm) return [];
            const b = rm.buf;
            const a1 = b[b.length - 1];
            const a0 = b[Math.max(0, b.length - 4)];
            const sp = a1 && a0 && a1.t > a0.t ? Math.hypot(a1.x - a0.x, a1.z - a0.z) / ((a1.t - a0.t) / 1000) : 0;
            return [{ id: r.id, x: row.x, y: row.y, z: row.z, yaw: row.yaw, alive: (row.flags & 1) !== 0, team: ((row.flags & 128) !== 0 ? 1 : 0) as 0 | 1, loud: sp > 3.0 && row.crouch < 0.5 }];
          });
          if (player && alive) {
            intel.step(nowS, { x: mover.x, y: mover.y, z: mover.z, yaw: view.yaw, eye: mover.y + fsEyeHeight(mover), team: myTeam as 0 | 1 }, others, ARENA, FS_TEAMS_ACTIVE || !!bf);
            intelDots = intel.view(nowS).map((m) => ({ x: m.x, z: m.z, yaw: m.yaw, kind: m.kind, alpha: m.alpha, live: m.live }));
          } else {
            intel.clear();
            intelDots = [];
          }
          // os amigos aparecem sempre no minimapa, inclusive depois de morrer
          if (player && (FS_TEAMS_ACTIVE || bf)) for (const o of others) if (o.team === myTeam && o.alive) intelDots.push({ x: o.x, z: o.z, yaw: o.yaw, kind: 'ally', alpha: 1, live: true, name: nameOf(o.id) });
        }
      }
      mini.current = { x: mover.x, z: mover.z, yaw: view.yaw, targets: [], boxes: ARENA, plan, labels: world.labels, marks: map.marks, intel: intelDots };
      if (player) setBoardState(inp.board && !isPaused);

      hudT += dt;
      if (hudT > 0.1) {
        hudT = 0;
        const sc = scene.stats();
        const players: FsPlayerRow[] = rosterNow().map((r, idx) => {
          const row = rows.get(r.id);
          const mine = r.id === meId;
          const k = row?.kills ?? 0;
          const a = row?.assists ?? 0;
          return { id: r.id, name: r.name, you: mine, alive: mine ? alive : row ? (row.flags & 1) !== 0 : true, armor: mine ? self?.armor ?? 0 : row?.armor ?? 0, kills: k, deaths: row?.deaths ?? 0, assists: a, hs: row?.hs ?? 0, damage: row?.damage ?? 0, points: fsMatchScore({ kills: k, assists: a }), team: ((row?.flags ?? 0) & 128) !== 0 ? ('t' as const) : ('ct' as const), money: mine ? bombSelf?.money : bombSelf?.mates?.[idx] };
        });
        const mp = players.find((p) => p.you);
        setHud({
          hp: self?.hp ?? 100, armor: self?.armor ?? 0, helmet: self?.helmet ?? false, hurtKey, heavyKey,
          hurtAge: (performance.now() - hurtAt) / 1000, heavyAge: (performance.now() - heavyAt) / 1000,
          dead: !alive, respawnIn: bf ? 0 : self?.respawnIn ?? 0, shield: alive && !bf ? self?.shield ?? 0 : 0, deadAge: !alive && deadSince >= 0 ? Math.max(0, clock - deadSince) : 0, follow: bf && !alive && followId ? nameOf(followId) : null,
          bomb: bf && bombSelf ? ((): BombHud => {
            const phase = (['buy', 'live', 'planted', 'end', 'over'] as const)[bf![0]!] ?? 'live';
            const allyAlive = players.filter((q) => q.team === (bombSelf!.side === 'tr' ? 't' : 'ct') && q.alive).length;
            const foeAlive = players.filter((q) => q.team !== (bombSelf!.side === 'tr' ? 't' : 'ct') && q.alive).length;
            const meIdx = rosterNow().findIndex((r) => r.id === meId);
            return {
              round: bf![2]!, winRounds: bombSelf!.win, tr: bf![3]!, ct: bf![4]!, mySide: bombSelf!.side, phase, time: bf![1]! / 10,
              money: Math.max(0, bombSelf!.money), plant: bombSelf!.plant, defuse: bombSelf!.defuse, site: bf![7] === 1 ? 'A' : bf![7] === 2 ? 'B' : null,
              swapKey, carrier: bf![8] === meIdx && meIdx >= 0, banner: bombBanner && bombBanner.until > clock ? bombBanner.text : null,
              hint: bombHint && bombHint.until > clock ? bombHint.text : null, alliesAlive: allyAlive, foesAlive: foeAlive, kit: !!bombSelf!.kit, pvp: !!snapRef.current.foxshot?.pvp,
            };
          })() : null,
          ammo: loadout.held ? loadout.grenades[loadout.held] : loadout.slot.ammo,
          mag: loadout.held ? FS_GRENADES[loadout.held].max : loadout.weapon.mag,
          weapon: loadout.held ? FS_GRENADES[loadout.held].name : loadout.weapon.name,
          weaponId: loadout.weapon.id, heldNade: loadout.held,
          nades: (['frag', 'flash'] as FsGrenadeId[]).filter((k) => loadout.grenades[k] > 0).map((k) => ({ id: k, name: FS_GRENADES[k].name, count: loadout.grenades[k], key: bindLabel((k === 'frag' ? fsSettings().binds.grenadeFrag : fsSettings().binds.grenadeFlash) || fsSettings().binds.grenade) })),
          speed: Math.round(Math.hypot(mover.vx, mover.vz) * 10) / 10,
          slots: loadout.slots.map((sl, i) => ({ id: sl?.id ?? null, name: sl ? FS_WEAPONS[sl.id].name : '', key: i + 1 })),
          current: loadout.current, reloading: !loadout.held && loadout.reloading, scoped,
          spreadPx: Math.min(60, fsSpreadDeg(loadout.weapon, { moving: Math.hypot(mover.vx, mover.vz) > 0.8, speed: Math.hypot(mover.vx, mover.vz), airborne: !mover.onGround, ads: adsOn }, loadout.slot.gun) * 4),
          fps: Math.round(fps), timeLeft, players, points: mp?.points ?? 0, tris: sc.tris, calls: sc.calls, level: scene.level, dpr: Math.round(scene.renderer.getPixelRatio() * 100) / 100,
          pos: [mover.x, mover.y, mover.z], k: lastK, spec: player ? null : followId ? nameOf(followId) : '',
        });
        const startAt = snapRef.current.foxshot?.startAt;
        setCount(phase === 'show' && startAt ? Math.max(0, Math.ceil((startAt - serverNow()) / 1000)) : null);
      }
    };
    let slowT = 0;
    let fastT = 0;

    scene
      .load()
      .then(() => {
        if (dead) return;
        scene.selectWeapon(loadout.weapon.id, true);
        for (const id of SLOTS) scene.hideTarget(id);
        setStatus('ready');
        last = performance.now();
        raf = requestAnimationFrame(frame);
      })
      .catch(() => setStatus('error'));

    if (import.meta.env.DEV) {
      (window as unknown as { __fsn?: unknown }).__fsn = {
        state: () => ({ mover: { ...mover }, view: { ...view }, self, k: lastK, left: timeLeft, rows: [...rows.values()], pending: pending.length, seq, roster: rosterNow(), me: meId, phase: snapRef.current.phase, direct: !!netRef.current?.direct, net: snapRef.current.foxshot?.net ?? 'server', rtt: netRef.current?.link.rtt() ?? -1 }),
        setView: (yaw: number, pitch: number) => {
          view.yaw = yaw;
          view.pitch = pitch;
          view.rPitch = view.rYaw = 0;
        },
        move: (fwd: number, strafe = 0) => {
          forced = fwd || strafe ? { fwd, strafe } : null;
        },
        fireBtn: (on: boolean) => controls.setTouch('fire', on),
        buy: (id: string) => buyRef.current({ id } as FsShopItem),
        aimAt: (id: string) => {
          const r = rows.get(id);
          if (!r) return;
          const dx = r.x - mover.x, dz = r.z - mover.z, dy = r.y + 0.9 - (mover.y + fsEyeHeight(mover));
          view.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
          view.pitch = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
          view.rPitch = view.rYaw = 0;
        },
        resume: () => resume(),
        ads: () => ({ amount: scene.adsAmount, locked: controls.locked, enabled: controls.enabled, paused: pausedRef.current }),
      };
    }

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      controls.detach();
      scene.dispose();
      try {
        (navigator as Navigator & { keyboard?: { unlock?: () => void } }).keyboard?.unlock?.();
        if (document.fullscreenElement) void document.exitFullscreen();
      } catch {
        /* sem tela cheia para sair */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setBoardState = useCallback((v: boolean) => setBoard((b) => (b === v ? b : v)), []);
  const h = hud;
  const players = h?.players ?? [];
  const spectating = !!h && h.spec !== null;
  const canPlay = (snapshot.foxshot?.roster ?? []).some((r) => r.bot) || (snapshot.foxshot?.roster?.length ?? 0) < 10;
  const playNow = () => {
    setDecided(true);
    sendRoom('fsplay');
  };

  return (
    <div className="fs" ref={root} data-testid="fs-root">
      <canvas ref={canvas} className="fs-canvas" data-testid="fs-canvas" />
      <div className="fs-blind" ref={blindEl} data-testid="fs-blind" aria-hidden="true" />
      <div className="fs-hitdir" ref={hitEl} data-testid="fs-hitdir" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      {!mePlayer && !decided && snapshot.phase !== 'lobby' && (
            <div className="fsr-choice" role="dialog" aria-modal="true" aria-label="Entrar na partida" data-testid="fsr-choice">
              <div className="fsr-choice-card">
                <small>A PARTIDA JÁ COMEÇOU</small>
                <h2>Como você quer entrar?</h2>
                <button type="button" className="cfh-btn" onClick={playNow} data-sfx="start" data-testid="fsr-choice-play">
                  Entrar para jogar
                </button>
                <button type="button" className="cfh-btn ghost" onClick={() => setDecided(true)} data-sfx="back" data-testid="fsr-choice-watch">
                  Entrar para espectar
                </button>
              </div>
            </div>
          )}
      {status === 'loading' && <div className="fs-load mono">CARREGANDO O DUNA...</div>}
      {status === 'error' && <div className="fs-load mono">Não deu para carregar os modelos. Atualize a página.</div>}
      {h && status === 'ready' && (
        <>
          {!spectating && !h.scoped && <FsCrosshair spreadPx={h.spreadPx} />}
          {!spectating && (
            <div className="fs-scope" ref={scopeEl} aria-hidden="true" style={{ opacity: 0 }} data-testid="fs-scope">
              <i />
              <b />
            </div>
          )}
          {marker && (
            <div key={marker.key} className={`fs-marker ${marker.kind}`} aria-hidden="true" data-testid="fs-marker">
              <span className="fs-x" />
              <b>{marker.text}</b>
            </div>
          )}
          {h.bomb ? <FsBombHud b={h.bomb} /> : <FsTopBar players={players} timeLeft={h.timeLeft} kills={0} deaths={0} />}
          {settings.showMinimap && <FsMinimap get={getMini} />}
          {bigMap && <FsBigMap get={getMini} title={`Mapa · ${snapshot.foxshot?.pvp ? 'Arena de Blocos' : 'Duna'}`} />}
          <div className="fsh-rcol">
            {settings.showTelemetry && <FsTelemetry fps={h.fps} tris={h.tris} calls={h.calls} level={h.level} dpr={h.dpr} speed={h.speed} ref="" />}
            <FsKillFeed items={feed} />
          </div>
          {!!h.shield && !spectating && <FsShield frac={h.shield} />}
          {(h.hurtAge) < 0.45 && !h.dead && !spectating && <div key={`h${h.hurtKey}`} className="fs-hurt" aria-hidden="true" />}
          {(h.heavyAge) < 1.7 && !h.dead && !spectating && <div key={`v${h.heavyKey}`} className="fs-hurt heavy" aria-hidden="true" />}
          {h.dead && !paused && !spectating && (!h.bomb || h.deadAge < 2.5) && (
            <div className="fs-deadscreen" role="status" data-testid="fs-dead">
              <b>Você morreu</b>
              <span className="mono" data-testid="fs-respawn">{h.bomb ? 'Você vai assistir a um aliado até o fim do round' : `Renascendo em ${h.respawnIn.toFixed(1)}`}</span>
            </div>
          )}
          {h.dead && h.bomb && h.deadAge >= 2.5 && !paused && !spectating && (
            <div className="fs-specbar" role="status" data-testid="fs-specbar">
              <b>Assistindo {h.follow ?? 'ninguém'}</b>
              <span className="mono">← → trocam de aliado · espere o próximo round</span>
            </div>
          )}
          {!spectating && <FsVitals hp={h.hp} armor={h.armor} helmet={h.helmet} />}
          {!spectating && <FsAmmo weapon={h.weapon} id={h.weaponId} ammo={h.ammo} mag={h.mag} reloading={h.reloading} slots={h.slots} current={h.current} nades={h.nades} heldNade={h.heldNade} />}
          {spectating && !paused && (
            <div className="fsr-spec" data-testid="fsr-spec">
              <small>ESPECTANDO</small>
              <b data-testid="fsr-spec-name">{h.spec || '...'}</b>
              <span className="mono">Esquerda / Direita troca de jogador</span>
              {canPlay && (
                <button type="button" className="cfh-btn" onClick={playNow} data-sfx="start" data-testid="fsr-join-play">
                  Entrar para jogar
                </button>
              )}
            </div>
          )}
          {shop && !paused && (
            <FsShop
              money={h.bomb && !h.bomb.pvp ? h.bomb.money : null}
              kit={h.bomb ? (h.bomb.mySide === 'ct' ? (h.bomb.kit ? 'owned' : 'ok') : 'na') : 'na'}
              onBuy={(i) => buyRef.current(i)}
              onClose={() => setShop(false)}
              equipped={h.slots}
              nades={h.nades}
              armor={h.armor}
              helmet={h.helmet}
              owned={[
                ...h.slots.flatMap((x) => (x.id ? [x.id] : [])),
                ...(h.armor > 0 ? ['vest'] : []),
                ...(h.armor > 0 && h.helmet ? ['vesthelm'] : []),
                ...h.nades.filter((n) => n.count >= FS_GRENADES[n.id].max).map((n) => n.id),
              ]}
            />
          )}
          {board && <FsScoreboard bomb={h.bomb ? { mySide: h.bomb.mySide, tr: h.bomb.tr, ct: h.bomb.ct } : undefined} players={players} timeLeft={h.timeLeft} title={h.bomb ? (snapshot.foxshot?.pvp ? `PvP · Arena de Blocos · online · primeiro a ${h.bomb.winRounds}` : `Bomba · Duna · online · primeiro a ${h.bomb.winRounds}`) : `Mata-mata · Duna · online`} />}
          {count !== null && (
            <div className="fsr-count" role="status" data-testid="fsr-count">
              <FsPreMatch
                count={count}
                kind={snapshot.foxshot?.kind === 'bomb' ? 'bomb' : 'dm'}
                map={snapshot.foxshot?.pvp ? 'Arena de Blocos' : 'Duna'}
                pvp={!!snapshot.foxshot?.pvp}
                side={snapshot.foxshot?.kind === 'bomb' ? ((snapshot.foxshot?.teams?.[snapshot.me ?? ''] ?? 0) === 1 ? 'tr' : (snapshot.foxshot?.teams?.[snapshot.me ?? ''] ?? 0) === 0 ? 'ct' : null) : null}
                winRounds={snapshot.foxshot?.winRounds ?? 8}
                names={(snapshot.foxshot?.roster ?? []).filter((r) => !r.bot).map((r) => r.name)}
              />
            </div>
          )}
          {needClick && !paused && (
            <div className="fs-hint mono" data-testid="fs-needclick">
              Clique na tela para prender o mouse
            </div>
          )}
          {touchUi && !paused && !portrait && !spectating && (
            <>
              <button type="button" className="fs-menubtn" onClick={() => setPaused(true)} data-testid="fs-menubtn">
                Menu
              </button>
              <div className="fs-stick" ref={stickEl} aria-hidden="true">
                <i />
              </div>
              <div className="fs-tbtns">
                <button type="button" className="fs-tb fire" onPointerDown={() => press('fire', true)} onPointerUp={() => press('fire', false)} onPointerCancel={() => press('fire', false)} aria-label="Atirar">
                  ATIRAR
                </button>
                {h.bomb && (
                  <>
                  {h.bomb.carrier && (
                    <button type="button" className="fs-tb" data-testid="fs-tb-c4" onPointerDown={() => press('bombslot', true)} aria-label="Pegar a C4 na mão">
                      C4
                    </button>
                  )}
                  <button type="button" className="fs-tb" data-testid="fs-tb-use" onPointerDown={() => press('use', true)} onPointerUp={() => press('use', false)} onPointerCancel={() => press('use', false)} aria-label="Plantar ou desarmar">
                    BOMBA
                  </button>
                  </>
                )}
                <button type="button" className="fs-tb ads" onPointerDown={() => press('ads', true)} onPointerUp={() => press('ads', false)} onPointerCancel={() => press('ads', false)} aria-label="Mirar">
                  MIRAR
                </button>
                <button type="button" className="fs-tb" onPointerDown={() => press('jump', true)} aria-label="Pular">
                  PULAR
                </button>
                <button type="button" className="fs-tb" onPointerDown={() => press('reload', true)} aria-label="Recarregar">
                  RECARGA
                </button>
                <button type="button" className="fs-tb" onPointerDown={() => press('buy', true)} aria-label="Loja">
                  LOJA
                </button>
                <button type="button" className="fs-tb" onPointerDown={() => press('cycle', true)} aria-label="Trocar de arma">
                  TROCAR
                </button>
              </div>
            </>
          )}
          {portrait && (
            <div className="fs-rotate" role="alert" data-testid="fs-rotate">
              <div className="fs-card">
                <h2>Gire o aparelho</h2>
                <p className="mono">O Counter Fox só joga com o celular deitado.</p>
              </div>
            </div>
          )}
          {inviteOpen && <InviteDialog onClose={() => setInviteOpen(false)} />}
          <GameChat enabled onClosed={(wasLocked) => wasLocked && ctl.current?.requestLock()} />
          <PauseOverlay />
          {paused && (
            <FsMenu touch={touchUi} onResume={() => resumeRef.current()} onEnd={() => void leaveRoom()} onSuicide={() => suicideRef.current()} exitTo={null} online={{ onLeave: () => void leaveRoom() }}>
              <button type="button" className="fsm-item" onClick={() => setInviteOpen(true)} data-sfx="start" data-testid="fsr-invite">
                Convidar amigos
              </button>
              {spectating && canPlay && (
                <button type="button" className="fsm-item" onClick={playNow} data-sfx="start" data-testid="fsr-menu-play">
                  Entrar para jogar
                </button>
              )}

            </FsMenu>
          )}
        </>
      )}
    </div>
  );
}

export { sendRoom };
