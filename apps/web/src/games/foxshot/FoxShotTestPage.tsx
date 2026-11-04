import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import * as THREE from 'three';
import {
  FS_DUST_MARKS,
  FS_DUST_SOLIDS,
  FS_SPAWN,
  fsAssister,
  fsDmFlash,
  fsDmHeading,
  fsDmHear,
  fsDmHurt,
  fsDmNew,
  fsDmPickWeapon,
  fsDmStep,
  fsMatchResult,
  fsMatchScore,
  fsPickSpawn,
  fsSeparate,
  FS_RESPAWN_S,
  type FsDamageEntry,
  type FsDmAction,
  type FsDmBrain,
  type FsDmFoe,
  type FsMatchConfig,
  type FsMatchRow,
  type FsTargetSpec,
  FS_BOT_SPEED,
  FS_GRENADES,
  fsClearLine,
  fsFlashEffect,
  fsFragDamage,
  fsGrenadeLaunch,
  fsGrenadeStep,
  type FsGrenadeBody,
  type FsGrenadeId,
  FS_TRAIN_GALLERY,
  fsNewRange,
  fsRangeStep,
  fsFlinch,
  fsFlinchAt,
  fsBotStep,
  fsNewBot,
  FS_WEAPONS,
  FsLoadout,
  fsDir,
  fsBuy,
  fsShopItem,
  fsEyeHeight,
  fsIsBackstab,
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
import { FoxShotScene, FS_WORLD_TRAIN, fsWorldDust, type Quality } from './FoxShotScene';
import { FsMatchEnd } from './FsMatchEnd';
import { FsControls } from './fs-controls';
import { bindLabel, fsSettings, useFsSettings } from './fs-settings';
import { FsMenu } from './FsMenu';
import { FsShop } from './FsShop';
import {
  FsBigMap,
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
const MATCH_S_TEST = 300;
/** A raposa cai (~1 s), fica no chão e afunda antes de nascer outra. */
const REVIVE_S = 3.6;
/** Armas soltas no chão: no máximo isto (as mais antigas somem) e somem sozinhas depois de um tempo, para não pesar. */
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
  /** Mata-mata: placar de cada bot. */
  kills: number;
  assists: number;
  hs: number;
  damage: number;
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
  heldNade: FsGrenadeId | null;
  nades: { id: FsGrenadeId; name: string; count: number; key: string }[];
  /** Conta os tiros que você levou (cada um dispara o clarão vermelho) e se está morto esperando renascer. */
  hurtKey: number;
  heavyKey: number;
  hurtAge: number;
  heavyAge: number;
  dead: boolean;
  respawnIn: number;
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
export function FoxShotTestPage({ match, onExit, onAgain }: { match?: FsMatchConfig; onExit?: () => void; onAgain?: () => void } = {}) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stickEl = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [portrait, setPortrait] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [marker, setMarker] = useState<Marker | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [result, setResult] = useState<FsMatchRow[] | null>(null);
  const endedRef = useRef(false);
  const onAgainRef = useRef<() => void>(() => undefined);
  onAgainRef.current = () => onAgain?.();
  const [paused, setPausedState] = useState(true);
  const [board, setBoard] = useState(false);
  const [bigMap, setBigMap] = useState(false);
  const bigMapRef = useRef(false);
  const [needClick, setNeedClick] = useState(false);
  const [shop, setShopState] = useState(false);
  const shopRef = useRef(false);
  const blindEl = useRef<HTMLDivElement>(null);
  const hitEl = useRef<HTMLDivElement>(null);
  const scopeEl = useRef<HTMLDivElement>(null);
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
  /** O mapa grande se comporta como a loja: solta o mouse ao abrir (o Esc chega e fecha) e prende de novo ao fechar. */
  const setMap = useCallback((v: boolean) => {
    bigMapRef.current = v;
    setBigMap(v);
    if (v) ctl.current?.releaseLock();
    else {
      shopClosedAt.current = performance.now();
      window.setTimeout(() => {
        if (!bigMapRef.current && !shopRef.current && !pausedRef.current) ctl.current?.requestLock();
      }, 160);
    }
  }, []);
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
        if (endedRef.current) return;
        // o mouse soltou (Esc ou clique fora): abre o menu; prendeu: some o menu
        if (!locked && !pausedRef.current && !shopRef.current && !bigMapRef.current && performance.now() - shopClosedAt.current > 600) setPaused(true);
        if (locked) {
          setPaused(false);
          setNeedClick(false);
        }
      },
    );

    // Esc com o menu aberto volta ao jogo (com o mouse preso, o navegador já consome o Esc e solta o mouse)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && bigMapRef.current) {
        e.preventDefault();
        setMap(false);
        return;
      }
      if (endedRef.current) return;
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
      // prepara os sons (um clique já aconteceu): sintetiza todos uma vez
      fsAudio.init();
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

    // ---- o mundo: a arena de teste ou o Duna com os bots do mata-mata
    const dmNames = Array.from({ length: match?.bots ?? 0 }, (_, i) => `Bot ${i + 1}`);
    const dmSpecs: FsTargetSpec[] = [];
    const dmSpawnY = new Map<string, number>();
    const firstSpawn = match ? fsPickSpawn([]) : null;
    if (match) {
      const placed: { x: number; z: number }[] = [{ x: firstSpawn!.x, z: firstSpawn!.z }];
      dmNames.forEach((n, i) => {
        const sp = fsPickSpawn(placed);
        placed.push({ x: sp.x, z: sp.z });
        dmSpecs.push({ id: `d${i + 1}`, label: n, x: sp.x, z: sp.z, armor: 0, helmet: false });
        dmSpawnY.set(`d${i + 1}`, sp.y);
      });
    }
    const world = match ? fsWorldDust(dmSpecs.map((d) => ({ id: d.id, x: d.x, z: d.z }))) : FS_WORLD_TRAIN;
    const ARENA = world.style === 'dust' ? FS_DUST_SOLIDS : world.boxes;
    const ALL_TARGETS: FsTargetSpec[] = [...world.targets, ...world.bots, ...dmSpecs];
    const isDm = (id: string) => dmSpecs.some((d) => d.id === id);
    const MATCH_S = match ? match.minutes * 60 : MATCH_S_TEST;
    const rnd = Math.random;
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

    // ---- estado do jogo
    const mover = fsNewMover(firstSpawn?.x ?? FS_SPAWN.x, firstSpawn?.z ?? FS_SPAWN.z);
    mover.y = firstSpawn?.y ?? 0;
    const view = { yaw: firstSpawn?.yaw ?? FS_SPAWN.yaw, pitch: 0, rYaw: 0, rPitch: 0 };
    const me = { hp: 100, armor: 0, helmet: false };
    const stats: MyStats = { kills: 0, deaths: 0, assists: 0, hs: 0, damage: 0 };
    const loadout = new FsLoadout(null, 'pistol');
    const targets = new Map<string, TargetState>(
      ALL_TARGETS.map((t) => [
        t.id,
        { hp: 100, armor: t.armor, crouch: 0, alive: true, reviveAt: 0, deaths: 0, kills: 0, assists: 0, hs: 0, damage: 0 },
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

    const botSt = new Map(world.bots.map((b) => [b.id, fsNewBot(b)]));
    const brains = new Map<string, FsDmBrain>();
    const dmgLog = new Map<string, FsDamageEntry[]>();
    const logDamage = (victim: string, attacker: string) => {
      const l = dmgLog.get(victim) ?? [];
      l.push({ attacker, time: clock });
      if (l.length > 24) l.shift();
      dmgLog.set(victim, l);
    };
    const nameOf = (id: string) => {
      if (id === 'me') return 'Você';
      const di = dmSpecs.findIndex((d) => d.id === id);
      if (di >= 0) return dmSpecs[di]!.label;
      const bi = world.bots.findIndex((t) => t.id === id);
      return bi >= 0 ? `Bot ${bi + 1}` : `Raposa ${world.targets.findIndex((t) => t.id === id) + 1}`;
    };
    const posOf = (id: string): [number, number, number] => {
      const br = brains.get(id);
      if (br) return [br.mover.x, br.mover.y, br.mover.z];
      const b = botSt.get(id);
      if (b) return [b.x, b.y, b.z];
      const t = world.targets.find((x) => x.id === id)!;
      return [t.x, 0, t.z];
    };
    const bodies = (): FsBody[] =>
      ALL_TARGETS.map((t) => {
        const s = targets.get(t.id)!;
        const b = botSt.get(t.id);
        // para onde olha (a facada nas costas precisa disso): bots olham para onde andam; os alvos parados, para o ponto de nascimento
        const fl = b ? ([Math.cos(b.h), Math.sin(b.h)] as [number, number]) : ((t as FsTargetSpec).facing ?? ([0, 1] as [number, number]));
        return { id: t.id, pos: posOf(t.id), alive: s.alive, armor: s.armor, helmet: t.helmet, crouch: b ? b.crouch : s.crouch, facing: fl };
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
        s.kills = s.assists = s.hs = s.damage = 0;
        if (isDm(t.id)) spawnBot(t.id);
        else scene.reviveTarget(t.id);
      }
      dmgLog.clear();
      matchStart = clock;
      setFeed([]);
    };
    /** Fim do tempo no mata-mata: congela o jogo e mostra a tabela de resultados. */
    const finishMatch = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      // o fim da partida fecha o mapa grande e a loja (senão ficavam por cima da tabela, sem como sair)
      bigMapRef.current = false;
      setBigMap(false);
      const rows = fsMatchResult([
        { id: 'me', name: 'Você', kills: stats.kills, assists: stats.assists, deaths: stats.deaths },
        ...dmSpecs.map((d) => {
          const t = targets.get(d.id)!;
          return { id: d.id, name: d.label, kills: t.kills, assists: t.assists, deaths: t.deaths };
        }),
      ]);
      setResult(rows);
      setShopState(false);
      shopRef.current = false;
      controls.releaseLock();
    };
    endMatchRef.current = () => {
      resetMatch();
      resume();
    };

    // ---- estande de tiro: os atiradores só atiram para a frente (norte), em rajadas, e só quando você está na galeria
    const rangeSt = new Map(world.bots.filter((b) => b.kind === 'shoot').map((b) => [b.id, fsNewRange()]));
    const rangeFiredAt: Record<string, number> = {};
    let rangeShots = 0;
    let deadUntil = 0;
    let deadSince = 0;
    let hurtKey = 0;
    let heavyKey = 0;
    let hurtAt = -1e9;
    let heavyAt = -1e9;
    /** Tremor da câmera ao levar tiro (graus); decai sozinho. */
    let shake = 0;
    /** Tiro recebido desacelera um instante (como no CS). */
    let flinch = { mul: 1, dur: 0 };
    let flinchAt = -1e9;
    const hitMarks: { x: number; z: number; at: number }[] = [];
    /** Só para os testes automáticos: mantém os arcos de dano visíveis (o teste tira a foto com calma). */
    let hitHold = false;
    let scopeOn = false;
    let scopeBlur = 0;
    let scopeBlurApplied = -1;
    /** Dano recebido na última 1,2 s (para saber quando é "muito dano"). */
    let recent: { t: number; d: number }[] = [];
    const pushFeedDeath = (killer: string, weapon: FsWeaponId | FsGrenadeId, head: boolean) => {
      const key = ++feedKey;
      setFeed((f) => [...f.slice(-4), { key, killer, weapon, victim: 'Você', head, you: false, youVictim: true }]);
      window.setTimeout(() => setFeed((f) => f.filter((x) => x.key !== key)), 6000);
    };
    /** Um tiro do estande: sempre para a frente do bot (nunca mira em ninguém), com uma dispersão pequena. */
    const rangeFire = (b: (typeof world.bots)[number], bs: ReturnType<typeof fsNewBot>) => {
      const wid = b.weapon as FsWeaponId;
      const w = FS_WEAPONS[wid];
      const origin: [number, number, number] = [bs.x + Math.cos(bs.h) * 0.4, 1.0, bs.z + Math.sin(bs.h) * 0.4];
      const yawDeg = (Math.atan2(-Math.cos(bs.h), -Math.sin(bs.h)) * 180) / Math.PI;
      const pellets = wid === 'shotgun' ? 5 : 1;
      let last: THREE.Vector3 | null = null;
      for (let i = 0; i < pellets; i++) {
        const spread = wid === 'shotgun' ? 3 : 0.8;
        const dir = fsDir(yawDeg + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread * 0.6);
        // o tiro é reto: quem passa na frente do atirador leva (ele não mira em ninguém)
        const me1: FsBody[] = clock >= deadUntil ? [{ id: 'me', pos: [mover.x, mover.y, mover.z], alive: true, armor: me.armor, helmet: me.helmet, crouch: mover.crouchK }] : [];
        const tr = fsTrace(w, origin, dir, ARENA, me1);
        last = new THREE.Vector3(tr.point[0], tr.point[1], tr.point[2]);
        scene.tracer(new THREE.Vector3(origin[0], origin[1], origin[2]), last, wid);
        if (tr.kind === 'world') scene.puff(last, 0xd8c8a8, 0.3, 0.4);
        else if (tr.kind === 'player' && tr.damage) hurtPlayer(tr.damage.hp, tr.damage.armorLoss, tr.zone === 'head', b.label, wid, undefined, { x: bs.x, z: bs.z });
      }
      scene.puff(new THREE.Vector3(origin[0], origin[1], origin[2]), 0xffd27a, 0.25, 0.1);
      fsAudio.shotAt(wid, bs.x, 1, bs.z, mover.x, mover.z);
      rangeFiredAt[b.id] = clock;
      rangeShots++;
    };
    /** Você levou dano (tiro ou explosão): vida, colete, efeitos e morte. */
    function hurtPlayer(hp: number, armorLoss: number, head: boolean, killer: string, icon: FsWeaponId | FsGrenadeId, by?: string, src?: { x: number; z: number }) {
      if (clock < deadUntil) return;
      // de onde veio o tiro (o arco vermelho em volta da mira aponta para lá)
      if (src) {
        hitMarks.push({ x: src.x, z: src.z, at: performance.now() });
        if (hitMarks.length > 4) hitMarks.shift();
      }
      if (by && match) logDamage('me', by);
      me.hp -= hp;
      if (hp > 0) {
        flinch = fsFlinch(hp);
        flinchAt = clock;
      }
      me.armor = Math.max(0, me.armor - armorLoss);
      hurtKey++;
      hurtAt = performance.now();
      // tiro na cabeça que não mata: a câmera treme forte; os outros tiros sacodem leve
      shake = Math.max(shake, head && me.hp > 0 ? 2.6 : 0.5);
      // muito dano de uma vez (35+ num tiro ou 55+ em 1,2 s): efeito vermelho mais forte que depois some
      recent = recent.filter((r) => clock - r.t < 1.2);
      recent.push({ t: clock, d: hp });
      if (hp >= 35 || recent.reduce((s, r) => s + r.d, 0) >= 55) {
        heavyKey++;
        heavyAt = performance.now();
      }
      if (me.hp <= 0) {
        me.hp = 0;
        stats.deaths++;
        deadUntil = clock + FS_RESPAWN_S;
        deadSince = clock;
        if (match && by) {
          // quem matou ganha o abate; o último que bateu antes dele, a assistência
          const kb = by !== 'me' ? targets.get(by) : undefined;
          if (kb) {
            kb.kills++;
            if (head) kb.hs++;
          }
          const as = fsAssister(dmgLog.get('me') ?? [], by, clock);
          const ab = as ? targets.get(as) : undefined;
          if (ab) ab.assists++;
          dmgLog.delete('me');
          pushKill(killer, icon, 'Você', head, { youVictim: true, assist: as ? nameOf(as) : undefined });
        } else pushFeedDeath(killer, icon, head);
      }
    }
    // ---- granadas: as que estão voando, o efeito de cegueira e os atiradores cegos
    const nades: { h: number; body: FsGrenadeBody; bounceSeen: number; bounceAt: number; owner?: string }[] = [];
    let blindTotal = 0;
    let blindUntil = 0;
    let scopedNow = false;
    let adsHold = 0;
    const eyeNow = (): [number, number, number] => [mover.x, mover.y + fsEyeHeight(mover), mover.z];
    const throwNade = (kind: FsGrenadeId, power: number, style: 'far' | 'mid' | 'near' = 'far') => {
      const dir = fsDir(view.yaw + view.rYaw, view.pitch + view.rPitch);
      const e = eyeNow();
      const origin: [number, number, number] = [e[0] + dir[0] * 0.4, e[1] - 0.15 + dir[1] * 0.4, e[2] + dir[2] * 0.4];
      // por baixo (direito): sai mais baixo e mais devagar
      if (style === 'near') origin[1] -= 0.35;
      const body = fsGrenadeLaunch(kind, origin, dir, power, [mover.vx, mover.vz]);
      nades.push({ h: scene.addGrenade(kind), body, bounceSeen: 0, bounceAt: -1 });
    };
    /** Dano de explosão em quem estiver no raio e à vista (sem parede no meio). */
    const damageTarget = (id: string, hp: number, icon: FsGrenadeId, fromX: number, fromZ: number, owner = 'me') => {
      if (match) {
        dealDamage(id, owner, hp, 0, false, icon, fromX, fromZ);
        return;
      }
      const st = targets.get(id)!;
      if (!st.alive) return;
      stats.damage += Math.min(st.hp, hp);
      st.hp -= hp;
      if (st.hp <= 0) {
        st.alive = false;
        st.deaths++;
        st.reviveAt = clock + REVIVE_S;
        stats.kills++;
        scene.killTarget(id, fromX, fromZ, 3.2);
        fsAudio.hit('kill');
        showMarker('kill', 'ABATE');
        const bi = world.bots.findIndex((t) => t.id === id);
        pushFeed(icon, bi >= 0 ? `Bot ${bi + 1}` : `Raposa ${world.targets.findIndex((t) => t.id === id) + 1}`, false);
      } else {
        scene.hitTarget(id);
        fsAudio.hit('body');
        showMarker('body', `-${hp}`);
      }
    };
    const explode = (g: FsGrenadeBody, owner = 'me') => {
      const blast: [number, number, number] = [g.x, g.y + 0.25, g.z];
      scene.explosion(g.kind, g.x, g.y, g.z);
      fsAudio.nadeAt(g.kind === 'frag' ? 'boom-frag' : 'boom-flash', g.x, g.y, g.z, mover.x, mover.z);
      if (g.kind === 'frag') {
        for (const t of ALL_TARGETS) {
          const st = targets.get(t.id)!;
          if (!st.alive) continue;
          const p = posOf(t.id);
          const c: [number, number, number] = [p[0], p[1] + 0.6, p[2]];
          const dmg = fsFragDamage(Math.hypot(c[0] - blast[0], c[1] - blast[1], c[2] - blast[2]));
          if (dmg > 0 && fsClearLine(ARENA, blast, c)) damageTarget(t.id, dmg, 'frag', g.x, g.z, owner);
        }
        // você também leva (se estiver perto e à vista)
        const me3: [number, number, number] = [mover.x, mover.y + 0.7, mover.z];
        const d = Math.hypot(me3[0] - blast[0], me3[1] - blast[1], me3[2] - blast[2]);
        const dmg = fsFragDamage(d);
        if (dmg > 0 && fsClearLine(ARENA, blast, me3)) hurtPlayer(dmg, 0, false, nameOf(owner), 'frag', owner, { x: g.x, z: g.z });
        // o chão treme para quem está perto
        shake = Math.max(shake, Math.max(0, 3.2 * (1 - d / 16)));
        return;
      }
      // luz: cega quem olha e enxerga, ensurdece quem está perto (mesmo sem ver)
      const eye = eyeNow();
      const r = fsFlashEffect(eye, fsDir(view.yaw + view.rYaw, view.pitch + view.rPitch), blast, fsClearLine(ARENA, eye, blast));
      if (r.blind > 0) {
        blindTotal = r.blind;
        blindUntil = clock + r.blind;
      }
      if (r.deaf > 0) fsAudio.deafen(r.deaf);
      // os bots do mata-mata: cegam como o jogador (olhando para a luz e à vista dela)
      for (const [id, b] of brains) {
        if (!targets.get(id)!.alive) continue;
        const be: [number, number, number] = [b.mover.x, b.mover.y + fsEyeHeight(b.mover), b.mover.z];
        const rr = fsFlashEffect(be, fsDir(b.yaw, b.pitch), blast, fsClearLine(ARENA, be, blast));
        if (rr.blind > 0) fsDmFlash(b, clock + rr.blind);
      }
    };
    const stepNades = (dt: number) => {
      for (let i = nades.length - 1; i >= 0; i--) {
        const n = nades[i]!;
        let boom = false;
        const sub = Math.max(1, Math.ceil(dt / (1 / 120)));
        for (let k = 0; k < sub && !boom; k++) boom = fsGrenadeStep(n.body, dt / sub, ARENA);
        scene.setGrenade(n.h, n.body.x, n.body.y, n.body.z, n.body.age * 9);
        if (n.body.bounces > n.bounceSeen && clock - n.bounceAt > 0.1 && Math.hypot(n.body.vx, n.body.vy, n.body.vz) > 1.2) {
          fsAudio.nadeAt('bounce', n.body.x, n.body.y, n.body.z, mover.x, mover.z);
          n.bounceAt = clock;
        }
        n.bounceSeen = n.body.bounces;
        if (boom) {
          scene.removeGrenade(n.h);
          nades.splice(i, 1);
          explode(n.body, n.owner);
        }
      }
    };
    const pushFeed = (weapon: FsWeaponId | FsGrenadeId, victim: string, head: boolean) => {
      const key = ++feedKey;
      setFeed((f) => [...f.slice(-4), { key, killer: 'Você', weapon, victim, head, you: true }]);
      window.setTimeout(() => setFeed((f) => f.filter((x) => x.key !== key)), 6000);
    };

    /** Efeitos do abate que está sendo contado agora (o kill feed mostra um ícone de cada): parede varada, sem mirar e atirador cego. */
    let curMods = { wall: false, noscope: false, blind: false };
    const pushKill = (
      killer: string,
      weapon: FsWeaponId | FsGrenadeId,
      victim: string,
      head: boolean,
      f: { you?: boolean; youVictim?: boolean; assist?: string; youAssist?: boolean },
    ) => {
      const key = ++feedKey;
      setFeed((l) => [...l.slice(-4), { key, killer, weapon, victim, head, you: !!f.you, youVictim: f.youVictim, assist: f.assist, youAssist: f.youAssist, wall: curMods.wall, noscope: curMods.noscope, blindKiller: curMods.blind }]);
      window.setTimeout(() => setFeed((l) => l.filter((x) => x.key !== key)), 6000);
    };
    /** Mata-mata: um bot (ou você) leva dano de `attacker`. Cuida de vida, colete, abate, assistência, pontos e do aviso na tela. */
    function dealDamage(victim: string, attacker: string, hp: number, armorLoss: number, head: boolean, icon: FsWeaponId | FsGrenadeId, fx: number, fz: number): 'kill' | 'hit' | null {
      if (victim === 'me') {
        hurtPlayer(hp, armorLoss, head, nameOf(attacker), icon, attacker, { x: fx, z: fz });
        return me.hp <= 0 ? 'kill' : 'hit';
      }
      const st = targets.get(victim);
      if (!st || !st.alive) return null;
      logDamage(victim, attacker);
      const dealt = Math.min(st.hp, hp);
      st.hp -= hp;
      st.armor = Math.max(0, st.armor - armorLoss);
      if (attacker === 'me') stats.damage += dealt;
      else {
        const a = targets.get(attacker);
        if (a) a.damage += dealt;
      }
      const vb = brains.get(victim);
      if (vb && attacker !== victim) fsDmHurt(vb, fx, fz);
      if (st.hp > 0) {
        scene.hitTarget(victim);
        return 'hit';
      }
      st.alive = false;
      st.deaths++;
      st.reviveAt = clock + REVIVE_S;
      const self = attacker === victim;
      const as = self ? null : fsAssister(dmgLog.get(victim) ?? [], attacker, clock);
      dmgLog.delete(victim);
      if (!self) {
        if (attacker === 'me') {
          stats.kills++;
          if (head) stats.hs++;
        } else {
          const a = targets.get(attacker);
          if (a) {
            a.kills++;
            if (head) a.hs++;
          }
        }
      }
      if (as === 'me') {
        stats.assists++;
        showMarker('body', 'ASSISTÊNCIA');
      } else if (as) {
        const a = targets.get(as);
        if (a) a.assists++;
      }
      const power = icon === 'frag' ? 3.2 : icon === 'flash' ? 1 : (({ knife: 0.8, pistol: 1, usp: 0.8, sniper: 2.8, shotgun: 2.4 }) as Partial<Record<string, number>>)[icon] ?? 1.4;
      scene.killTarget(victim, fx, fz, power);
      if (attacker === 'me') {
        fsAudio.hit('kill');
        showMarker('kill', head ? 'CABEÇA' : 'ABATE');
      }
      pushKill(nameOf(attacker), icon, nameOf(victim), head, { you: attacker === 'me', assist: as ? nameOf(as) : undefined, youAssist: as === 'me' });
      return 'kill';
    }
    /** Põe um bot do mata-mata em campo (cérebro, arma, colete). `x, z, yaw` vêm do ponto de nascimento. */
    function initBot(id: string, x: number, z: number, yaw: number, y = 0) {
      const spec = dmSpecs.find((d) => d.id === id)!;
      const st = targets.get(id)!;
      st.alive = true;
      st.hp = 100;
      st.crouch = 0;
      const vest = rnd() < 0.55;
      st.armor = vest ? 100 : 0;
      spec.helmet = vest && rnd() < 0.5;
      brains.set(id, fsDmNew(id, x, z, yaw, fsDmPickWeapon(rnd), rnd, y));
      const bs = fsNewBot({ ...spec, kind: 'turn', x, z, x1: x, z1: z });
      bs.h = fsDmHeading(yaw);
      botSt.set(id, bs);
      dmgLog.delete(id);
    }
    /** Quem está vivo (e onde): para escolher onde nascer longe deles. */
    const aliveFoes = (except: string) => {
      const out: { x: number; z: number }[] = [];
      if (except !== 'me' && clock >= deadUntil) out.push({ x: mover.x, z: mover.z });
      for (const d of dmSpecs) if (d.id !== except && targets.get(d.id)!.alive) out.push({ x: brains.get(d.id)!.mover.x, z: brains.get(d.id)!.mover.z });
      return out;
    };
    function spawnBot(id: string) {
      const sp = fsPickSpawn(aliveFoes(id), rnd);
      initBot(id, sp.x, sp.z, sp.yaw, sp.y);
      scene.reviveTarget(id);
      scene.setBot(id, sp.x, sp.y, sp.z, botSt.get(id)!.h, 'idle', 1);
    }
    for (const d of dmSpecs) initBot(d.id, d.x, d.z, firstSpawn ? (Math.atan2(d.x, d.z) * 180) / Math.PI + 180 : 0, dmSpawnY.get(d.id) ?? 0);

    // ---- os bots do mata-mata jogando
    const foesFor = (self: string): FsDmFoe[] => {
      const out: FsDmFoe[] = [];
      if (self !== 'me' && clock >= deadUntil) {
        out.push({ id: 'me', x: mover.x, y: mover.y, z: mover.z, crouch: mover.crouchK, noisy: mover.onGround && Math.hypot(mover.vx, mover.vz) > 3.4 && mover.crouchK < 0.5 });
      }
      for (const [id, b] of brains) {
        if (id !== self && targets.get(id)!.alive) out.push({ id, x: b.mover.x, y: b.mover.y, z: b.mover.z, crouch: b.mover.crouchK, noisy: b.speed > 3.4 && b.mover.crouchK < 0.5 });
      }
      return out;
    };
    const bodiesFor = (self: string): FsBody[] => {
      const out = bodies().filter((b) => b.id !== self);
      out.push({ id: 'me', pos: [mover.x, mover.y, mover.z], alive: clock >= deadUntil, armor: me.armor, helmet: me.helmet, crouch: mover.crouchK });
      return out;
    };
    const dmFire = (b: FsDmBrain, a: Extract<FsDmAction, { type: 'fire' }>) => {
      const w = FS_WEAPONS[a.weapon];
      const others = bodiesFor(b.id);
      const o = new THREE.Vector3(a.origin[0] + a.rays[0]![0] * 0.5, a.origin[1] + a.rays[0]![1] * 0.5, a.origin[2] + a.rays[0]![2] * 0.5);
      const pool = new Map<string, { hp: number; armorLoss: number; head: boolean; wall: boolean }>();
      for (const ray of a.rays) {
        const tr = fsTrace(w, a.origin, ray, ARENA, others);
        scene.tracer(o, new THREE.Vector3(tr.point[0], tr.point[1], tr.point[2]), a.weapon);
        if (tr.kind === 'player' && tr.targetId && tr.damage) {
          const cur = pool.get(tr.targetId) ?? { hp: 0, armorLoss: 0, head: false, wall: false };
          cur.wall = cur.wall || tr.wall < 1;
          cur.hp += tr.damage.hp;
          cur.armorLoss += tr.damage.armorLoss;
          cur.head = cur.head || tr.zone === 'head';
          pool.set(tr.targetId, cur);
        }
      }
      scene.puff(o, 0xffd27a, 0.25, 0.1);
      fsAudio.shotAt(a.weapon, b.mover.x, 1, b.mover.z, mover.x, mover.z);
      for (const [vid, d] of pool) {
        curMods = { wall: d.wall, noscope: false, blind: false };
        dealDamage(vid, b.id, d.hp, d.armorLoss, d.head, a.weapon, b.mover.x, b.mover.z);
        curMods = { wall: false, noscope: false, blind: false };
      }
      for (const [id, other] of brains) if (id !== b.id) fsDmHear(other, a.weapon, b.mover.x, b.mover.z);
    };
    const dmStepT: Record<string, number> = {};
    /** Só para os testes automáticos: congela os bots (sem andar nem atirar). */
    let dmOff = false;
    const stepDm = (dt: number) => {
      const movers: { x: number; z: number }[] = [];
      for (const d of dmSpecs) {
        if (!targets.get(d.id)!.alive) continue;
        const b = brains.get(d.id)!;
        const acts = fsDmStep(b, { now: clock, dt, rng: rnd, boxes: ARENA, foes: foesFor(d.id) });
        for (const a of acts) {
          if (a.type === 'fire') dmFire(b, a);
          else if (a.type === 'throw') {
            const body = fsGrenadeLaunch(a.kind, a.origin, a.dir, a.power, [b.mover.vx, b.mover.vz]);
            nades.push({ h: scene.addGrenade(a.kind), body, bounceSeen: 0, bounceAt: -1, owner: d.id });
          }
        }
        movers.push(b.mover);
      }
      fsSeparate(movers);
      for (const d of dmSpecs) {
        const st = targets.get(d.id)!;
        if (!st.alive) continue;
        const b = brains.get(d.id)!;
        const bs = botSt.get(d.id)!;
        bs.x = b.mover.x;
        bs.y = b.mover.y;
        bs.z = b.mover.z;
        bs.h = fsDmHeading(b.yaw);
        bs.crouch = b.mover.crouchK;
        const still = b.mover.crouchK > 0.5 && b.speed < 1;
        scene.setBot(d.id, bs.x, bs.y, bs.z, bs.h, still ? 'crouchwalk' : b.anim, still ? 0 : b.animSpeed);
        if (b.speed > 3.4 && b.mover.onGround && b.mover.crouchK < 0.5) {
          dmStepT[d.id] = (dmStepT[d.id] ?? 0) - dt * (b.speed / 3.4);
          if (dmStepT[d.id]! <= 0) {
            dmStepT[d.id] = 0.5;
            fsAudio.stepAt(bs.x, 0, bs.z, mover.x, mover.z);
          }
        }
      }
    };

    const applyHit = (
      id: FsWeaponId,
      tr: ReturnType<typeof fsTrace>,
      to: THREE.Vector3,
      pool?: { total: number; kind: 'head' | 'armor' | 'body' },
    ) => {
      if (tr.kind === 'world') {
        scene.puff(to, 0xd8c8a8, 0.3, 0.4);
        fsAudio.impact();
      } else if (tr.kind === 'player' && tr.targetId && tr.damage && match) {
        const d = tr.damage;
        scene.puff(to, tr.zone === 'head' ? 0xffd45a : 0xff9a4a, 0.4, 0.3);
        curMods = { wall: tr.wall < 1, noscope: id === 'sniper' && !scopedNow, blind: blindUntil > clock };
        const res = dealDamage(tr.targetId, 'me', d.hp, d.armorLoss, tr.zone === 'head', id, mover.x, mover.z);
        curMods = { wall: false, noscope: false, blind: false };
        if (res === 'hit') {
          const kind = tr.zone === 'head' ? 'head' : d.protectedByArmor ? 'armor' : 'body';
          if (pool) {
            pool.total += d.hp;
            if (kind === 'head' || pool.kind === 'body') pool.kind = kind;
          } else {
            fsAudio.hit(kind);
            showMarker(kind, `-${d.hp}`);
          }
        }
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
          const bi = world.bots.findIndex((t) => t.id === tr.targetId);
          pushFeed(id, bi >= 0 ? `Bot ${bi + 1}` : `Raposa ${world.targets.findIndex((t) => t.id === tr.targetId) + 1}`, tr.zone === 'head');
        } else {
          scene.hitTarget(tr.targetId);
          const kind = tr.zone === 'head' ? 'head' : d.protectedByArmor ? 'armor' : 'body';
          if (pool) {
            // escopeta: os projéteis do mesmo tiro somam o dano e mostram um marcador só
            pool.total += d.hp;
            if (kind === 'head' || pool.kind === 'body') pool.kind = kind;
          } else {
            fsAudio.hit(kind);
            showMarker(kind, `-${d.hp}`);
          }
        }
      }
    };

    const fire = (
      id: FsWeaponId,
      shot: { kickPitch: number; kickYaw: number; devYaw: number; devPitch: number; pellets?: { devYaw: number; devPitch: number }[] },
    ) => {
      const w = FS_WEAPONS[id];
      const eye: [number, number, number] = [mover.x, mover.y + fsEyeHeight(mover), mover.z];
      const from = scene.muzzleWorld();
      // escopeta: cada projétil é um raio (com o desvio dele); as outras armas, um só
      const rays = shot.pellets ?? [{ devYaw: shot.devYaw, devPitch: shot.devPitch }];
      const pool = shot.pellets ? { total: 0, kind: 'body' as 'head' | 'armor' | 'body' } : undefined;
      const killsBefore = stats.kills;
      for (const ray of rays) {
        const dir = fsDir(view.yaw + view.rYaw + ray.devYaw, view.pitch + view.rPitch + ray.devPitch);
        const tr = fsTrace(w, eye, dir, ARENA, bodies());
        const to = new THREE.Vector3(tr.point[0], tr.point[1], tr.point[2]);
        scene.tracer(from, to, id);
        applyHit(id, tr, to, pool);
      }
      if (pool && pool.total > 0 && stats.kills === killsBefore) {
        fsAudio.hit(pool.kind);
        showMarker(pool.kind, `-${pool.total}`);
      }
      scene.fireFx(({ sniper: 2.4, shotgun: 3.2, pistol: 0.5, usp: 0.28, smg: 0.8, m4: 0.95, ak: 1, knife: 0 } as Record<FsWeaponId, number>)[id]);
      fsAudio.shot(id);
      for (const b of brains.values()) fsDmHear(b, id, mover.x, mover.z);
      view.rPitch += shot.kickPitch;
      view.rYaw += shot.kickYaw;
    };

    const melee = (kind: 'slash' | 'stab') => {
      const kw = FS_WEAPONS.knife;
      const eye: [number, number, number] = [mover.x, mover.y + fsEyeHeight(mover), mover.z];
      const dir = fsDir(view.yaw + view.rYaw, view.pitch + view.rPitch);
      const w = kind === 'stab' ? { ...kw, damage: kw.melee!.stab } : kw;
      let tr = fsTrace(w, eye, dir, ARENA, bodies(), kw.melee!.range);
      // facada (botão direito) nas costas de quem acertou: 100 de dano (mata na hora) e animação própria
      let back = false;
      if (kind === 'stab' && tr.kind === 'player' && tr.targetId) {
        const body = bodies().find((b) => b.id === tr.targetId);
        if (body?.facing && fsIsBackstab(body.facing, [body.pos[0], body.pos[2]], [mover.x, mover.z])) {
          back = true;
          tr = fsTrace({ ...kw, damage: kw.melee!.backstab }, eye, dir, ARENA, bodies(), kw.melee!.range);
        }
      }
      scene.knifeSwing(back ? 'backstab' : kind);
      fsAudio.shot('knife');
      const point = new THREE.Vector3(tr.point[0], tr.point[1], tr.point[2]);
      if (back) {
        // facada nas costas: o abate espera a faca descer na animação (~0,27 s) e só então acontece, junto com o som
        const victim = tr.targetId;
        window.setTimeout(() => {
          if (victim && !targets.get(victim)?.alive) return;
          fsAudio.stab();
          applyHit('knife', tr, point);
        }, 270);
        return;
      }
      if (tr.kind === 'player') fsAudio.stab();
      applyHit('knife', tr, point);
    };
    const handle = (events: ReturnType<FsLoadout['update']>) => {
      for (const e of events) {
        if (e.type === 'fire') {
          fire(e.weapon.id, e.shot);
        }
        else if (e.type === 'melee') melee(e.kind);
        else if (e.type === 'inspect') {
          if (e.weapon.id === 'knife') scene.knifeInspect(true, e.weapon.inspect);
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
          throwNade(e.grenade, e.power, e.style);
        } else if (e.type === 'bolt') boltAt = clock + 0.45;
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
        points: match ? fsMatchScore(stats) : undefined,
        team: 'ct',
      },
      ...ALL_TARGETS.map((t) => {
        const s = targets.get(t.id)!;
        return {
          id: t.id,
          name: nameOf(t.id),
          you: false,
          alive: s.alive,
          armor: s.armor,
          kills: s.kills,
          deaths: s.deaths,
          assists: s.assists,
          hs: s.hs,
          damage: s.damage,
          points: match ? fsMatchScore(s) : undefined,
          team: isDm(t.id) ? (dmSpecs.findIndex((d) => d.id === t.id) % 2 === 0 ? ('t' as const) : ('ct' as const)) : undefined,
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
        const hit = ARENA.some(
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
      // comprar granada só guarda (não troca o que está na mão)
      if (!fsShopItem(item.id)?.grenade) afterEquip();
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
      const isPaused = pausedRef.current || endedRef.current;
      const inp = controls.read();
      const playerDead = clock < deadUntil;
      // cai a câmera ao morrer (0 a 1 em 0,7 s)
      const deathK = playerDead ? Math.min(1, (clock - deadSince) / 0.7) : 0;
      scene.hideViewmodel = deathK > 0.15;
      if (playerDead) {
        inp.fwd = inp.strafe = 0;
        inp.jump = inp.trigger = inp.ads = inp.reload = inp.crouch = inp.walk = inp.inspect = inp.buy = inp.drop = inp.pickup = false;
      } else if (deadUntil > 0) {
        // renasce no ponto de partida, vida cheia, sem colete (como no CS)
        deadUntil = 0;
        me.hp = 100;
        me.armor = 0;
        me.helmet = false;
        // renasce com os pentes cheios (as granadas gastas não voltam: compra de novo na loja)
        loadout.refillAmmo();
        scene.endReload();
        const sp = match ? fsPickSpawn(aliveFoes('me'), rnd) : FS_SPAWN;
        {
          view.yaw = sp.yaw;
          view.pitch = view.rPitch = view.rYaw = 0;
        }
        mover.x = sp.x;
        mover.z = sp.z;
        mover.y = 'y' in sp ? (sp as { y: number }).y : 0;
        mover.vx = mover.vz = mover.vy = 0;
        prev.x = mover.x;
        prev.y = 0;
        prev.z = mover.z;
      }
      const w = loadout.weapon;
      let speed = Math.hypot(mover.vx, mover.vz);
      let adsOn = false;

      if (!isPaused) {
        clock += dt;
        // a luz (cegueira) não passa enquanto está morto: continua depois de renascer
        if (playerDead) blindUntil += dt;
        // o botão de mirar segurado não pode piscar: uma queda de 0,12 s no sinal não solta a mira
        adsHold = inp.ads ? 0.12 : Math.max(0, adsHold - dt);
        adsOn = (inp.ads || adsHold > 0) && !loadout.reloading && !loadout.weapon.melee;
        const adsScale = Math.min(1, (w.adsFov || 62) / baseFov) * st.adsSens;
        const look = controls.takeLook(adsOn ? adsScale : 1);
        view.yaw += look.yaw;
        view.pitch = Math.max(-88, Math.min(88, view.pitch + look.pitch));
        if (inp.map) setMap(!bigMapRef.current);
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
        else if (inp.cycle) handle(loadout.cycleAll(1));
        if (inp.grenade) handle(loadout.selectGrenade('next'));
        if (inp.grenadeFrag) handle(loadout.selectGrenade('frag'));
        if (inp.grenadeFlash) handle(loadout.selectGrenade('flash'));

        const speed0 = speed;
        const mul = loadout.weapon.moveMul * (adsOn ? 0.65 : 1) * fsFlinchAt(flinch, clock - flinchAt);
        acc += dt;
        // o clique de pular vale por 0,15 s: apertar um pouco antes de pousar já pula no pouso (bunny hop sem segurar a tecla)
        if (inp.jump) jumpBuf = 0.15;
        // quem está vivo é um obstáculo (dá para esbarrar); quem morreu deixa de ser (dá para passar por cima)
        const solids: FsBox[] = [...ARENA];
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
        // granadas no ar e a força do arremesso (o braço vai para trás enquanto segura)
        if (loadout.held) scene.nadeCharge(loadout.pinOut ? (loadout.throwStyle === 'far' ? 1 : loadout.throwStyle === 'mid' ? 0.6 : 0.1) : 0);
        stepNades(dt);
        if (match && !dmOff) stepDm(dt);
        // bots andando, pulando e girando
        for (const b of world.bots) {
          const bs = botSt.get(b.id)!;
          if (!targets.get(b.id)!.alive) continue;
          fsBotStep(bs, b, dt);
          if (b.kind === 'shoot') {
            // só atiram com a pessoa na galeria; sempre para a frente, nunca na direção dela
            const g = FS_TRAIN_GALLERY;
            const watching = mover.x > g.x0 - 2 && mover.x < g.x1 + 2 && mover.z > g.z0 - 3 && mover.z < g.z1 + 0.5 && !playerDead;
            const st = rangeSt.get(b.id)!;
            if (watching && fsRangeStep(st, b.weapon as FsWeaponId, dt, Math.random)) rangeFire(b, bs);
            bs.anim = clock - (rangeFiredAt[b.id] ?? -9) < 0.25 ? 'shoot' : 'idle';
          }
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
            if (isDm(t.id)) {
              spawnBot(t.id);
              continue;
            }
            s.armor = t.armor;
            const spec = world.bots.find((b) => b.id === t.id);
            if (spec) botSt.set(t.id, fsNewBot(spec));
            scene.reviveTarget(t.id);
          }
        }
        if (clock - matchStart >= MATCH_S) {
          if (match) finishMatch();
          else resetMatch();
        }
      }
      setBoardState(inp.board && !isPaused);

      const scoped = adsOn && loadout.weapon.adsFov > 0;
      scopedNow = scoped;
      const adsTarget = adsOn ? 1 : 0;
      const fov = baseFov + ((loadout.weapon.adsFov || 62) - baseFov) * (adsOn ? 1 : 0);
      // física em passos fixos de 1/120 s: interpola para a câmera andar liso em qualquer taxa de quadros
      const alpha = isPaused ? 1 : Math.min(1, acc / STEP);
      // granada de luz: tela branca cheia enquanto dura a primeira parte e depois some aos poucos
      if (blindEl.current) {
        const left = isPaused ? 0 : blindUntil - clock;
        const o = left <= 0 ? 0 : left > blindTotal * 0.45 ? 1 : left / (blindTotal * 0.45);
        blindEl.current.style.opacity = String(Math.max(0, Math.min(1, o)));
      }
      // luneta da sniper: liga junto com a mira fechando (sem esperar o HUD, que só atualiza a cada 100 ms) e o borrão anda suave
      if (scopeEl.current) {
        const on = loadout.weapon.adsFov > 0 && !loadout.reloading && !isPaused && scene.adsAmount > 0.93 && adsOn;
        const el = scopeEl.current;
        if (on !== scopeOn) {
          scopeOn = on;
          el.style.opacity = on ? '1' : '0';
        }
        const tb = Math.min(1, fsSpreadDeg(loadout.weapon, { moving: speed > 0.8, speed, airborne: !mover.onGround, ads: true }, loadout.slot.gun) / 6) * 2.4;
        scopeBlur += (tb - scopeBlur) * Math.min(1, dt * 8);
        const bq = Math.round(scopeBlur * 4) / 4;
        if (bq !== scopeBlurApplied) {
          scopeBlurApplied = bq;
          for (const c of Array.from(el.children) as HTMLElement[]) c.style.filter = bq > 0 ? `blur(${bq}px)` : '';
        }
      }
      // arcos vermelhos em volta da mira: apontam de onde veio cada tiro e somem em ~1,6 s
      {
        const arcs = hitEl.current?.children;
        const nowMs = performance.now();
        for (let i = 0; arcs && i < arcs.length; i++) {
          const el = arcs[i] as HTMLElement;
          const m = hitMarks[i];
          const age = m ? (hitHold ? 0.2 : (nowMs - m.at) / 1000) : 9;
          if (!m || age > 1.6 || playerDead) {
            el.style.opacity = '0';
            continue;
          }
          const bearing = (Math.atan2(-(m.x - mover.x), -(m.z - mover.z)) * 180) / Math.PI;
          el.style.transform = `rotate(${-(bearing - view.yaw)}deg)`;
          el.style.opacity = String(Math.min(1, (1.6 - age) / 0.9));
        }
      }
      // tremor: passa rápido e some em ~0,5 s
      if (!isPaused) shake *= Math.exp(-6 * dt);
      const sk = shake > 0.02 ? shake : 0;
      const e = deathK * deathK * (3 - 2 * deathK);
      scene.setView(
        prev.x + (mover.x - prev.x) * alpha,
        prev.y + (mover.y - prev.y) * alpha + fsEyeHeight(mover) - e * (fsEyeHeight(mover) - 0.22),
        prev.z + (mover.z - prev.z) * alpha,
        view.yaw + view.rYaw + (sk ? Math.sin(clock * 83) * sk : 0),
        view.pitch + view.rPitch + (sk ? Math.cos(clock * 71) * sk : 0) + e * 18,
        THREE.MathUtils.lerp(scene.fovNow ?? baseFov, fov, Math.min(1, dt * 12)),
        (sk ? Math.sin(clock * 97) * sk * 0.6 : 0) + e * 24,
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
        boxes: ARENA,
        labels: world.labels,
        marks: world.style === 'dust' ? FS_DUST_MARKS : undefined,
        // no mata-mata todos são inimigos e o radar não entrega onde estão
        targets: (match ? [] : ALL_TARGETS).map((t) => ({
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
          hurtKey,
          heavyKey,
          hurtAge: (performance.now() - hurtAt) / 1000,
          heavyAge: (performance.now() - heavyAt) / 1000,
          dead: clock < deadUntil,
          respawnIn: Math.max(0, deadUntil - clock),
          armor: me.armor,
          helmet: me.helmet,
          ammo: loadout.held ? loadout.grenades[loadout.held] : loadout.slot.ammo,
          mag: loadout.held ? FS_GRENADES[loadout.held].max : loadout.weapon.mag,
          weapon: loadout.held ? FS_GRENADES[loadout.held].name : loadout.weapon.name,
          weaponId: loadout.weapon.id,
          heldNade: loadout.held,
          nades: (['frag', 'flash'] as FsGrenadeId[])
            .filter((k) => loadout.grenades[k] > 0)
            .map((k) => ({ id: k, name: FS_GRENADES[k].name, count: loadout.grenades[k], key: bindLabel((k === 'frag' ? fsSettings().binds.grenadeFrag : fsSettings().binds.grenadeFlash) || fsSettings().binds.grenade) })),
          speed: Math.round(speed * 10) / 10,
          blur: Math.min(1, fsSpreadDeg(loadout.weapon, mvs, loadout.slot.gun) / 6),
          slots: loadout.slots.map((sl, i) => ({ id: sl?.id ?? null, name: sl ? FS_WEAPONS[sl.id].name : '', key: i + 1 })),
          current: loadout.current,
          reloading: !loadout.held && loadout.reloading,
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
        // times (só a cor): você é contra-terrorista (azul), o 1º bot terrorista (laranja), o 2º azul...
        dmSpecs.forEach((d, i) => {
          scene.setTeam(d.id, i % 2 === 0 ? 't' : 'ct');
          // os do seu time (azul) aparecem com o nome e por trás das paredes
          if (i % 2 === 1) scene.setAlly(d.id, true, d.label);
        });
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
        teleport(x: number, z: number, y?: number) {
          mover.x = x;
          mover.z = z;
          prev.x = x;
          prev.z = z;
          if (y !== undefined) {
            mover.y = y;
            prev.y = y;
          }
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
        look(yaw: number, pitch = 0) {
          view.yaw = yaw;
          view.pitch = pitch;
          view.rPitch = view.rYaw = 0;
        },
        rangeShots: () => rangeShots,
        feedDemo: () => {
          curMods = { wall: true, noscope: true, blind: true };
          pushKill('Você', 'sniper', 'Bot 1', true, { you: true });
          curMods = { wall: false, noscope: false, blind: false };
          pushKill('Bot 2', 'ak', 'Você', true, { youVictim: true });
        },
        bot: (id: string) => ({ ...botSt.get(id)!, alive: targets.get(id)!.alive }),
        pos: (id: string) => posOf(id),
        hp: () => me.hp,
        nades: () => ({ ...loadout.grenades, held: loadout.held, flying: nades.length }),
        grab: (k: FsGrenadeId | 'next') => handle(loadout.selectGrenade(k)),
        throwNow: (k: FsGrenadeId, power = 0.6) => throwNade(k, power),
        altBtn: (on: boolean) => controls.setTouch('ads', on),
        blind: () => Math.max(0, blindUntil - clock),
        fireBtn: (on: boolean) => controls.setTouch('fire', on),
        blastAt: (kind: FsGrenadeId, x: number, z: number) => {
          const body = { kind, x, y: 0.15, z, vx: 0, vy: 0, vz: 0, age: 0, fuse: 0.05, bounces: 0 } as FsGrenadeBody;
          nades.push({ h: scene.addGrenade(kind), body, bounceSeen: 0, bounceAt: -1 });
        },
        ads: (on: boolean) => controls.setTouch('ads', on),
        vm: () => scene.debugVm(),
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
        match: () => ({ ended: endedRef.current, clock, matchStart, dm: dmSpecs.map((d) => ({ id: d.id, ...targets.get(d.id)!, weapon: brains.get(d.id)?.weapon, x: brains.get(d.id)?.mover.x, z: brains.get(d.id)?.mover.z })) }),
        finish: () => finishMatch(),
        holdHit: (v: boolean) => {
          hitHold = v;
        },
        hurt: (x: number, z: number) => hurtPlayer(1, 0, false, 'teste', 'pistol', undefined, { x, z }),
        dmOff: (v: boolean) => {
          dmOff = v;
        },
        skip: (sec: number) => {
          matchStart -= sec;
        },
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
      <div className="fs-blind" ref={blindEl} data-testid="fs-blind" aria-hidden="true" />
      <div className="fs-hitdir" ref={hitEl} data-testid="fs-hitdir" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      {status === 'loading' && <div className="fs-load mono">CARREGANDO O TREINO...</div>}
      {status === 'error' && (
        <div className="fs-load mono">Não deu para carregar os modelos. Atualize a página.</div>
      )}

      {hud && status === 'ready' && (
        <>
          <div className="fs-scope" ref={scopeEl} aria-hidden="true" style={{ opacity: 0 }}>
            <i />
            <b />
          </div>
          {!hud.scoped && <FsCrosshair spreadPx={hud.spreadPx} />}
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
          {bigMap && !result && <FsBigMap get={getMini} title={match ? 'Mapa · Duna' : 'Mapa · Treino'} />}
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
          {hud.hurtAge < 0.45 && !hud.dead && !result && <div key={`h${hud.hurtKey}`} className="fs-hurt" aria-hidden="true" />}
          {hud.heavyAge < 1.7 && !hud.dead && !result && <div key={`v${hud.heavyKey}`} className="fs-hurt heavy" aria-hidden="true" />}
          {hud.dead && !paused && !result && (
            <div className="fs-deadscreen" role="status" data-testid="fs-dead">
              <b>Você morreu</b>
              <span className="mono" data-testid="fs-respawn">
                Renascendo em {hud.respawnIn.toFixed(1)}
              </span>
            </div>
          )}
          <FsVitals hp={hud.hp} armor={hud.armor} helmet={hud.helmet} />
          <FsAmmo
            weapon={hud.weapon}
            id={hud.weaponId}
            ammo={hud.ammo}
            mag={hud.mag}
            reloading={hud.reloading}
            slots={hud.slots}
            current={hud.current}
            nades={hud.nades}
            heldNade={hud.heldNade}
          />
          {shop && !paused && (
            <FsShop
              onBuy={(i) => buyRef.current(i)}
              onClose={() => setShop(false)}
              equipped={hud.slots}
              nades={hud.nades}
              armor={hud.armor}
              helmet={hud.helmet}
              owned={[
                ...hud.slots.flatMap((x) => (x.id ? [x.id] : [])),
                ...(hud.armor > 0 ? ['vest'] : []),
                ...(hud.armor > 0 && hud.helmet ? ['vesthelm'] : []),
                ...hud.nades.filter((n) => n.count >= FS_GRENADES[n.id].max).map((n) => n.id),
              ]}
            />
          )}
          {board && !result && <FsScoreboard players={hud.players} timeLeft={hud.timeLeft} title={match ? `Mata-mata · Duna · ${match.minutes} min` : undefined} />}
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
          {result && match && (
            <FsMatchEnd rows={result} minutes={match.minutes} onAgain={() => onAgainRef.current()} onExit={() => onExit?.()} />
          )}
          {paused && !portrait && !result && (
            <FsMenu
              touch={touch}
              exitTo="/fox-cap/counter-fox"
              exitLabel="Voltar ao menu do Counter Fox"
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
