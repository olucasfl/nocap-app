import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  FS_DUST_SOLIDS,
  FS_DUST_MARKS,
  FS_GRENADES,
  FS_WEAPONS,
  FsLoadout,
  fsBuy,
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
import { leaveRoom, sendRoom, sendRoomQuiet, serverNow, subscribeRoom, type RoomSnapshot } from '@/lib/rooms';
import { GameChat } from '@/components/GameChat';
import { InviteDialog } from '@/components/InviteDialog';
import { FoxShotScene, fsWorldDust, type Quality } from './FoxShotScene';
import { FsControls } from './fs-controls';
import { bindLabel, fsSettings, useFsSettings } from './fs-settings';
import { FsMenu } from './FsMenu';
import { FsShop } from './FsShop';
import { FsBigMap, FsAmmo, FsCrosshair, FsKillFeed, FsMinimap, FsScoreboard, FsTopBar, FsVitals, type FeedItem, type FsPlayerRow, type MinimapData } from './FsHud';
import { FoxShotRoomFinal } from './FoxShotRoomFinal';
import './foxshot.css';
import './counterfox-hub.css';

/** Passo da simulação (igual ao servidor) e atraso da interpolação dos outros jogadores. */
const TICK = 1 / 60;
const INTERP_MS = 100;
const ARENA = FS_DUST_SOLIDS;

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
}
interface SelfState {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; og: boolean; ck: number; seq: number; yaw: number; pitch: number;
  hp: number; armor: number; helmet: boolean; alive: boolean; respawnIn: number;
  cur: number; held: FsGrenadeId | null; ammo: number; reloading: boolean; slots: number[]; nades: Record<FsGrenadeId, number>;
}
interface Frame {
  f: { k: number; left: number; p: number[][]; g: number[][] };
  s: SelfState | null;
  e: FsNetEvent[];
}
interface RoomHud {
  hp: number; armor: number; helmet: boolean; hurtKey: number; heavyKey: number; hurtAge: number; heavyAge: number; dead: boolean; respawnIn: number;
  ammo: number; mag: number; weapon: string; weaponId: FsWeaponId; heldNade: FsGrenadeId | null;
  nades: { id: FsGrenadeId; name: string; count: number; key: string }[];
  speed: number; slots: { id: FsWeaponId | null; name: string; key: number }[]; current: number; reloading: boolean; scoped: boolean; spreadPx: number;
  spec: string | null;
  fps: number; timeLeft: number; players: FsPlayerRow[]; points: number; tris: number; calls: number; level: Quality; dpr: number; pos: number[]; k: number;
}
interface Snap {
  t: number;
  x: number; y: number; z: number; yaw: number; crouch: number; flags: number;
}
interface Pending {
  seq: number; fwd: number; strafe: number; jump: boolean; yaw: number; mul: number; crouch: boolean; walk: boolean;
}

const toRow = (r: number[]): Row => ({
  idx: r[0]!, x: r[1]! / 100, y: r[2]! / 100, z: r[3]! / 100, yaw: r[4]! / 10, pitch: r[5]! / 10, hp: r[6]!, armor: r[7]!, flags: r[8]!, weapon: r[9]!, crouch: r[10]! / 100, seq: r[11]!, kills: r[12]!, assists: r[13]!, deaths: r[14]!,
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
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const blindEl = useRef<HTMLDivElement>(null);
  const scopeEl = useRef<HTMLDivElement>(null);
  const hitEl = useRef<HTMLDivElement>(null);
  const ctl = useRef<FsControls | null>(null);
  const pausedRef = useRef(mePlayer);
  const shopRef = useRef(false);
  const buyRef = useRef<(item: FsShopItem) => void>(() => undefined);
  const resumeRef = useRef<() => void>(() => undefined);
  const mini = useRef<MinimapData>({ x: 0, z: 0, yaw: 0, targets: [] });
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  const settings = useFsSettings();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [paused, setPausedState] = useState(mePlayer);
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
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    let dead = false;
    let raf = 0;

    const controls = new FsControls();
    ctl.current = controls;
    controls.enabled = false;
    controls.attach(
      el,
      () => undefined,
      (locked) => {
        if (!locked && !pausedRef.current && !shopRef.current && !bigMapRef.current) setPaused(true);
        if (locked) {
          setPaused(false);
          setNeedClick(false);
        }
      },
    );
    const cycleFollow = (d: 1 | -1) => {
      const live = rosterNow().filter((r) => r.id !== meId && remotes.get(slotOf(r.id) ?? '')?.alive);
      if (!live.length) return;
      const at = live.findIndex((r) => r.id === followId);
      followId = live[(at + d + live.length) % live.length]!.id;
    };
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[data-testid="invite-dialog"]')) return;
      if (!isPlayerNow() && !e.repeat) {
        if (e.code === 'ArrowRight' || e.code === 'KeyD') cycleFollow(1);
        else if (e.code === 'ArrowLeft' || e.code === 'KeyA') cycleFollow(-1);
        else if (e.code === 'KeyM' && !pausedRef.current) setMap(!bigMapRef.current);
        else if (e.code === 'Tab' && !pausedRef.current) {
          e.preventDefault();
          setBoard(true);
        }
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

    const world = fsWorldDust(SLOTS.map((id) => ({ id, x: 0, z: 0 })));
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
    let lastFrameAt = 0;
    let timeLeft = info.minutes * 60;
    const remotes = new Map<string, { buf: Snap[]; alive: boolean; shown: boolean; weapon: number; team?: 'ct' | 't'; teamBit?: 0 | 1; ally?: boolean; allyName?: string }>();
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

    const showMarker = (kind: 'body' | 'head' | 'kill' | 'armor', text: string) => setMarker({ key: ++markerKey, kind, text });
    const pushFeed = (it: Omit<FeedItem, 'key'>) => {
      const key = ++feedKey;
      setFeed((f) => [...f.slice(-4), { key, ...it }]);
      window.setTimeout(() => setFeed((f) => f.filter((x) => x.key !== key)), 6000);
    };

    // ---- mensagens do servidor
    const onFss = (m: unknown) => {
      const fr = m as Frame;
      if (!fr?.f) return;
      inbox.push(fr);
      if (inbox.length > 60) inbox.shift();
    };
    const unsub = subscribeRoom('fss', onFss);

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
          return { t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: a.yaw + dy * k, crouch: a.crouch + (b.crouch - a.crouch) * k, flags: b.flags };
        }
      }
      return buf[buf.length - 1]!;
    }

    /** Aplica um quadro do servidor: corpos dos outros, tabela, granadas, eventos e a conferência do próprio corpo. */
    const applyFrame = (fr: Frame, now: number) => {
      lastK = fr.f.k;
      lastFrameAt = now;
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
        rm.buf.push({ t: now, x: r.x, y: r.y, z: r.z, yaw: r.yaw, crouch: r.crouch, flags: r.flags });
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
        const ally = !!who && who.id !== meId && myBit !== undefined && rm.teamBit === myBit;
        if (rm.ally !== ally || (ally && rm.allyName !== who?.name)) {
          rm.ally = ally;
          rm.allyName = who?.name;
          scene.setAlly(key, ally, who?.name ?? '');
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
      for (const e of fr.e) onEvent(e);
      if (fr.s) pendingSelf = fr.s;
    };

    const onEvent = (e: FsNetEvent) => {
      const px = mover.x;
      const pz = mover.z;
      if (e.k === 'shot') {
        if (e.by === meId) return;
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
        if (e.id === meId) deadSince = -1;
      }
    };

    /** Confere o próprio corpo com o do servidor e refaz as entradas que ele ainda não viu (previsão com correção). */
    const reconcile = (s: SelfState) => {
      const aliveNow = s.alive;
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
      const bodies = bodiesNow(performance.now() - INTERP_MS);
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
      const r = fsBuy(loadout, item.id);
      if (!r.ok) return;
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
        adsHold = inp.ads ? 0.12 : Math.max(0, adsHold - dt);
        adsOn = alive && (inp.ads || adsHold > 0) && !loadout.reloading && !w.melee;
        const adsScale = Math.min(1, (w.adsFov || 62) / st.fov) * st.adsSens;
        const look = controls.takeLook(adsOn ? adsScale : 1);
        view.yaw += look.yaw;
        view.pitch = Math.max(-88, Math.min(88, view.pitch + look.pitch));
        if (inp.map) setMap(!bigMapRef.current);
        if (inp.buy) setShop(!shopRef.current);
        const shopOpen = shopRef.current;
        if (alive) {
          if (inp.pick >= 0 && !shopOpen) switchTo(inp.pick);
          else if (inp.cycle && !shopOpen) {
            cmdQueue.push({ t: 'cycle', d: 1 });
            handle(loadout.cycleAll(1));
          }
          if (inp.grenade) {
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
          const p: Pending = { seq: ++seq, fwd: alive ? inp.fwd : 0, strafe: alive ? inp.strafe : 0, jump: alive && jumpBuf > 0, yaw: view.yaw, mul, crouch: alive && inp.crouch, walk: alive && inp.walk };
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
            trigger: alive && inp.trigger && !shopOpen, alt: alive && inp.ads && !shopOpen, reload: alive && reloadOnce, inspect: alive && inspectOnce,
            viewTick: Math.round(lastK + ((perfNow - lastFrameAt) / 1000) * 60 - (INTERP_MS / 1000) * 60),
            cmds,
          });
          reloadOnce = false;
          inspectOnce = false;
          if (outbox.length > 8) outbox.shift();
          sendT++;
          if (sendT >= 2) {
            sendT = 0;
            sendRoomQuiet('fsin', outbox.slice(-4));
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
          handle(loadout.update(dt, { trigger: inp.trigger && !shopOpen, reload: inp.reload, alt: inp.ads && !shopOpen, inspect: inp.inspect }, mv, meId));
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
      const rt = perfNow - INTERP_MS;
      for (const [id, rm] of remotes) {
        if (!rm.shown || !rm.alive) continue;
        const p = sample(rm.buf, rt);
        if (!p) continue;
        const moving = (p.flags & 64) !== 0;
        const shooting = (p.flags & 8) !== 0;
        const crouching = p.crouch > 0.5;
        const anim = shooting ? 'shoot' : moving ? (crouching ? 'crouchwalk' : 'run') : crouching ? 'crouchwalk' : 'idle';
        scene.setBot(id, p.x, p.y, p.z, fsDmHeading(p.yaw), anim, moving ? 1 : crouching ? 0 : 1);
      }

      // câmera: interpola o passo de 1/60 e desliza o erro de previsão
      errOff.x *= Math.exp(-12 * dt); errOff.y *= Math.exp(-12 * dt); errOff.z *= Math.exp(-12 * dt);
      const alpha = isPaused || !live ? 1 : Math.min(1, acc / TICK);
      const scoped = adsOn && loadout.weapon.adsFov > 0;
      const fov = st.fov + ((loadout.weapon.adsFov || 62) - st.fov) * (adsOn ? 1 : 0);
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
      if (!player) {
        // espectando: câmera atrás da raposa que se segue (Esquerda e Direita trocam)
        const alivePeers = rosterNow().filter((r) => r.id !== meId && remotes.get(slotOf(r.id) ?? '')?.alive);
        const cur = followId ? remotes.get(slotOf(followId) ?? '') : undefined;
        if (!cur || !cur.alive || !cur.shown) {
          const best = alivePeers.map((r) => ({ id: r.id, pts: fsMatchScore({ kills: rows.get(r.id)?.kills ?? 0, assists: rows.get(r.id)?.assists ?? 0 }) })).sort((a, b) => b.pts - a.pts)[0];
          if (best) followId = best.id;
        }
        const tr = followId ? remotes.get(slotOf(followId) ?? '') : undefined;
        const tp = tr ? sample(tr.buf, rt) : null;
        if (tp) {
          const d = fsDir(tp.yaw, 0);
          const tx = tp.x - d[0] * 3.2;
          const ty = tp.y + 2.1;
          const tz = tp.z - d[2] * 3.2;
          const k = cam.ok ? Math.min(1, dt * 9) : 1;
          cam.x += (tx - cam.x) * k;
          cam.y += (ty - cam.y) * k;
          cam.z += (tz - cam.z) * k;
          let dy = tp.yaw - cam.yaw;
          if (dy > 180) dy -= 360;
          if (dy < -180) dy += 360;
          cam.yaw += cam.ok ? dy * k : dy;
          cam.ok = true;
        }
        if (cam.ok) {
          mover.x = cam.x;
          mover.y = cam.y - 1.6;
          mover.z = cam.z;
          scene.setView(cam.x, cam.y, cam.z, cam.yaw, -9, st.fov, 0);
          view.yaw = cam.yaw;
          fsAudio.listener(cam.x, cam.y, cam.z, fsDir(cam.yaw, 0));
        }
      } else
      scene.setView(
        prev.x + (mover.x - prev.x) * alpha + errOff.x,
        prev.y + (mover.y - prev.y) * alpha + errOff.y + fsEyeHeight(mover) - e * (fsEyeHeight(mover) - 0.22),
        prev.z + (mover.z - prev.z) * alpha + errOff.z,
        view.yaw + view.rYaw + (sk ? Math.sin(clock * 83) * sk : 0),
        view.pitch + view.rPitch + (sk ? Math.cos(clock * 71) * sk : 0) + e * 18,
        THREE.MathUtils.lerp(scene.fovNow ?? st.fov, fov, Math.min(1, dt * 12)),
        (sk ? Math.sin(clock * 97) * sk * 0.6 : 0) + e * 24,
      );
      if (player) fsAudio.listener(mover.x, mover.y + fsEyeHeight(mover), mover.z, fsDir(view.yaw + view.rYaw, view.pitch + view.rPitch));
      scene.update(isPaused ? 0 : dt, { speed: Math.hypot(mover.vx, mover.vz), adsTarget: adsOn ? 1 : 0, airborne: !mover.onGround });
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

      mini.current = { x: mover.x, z: mover.z, yaw: view.yaw, targets: [], boxes: ARENA, labels: world.labels, marks: FS_DUST_MARKS };
      if (player) setBoardState(inp.board && !isPaused);

      hudT += dt;
      if (hudT > 0.1) {
        hudT = 0;
        const sc = scene.stats();
        const players: FsPlayerRow[] = rosterNow().map((r) => {
          const row = rows.get(r.id);
          const mine = r.id === meId;
          const k = row?.kills ?? 0;
          const a = row?.assists ?? 0;
          return { id: r.id, name: r.name, you: mine, alive: mine ? alive : row ? (row.flags & 1) !== 0 : true, armor: mine ? self?.armor ?? 0 : row?.armor ?? 0, kills: k, deaths: row?.deaths ?? 0, assists: a, hs: 0, damage: 0, points: fsMatchScore({ kills: k, assists: a }), team: ((row?.flags ?? 0) & 128) !== 0 ? ('t' as const) : ('ct' as const) };
        });
        const mp = players.find((p) => p.you);
        setHud({
          hp: self?.hp ?? 100, armor: self?.armor ?? 0, helmet: self?.helmet ?? false, hurtKey, heavyKey,
          hurtAge: (performance.now() - hurtAt) / 1000, heavyAge: (performance.now() - heavyAt) / 1000,
          dead: !alive, respawnIn: self?.respawnIn ?? 0,
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
        state: () => ({ mover: { ...mover }, view: { ...view }, self, k: lastK, left: timeLeft, rows: [...rows.values()], pending: pending.length, seq, roster: rosterNow(), me: meId, phase: snapRef.current.phase }),
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
          <FsTopBar players={players} timeLeft={h.timeLeft} kills={0} deaths={0} />
          {settings.showMinimap && <FsMinimap get={getMini} />}
          {bigMap && <FsBigMap get={getMini} title="Mapa · Duna" />}
          <div className="fsh-rcol">
            <FsKillFeed items={feed} />
          </div>
          {(h.hurtAge) < 0.45 && !h.dead && !spectating && <div key={`h${h.hurtKey}`} className="fs-hurt" aria-hidden="true" />}
          {(h.heavyAge) < 1.7 && !h.dead && !spectating && <div key={`v${h.heavyKey}`} className="fs-hurt heavy" aria-hidden="true" />}
          {h.dead && !paused && !spectating && (
            <div className="fs-deadscreen" role="status" data-testid="fs-dead">
              <b>Você morreu</b>
              <span className="mono" data-testid="fs-respawn">Renascendo em {(h.respawnIn).toFixed(1)}</span>
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
          {board && <FsScoreboard players={players} timeLeft={h.timeLeft} title={`Mata-mata · Duna · online`} />}
          {count !== null && (
            <div className="fsr-count" role="status" data-testid="fsr-count">
              <small>COMEÇA EM</small>
              <b key={count}>{count}</b>
            </div>
          )}
          {needClick && !paused && (
            <div className="fs-hint mono" data-testid="fs-needclick">
              Clique na tela para prender o mouse
            </div>
          )}
          {inviteOpen && <InviteDialog onClose={() => setInviteOpen(false)} />}
          <GameChat enabled onClosed={(wasLocked) => wasLocked && ctl.current?.requestLock()} />
          {paused && (
            <FsMenu touch={false} onResume={() => resumeRef.current()} onEnd={() => void leaveRoom()} exitTo="/fox-cap/counter-fox" exitLabel="Sair da partida">
              <button type="button" className="fsm-item" onClick={() => setInviteOpen(true)} data-sfx="start" data-testid="fsr-invite">
                Convidar amigos
              </button>
              {spectating && canPlay && (
                <button type="button" className="fsm-item" onClick={playNow} data-sfx="start" data-testid="fsr-menu-play">
                  Entrar para jogar
                </button>
              )}
              <button type="button" className="fsm-item danger" onClick={() => void leaveRoom()} data-testid="fsr-leave">
                Sair da sala
              </button>
            </FsMenu>
          )}
        </>
      )}
    </div>
  );
}

export { sendRoom };
