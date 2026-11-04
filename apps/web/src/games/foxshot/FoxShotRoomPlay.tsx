import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  FS_DUST_BOXES,
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
const ARENA = FS_DUST_BOXES;

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
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const blindEl = useRef<HTMLDivElement>(null);
  const hitEl = useRef<HTMLDivElement>(null);
  const ctl = useRef<FsControls | null>(null);
  const pausedRef = useRef(true);
  const shopRef = useRef(false);
  const buyRef = useRef<(item: FsShopItem) => void>(() => undefined);
  const resumeRef = useRef<() => void>(() => undefined);
  const mini = useRef<MinimapData>({ x: 0, z: 0, yaw: 0, targets: [] });
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  const settings = useFsSettings();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [paused, setPausedState] = useState(true);
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
    const roster = info.roster ?? [];
    const meId = snapRef.current.me ?? '';
    const others = roster.filter((r) => r.id !== meId);
    const nameOf = (id: string) => roster.find((r) => r.id === id)?.name ?? '?';
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
        if (!locked && !pausedRef.current && !shopRef.current) setPaused(true);
        if (locked) {
          setPaused(false);
          setNeedClick(false);
        }
      },
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && bigMapRef.current) {
        e.preventDefault();
        bigMapRef.current = false;
        setBigMap(false);
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
    const resume = () => {
      setPaused(false);
      fsAudio.init();
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

    const world = fsWorldDust(others.map((o) => ({ id: o.id, x: 0, z: 0 })));
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
    const remotes = new Map<string, { buf: Snap[]; alive: boolean; shown: boolean; weapon: number }>();
    for (const o of others) remotes.set(o.id, { buf: [], alive: true, shown: false, weapon: 0 });
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
        const id = roster[r.idx]?.id;
        if (!id) continue;
        rows.set(id, r);
        const rm = remotes.get(id);
        if (!rm) continue;
        const alive = (r.flags & 1) !== 0;
        rm.buf.push({ t: now, x: r.x, y: r.y, z: r.z, yaw: r.yaw, crouch: r.crouch, flags: r.flags });
        if (rm.buf.length > 24) rm.buf.shift();
        rm.weapon = r.weapon;
        if (alive && (!rm.alive || !rm.shown)) {
          rm.alive = true;
          rm.shown = true;
          scene.reviveTarget(id);
          scene.setBot(id, r.x, r.y, r.z, fsDmHeading(r.yaw), 'idle', 1);
        } else if (!alive && rm.alive) {
          rm.alive = false;
          const from = killFrom.get(id) ?? [r.x, r.z + 1];
          scene.killTarget(id, from[0], from[1], 1.4);
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
        if (e.vic !== meId) scene.hitTarget(e.vic);
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
          const rm = remotes.get(e.victim);
          if (rm && rm.alive && kr) {
            rm.alive = false;
            scene.killTarget(e.victim, kr.x, kr.z, 1.4);
          }
        }
        if (e.killer === meId) showMarker('kill', e.head ? 'CABEÇA' : 'ABATE');
        else if (e.assist === meId) showMarker('body', 'ASSISTÊNCIA');
        pushFeed({ killer: nameOf(e.killer), weapon: e.w, victim: nameOf(e.victim), head: e.head, you: e.killer === meId, youVictim: e.victim === meId, assist: e.assist ? nameOf(e.assist) : undefined, youAssist: e.assist === meId });
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
      scene.hideViewmodel = deathK > 0.15;

      let adsOn = false;
      const w = loadout.weapon;
      if (!isPaused) clock += dt;
      if (live && haveSelf && !isPaused) {
        adsOn = alive && inp.ads && !loadout.reloading && !w.melee;
        const adsScale = Math.min(1, (w.adsFov || 62) / st.fov) * st.adsSens;
        const look = controls.takeLook(adsOn ? adsScale : 1);
        view.yaw += look.yaw;
        view.pitch = Math.max(-88, Math.min(88, view.pitch + look.pitch));
        if (inp.map) {
          bigMapRef.current = !bigMapRef.current;
          setBigMap(bigMapRef.current);
        }
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
      scene.setView(
        prev.x + (mover.x - prev.x) * alpha + errOff.x,
        prev.y + (mover.y - prev.y) * alpha + errOff.y + fsEyeHeight(mover) - e * (fsEyeHeight(mover) - 0.22),
        prev.z + (mover.z - prev.z) * alpha + errOff.z,
        view.yaw + view.rYaw + (sk ? Math.sin(clock * 83) * sk : 0),
        view.pitch + view.rPitch + (sk ? Math.cos(clock * 71) * sk : 0) + e * 18,
        THREE.MathUtils.lerp(scene.fovNow ?? st.fov, fov, Math.min(1, dt * 12)),
        (sk ? Math.sin(clock * 97) * sk * 0.6 : 0) + e * 24,
      );
      fsAudio.listener(mover.x, mover.y + fsEyeHeight(mover), mover.z, fsDir(view.yaw + view.rYaw, view.pitch + view.rPitch));
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

      mini.current = { x: mover.x, z: mover.z, yaw: view.yaw, targets: [], boxes: ARENA, labels: world.labels };
      setBoardState(inp.board && !isPaused);

      hudT += dt;
      if (hudT > 0.1) {
        hudT = 0;
        const sc = scene.stats();
        const players: FsPlayerRow[] = roster.map((r) => {
          const row = rows.get(r.id);
          const mine = r.id === meId;
          const k = row?.kills ?? 0;
          const a = row?.assists ?? 0;
          return { id: r.id, name: r.name, you: mine, alive: mine ? alive : row ? (row.flags & 1) !== 0 : true, armor: mine ? self?.armor ?? 0 : row?.armor ?? 0, kills: k, deaths: row?.deaths ?? 0, assists: a, hs: 0, damage: 0, points: fsMatchScore({ kills: k, assists: a }) };
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
          pos: [mover.x, mover.y, mover.z], k: lastK,
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
        for (const o of others) scene.hideTarget(o.id);
        setStatus('ready');
        last = performance.now();
        raf = requestAnimationFrame(frame);
      })
      .catch(() => setStatus('error'));

    if (import.meta.env.DEV) {
      (window as unknown as { __fsn?: unknown }).__fsn = {
        state: () => ({ mover: { ...mover }, view: { ...view }, self, k: lastK, left: timeLeft, rows: [...rows.values()], pending: pending.length, seq, roster, me: meId, phase: snapRef.current.phase }),
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
      };
    }

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
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
      {status === 'loading' && <div className="fs-load mono">CARREGANDO O DUNA...</div>}
      {status === 'error' && <div className="fs-load mono">Não deu para carregar os modelos. Atualize a página.</div>}
      {h && status === 'ready' && (
        <>
          <FsCrosshair spreadPx={h.spreadPx} />
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
          {(h.hurtAge) < 0.45 && !h.dead && <div key={`h${h.hurtKey}`} className="fs-hurt" aria-hidden="true" />}
          {(h.heavyAge) < 1.7 && !h.dead && <div key={`v${h.heavyKey}`} className="fs-hurt heavy" aria-hidden="true" />}
          {h.dead && !paused && (
            <div className="fs-deadscreen" role="status" data-testid="fs-dead">
              <b>Você morreu</b>
              <span className="mono" data-testid="fs-respawn">Renascendo em {(h.respawnIn).toFixed(1)}</span>
            </div>
          )}
          <FsVitals hp={h.hp} armor={h.armor} helmet={h.helmet} />
          <FsAmmo weapon={h.weapon} id={h.weaponId} ammo={h.ammo} mag={h.mag} reloading={h.reloading} slots={h.slots} current={h.current} nades={h.nades} heldNade={h.heldNade} />
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
          <GameChat enabled onClosed={(wasLocked) => wasLocked && ctl.current?.requestLock()} />
          {paused && (
            <FsMenu touch={false} onResume={() => resumeRef.current()} onEnd={() => void leaveRoom()} exitTo="/fox-cap/counter-fox" exitLabel="Sair da partida">
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
