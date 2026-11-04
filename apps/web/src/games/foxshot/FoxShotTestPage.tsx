import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import * as THREE from 'three';
import {
  FS_ARENA,
  FS_SPAWN,
  FS_BOTS,
  FS_BOT_SPEED,
  FS_TARGETS,
  fsBotStep,
  fsNewBot,
  FS_WEAPONS,
  FsLoadout,
  fsDir,
  fsBuy,
  fsEyeHeight,
  fsQuiet,
  type FsShopItem,
  fsNewMover,
  fsSpreadDeg,
  fsStepMover,
  fsTrace,
  type FsBody,
  type FsBox,
  type FsWeaponId,
} from '@nocap/games';
import { fsAudio } from '@/lib/foxshot-audio';
import { FoxShotScene, type Quality } from './FoxShotScene';
import { FsControls } from './fs-controls';
import { bindLabel, fsSettings, useFsSettings } from './fs-settings';
import { FsMenu } from './FsMenu';
import { FsShop } from './FsShop';
import {
  FsAmmo,
  FsCrosshair,
  FsKillFeed,
  FsMinimap,
  FsScoreboard,
  FsTelemetry,
  FsTopBar,
  FsVitals,
  type FeedItem,
  type FsSlotInfo,
  type FsPlayerRow,
  type MinimapData,
} from './FsHud';
import './foxshot.css';

const STEP = 1 / 120;
const MATCH_S = 300;
/** A raposa cai (~1 s), fica no chão e afunda antes de nascer outra. */
const REVIVE_S = 3.6;
/** Armas soltas no chão: no máximo isto (as mais antigas somem) e somem sozinhas depois de um tempo, para não pesar. */
/** Alvos parados e bots de treino: tudo o que leva tiro. */
const ALL_TARGETS = [...FS_TARGETS, ...FS_BOTS];
const PICK_AUTO_R = 0.9;
const DROP_MAX = 6;
const DROP_LIFE_S = 25;
const PICK_R = 1.8;

interface Drop {
  h: number;
  id: FsWeaponId;
  ammo: number;
  x: number;
  z: number;
  at: number;
  /** Não pega sozinho até esse instante (a que você acabou de jogar). */
  noPick: number;
  /** Em voo (jogada com G): altura e velocidade. */
  y: number;
  vx: number;
  vy: number;
  vz: number;
  flying: boolean;
}

interface TargetState {
  hp: number;
  armor: number;
  /** 1 agachada (a cabeça e o corpo descem na mira), 0 de pé. */
  crouch: number;
  alive: boolean;
  reviveAt: number;
  deaths: number;
}

interface MyStats {
  kills: number;
  deaths: number;
  /** Assistências: só existem com mais de um jogador dando dano (online); aqui fica em 0. */
  assists: number;
  hs: number;
  damage: number;
}

interface Hud {
  hp: number;
  armor: number;
  helmet: boolean;
  ammo: number;
  mag: number;
  weapon: string;
  weaponId: FsWeaponId;
  slots: FsSlotInfo[];
  current: number;
  /** Velocidade no chão (m/s) e abertura da mira (para borrar a luneta andando). */
  speed: number;
  blur: number;
  /** Arma no chão que está sob a mira (nome) e se dá para pegar daqui. */
  look: { name: string; near: boolean } | null;
  reloading: boolean;
  scoped: boolean;
  spreadPx: number;
  fps: number;
  timeLeft: number;
  players: FsPlayerRow[];
  me: MyStats;
  tris: number;
  calls: number;
  level: Quality;
  dpr: number;
  ref: string;
}

interface Marker {
  key: number;
  kind: 'body' | 'head' | 'kill' | 'armor';
  text: string;
}

/**
 * Fox Shot!, fase 0 (spec 056): arena de teste para sentir o visual, o tiro, o recuo de cada arma e o dano estilo CS contra
 * alvos parados (sem colete, com colete, com colete e capacete). HUD no desenho do CS: tempo e jogadores em cima, mapa à
 * esquerda, abates à direita, vida e colete embaixo à esquerda, arma e munição à direita; Tab abre o placar e Esc o menu.
 */
export function FoxShotTestPage() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stickEl = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [portrait, setPortrait] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [marker, setMarker] = useState<Marker | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [paused, setPausedState] = useState(true);
  const [board, setBoard] = useState(false);
  const [needClick, setNeedClick] = useState(false);
  const [shop, setShopState] = useState(false);
  const shopRef = useRef(false);
  const shopClosedAt = useRef(0);
  const buyRef = useRef<(item: FsShopItem) => void>(() => undefined);
  const setShop = useCallback((v: boolean) => {
    shopRef.current = v;
    setShopState(v);
    // a loja precisa do cursor: solta o mouse ao abrir e prende de novo ao fechar
    if (v) ctl.current?.releaseLock();
    else {
      shopClosedAt.current = performance.now();
      // prende o mouse de novo só depois do Esc/B: pedir na hora faz o navegador soltar em seguida e abrir o menu de opções
      window.setTimeout(() => {
        if (!shopRef.current && !pausedRef.current) ctl.current?.requestLock();
      }, 160);
    }
  }, []);
  const ctl = useRef<FsControls | null>(null);
  const pausedRef = useRef(true);
  const endMatchRef = useRef<() => void>(() => undefined);
  const mini = useRef<MinimapData>({ x: 0, z: 0, yaw: 0, targets: [] });
  const getMini = useCallback(() => mini.current, []);
  const settings = useFsSettings();
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

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

  useEffect(() => {
    const onResize = () => setPortrait(touch && window.innerHeight > window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [touch]);

  useEffect(() => {
    const el = root.current!;
    const cv = canvas.current!;
    let raf = 0;
    let dead = false;
    const controls = new FsControls();
    ctl.current = controls;
    controls.enabled = false;
    controls.attach(
      el,
      (s) => {
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
        // o mouse soltou (Esc ou clique fora): abre o menu; prendeu: some o menu
        if (!locked && !pausedRef.current && !shopRef.current && performance.now() - shopClosedAt.current > 600) setPaused(true);
        if (locked) {
          setPaused(false);
          setNeedClick(false);
        }
      },
    );

    // Esc com o menu aberto volta ao jogo (com o mouse preso, o navegador já consome o Esc e solta o mouse)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && shopRef.current) {
        e.preventDefault();
        setShop(false);
        return;
      }
      // com o teclado travado (tela cheia) o Esc chega aqui em vez de soltar o mouse sozinho: abre o menu do jogo
      if (e.code === 'Escape' && !pausedRef.current && !e.repeat) {
        e.preventDefault();
        setPaused(true);
        controls.releaseLock();
        return;
      }
      if (
        e.code === 'Escape' &&
        pausedRef.current &&
        !e.repeat &&
        !document.querySelector('.fsm-binds .listen')
      ) {
        e.preventDefault();
        resume();
      }
    };
    window.addEventListener('keydown', onKey);
    const resume = () => {
      setPaused(false);
      if (!touch) {
        // tela cheia + trava de teclado: o navegador deixa de fechar a aba com Ctrl+W (e de recarregar com Ctrl+R) enquanto joga
        if (fsSettings().fullscreenLock) {
          const root = document.documentElement;
          const nav = navigator as Navigator & { keyboard?: { lock?: (keys: string[]) => Promise<void> } };
          const lock = () =>
            nav.keyboard?.lock?.(['KeyA', 'KeyB', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyN', 'KeyQ', 'KeyR', 'KeyS', 'KeyT', 'KeyW', 'Digit1', 'Digit2', 'Digit3', 'Tab', 'Escape']).catch(() => undefined);
          if (document.fullscreenElement) void lock();
          else void root.requestFullscreen?.().then(lock).catch(() => undefined);
        }
        controls.requestLock();
        // o navegador pode recusar prender o mouse logo depois do Esc: pede um clique
        window.setTimeout(() => {
          if (!controls.locked && !pausedRef.current) setNeedClick(true);
        }, 350);
      }
    };
    resumeRef.current = resume;

    const scene = new FoxShotScene(cv);
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

    // ---- estado do jogo
    const mover = fsNewMover(FS_SPAWN.x, FS_SPAWN.z);
    const view = { yaw: 0, pitch: 0, rYaw: 0, rPitch: 0 };
    const me = { hp: 100, armor: 0, helmet: false };
    const stats: MyStats = { kills: 0, deaths: 0, assists: 0, hs: 0, damage: 0 };
    const loadout = new FsLoadout(null, 'pistol');
    const targets = new Map<string, TargetState>(
      ALL_TARGETS.map((t) => [
        t.id,
        { hp: 100, armor: t.armor, crouch: 0, alive: true, reviveAt: 0, deaths: 0 },
      ]),
    );
    let markerKey = 0;
    let feedKey = 0;
    let magInPlayed = false;
    let chargePlayed = false;
    let stepT = 0;
    let acc = 0;
    /** Posição antes do último passo da física: a câmera mostra o meio-termo entre ela e a atual (sem trancos com a mira ampliada). */
    const prev = { x: mover.x, y: mover.y, z: mover.z };
    const botStepT: Record<string, number> = {};
    let jumpBuf = 0;
    let slowT = 0;
    let fastT = 0;
    let hudT = 0;
    let boltAt = -1;
    let clock = 0;
    let matchStart = 0;
    let last = performance.now();
    let fps = 60;

    const botSt = new Map(FS_BOTS.map((b) => [b.id, fsNewBot(b)]));
    const posOf = (id: string): [number, number, number] => {
      const b = botSt.get(id);
      if (b) return [b.x, b.y, b.z];
      const t = FS_TARGETS.find((x) => x.id === id)!;
      return [t.x, 0, t.z];
    };
    const bodies = (): FsBody[] =>
      ALL_TARGETS.map((t) => {
        const s = targets.get(t.id)!;
        const b = botSt.get(t.id);
        return { id: t.id, pos: posOf(t.id), alive: s.alive, armor: s.armor, helmet: t.helmet, crouch: b ? b.crouch : s.crouch };
      });

    const showMarker = (kind: Marker['kind'], text: string) =>
      setMarker({ key: ++markerKey, kind, text });

    const resetMatch = () => {
      stats.kills = stats.deaths = stats.assists = stats.hs = stats.damage = 0;
      for (const t of ALL_TARGETS) {
        const s = targets.get(t.id)!;
        s.alive = true;
        s.hp = 100;
        s.armor = t.armor;
        s.deaths = 0;
        scene.reviveTarget(t.id);
      }
      matchStart = clock;
      setFeed([]);
    };
    endMatchRef.current = () => {
      resetMatch();
      resume();
    };

    const pushFeed = (weapon: FsWeaponId, victim: string, head: boolean) => {
      const key = ++feedKey;
      setFeed((f) => [...f.slice(-4), { key, killer: 'Você', weapon, victim, head, you: true }]);
      window.setTimeout(() => setFeed((f) => f.filter((x) => x.key !== key)), 6000);
    };

    const applyHit = (
      id: FsWeaponId,
      tr: ReturnType<typeof fsTrace>,
      to: THREE.Vector3,
    ) => {
      if (tr.kind === 'world') {
        scene.puff(to, 0xd8c8a8, 0.3, 0.4);
        fsAudio.impact();
      } else if (tr.kind === 'player' && tr.targetId && tr.damage) {
        const st = targets.get(tr.targetId)!;
        const d = tr.damage;
        stats.damage += Math.min(st.hp, d.hp);
        st.hp -= d.hp;
        st.armor = Math.max(0, st.armor - d.armorLoss);
        scene.puff(to, tr.zone === 'head' ? 0xffd45a : 0xff9a4a, 0.4, 0.3);
        if (st.hp <= 0) {
          st.alive = false;
          st.deaths++;
          st.reviveAt = clock + REVIVE_S;
          stats.kills++;
          if (tr.zone === 'head') stats.hs++;
          scene.killTarget(tr.targetId, mover.x, mover.z, id === 'knife' ? 0.8 : id === 'pistol' ? 1.0 : id === 'sniper' ? 2.8 : 1.4);
          fsAudio.hit('kill');
          showMarker('kill', tr.zone === 'head' ? 'CABEÇA' : 'ABATE');
          const bi = FS_BOTS.findIndex((t) => t.id === tr.targetId);
          pushFeed(id, bi >= 0 ? `Bot ${bi + 1}` : `Raposa ${FS_TARGETS.findIndex((t) => t.id === tr.targetId) + 1}`, tr.zone === 'head');
        } else {
          scene.hitTarget(tr.targetId);
          const kind = tr.zone === 'head' ? 'head' : d.protectedByArmor ? 'armor' : 'body';
          fsAudio.hit(kind);
          showMarker(kind, `-${d.hp}`);
        }
      }
    };

    const fire = (
      id: FsWeaponId,
      shot: { kickPitch: number; kickYaw: number; devYaw: number; devPitch: number },
    ) => {
      const w = FS_WEAPONS[id];
      const eye: [number, number, number] = [mover.x, mover.y + fsEyeHeight(mover), mover.z];
      const dir = fsDir(
        view.yaw + view.rYaw + shot.devYaw,
        view.pitch + view.rPitch + shot.devPitch,
      );
      const tr = fsTrace(w, eye, dir, FS_ARENA, bodies());
      const from = scene.muzzleWorld();
      const to = new THREE.Vector3(tr.point[0], tr.point[1], tr.point[2]);
      scene.tracer(from, to, id);
      scene.fireFx(id === 'sniper' ? 2.4 : id === 'pistol' ? 0.5 : 1);
      fsAudio.shot(id);
      applyHit(id, tr, to);
      view.rPitch += shot.kickPitch;
      view.rYaw += shot.kickYaw;
    };

    const melee = (kind: 'slash' | 'stab') => {
      const kw = FS_WEAPONS.knife;
      const eye: [number, number, number] = [mover.x, mover.y + fsEyeHeight(mover), mover.z];
      const dir = fsDir(view.yaw + view.rYaw, view.pitch + view.rPitch);
      const w = kind === 'stab' ? { ...kw, damage: kw.melee!.stab } : kw;
      const tr = fsTrace(w, eye, dir, FS_ARENA, bodies(), kw.melee!.range);
      scene.knifeSwing(kind);
      fsAudio.shot('knife');
      if (tr.kind === 'player') fsAudio.stab();
      applyHit('knife', tr, new THREE.Vector3(tr.point[0], tr.point[1], tr.point[2]));
    };
    const handle = (events: ReturnType<FsLoadout['update']>) => {
      for (const e of events) {
        if (e.type === 'fire') {
          fire(e.weapon.id, e.shot);
        }
        else if (e.type === 'melee') melee(e.kind);
        else if (e.type === 'inspect') {
          if (e.weapon.id === 'knife') scene.knifeInspect(true);
          else scene.gunInspect(true, e.weapon.inspect);
        }
        else if (e.type === 'dry') fsAudio.dry();
        else if (e.type === 'reload') {
          fsAudio.magOut();
          scene.startReload();
          magInPlayed = false;
          chargePlayed = false;
        } else if (e.type === 'reloaded') {
          scene.endReload();
          if (e.weapon.id === 'sniper') fsAudio.bolt();
        } else if (e.type === 'draw') fsAudio.draw();
        else if (e.type === 'bolt') boltAt = clock + 0.45;
      }
    };

    const switchTo = (i: number) => {
      const ev = loadout.switchTo(i);
      if (!ev.length) return;
      scene.selectWeapon(loadout.weapon.id);
      handle(ev);
    };

    const players = (): FsPlayerRow[] => [
      {
        id: 'me',
        name: 'Você',
        you: true,
        alive: true,
        armor: me.armor,
        kills: stats.kills,
        deaths: stats.deaths,
        assists: stats.assists,
        hs: stats.hs,
        damage: stats.damage,
      },
      ...ALL_TARGETS.map((t, i) => {
        const s = targets.get(t.id)!;
        return {
          id: t.id,
          name: i < FS_TARGETS.length ? `Raposa ${i + 1}` : `Bot ${i - FS_TARGETS.length + 1}`,
          you: false,
          alive: s.alive,
          armor: s.armor,
          kills: 0,
          deaths: s.deaths,
          assists: 0,
          hs: 0,
          damage: 0,
        };
      }),
    ];

    // ---- armas no chão
    const drops: Drop[] = [];
    const addDrop = (id: FsWeaponId, ammo: number, x: number, z: number) => {
      if (drops.length >= DROP_MAX) {
        const old = drops.shift()!;
        scene.removeDrop(old.h);
      }
      drops.push({ h: scene.addDrop(id, x, z), id, ammo, x, z, at: clock, noPick: clock + 1.6, y: 0.14, vx: 0, vy: 0, vz: 0, flying: false });
    };
    /** G: joga a arma num arremesso curto para onde a mira aponta (cai a uns 2 metros). */
    const throwWeapon = (id: FsWeaponId, ammo: number) => {
      const dir = fsDir(view.yaw + view.rYaw, view.pitch + view.rPitch);
      const hs = Math.hypot(dir[0], dir[2]) || 1;
      const sp = 3.2;
      addDrop(id, ammo, mover.x, mover.z);
      const d = drops[drops.length - 1]!;
      d.y = mover.y + fsEyeHeight(mover) - 0.25;
      d.vx = (dir[0] / hs) * sp * (0.6 + 0.4 * (hs));
      d.vz = (dir[2] / hs) * sp * (0.6 + 0.4 * (hs));
      d.vy = Math.max(-1.5, Math.min(2.5, dir[1] * 3 + 1.2));
      d.flying = true;
    };
    const stepDrops = (dt: number) => {
      for (const d of drops) {
        if (!d.flying) continue;
        d.vy -= 12 * dt;
        const nx = d.x + d.vx * dt,
          nz = d.z + d.vz * dt,
          ny = d.y + d.vy * dt;
        // parede ou caixa: para o avanço e deixa cair
        const hit = FS_ARENA.some(
          (b) => nx > b.min[0] && nx < b.max[0] && nz > b.min[2] && nz < b.max[2] && ny > b.min[1] && ny < b.max[1],
        );
        if (hit) {
          d.vx = d.vz = 0;
        } else {
          d.x = nx;
          d.z = nz;
        }
        d.y = ny;
        if (d.y <= 0.14) {
          d.y = 0.14;
          d.flying = false;
        }
        scene.setDrop(d.h, d.x, d.y, d.z, !d.flying);
      }
    };
    const dropAhead = (id: FsWeaponId, ammo: number) => {
      const yaw = (view.yaw * Math.PI) / 180;
      addDrop(id, ammo, mover.x - Math.sin(yaw) * 1.2, mover.z - Math.cos(yaw) * 1.2);
    };
    const afterEquip = () => scene.selectWeapon(loadout.weapon.id);
    buyRef.current = (item) => {
      const r = fsBuy(loadout, item.id);
      if (!r.ok) return;
      if (r.armor) {
        me.armor = r.armor.points;
        // comprar só o colete não tira o capacete que já tem
        me.helmet = me.helmet || r.armor.helmet;
      }
      if (r.dropped) dropAhead(r.dropped.id, r.dropped.ammo);
      afterEquip();
      fsAudio.draw();
    };

    const frame = (now: number) => {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
      const st = fsSettings();
      applyQuality();
      const baseFov = st.fov;
      const isPaused = pausedRef.current;
      const inp = controls.read();
      const w = loadout.weapon;
      let speed = Math.hypot(mover.vx, mover.vz);
      let adsOn = false;

      if (!isPaused) {
        clock += dt;
        adsOn = inp.ads && !loadout.reloading && !loadout.weapon.melee;
        const adsScale = Math.min(1, (w.adsFov || 62) / baseFov) * st.adsSens;
        const look = controls.takeLook(adsOn ? adsScale : 1);
        view.yaw += look.yaw;
        view.pitch = Math.max(-88, Math.min(88, view.pitch + look.pitch));
        if (inp.buy) setShop(!shopRef.current);
        const shopOpen = shopRef.current;
        if (inp.drop) {
          const d = loadout.drop();
          if (d) {
            throwWeapon(d.id, d.ammo);
            afterEquip();
          }
        }
        stepDrops(dt);
        // pega sozinho (sem olhar) a arma do chão cujo espaço está vazio: é só passar por cima
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i]!;
          if (d.flying || clock < d.noPick) continue;
          if (Math.hypot(d.x - mover.x, d.z - mover.z) > PICK_AUTO_R) continue;
          if (loadout.slots[FsLoadout.slotIndex(FS_WEAPONS[d.id].slot)]) continue;
          drops.splice(i, 1);
          scene.removeDrop(d.h);
          loadout.equip(d.id, d.ammo);
          afterEquip();
          fsAudio.draw();
        }
        if (inp.pickup) {
          let best: Drop | null = null;
          let bd = PICK_R;
          for (const d of drops) {
            const dd = Math.hypot(d.x - mover.x, d.z - mover.z);
            if (dd < bd) {
              bd = dd;
              best = d;
            }
          }
          if (best) {
            drops.splice(drops.indexOf(best), 1);
            scene.removeDrop(best.h);
            const old = loadout.slots[FsLoadout.slotIndex(FS_WEAPONS[best.id].slot)];
            const prev = loadout.equip(best.id, best.ammo);
            if (prev && old) dropAhead(prev, old.ammo);
            afterEquip();
            fsAudio.draw();
          }
        }
        for (let i = drops.length - 1; i >= 0; i--) {
          if (clock - drops[i]!.at > DROP_LIFE_S) {
            scene.removeDrop(drops[i]!.h);
            drops.splice(i, 1);
          }
        }
        if (shopOpen) inp.pick = -1;
        if (inp.pick >= 0) switchTo(inp.pick);
        else if (inp.cycle) switchTo((loadout.current + 1) % loadout.slots.length);

        const speed0 = speed;
        const mul = loadout.weapon.moveMul * (adsOn ? 0.65 : 1);
        acc += dt;
        // o clique de pular vale por 0,15 s: apertar um pouco antes de pousar já pula no pouso (bunny hop sem segurar a tecla)
        if (inp.jump) jumpBuf = 0.15;
        // quem está vivo é um obstáculo (dá para esbarrar); quem morreu deixa de ser (dá para passar por cima)
        const solids: FsBox[] = [...FS_ARENA];
        for (const t of ALL_TARGETS) {
          if (!targets.get(t.id)!.alive) continue;
          const p = posOf(t.id);
          const bs = botSt.get(t.id);
          const h = 1.3 + ((0.95 / 1.3 - 1) * 1.3) * (bs ? bs.crouch : targets.get(t.id)!.crouch);
          solids.push({ min: [p[0] - 0.3, p[1], p[2] - 0.3], max: [p[0] + 0.3, p[1] + h, p[2] + 0.3], pen: 0, mat: 'crate' });
        }
        while (acc >= STEP) {
          acc -= STEP;
          const wasGround = mover.onGround;
          prev.x = mover.x;
          prev.y = mover.y;
          prev.z = mover.z;
          fsStepMover(
            mover,
            {
              fwd: inp.fwd,
              strafe: inp.strafe,
              jump: jumpBuf > 0,
              yaw: view.yaw,
              speedMul: mul,
              crouch: inp.crouch,
              walk: inp.walk,
            },
            STEP,
            solids,
          );
          if (wasGround && !mover.onGround && jumpBuf > 0) jumpBuf = 0;
          jumpBuf = Math.max(0, jumpBuf - STEP);
        }
        speed = Math.hypot(mover.vx, mover.vz);
        const quiet = fsQuiet({ crouch: inp.crouch, walk: inp.walk });
        if (mover.onGround && speed > 1.5 && !quiet) {
          stepT -= dt * (speed / 3.4);
          if (stepT <= 0) {
            fsAudio.step();
            stepT = 0.5;
          }
        }
        if (speed0 < 0.5 && speed >= 0.5) stepT = 0.05;

        const mv = {
          moving: speed > 0.8,
          speed,
          airborne: !mover.onGround,
          ads: adsOn,
          crouch: mover.crouchK > 0.5,
        };
        const wasInspecting = loadout.inspecting;
        handle(
          loadout.update(
            dt,
            {
              trigger: inp.trigger && !shopOpen,
              reload: inp.reload,
              alt: inp.ads && !shopOpen,
              inspect: inp.inspect,
            },
            mv,
            'me',
          ),
        );
        if (wasInspecting && !loadout.inspecting) {
          scene.knifeInspect(false);
          scene.gunInspect(false);
        }
        if (loadout.reloading) {
          const p = 1 - loadout.reloadT / loadout.weapon.reload;
          scene.setReloadProgress(p);
          if (p > 0.68 && !magInPlayed) {
            magInPlayed = true;
            fsAudio.magIn();
          }
          if (p > 0.82 && !chargePlayed) {
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
        // bots andando, pulando e girando
        for (const b of FS_BOTS) {
          const bs = botSt.get(b.id)!;
          if (!targets.get(b.id)!.alive) continue;
          fsBotStep(bs, b, dt);
          scene.setBot(b.id, bs.x, bs.y, bs.z, bs.h, bs.anim, bs.animSpeed);
          // passos do bot que anda normalmente: som 3D (quem anda no shift ou agachado não faz barulho)
          if (b.kind === 'walk' && bs.anim === 'run' && bs.y <= 0) {
            botStepT[b.id] = (botStepT[b.id] ?? 0) - dt * (FS_BOT_SPEED.walk / 3.4);
            if (botStepT[b.id]! <= 0) {
              botStepT[b.id] = 0.5;
              fsAudio.stepAt(bs.x, 0, bs.z, mover.x, mover.z);
            }
          }
        }
        for (const t of ALL_TARGETS) {
          const s = targets.get(t.id)!;
          // o corpo fica no chão e some de repente 1 s antes de nascer outro
          if (!s.alive && clock >= s.reviveAt - 1) scene.hideTarget(t.id);
          if (!s.alive && clock >= s.reviveAt) {
            s.alive = true;
            s.hp = 100;
            s.armor = t.armor;
            const spec = FS_BOTS.find((b) => b.id === t.id);
            if (spec) botSt.set(t.id, fsNewBot(spec));
            scene.reviveTarget(t.id);
          }
        }
        if (clock - matchStart >= MATCH_S) resetMatch();
      }
      setBoardState(inp.board && !isPaused);

      const scoped = adsOn && loadout.weapon.adsFov > 0;
      const adsTarget = adsOn ? 1 : 0;
      const fov = baseFov + ((loadout.weapon.adsFov || 62) - baseFov) * (adsOn ? 1 : 0);
      // física em passos fixos de 1/120 s: interpola para a câmera andar liso em qualquer taxa de quadros
      const alpha = isPaused ? 1 : Math.min(1, acc / STEP);
      scene.setView(
        prev.x + (mover.x - prev.x) * alpha,
        prev.y + (mover.y - prev.y) * alpha + fsEyeHeight(mover),
        prev.z + (mover.z - prev.z) * alpha,
        view.yaw + view.rYaw,
        view.pitch + view.rPitch,
        THREE.MathUtils.lerp(scene.fovNow ?? baseFov, fov, Math.min(1, dt * 12)),
      );
      fsAudio.listener(mover.x, mover.y + fsEyeHeight(mover), mover.z, fsDir(view.yaw + view.rYaw, view.pitch + view.rPitch));
      scene.update(isPaused ? 0 : dt, { speed, adsTarget, airborne: !mover.onGround });
      scene.render();

      // qualidade automática pelo fps (só quando a pessoa deixa em "Automática")
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
        } else if (
          fastT > 8 &&
          ((scene.level === 'low' && cap !== ('low' as Quality)) ||
            (scene.level === 'mid' && cap === 'high'))
        ) {
          scene.setQuality(scene.level === 'low' ? 'mid' : 'high');
          fastT = 0;
        }
      }

      mini.current = {
        x: mover.x,
        z: mover.z,
        yaw: view.yaw,
        targets: ALL_TARGETS.map((t) => ({
          x: posOf(t.id)[0],
          z: posOf(t.id)[2],
          alive: targets.get(t.id)!.alive,
          armor: targets.get(t.id)!.armor,
        })),
      };

      hudT += dt;
      if (hudT > 0.1) {
        hudT = 0;
        const sc = scene.stats();
        const mvs = { moving: speed > 0.8,
          speed, airborne: !mover.onGround, ads: adsOn };
        // arma no chão sob a mira: perto do centro da tela e a poucos metros
        let look: Hud['look'] = null;
        {
          const eyeY = mover.y + fsEyeHeight(mover);
          const dir = fsDir(view.yaw + view.rYaw, view.pitch + view.rPitch);
          let best = 1e9;
          for (const d of drops) {
            const vx = d.x - mover.x,
              vy = 0.15 - eyeY,
              vz = d.z - mover.z;
            const dist = Math.hypot(vx, vy, vz);
            if (dist > 4.5 || dist < 0.2) continue;
            const cos = (vx * dir[0] + vy * dir[1] + vz * dir[2]) / dist;
            // cone de ~7 graus, um pouco mais folgado quando está perto
            if (cos < Math.cos((7 + 6 / dist) * (Math.PI / 180)) || dist >= best) continue;
            best = dist;
            look = { name: FS_WEAPONS[d.id].name, near: dist <= PICK_R };
          }
        }
        setHud({
          look,
          hp: me.hp,
          armor: me.armor,
          helmet: me.helmet,
          ammo: loadout.slot.ammo,
          mag: loadout.weapon.mag,
          weapon: loadout.weapon.name,
          weaponId: loadout.weapon.id,
          speed: Math.round(speed * 10) / 10,
          blur: Math.min(1, fsSpreadDeg(loadout.weapon, mvs, loadout.slot.gun) / 6),
          slots: loadout.slots.map((sl, i) => ({ id: sl?.id ?? null, name: sl ? FS_WEAPONS[sl.id].name : '', key: i + 1 })),
          current: loadout.current,
          reloading: loadout.reloading,
          scoped,
          spreadPx: Math.min(60, fsSpreadDeg(loadout.weapon, mvs, loadout.slot.gun) * 4),
          fps: Math.round(fps),
          timeLeft: MATCH_S - (clock - matchStart),
          players: players(),
          me: { ...stats },
          tris: sc.tris,
          calls: sc.calls,
          level: scene.level,
          dpr: Math.round(scene.renderer.getPixelRatio() * 100) / 100,
          ref: (['ak', 'pistol', 'sniper'] as FsWeaponId[])
            .filter((k) => scene.usingRef[k])
            .join(','),
        });
      }
    };

    scene
      .load()
      .then(() => {
        if (dead) return;
        // a arma inicial é a pistola: o modelo na mão tem de ser o dela (antes aparecia o fuzil)
        scene.selectWeapon(loadout.weapon.id, true);
        setStatus('ready');
        last = performance.now();
        raf = requestAnimationFrame(frame);
      })
      .catch(() => setStatus('error'));

    // ganchos de teste (só em desenvolvimento): apontar para um alvo e atirar
    if (import.meta.env.DEV) {
      (window as unknown as { __fs?: unknown }).__fs = {
        aimAt(id: string, zone: 'head' | 'chest' | 'legs' = 'chest') {
          const tp = posOf(id);
          const y = zone === 'head' ? 1.17 : zone === 'chest' ? 0.9 : 0.3;
          const dx = tp[0] - mover.x,
            dz = tp[2] - mover.z,
            dy = y - (mover.y + fsEyeHeight(mover));
          view.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
          view.pitch = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
          view.rPitch = view.rYaw = 0;
        },
        teleport(x: number, z: number) {
          mover.x = x;
          mover.z = z;
          prev.x = x;
          prev.z = z;
        },
        shoot(count = 1) {
          // solta o gatilho antes (a pistola só atira em clique novo)
          handle(loadout.update(0.001, { trigger: false, reload: false }, { moving: false, airborne: false, ads: true }, 'me'));
          for (let i = 0; i < count; i++) {
            loadout.slot.gun.since = 99;
            loadout.drawT = 0;
            loadout.cooldown = 0;
            loadout.slot.ammo = Math.max(loadout.slot.ammo, 1);
            handle(
              loadout.update(
                0.001,
                { trigger: i % 2 === 0, reload: false },
                { moving: false, airborne: false, ads: true },
                'me',
              ),
            );
          }
        },
        weapon(i: number) {
          switchTo(i);
          loadout.drawT = 0;
        },
        target(id: string) {
          return { ...targets.get(id)! };
        },
        reload() {
          loadout.drawT = 0;
          loadout.slot.ammo = 0;
          handle(loadout.update(0.001, { trigger: false, reload: true }, { moving: false, airborne: false, ads: false }, 'me'));
        },
        knife(kind: 'slash' | 'stab' | 'inspect') {
          loadout.drawT = 0;
          loadout.cooldown = 0;
          loadout.update(0.001, { trigger: false, reload: false }, { moving: false, airborne: false, ads: false }, 'me');
          handle(
            loadout.update(
              0.001,
              { trigger: kind === 'slash', reload: false, alt: kind === 'stab', inspect: kind === 'inspect' },
              { moving: false, airborne: false, ads: false },
              'me',
            ),
          );
        },
        bot: (id: string) => ({ ...botSt.get(id)!, alive: targets.get(id)!.alive }),
        pos: (id: string) => posOf(id),
        crouchTarget(id: string, on: boolean) {
          targets.get(id)!.crouch = on ? 1 : 0;
          scene.setTargetCrouch(id, on);
        },
        reloadAt: (u: number | null) => scene.debugReload(u),
        inspectGun: () => {
          loadout.drawT = 0;
          loadout.cooldown = 0;
          handle(loadout.update(0.001, { trigger: false, reload: false, inspect: true }, { moving: false, airborne: false, ads: false }, 'me'));
        },
        pose: (kind: 'slash' | 'stab' | 'inspect' | null, u?: number) => scene.debugKnife(kind, u),
        stats: () => ({ ...stats }),
        mover,
        drops: () => drops.map((d) => ({ id: d.id, ammo: d.ammo })),
        buy: (id: string) => buyRef.current({ id } as FsShopItem),
        loadout,
        view,
      };
    }

    // se tentarem fechar a aba jogando (Ctrl+W, por exemplo), o navegador pergunta antes
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (pausedRef.current || touch) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);

    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      try {
        (navigator as Navigator & { keyboard?: { unlock?: () => void } }).keyboard?.unlock?.();
        if (document.fullscreenElement) void document.exitFullscreen();
      } catch {
        /* sem tela cheia para sair */
      }
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      controls.detach();
      scene.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touch]);

  const resumeRef = useRef<() => void>(() => undefined);
  const setBoardState = useCallback((v: boolean) => setBoard((b) => (b === v ? b : v)), []);
  const press = useCallback(
    (name: 'fire' | 'ads' | 'jump' | 'reload' | 'cycle', down: boolean) =>
      ctl.current?.setTouch(name, down),
    [],
  );

  return (
    <div className="fs" ref={root} data-testid="fs-root">
      <canvas ref={canvas} className="fs-canvas" data-testid="fs-canvas" />
      {status === 'loading' && <div className="fs-load mono">CARREGANDO A ARENA...</div>}
      {status === 'error' && (
        <div className="fs-load mono">Não deu para carregar os modelos. Atualize a página.</div>
      )}

      {hud && status === 'ready' && (
        <>
          {hud.scoped ? (
            <div className="fs-scope" aria-hidden="true">
              <i style={{ filter: `blur(${(hud.blur * 2.4).toFixed(1)}px)` }} />
              <b style={{ filter: `blur(${(hud.blur * 2.4).toFixed(1)}px)` }} />
            </div>
          ) : (
            <FsCrosshair spreadPx={hud.spreadPx} />
          )}
          {hud.look && !hud.scoped && (
            <div className="fs-look" data-testid="fs-look" aria-hidden="true">
              <b>{hud.look.name}</b>
              {hud.look.near && <span className="mono">{bindLabel(settings.binds.pickup)} pegar</span>}
            </div>
          )}
          {marker && (
            <div
              key={marker.key}
              className={`fs-marker ${marker.kind}`}
              aria-hidden="true"
              data-testid="fs-marker"
            >
              <span className="fs-x" />
              <b>{marker.text}</b>
            </div>
          )}
          <FsTopBar
            players={hud.players}
            timeLeft={hud.timeLeft}
            kills={hud.me.kills}
            deaths={hud.me.deaths}
          />
          {settings.showMinimap && <FsMinimap get={getMini} />}
          <div className="fsh-rcol">
          {settings.showTelemetry && (
            <FsTelemetry
              fps={hud.fps}
              tris={hud.tris}
              calls={hud.calls}
              level={hud.level}
              dpr={hud.dpr}
              speed={hud.speed}
              ref={hud.ref}
            />
          )}
          <FsKillFeed items={feed} />
          </div>
          <FsVitals hp={hud.hp} armor={hud.armor} helmet={hud.helmet} />
          <FsAmmo
            weapon={hud.weapon}
            id={hud.weaponId}
            ammo={hud.ammo}
            mag={hud.mag}
            reloading={hud.reloading}
            slots={hud.slots}
            current={hud.current}
          />
          {shop && !paused && (
            <FsShop
              onBuy={(i) => buyRef.current(i)}
              onClose={() => setShop(false)}
              equipped={hud.slots}
              armor={hud.armor}
              helmet={hud.helmet}
              owned={[
                ...hud.slots.flatMap((x) => (x.id ? [x.id] : [])),
                ...(hud.armor > 0 ? ['vest'] : []),
                ...(hud.armor > 0 && hud.helmet ? ['vesthelm'] : []),
              ]}
            />
          )}
          {board && <FsScoreboard players={hud.players} timeLeft={hud.timeLeft} />}
          {needClick && !paused && (
            <div className="fs-hint mono" data-testid="fs-needclick">
              Clique na tela para prender o mouse
            </div>
          )}
          {touch && !paused && (
            <>
              <button
                type="button"
                className="fs-menubtn"
                onClick={() => setPaused(true)}
                data-testid="fs-menubtn"
              >
                Menu
              </button>
              <div className="fs-stick" ref={stickEl} aria-hidden="true">
                <i />
              </div>
              <div className="fs-tbtns">
                <button
                  type="button"
                  className="fs-tb fire"
                  onPointerDown={() => press('fire', true)}
                  onPointerUp={() => press('fire', false)}
                  onPointerCancel={() => press('fire', false)}
                  aria-label="Atirar"
                >
                  ATIRAR
                </button>
                <button
                  type="button"
                  className="fs-tb ads"
                  onPointerDown={() => press('ads', true)}
                  onPointerUp={() => press('ads', false)}
                  onPointerCancel={() => press('ads', false)}
                  aria-label="Mirar"
                >
                  MIRAR
                </button>
                <button
                  type="button"
                  className="fs-tb"
                  onPointerDown={() => press('jump', true)}
                  aria-label="Pular"
                >
                  PULAR
                </button>
                <button
                  type="button"
                  className="fs-tb"
                  onPointerDown={() => press('reload', true)}
                  aria-label="Recarregar"
                >
                  RECARGA
                </button>
                <button
                  type="button"
                  className="fs-tb"
                  onClick={() => setShop(!shopRef.current)}
                  aria-label="Loja"
                >
                  LOJA
                </button>
                <button
                  type="button"
                  className="fs-tb"
                  onPointerDown={() => press('cycle', true)}
                  aria-label="Trocar de arma"
                >
                  TROCAR
                </button>
              </div>
            </>
          )}
          {paused && !portrait && (
            <FsMenu
              touch={touch}
              onResume={() => resumeRef.current()}
              onEnd={() => endMatchRef.current()}
            />
          )}
        </>
      )}
      {portrait && (
        <div className="fs-rotate" role="alert" data-testid="fs-rotate">
          <div className="fs-card">
            <h2>Gire o aparelho</h2>
            <p className="mono">O Counter Fox só joga com o celular deitado.</p>
            <Link to="/fox-cap" className="btn ghost">
              Voltar
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
