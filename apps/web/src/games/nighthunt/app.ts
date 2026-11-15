import {
  ACHIEVEMENTS,
  EVOLUTIONS,
  EVO_INFO,
  HEROES,
  HERO_IDS,
  HERO_INFO,
  MAPS,
  MAP_IDS,
  MAP_INFO,
  META_LIST,
  PASSIVE_IDS,
  UPGRADE_MAX,
  WEAPON_IDS,
  buyHero,
  heroUnlocked,
  mapProgress,
  mapUnlocked,
  type ChoiceId,
  type EvoId,
  NhWorld,
  STEP,
  UPGRADES,
  UPGRADE_IDS,
  MAX_PASSIVE_SLOTS,
  MAX_WEAPON_SLOTS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  applyRun,
  buyMeta,
  checkAchievements,
  metaBonus,
  metaCost,
  type Achievement,
  type NhEvent,
  type NhSave,
  type RunResult,
  type UpgradeId,
} from '@nocap/games';
import {
  drawFrame,
  drawText,
  frameSize,
  loadAtlas,
  measureText,
  nineSlice,
  wrapText,
  fitText,
  type Atlas,
} from './assets';
import { NhAudio, type NhSound } from './audio';
import { NH_REMOTE, loadSave, writeSave } from './save';
import {
  drawWorld,
  stage,
  heroFrame,
  mapFrame,
  pushFx,
  type Fx,
  type WorldDrawState,
} from './view';
import { animFrame } from './assets';

type Screen =
  | 'loading'
  | 'menu'
  | 'heroes'
  | 'maps'
  | 'upgrades'
  | 'achievements'
  | 'items'
  | 'audio'
  | 'game'
  | 'over';
type Modal = null | 'levelUp' | 'chest' | 'pause' | 'audio' | 'confirmQuit';
type Style = 'main' | 'danger' | 'blue' | 'dis';

// Telas de menu desenham numa caixa de 510x680 centrada; o jogo usa a largura inteira. W e H valem para a tela que está sendo desenhada.
let W = VIEW_WIDTH;
let H = VIEW_HEIGHT;
const NAVY = '#191d2b';
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const back = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = Math.min(1, Math.max(0, x));
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
interface ChoiceInfo {
  name: string;
  desc: string;
  icon: string;
  evo: boolean;
  max: number;
}
/** Nome, descrição e ícone de uma melhoria ou evolução. */
function choiceInfo(id: ChoiceId): ChoiceInfo {
  if (id.startsWith('evo')) {
    const e = EVO_INFO[id as EvoId];
    return { name: e.name, desc: e.desc, icon: `E/${id}`, evo: true, max: 1 };
  }
  const u = UPGRADES[id as UpgradeId];
  return { name: u.name, desc: u.desc, icon: u.icon, evo: false, max: u.max };
}
const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

interface Hit {
  x: number;
  y: number;
  w: number;
  h: number;
  fn: () => void;
  id: string;
}

export interface NhHooks {
  /** Sai do jogo (volta para o Hub). */
  exit(): void;
}

/**
 * O Night Hunt inteiro desenhado em canvas (menu, melhorias, itens, conquistas, partida, pausa, resultado), com a arte do Slash.
 * A simulação vive em @nocap/games (NhWorld); aqui só entrada, desenho, som e transições.
 */
export class NhApp {
  private g: CanvasRenderingContext2D;
  private a!: Atlas;
  private audio = new NhAudio();
  private save: NhSave = loadSave();
  private raf = 0;
  private prev = 0;
  private dpr = 1;
  private cw = 0;
  private ch = 0;
  private k = 1;
  /** Tamanho lógico da tela inteira (a caixa 510x680 cabe dentro dele, em pé ou deitado). */
  private fw = VIEW_WIDTH;
  private fh = VIEW_HEIGHT;
  private bx = 0;
  private by = 0;
  private my = 0;
  private ox = 0;
  private oy = 0;
  private time = 0;
  private screen: Screen = 'loading';
  private modal: Modal = null;
  private modalT = 0;
  private screenT = 0;
  private fade = { t: 0, to: null as Screen | null, phase: 'in' as 'out' | 'in' };
  private hits: Hit[] = [];
  private mouse = { x: -99, y: -99, down: false, id: '' as string };
  private keys = new Set<string>();
  private joy: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private uid = 0;
  private cleanup: Array<() => void> = [];

  // partida
  private world: NhWorld | null = null;
  private acc = 0;
  private fx: Fx[] = [];
  private draw: WorldDrawState = {
    time: 0,
    deadFor: -1,
    hurtFlash: 0,
    healFlash: 0,
    fx: this.fx,
    dropT: new Map(),
    hero: 'kael',
    map: 'campo',
  };
  private chestT = 0;
  private chestPick: ChoiceId | null = null;
  private banishMode = false;
  private screenRed = 0;
  private runSeed = 0;

  // resultados
  private result: {
    r: RunResult;
    gold: number;
    record: boolean;
    unlocked: Achievement[];
    shown: number;
    seen: UpgradeId[];
  } | null = null;

  // telas de lista
  private scroll = 0;
  private scrollMax = 0;
  private selItem = 0;
  private dragScroll: { y: number; s: number } | null = null;
  private slider: 'music' | 'sound' | null = null;
  private toastQ: Array<{ text: string; sub: string; t: number }> = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private hooks: NhHooks,
  ) {
    this.g = canvas.getContext('2d')!;
  }

  async start(): Promise<void> {
    this.bind();
    this.resize();
    this.a = await loadAtlas();
    this.audio.sound = this.save.sound;
    this.audio.musicOn = this.save.music;
    this.screen = 'menu';
    this.screenT = 0;
    this.prev = performance.now();
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  /** Atalhos só para teste em desenvolvimento (window.__nh). */
  devHooks() {
    return {
      xp: (n = 10) => {
        const w = this.world;
        if (w)
          for (let i = 0; i < n; i++)
            w.items.push({
              uid: 9000 + i,
              type: 'xp',
              x: w.player.x,
              y: w.player.y,
              attracted: false,
              speed: 0,
              born: w.t,
            });
      },
      chest: () => {
        const w = this.world;
        if (w)
          w.items.push({
            uid: 9999,
            type: 'chest',
            x: w.player.x,
            y: w.player.y,
            attracted: false,
            speed: 0,
            born: w.t,
          });
      },
      skip: (sec: number) => {
        const w = this.world;
        if (!w) return;
        for (let i = 0; i < sec * 60 && w.alive; i++) {
          if (w.pending) w.choose(w.pending.options[0]!);
          w.player.hp = w.player.maxHp;
          w.step({ x: Math.cos(i / 90), y: Math.sin(i / 90) });
          w.drainEvents();
        }
      },
      die: () => {
        const w = this.world;
        if (w) (w as unknown as { hurtPlayer(n: number): void }).hurtPlayer(9999);
      },
      state: () => ({
        screen: this.screen,
        modal: this.modal,
        t: this.world?.t,
        level: this.world?.level,
        enemies: this.world?.enemies.length,
        kills: this.world?.kills,
        hp: this.world?.player.hp,
      }),
      gold: (n: number) => (this.save.gold += n),
      evo: () => {
        const w = this.world;
        if (w) {
          w.levels.halo = 6;
          w.levels.heart = 1;
        }
      },
      levels: (n: number) => {
        const w = this.world;
        if (w) {
          for (const id of ['horizontal', 'axe', 'orbit', 'lightning', 'armor', 'clover'] as const)
            w.levels[id] = Math.min(n, 5);
        }
      },
      pick: (hero: string, map: string) => {
        this.save.pick = { hero, map };
        if (!this.save.heroes.includes(hero)) this.save.heroes.push(hero);
        const st = this.save.stats;
        st.bestTime = Math.max(st.bestTime, 1000);
        st.bestLevel = Math.max(st.bestLevel, 30);
        st.bossKills = Math.max(st.bossKills, 5);
        if (st.evolutions.length < 2) st.evolutions = ['evoHalo', 'evoAxe'];
      },
      brk: () => {
        const w = this.world;
        const b = w?.breakables[0];
        if (w && b) {
          w.player.x = b.x - 70;
          w.player.y = b.y - 30;
        }
        return w?.breakables.length ?? 0;
      },
      go: (s: Screen) => this.go(s),
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    for (const c of this.cleanup) c();
    this.audio.dispose();
    writeSave(this.save);
  }

  // ---------------- entrada ----------------
  private bind(): void {
    const c = this.canvas;
    const on = (
      el: HTMLElement | Window,
      ev: string,
      fn: (e: never) => void,
      opts?: AddEventListenerOptions,
    ) => {
      el.addEventListener(ev, fn as EventListener, opts);
      this.cleanup.push(() => el.removeEventListener(ev, fn as EventListener));
    };
    on(window, 'resize', () => this.resize());
    // a conta mandou um save mais novo (outro aparelho): vale por inteiro, fora de uma partida
    on(window, NH_REMOTE, () => {
      if (this.screen !== 'game') this.save = loadSave();
    });
    on(c, 'pointerdown', (e: PointerEvent) => {
      this.audio.unlock();
      c.setPointerCapture(e.pointerId);
      const p = this.pos(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.down = true;
      const h = this.hitAt(p.x, p.y);
      this.mouse.id = h?.id ?? '';
      if (this.slider === null) this.sliderStart(p.x, p.y);
      if (!h && this.screen === 'game' && !this.modal && this.world?.alive)
        this.joy = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
      else if (!h && this.isListScreen()) this.dragScroll = { y: p.y, s: this.scroll };
    });
    on(c, 'pointermove', (e: PointerEvent) => {
      const p = this.pos(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      if (this.joy && this.joy.id === e.pointerId) {
        this.joy.x = p.x;
        this.joy.y = p.y;
      }
      if (this.slider) this.sliderMove(p.x);
      if (this.dragScroll)
        this.scroll = Math.max(
          0,
          Math.min(this.scrollMax, this.dragScroll.s - (p.y - this.dragScroll.y)),
        );
    });
    const up = (e: PointerEvent) => {
      const p = this.pos(e);
      const h = this.hitAt(p.x, p.y);
      const moved = this.dragScroll ? Math.abs(p.y - this.dragScroll.y) > 8 : false;
      if (this.mouse.down && h && h.id === this.mouse.id && !moved) {
        this.audio.play('click');
        h.fn();
      }
      this.mouse.down = false;
      this.mouse.id = '';
      this.slider = null;
      this.dragScroll = null;
      if (this.joy && this.joy.id === e.pointerId) this.joy = null;
    };
    on(c, 'pointerup', up);
    on(c, 'pointercancel', () => {
      this.mouse.down = false;
      this.joy = null;
      this.slider = null;
      this.dragScroll = null;
    });
    on(c, 'wheel', (e: WheelEvent) => {
      if (this.isListScreen())
        this.scroll = Math.max(0, Math.min(this.scrollMax, this.scroll + e.deltaY * 0.6));
    });
    on(window, 'keydown', (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key))
        e.preventDefault();
      this.keys.add(key);
      this.audio.unlock();
      this.onKey(key);
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => {
      this.keys.clear();
      if (this.screen === 'game' && !this.modal && this.world?.alive) this.openModal('pause');
    });
    on(document as unknown as HTMLElement, 'visibilitychange', () => {
      if (document.hidden && this.screen === 'game' && !this.modal && this.world?.alive)
        this.openModal('pause');
    });
  }

  private pos(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - this.ox) / this.k,
      y: (e.clientY - r.top - this.oy) / this.k,
    };
  }
  private hitAt(x: number, y: number): Hit | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i]!;
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
  }
  private isListScreen(): boolean {
    return (
      this.screen === 'achievements' ||
      this.screen === 'items' ||
      this.screen === 'upgrades' ||
      this.screen === 'heroes'
    );
  }

  private onKey(key: string): void {
    if (this.screen === 'game' && this.world) {
      if (key === 'escape' || key === 'p') {
        if (this.modal === 'pause') this.closeModal();
        else if (!this.modal && this.world.alive) this.openModal('pause');
      }
      if (this.modal === 'levelUp' && key === 'r') this.world.reroll();
      if (this.modal === 'levelUp' && key === 'b') this.banishMode = !this.banishMode;
      if (this.modal === 'levelUp' && key === 'x') this.world.skip();
      if (this.modal === 'levelUp' && '1234'.includes(key)) {
        const c = this.world.pending?.options[Number(key) - 1];
        if (c && this.modalT > 0.5 + Number(key) * 0.12) this.pickUpgrade(c);
      }
      if (this.modal === 'chest' && (key === 'enter' || key === ' ') && this.chestT > 1.6)
        this.pickUpgrade(this.chestPick!);
      if (this.modal === 'chest' && key === 'escape' && this.chestT > 1.6) this.pickUpgrade(null);
    } else if (this.screen === 'menu' && (key === 'enter' || key === ' ')) this.go('heroes');
    else if (this.screen === 'heroes' && (key === 'enter' || key === ' ')) this.go('maps');
    else if (this.screen === 'maps' && (key === 'enter' || key === ' ')) this.startGame();
    else if (key === 'escape' && this.screen === 'maps') this.go('heroes');
    else if (
      key === 'escape' &&
      this.screen !== 'menu' &&
      this.screen !== 'loading' &&
      this.screen !== 'game'
    )
      this.go('menu');
  }

  // ---------------- tamanho ----------------
  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cw = r.width;
    this.ch = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.k = Math.min(this.cw / VIEW_WIDTH, this.ch / VIEW_HEIGHT);
    this.fw = this.cw / this.k;
    this.fh = this.ch / this.k;
    stage.w = this.fw;
    stage.h = this.fh;
  }

  // ---------------- laço ----------------
  private frame(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - this.prev) / 1000));
    this.prev = now;
    this.time += dt;
    this.screenT += dt;
    this.modalT += dt;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  private update(dt: number): void {
    // transição entre telas
    if (this.fade.to !== null || this.fade.t > 0) {
      if (this.fade.phase === 'out') {
        this.fade.t += dt / 0.2;
        if (this.fade.t >= 1) {
          if (this.fade.to) this.enter(this.fade.to);
          this.fade.to = null;
          this.fade.phase = 'in';
          this.fade.t = 1;
        }
      } else {
        this.fade.t -= dt / 0.28;
        if (this.fade.t <= 0) this.fade.t = 0;
      }
    }
    for (const t of this.toastQ) t.t += dt;
    this.toastQ = this.toastQ.filter((t) => t.t < 3.6);
    if (this.screen === 'over' && this.result)
      this.result.shown = Math.min(
        this.result.gold,
        this.result.shown + Math.max(1, this.result.gold / 45) * dt * 60 * 0.6,
      );
    if (this.screen !== 'game' || !this.world) return;

    const w = this.world;
    this.draw.time = this.time;
    this.draw.hurtFlash = Math.max(0, this.draw.hurtFlash - dt);
    this.draw.healFlash = Math.max(0, this.draw.healFlash - dt);
    this.screenRed = Math.max(0, this.screenRed - dt * 2.2);
    for (const f of this.fx) f.t += dt;
    this.fx.splice(0, this.fx.length, ...this.fx.filter((f) => f.t < f.dur));

    if (w.pending && !this.modal) {
      this.openModal(w.pending.kind);
      this.banishMode = false;
      if (w.pending.kind === 'chest') {
        this.chestPick = w.pending.options[0] ?? null;
        this.chestT = 0;
      }
    }
    if (!this.modal && w.alive) {
      this.acc += dt;
      let n = 0;
      const input = this.readInput();
      while (this.acc >= STEP && n < 6 && !w.pending) {
        w.step(input);
        this.acc -= STEP;
        n++;
        this.consume(w.drainEvents());
      }
      if (this.acc > STEP * 6) this.acc = 0;
    }
    if (this.modal === 'chest') this.chestT += dt;
    if (!w.alive) {
      this.draw.deadFor = this.draw.deadFor < 0 ? 0 : this.draw.deadFor + dt;
      if (this.draw.deadFor > 2.6) this.finishRun();
    }
  }

  private readInput(): { x: number; y: number } {
    let x =
      (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) -
      (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
    let y =
      (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) -
      (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0);
    if (this.joy) {
      const R = 46;
      const dx = this.joy.x - this.joy.ox;
      const dy = this.joy.y - this.joy.oy;
      const l = Math.hypot(dx, dy);
      if (l > 4) {
        x = dx / Math.max(l, R);
        y = -dy / Math.max(l, R);
        if (l > R * 1.6) {
          // o botão acompanha o dedo se ele se afastar muito
          this.joy.ox = this.joy.x - (dx / l) * R * 1.6;
          this.joy.oy = this.joy.y - (dy / l) * R * 1.6;
        }
      }
    }
    return { x, y };
  }

  private consume(events: NhEvent[]): void {
    const snd = (n: NhSound, r = 1) => this.audio.play(n, r);
    for (const e of events) {
      switch (e.k) {
        case 'swing':
          snd('swing');
          break;
        case 'enemyHit':
          snd('enemyHit', 0.9 + Math.random() * 0.2);
          break;
        case 'enemyDeath':
          pushFx(this.fx, 'enemyDeath', e.x, e.y);
          break;
        case 'breakHit':
          snd('enemyHit', 0.7 + Math.random() * 0.15);
          break;
        case 'break':
          pushFx(this.fx, 'debris', e.x, e.y, this.world?.mapId);
          snd('enemyHit', 0.55);
          break;
        case 'playerHit':
          snd('playerHit');
          this.draw.hurtFlash = 0.1;
          this.screenRed = this.save.flashes ? 0.55 : 0;
          break;
        case 'playerDeath':
          snd('playerDeath');
          this.audio.stopMusic();
          break;
        case 'pickup':
          pushFx(this.fx, 'pickup', e.x, e.y);
          snd(
            ({ xp: 'xp', gold: 'gold', health: 'heal', magnet: 'magnet', chest: 'chest' } as const)[
              e.type
            ],
          );
          if (e.type === 'health') this.draw.healFlash = 0.12;
          break;
        case 'levelUp':
          snd('levelUp');
          break;
        case 'fire':
          snd(e.kind === 'axe' ? 'horizontal' : e.kind);
          break;
        case 'bolt':
          pushFx(this.fx, 'bolt', e.x, e.y);
          snd('diagonal', 1.4);
          break;
        case 'evolve':
          snd('levelUp', 0.8);
          this.screenRed = 0;
          break;
      }
    }
  }

  // ---------------- fluxo ----------------
  private go(to: Screen): void {
    if (this.fade.to) return;
    this.fade.to = to;
    this.fade.phase = 'out';
    this.fade.t = 0;
  }
  private enter(s: Screen): void {
    this.screen = s;
    this.screenT = 0;
    this.modal = null;
    this.scroll = 0;
    this.joy = null;
    if (s === 'menu') {
      this.audio.stopMusic();
      this.world = null;
    }
    if (s === 'game') this.audio.startMusic();
    this.audio.applyVolumes();
  }
  private openModal(m: Exclude<Modal, null>): void {
    this.modal = m;
    this.modalT = 0;
    this.joy = null;
    if (m === 'levelUp' || m === 'chest') this.audio.play(m === 'chest' ? 'chest' : 'menuOpen');
    else this.audio.play('menuOpen');
    this.audio.pauseAll(false);
  }
  private closeModal(): void {
    this.modal = null;
    this.joy = null;
  }

  private startGame(): void {
    this.go('game');
    const { hero, map } = this.save.pick;
    this.runSeed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    this.world = new NhWorld(String(this.runSeed), this.save.meta, { hero, map });
    this.acc = 0;
    this.fx.length = 0;
    this.draw = {
      time: 0,
      deadFor: -1,
      hurtFlash: 0,
      healFlash: 0,
      fx: this.fx,
      dropT: new Map(),
      hero,
      map,
    };
    this.screenRed = 0;
    this.modal = null;
    this.banishMode = false;
    this.result = null;
    this.audio.startMusic();
    writeSave(this.save);
  }

  private pickUpgrade(id: ChoiceId | null): void {
    if (!this.world) return;
    if (id === null) this.world.decline();
    else {
      this.world.choose(id);
      if (!id.startsWith('evo') && !this.save.seen.includes(id as UpgradeId))
        this.save.seen.push(id as UpgradeId);
    }
    this.audio.play('click');
    this.modal = null;
    this.banishMode = false;
    if (this.world.pending) {
      // outra janela na fila (subiu mais de um nível de uma vez)
      const p = this.world.pending;
      this.openModal(p.kind);
      if (p.kind === 'chest') {
        this.chestPick = p.options[0] ?? null;
        this.chestT = 0;
      }
    }
  }

  private finishRun(): void {
    if (!this.world || this.screen !== 'game' || this.fade.to) return;
    const r = this.world.result();
    const before = this.save.highscore;
    const { unlocked, goldGained } = applyRun(this.save, r, Date.now());
    writeSave(this.save);
    this.result = {
      r,
      gold: goldGained,
      record: r.score > before && before > 0,
      unlocked,
      shown: 0,
      seen: UPGRADE_IDS.filter((u) => (r.upgrades[u] ?? 0) > 0),
    };
    this.go('over');
  }

  // ---------------- widgets ----------------
  private btn(
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fn: () => void,
    style: Style = 'main',
    icon?: string,
  ): void {
    const g = this.g;
    const a = this.a;
    const id = `b${this.uid++}${label}`;
    const hov =
      this.mouse.x >= x && this.mouse.x <= x + w && this.mouse.y >= y && this.mouse.y <= y + h;
    const prs = hov && this.mouse.down && this.mouse.id === id;
    if (style !== 'dis') this.hits.push({ x, y, w, h, fn, id });
    const oy = prs ? 2 : 0;
    const s = h / 32;
    g.save();
    nineSlice(g, a, 'UI/ButtonMain', x, y + oy, w, h, 10, s);
    if (style === 'danger') {
      g.globalCompositeOperation = 'source-atop';
    }
    g.restore();
    if (style === 'danger' || style === 'dis' || hov) {
      g.save();
      g.globalAlpha = style === 'dis' ? 0.55 : style === 'danger' ? 0.45 : 0.14;
      g.fillStyle = style === 'dis' ? '#10131c' : style === 'danger' ? '#d83a3a' : '#ffffff';
      g.beginPath();
      g.roundRect(x + 8 * s, y + 5 * s + oy, w - 16 * s, h - 10 * s, 6);
      g.fill();
      g.restore();
    }
    const size = Math.min(h * 0.4, 30);
    let tx = x + w / 2;
    if (icon) {
      const f = frameSize(a, icon);
      const is = (h * 0.6) / Math.max(f.w, f.h);
      drawFrame(g, a, icon, x + 18 * s + (f.w * is) / 2, y + h / 2 + oy, { s: is });
      tx += (f.w * is) / 2 + 4;
    }
    drawText(g, a, label, tx, y + h / 2 - size / 2 - 1 + oy, {
      size,
      align: 'center',
      color: style === 'dis' ? '#8d93a8' : '#ffffff',
      maxWidth: w - 40 * s - (icon ? 30 : 0),
    });
  }

  private smallBtn(
    icon: 'x' | 'sound' | 'pause',
    x: number,
    y: number,
    size: number,
    fn: () => void,
  ): void {
    const g = this.g;
    const a = this.a;
    const id = `s${this.uid++}${icon}`;
    const hov =
      this.mouse.x >= x &&
      this.mouse.x <= x + size &&
      this.mouse.y >= y &&
      this.mouse.y <= y + size;
    const prs = hov && this.mouse.down && this.mouse.id === id;
    this.hits.push({ x: x - 6, y: y - 6, w: size + 12, h: size + 12, fn, id });
    const oy = prs ? 2 : 0;
    nineSlice(g, a, 'UI/Button', x, y + oy, size, size, 5, size / 16);
    g.save();
    g.fillStyle = '#ffffff';
    if (hov) {
      g.globalAlpha = 0.12;
      g.beginPath();
      g.roundRect(x + 4, y + 4 + oy, size - 8, size - 8, 4);
      g.fill();
      g.globalAlpha = 1;
    }
    const cx = x + size / 2;
    const cy = y + size / 2 + oy;
    if (icon === 'pause') {
      g.fillRect(cx - size * 0.18, cy - size * 0.24, size * 0.12, size * 0.48);
      g.fillRect(cx + size * 0.06, cy - size * 0.24, size * 0.12, size * 0.48);
    } else if (icon === 'x') {
      g.lineWidth = size * 0.12;
      g.strokeStyle = '#ffffff';
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx - size * 0.2, cy - size * 0.2);
      g.lineTo(cx + size * 0.2, cy + size * 0.2);
      g.moveTo(cx + size * 0.2, cy - size * 0.2);
      g.lineTo(cx - size * 0.2, cy + size * 0.2);
      g.stroke();
    } else {
      g.beginPath();
      g.moveTo(cx - size * 0.24, cy - size * 0.1);
      g.lineTo(cx - size * 0.1, cy - size * 0.1);
      g.lineTo(cx + size * 0.08, cy - size * 0.26);
      g.lineTo(cx + size * 0.08, cy + size * 0.26);
      g.lineTo(cx - size * 0.1, cy + size * 0.1);
      g.lineTo(cx - size * 0.24, cy + size * 0.1);
      g.closePath();
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = size * 0.07;
      g.beginPath();
      g.arc(cx + size * 0.1, cy, size * 0.16, -0.9, 0.9);
      g.stroke();
    }
    g.restore();
  }

  /** Janela do Slash com título, cantos e enfeites. Devolve a área útil. */
  private windowFrame(
    title: string,
    x: number,
    y: number,
    w: number,
    h: number,
    pop = 1,
    onClose?: () => void,
  ): { x: number; y: number; w: number; h: number } {
    const g = this.g;
    const a = this.a;
    g.save();
    const cx = x + w / 2;
    const cy = y + h / 2;
    const sc = 0.82 + 0.18 * back(pop);
    g.translate(cx, cy);
    g.scale(sc, sc);
    g.translate(-cx, -cy);
    g.globalAlpha = Math.min(1, pop * 3);
    nineSlice(g, a, 'UI/Window/WndBg', x, y, w, h, 7, 2);
    drawFrame(g, a, 'UI/Window/WndDecTop', cx, y - 4, { s: 2, ay: 0.5 });
    drawFrame(g, a, 'UI/Window/WndDecTopCorner', x - 4, y - 8, { s: 2, ax: 0, ay: 0 });
    drawFrame(g, a, 'UI/Window/WndDecTopCorner', x + w + 4, y - 8, {
      s: 2,
      ax: 0,
      ay: 0,
      flip: true,
    });
    drawFrame(g, a, 'UI/Window/WndDecBott', cx, y + h + 2, { s: 2, ay: 0.5 });
    const tw = Math.min(w - 120, 300);
    nineSlice(g, a, 'UI/Window/WndTitleBg', cx - tw / 2, y - 22, tw, 56, 10, 1.6);
    drawText(g, a, title, cx, y - 8, { size: 24, align: 'center', maxWidth: tw - 30 });
    g.restore();
    if (onClose) this.smallBtn('x', x + w - 32, y + 10, 30, onClose);
    return { x: x + 14, y: y + 40, w: w - 28, h: h - 54 };
  }

  private goldCounter(x: number, y: number, align: 'left' | 'center' = 'left'): void {
    const g = this.g;
    const a = this.a;
    const txt = String(this.save.gold);
    const size = 24;
    const wd = measureText(a, txt, { size }) + 40;
    const sx = align === 'center' ? x - wd / 2 : x;
    drawFrame(g, a, 'UI/GoldIcon', sx + 14, y + 12, { s: 2 });
    drawText(g, a, txt, sx + 36, y, { size, color: '#ffd44a' });
  }

  private drawIconTile(
    icon: string,
    x: number,
    y: number,
    s: number,
    opts: { dark?: boolean; q?: boolean; sel?: boolean } = {},
  ): void {
    const g = this.g;
    const a = this.a;
    nineSlice(g, a, 'UI/UpgButton', x, y, s, s, 8, s / 30);
    if (opts.q) {
      drawText(g, a, '?', x + s / 2, y + s * 0.2, {
        size: s * 0.5,
        align: 'center',
        color: '#8d93a8',
      });
    } else {
      const f = frameSize(a, icon);
      const is = (s * 0.74) / Math.max(f.w, f.h);
      drawFrame(g, a, icon, x + s / 2, y + s / 2, {
        s: is,
        tint: opts.dark ? '#10131c' : undefined,
        tintAlpha: opts.dark ? 0.8 : 0,
      });
    }
    if (opts.sel) {
      g.save();
      g.strokeStyle = '#ffd44a';
      g.lineWidth = 3;
      g.strokeRect(x - 3, y - 3, s + 6, s + 6);
      g.restore();
    }
  }

  // ---------------- desenho ----------------
  private render(): void {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#0c0e15';
    g.fillRect(0, 0, this.cw, this.ch);
    this.hits = [];
    this.uid = 0;
    if (this.screen === 'loading') {
      g.fillStyle = '#9aa3b8';
      g.font = '16px sans-serif';
      g.textAlign = 'center';
      g.fillText('Carregando...', this.cw / 2, this.ch / 2);
      return;
    }
    const inGame = this.screen === 'game';
    // menus: caixa 510x680 no centro; jogo: largura inteira, HUD no topo, janelas centradas na vertical
    W = inGame ? this.fw : VIEW_WIDTH;
    H = VIEW_HEIGHT;
    this.bx = inGame ? 0 : (this.fw - VIEW_WIDTH) / 2;
    this.by = inGame ? 0 : (this.fh - VIEW_HEIGHT) / 2;
    this.my = inGame && this.modal ? Math.max(0, (this.fh - VIEW_HEIGHT) / 2) : 0;
    this.ox = this.bx * this.k;
    this.oy = (this.by + this.my) * this.k;
    g.save();
    g.scale(this.k, this.k);
    g.translate(this.bx, this.by);
    g.imageSmoothingEnabled = false;
    switch (this.screen) {
      case 'menu':
        this.drawMenu();
        break;
      case 'heroes':
        this.drawHeroes();
        break;
      case 'maps':
        this.drawMaps();
        break;
      case 'upgrades':
        this.drawUpgrades();
        break;
      case 'achievements':
        this.drawAchievements();
        break;
      case 'items':
        this.drawItems();
        break;
      case 'audio':
        this.drawMenuBg();
        this.drawAudioWindow(() => this.go('menu'));
        break;
      case 'game':
        this.drawGame();
        break;
      case 'over':
        this.drawOver();
        break;
    }
    this.drawToasts();
    if (this.fade.t > 0) {
      g.globalAlpha = Math.min(1, this.fade.t);
      g.fillStyle = '#080a10';
      g.fillRect(-this.bx, -this.by, this.fw, this.fh);
      g.globalAlpha = 1;
    }
    g.restore();
  }

  private drawMenuBg(): void {
    const g = this.g;
    const a = this.a;
    // o fundo ocupa a tela inteira; o conteúdo fica na caixa 510x680 (bx, by é o canto dela)
    const x0 = -this.bx;
    const y0 = -this.by;
    const fw = this.fw;
    const fh = this.fh;
    const bottom = y0 + fh;
    g.fillStyle = NAVY;
    g.fillRect(x0, y0, fw, fh);
    const red = g.createLinearGradient(0, y0 + fh * 0.35, 0, bottom);
    red.addColorStop(0, 'rgba(158,40,54,0)');
    red.addColorStop(1, 'rgba(158,40,54,.85)');
    g.fillStyle = red;
    g.fillRect(x0, y0 + fh * 0.35, fw, fh * 0.65);
    const blue = g.createLinearGradient(0, y0, 0, y0 + fh * 0.55);
    blue.addColorStop(0, 'rgba(30,77,146,.95)');
    blue.addColorStop(1, 'rgba(30,77,146,0)');
    g.fillStyle = blue;
    g.fillRect(x0, y0, fw, fh * 0.55);
    // sol e raios girando devagar, e a horda de silhueta (a horda se repete para cobrir telas largas)
    const cx = x0 + fw / 2;
    g.save();
    g.globalAlpha = 0.22;
    drawFrame(g, a, 'UI/sunrays', cx, bottom - 70, {
      s: 5.2 * Math.max(1, fw / 510),
      rot: this.time * 0.05,
    });
    g.restore();
    drawFrame(g, a, 'UI/TitleMenu/Sun', cx, bottom - 70, { s: 1.5, tint: '#ff9a3c', tintAlpha: 1 });
    for (let hx = cx - 560; hx <= cx + 560; hx += 480)
      if (hx > x0 - 300 && hx < x0 + fw + 300)
        drawFrame(g, a, 'UI/TitleMenu/Horde', hx, bottom - 101, {
          s: 1.6,
          tint: '#191d2b',
          tintAlpha: 1,
        });
    g.fillStyle = NAVY;
    g.fillRect(x0, bottom - 22, fw, 22);
  }

  private drawMenu(): void {
    const g = this.g;
    const a = this.a;
    this.drawMenuBg();
    const open = ease(this.screenT / 0.5);
    // título (fonte Bonk Fatty do Slash) com contorno
    const ty = 80 - (1 - open) * 40 + Math.sin(this.time * 1.6) * 3;
    g.save();
    g.globalAlpha = open;
    drawText(g, a, 'NIGHT', W / 2, ty, {
      size: 92,
      align: 'center',
      font: 'bonk',
      color: '#ffb23e',
    });
    drawText(g, a, 'HUNT', W / 2, ty + 78, {
      size: 92,
      align: 'center',
      font: 'bonk',
      color: '#ff5a3c',
    });
    g.restore();
    const hs = this.save.highscore;
    drawText(g, a, hs > 0 ? `Recorde: ${fmtTime(hs)}` : 'Sobreviva ao máximo', W / 2, 262, {
      size: 22,
      align: 'center',
      color: '#f2e6c8',
    });
    const bx = W / 2 - 125;
    const slide = (i: number) => (1 - ease((this.screenT - 0.12 * i) / 0.4)) * 70;
    this.btn('JOGAR', bx, 300 + slide(0), 250, 66, () => this.go('heroes'));
    this.btn('MELHORIAS', bx, 378 + slide(1), 250, 54, () => this.go('upgrades'), 'blue');
    this.btn('ITENS', bx, 444 + slide(2), 250, 54, () => this.go('items'), 'blue');
    this.btn('CONQUISTAS', bx, 510 + slide(3), 250, 54, () => this.go('achievements'), 'blue');
    const done = Object.keys(this.save.achievements).length;
    drawText(g, a, `${done}/${ACHIEVEMENTS.length}`, bx + 250 + 14, 510 + slide(3) + 15, {
      size: 18,
      color: '#ffd44a',
    });
    this.goldCounter(14, 16);
    this.smallBtn('sound', W - 56, 14, 42, () => this.go('audio'));
    this.btn('VOLTAR', 14, H - 58, 120, 44, () => this.hooks.exit(), 'danger');
  }

  // ---------------- escolha do herói e do mapa ----------------
  private drawHeroes(): void {
    const g = this.g;
    const a = this.a;
    this.drawMenuBg();
    const pop = ease(this.screenT / 0.3);
    const f = this.windowFrame('ESCOLHA O HERÓI', 18, 72, W - 36, H - 150, pop, () =>
      this.go('menu'),
    );
    this.goldCounter(W / 2, 30, 'center');
    const top = f.y + 4;
    const viewH = f.h - 78;
    const rh = 112;
    this.scrollMax = Math.max(0, HERO_IDS.length * rh - viewH);
    g.save();
    g.beginPath();
    g.rect(f.x, top, f.w, viewH);
    g.clip();
    HERO_IDS.forEach((id, i) => {
      const y = top + i * rh - this.scroll;
      if (y < top - rh || y > top + viewH) return;
      const h = HEROES[id]!;
      const info = HERO_INFO[id]!;
      const owned = heroUnlocked(this.save, id);
      const sel = this.save.pick.hero === id;
      nineSlice(g, a, 'UI/Button', f.x + 2, y + 2, f.w - 4, rh - 8, 5, 2);
      if (sel) {
        g.save();
        g.strokeStyle = '#ffd44a';
        g.lineWidth = 3;
        g.strokeRect(f.x + 4, y + 4, f.w - 8, rh - 12);
        g.restore();
      }
      nineSlice(g, a, 'UI/UpgButton', f.x + 12, y + 12, 84, 84, 8, 84 / 30);
      drawFrame(
        g,
        a,
        heroFrame(a, id, animFrame(a, 'Player/Idle', this.time + i * 0.3)),
        f.x + 54,
        y + 56,
        {
          s: 2.3,
          flip: true,
          tint: owned ? undefined : '#10131c',
          tintAlpha: owned ? 0 : 0.75,
        },
      );
      drawText(g, a, owned ? info.name : '???', f.x + 108, y + 12, {
        size: 26,
        color: owned ? '#ffd44a' : '#8d93a8',
      });
      drawText(
        g,
        a,
        info.title,
        f.x + 108 + measureText(a, owned ? info.name : '???', { size: 26 }) + 10,
        y + 19,
        { size: 15, color: '#9ad0ff' },
      );
      const fit = fitText(a, info.desc, f.w - 260, rh - 42 - 14, 14);
      fit.lines.forEach((l, j) =>
        drawText(g, a, l, f.x + 108, y + 42 + j * fit.lh, { size: fit.size, color: '#e6ecff' }),
      );
      if (h.start) drawFrame(g, a, UPGRADES[h.start].icon, f.x + f.w - 160, y + 30, { s: 0.55 });
      const bx = f.x + f.w - 140;
      if (!owned) {
        const can = this.save.gold >= h.price;
        this.btn(
          String(h.price),
          bx,
          y + 52,
          126,
          44,
          () => {
            if (buyHero(this.save, id)) {
              this.save.pick.hero = id;
              writeSave(this.save);
              this.audio.play('gold');
            } else this.audio.play('playerHit');
          },
          can ? 'main' : 'dis',
          'UI/GoldIconSmall',
        );
      } else {
        this.btn(
          sel ? 'ESCOLHIDO' : 'ESCOLHER',
          bx,
          y + 52,
          126,
          44,
          () => {
            this.save.pick.hero = id;
            writeSave(this.save);
          },
          sel ? 'blue' : 'main',
        );
      }
    });
    g.restore();
    this.drawScrollbar(f.x + f.w - 6, top, viewH);
    this.btn('CONTINUAR', W / 2 - 120, f.y + f.h - 66, 240, 58, () => this.go('maps'), 'main');
  }

  private drawMaps(): void {
    const g = this.g;
    const a = this.a;
    this.drawMenuBg();
    const pop = ease(this.screenT / 0.3);
    const f = this.windowFrame('ESCOLHA O MAPA', 18, 72, W - 36, H - 150, pop, () =>
      this.go('heroes'),
    );
    this.goldCounter(W / 2, 30, 'center');
    const rh = (f.h - 8) / MAP_IDS.length;
    MAP_IDS.forEach((id, i) => {
      const y = f.y + 4 + i * rh;
      const m = MAPS[id]!;
      const info = MAP_INFO[id]!;
      const open = mapUnlocked(this.save, id);
      const sel = this.save.pick.map === id;
      nineSlice(g, a, 'UI/Button', f.x + 2, y + 2, f.w - 4, rh - 8, 5, 2);
      if (sel && open) {
        g.save();
        g.strokeStyle = '#ffd44a';
        g.lineWidth = 3;
        g.strokeRect(f.x + 4, y + 4, f.w - 8, rh - 12);
        g.restore();
      }
      // prévia: o chão do mapa com a decoração dele e o herói escolhido
      const pw = 150;
      const ph = rh - 40;
      const px = f.x + 14;
      const py = y + 14;
      g.save();
      g.beginPath();
      g.rect(px, py, pw, ph);
      g.clip();
      g.fillStyle = `rgb(${m.ground[0]},${m.ground[1]},${m.ground[2]})`;
      g.fillRect(px, py, pw, ph);
      const tile = this.a.bgs[(i * 2 + 1) % this.a.bgs.length] ?? [];
      for (const it of tile)
        drawFrame(g, a, mapFrame(a, id, it.f), px + pw / 2 + it.x * 0.5, py + ph / 2 - it.y * 0.5, {
          s: it.s * 0.7,
        });
      drawFrame(
        g,
        a,
        heroFrame(a, this.save.pick.hero, animFrame(a, 'Player/Idle', this.time)),
        px + pw / 2,
        py + ph / 2 + 4,
        { s: 1.6, flip: true },
      );
      for (let k = 0; k < 3; k++)
        drawFrame(
          g,
          a,
          animFrame(a, 'Enemies/Bat/Move', this.time + k * 0.2),
          px + 24 + k * 50,
          py + 24 + (k % 2) * 40,
          { s: 1.3 },
        );
      if (!open) {
        g.fillStyle = 'rgba(8,10,16,.72)';
        g.fillRect(px, py, pw, ph);
      }
      g.restore();
      g.strokeStyle = '#0f1424';
      g.lineWidth = 3;
      g.strokeRect(px, py, pw, ph);
      const tx = px + pw + 14;
      drawText(g, a, open ? info.name : '???', tx, y + 14, {
        size: 26,
        color: open ? '#ffd44a' : '#8d93a8',
        maxWidth: f.w - pw - 40,
      });
      // texto, recorde/requisito e botão empilhados: a descrição cabe no espaço que sobra
      const fit = fitText(
        a,
        open ? info.desc : 'Mapa bloqueado.',
        f.w - pw - 44,
        open ? Math.max(20, rh - 8 - 46 - 76) : 18,
        15,
      );
      fit.lines.forEach((l, j) =>
        drawText(g, a, l, tx, y + 46 + j * fit.lh, { size: fit.size, color: '#e6ecff' }),
      );
      const best = this.save.stats.mapBestTime[id] ?? 0;
      if (open && best > 0)
        drawText(g, a, `Recorde: ${fmtTime(best)}`, tx, y + rh - 80, {
          size: 15,
          color: '#9ad0ff',
        });
      if (!open) {
        // exigências com o progresso de cada uma (todas precisam estar cumpridas)
        const reqs = mapProgress(this.save, id);
        reqs.forEach((r, j) => {
          const time = r.label.startsWith('Sobreviva');
          const v = (n: number) => (time ? fmtTime(n) : String(n));
          drawText(
            g,
            a,
            `${r.label} (${v(r.have)}/${v(r.need)})`,
            tx,
            y + rh - 58 - (reqs.length - j) * 16,
            { size: 13, color: r.done ? '#7fe08a' : '#ff9a6a', maxWidth: f.w - pw - 44 },
          );
        });
      }
      void m;
      this.btn(
        open ? 'JOGAR' : 'BLOQUEADO',
        tx,
        y + rh - 52,
        200,
        38,
        () => {
          this.save.pick.map = id;
          this.startGame();
        },
        open ? 'main' : 'dis',
      );
    });
  }

  // ---------------- melhorias permanentes ----------------
  private drawUpgrades(): void {
    const g = this.g;
    const a = this.a;
    this.drawMenuBg();
    const pop = ease(this.screenT / 0.3);
    const f = this.windowFrame('MELHORIAS', 18, 72, W - 36, H - 150, pop, () => this.go('menu'));
    this.goldCounter(W / 2, 30, 'center');
    const rh = 92;
    const top = f.y + 4;
    const viewH = f.h - 8;
    this.scrollMax = Math.max(0, META_LIST.length * rh - viewH);
    g.save();
    g.beginPath();
    g.rect(f.x, top, f.w, viewH);
    g.clip();
    META_LIST.forEach((m, i) => {
      const y = top + i * rh - this.scroll;
      if (y < top - rh || y > top + viewH) return;
      const lv = this.save.meta[m.key];
      const cost = metaCost(m.key, lv);
      const max = cost === null;
      const can = !max && this.save.gold >= cost;
      this.drawIconTile(m.icon, f.x + 4, y + 8, 72);
      const tx = f.x + 86;
      drawText(g, a, m.name, tx, y + 8, { size: 24, color: '#ffffff' });
      const next = metaBonus(m.key, max ? lv : lv + 1);
      const fit = fitText(a, m.desc(next), f.w - 86 - 150, rh - 36 - 30, 15);
      fit.lines.forEach((l, j) =>
        drawText(g, a, l, tx, y + 36 + j * fit.lh, {
          size: fit.size,
          color: max ? '#9aa3b8' : '#c9d3ea',
        }),
      );
      for (let p = 0; p < 3; p++)
        drawFrame(g, a, 'UI/ButtonMark', tx + p * 22 + 6, y + rh - 18, {
          s: 1.4,
          alpha: p < lv ? 1 : 0.28,
        });
      const bw = 124;
      const bx = f.x + f.w - bw - 6;
      if (max) this.btn('MÁX', bx, y + rh / 2 - 24, bw, 46, () => undefined, 'dis');
      else
        this.btn(
          String(cost),
          bx,
          y + rh / 2 - 24,
          bw,
          46,
          () => this.buyMeta(m.key),
          can ? 'main' : 'dis',
          'UI/GoldIconSmall',
        );
    });
    g.restore();
    this.drawScrollbar(f.x + f.w - 4, top, viewH);
  }

  private buyMeta(key: (typeof META_LIST)[number]['key']): void {
    if (buyMeta(this.save, key)) {
      writeSave(this.save);
      this.audio.play('gold');
      const unlocked = checkAchievements(this.save, Date.now());
      writeSave(this.save);
      for (const u of unlocked)
        this.toastQ.push({ text: u.name, sub: `Conquista! +${u.reward} de ouro`, t: 0 });
    } else this.audio.play('playerHit');
  }

  // ---------------- conquistas ----------------
  private drawAchievements(): void {
    const g = this.g;
    const a = this.a;
    this.drawMenuBg();
    const pop = ease(this.screenT / 0.3);
    const done = Object.keys(this.save.achievements).length;
    const f = this.windowFrame('CONQUISTAS', 18, 72, W - 36, H - 150, pop, () => this.go('menu'));
    drawText(g, a, `Concluídas: ${done} de ${ACHIEVEMENTS.length}`, W / 2, f.y + 2, {
      size: 20,
      align: 'center',
      color: '#ffd44a',
    });
    const top = f.y + 34;
    const viewH = f.h - 40;
    const rh = 78;
    this.scrollMax = Math.max(0, ACHIEVEMENTS.length * rh - viewH);
    g.save();
    g.beginPath();
    g.rect(f.x, top, f.w, viewH);
    g.clip();
    ACHIEVEMENTS.forEach((ac, i) => {
      const y = top + i * rh - this.scroll;
      if (y < top - rh || y > top + viewH) return;
      const got = this.save.achievements[ac.id] !== undefined;
      const [v, goal] = ac.progress(this.save);
      g.save();
      g.globalAlpha = got ? 1 : 0.92;
      nineSlice(g, a, 'UI/Button', f.x + 2, y + 2, f.w - 4, rh - 8, 5, 2);
      g.restore();
      this.drawIconTile(ac.icon, f.x + 10, y + 10, 52, { dark: !got });
      drawText(g, a, ac.name, f.x + 76, y + 10, {
        size: 21,
        color: got ? '#ffd44a' : '#ffffff',
        maxWidth: f.w - 200,
      });
      drawText(g, a, ac.desc, f.x + 76, y + 33, {
        size: 15,
        color: '#c9d3ea',
        maxWidth: f.w - 200,
      });
      if (got) {
        drawText(g, a, 'OK', f.x + f.w - 18, y + 14, {
          size: 22,
          align: 'right',
          color: '#6aff7a',
        });
        drawFrame(g, a, 'UI/GoldIconSmall', f.x + f.w - 56, y + 44, { s: 2 });
        drawText(g, a, `+${ac.reward}`, f.x + f.w - 18, y + 36, {
          size: 16,
          align: 'right',
          color: '#ffd44a',
        });
      } else {
        const bw = f.w - 100;
        g.fillStyle = '#10131c';
        g.fillRect(f.x + 76, y + 55, bw - 100, 8);
        g.fillStyle = '#4aa0ff';
        g.fillRect(f.x + 76, y + 55, (bw - 100) * Math.min(1, v / goal), 8);
        drawText(g, a, `${fmtProg(v)}/${fmtProg(goal)}`, f.x + 76 + bw - 90, y + 50, {
          size: 14,
          color: '#c9d3ea',
        });
        drawFrame(g, a, 'UI/GoldIconSmall', f.x + f.w - 56, y + 20, { s: 2, alpha: 0.6 });
        drawText(g, a, `+${ac.reward}`, f.x + f.w - 18, y + 12, {
          size: 16,
          align: 'right',
          color: '#9aa3b8',
        });
      }
    });
    g.restore();
    this.drawScrollbar(f.x + f.w - 6, top, viewH);
  }

  private drawScrollbar(x: number, y: number, h: number): void {
    if (this.scrollMax <= 0) return;
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(x, y, 4, h);
    const th = Math.max(30, h * (h / (h + this.scrollMax)));
    g.fillStyle = '#9fb4e6';
    g.fillRect(x, y + (h - th) * (this.scroll / this.scrollMax), 4, th);
  }

  // ---------------- itens (coleção) ----------------
  private drawItems(): void {
    const g = this.g;
    const a = this.a;
    this.drawMenuBg();
    const pop = ease(this.screenT / 0.3);
    const seenUp = UPGRADE_IDS.filter((u) => this.save.seen.includes(u)).length;
    const total = UPGRADE_IDS.length + EVOLUTIONS.length + PICKUPS.length;
    const known = seenUp + this.save.stats.evolutions.length + PICKUPS.length;
    const f = this.windowFrame('ITENS', 18, 72, W - 36, H - 150, pop, () => this.go('menu'));
    drawText(g, a, `Coletados: ${known} de ${total}`, W / 2, f.y + 2, {
      size: 20,
      align: 'center',
      color: '#ffd44a',
    });
    interface Entry {
      id: string;
      name: string;
      desc: string;
      icon: string;
      known: boolean;
      levels?: string[];
      kind: string;
      recipe?: string;
    }
    const entries: Entry[] = [
      ...UPGRADE_IDS.map((id) => {
        const u = UPGRADES[id];
        return {
          id,
          name: u.name,
          desc: u.desc,
          icon: u.icon,
          known: this.save.seen.includes(id),
          levels: Array.from({ length: u.max }, (_, i) => u.level(i + 1)),
          kind: WEAPON_IDS.includes(id) ? 'Arma' : 'Passivo',
        };
      }),
      ...EVOLUTIONS.map((e) => {
        const info = EVO_INFO[e.id];
        const recipe = `${e.maxed.map((m) => UPGRADES[m].name).join(' + ')} no máximo + ${UPGRADES[e.passive].name}, e abra um baú.`;
        return {
          id: e.id,
          name: info.name,
          desc: info.desc,
          icon: `E/${e.id}`,
          known: this.save.stats.evolutions.includes(e.id),
          kind: 'Evolução',
          recipe,
        };
      }),
      ...PICKUPS.map((p) => ({
        id: p.id,
        name: p.name,
        desc: p.desc,
        icon: p.icon,
        known: true,
        kind: 'Item do chão',
      })),
    ];
    const cols = 5;
    const gap = 10;
    const ts = (f.w - 8 - gap * (cols - 1)) / cols;
    const gx = f.x + 4;
    const gy = f.y + 34;
    const detailH = 214;
    const viewH = f.h - 34 - detailH - 8;
    const rows = Math.ceil(entries.length / cols);
    this.scrollMax = Math.max(0, rows * (ts + gap) - viewH);
    g.save();
    g.beginPath();
    g.rect(f.x, gy - 4, f.w, viewH + 4);
    g.clip();
    entries.forEach((en, i) => {
      const x = gx + (i % cols) * (ts + gap);
      const y = gy + Math.floor(i / cols) * (ts + gap) - this.scroll;
      if (y < gy - ts || y > gy + viewH) return;
      this.hits.push({
        x,
        y: Math.max(y, gy),
        w: ts,
        h: Math.min(ts, gy + viewH - y),
        fn: () => (this.selItem = i),
        id: `t${i}`,
      });
      this.drawIconTile(en.icon, x, y, ts, { q: !en.known, sel: this.selItem === i });
    });
    g.restore();
    this.drawScrollbar(f.x + f.w - 4, gy, viewH);
    const py = gy + viewH + 8;
    const sel = entries[Math.min(this.selItem, entries.length - 1)]!;
    nineSlice(g, a, 'UI/Button', f.x + 2, py, f.w - 4, f.y + f.h - py - 2, 5, 2);
    drawText(g, a, sel.known ? sel.name : '???', f.x + 16, py + 10, {
      size: 24,
      color: sel.known ? '#ffd44a' : '#8d93a8',
    });
    drawText(g, a, sel.kind, f.x + f.w - 16, py + 14, {
      size: 14,
      align: 'right',
      color: sel.kind === 'Evolução' ? '#ffd44a' : '#9aa3b8',
    });
    let yy = py + 42;
    const text = sel.known
      ? sel.desc
      : sel.recipe
        ? 'Ainda não descoberta.'
        : 'Ainda não descoberto. Encontre este item em uma partida.';
    for (const l of wrapText(a, text, f.w - 36, { size: 16 })) {
      drawText(g, a, l, f.x + 16, yy, { size: 16, color: '#ffffff' });
      yy += 19;
    }
    if (sel.recipe) {
      for (const l of wrapText(a, 'Receita: ' + sel.recipe, f.w - 36, { size: 15 })) {
        drawText(g, a, l, f.x + 16, yy, { size: 15, color: '#9ad0ff' });
        yy += 18;
      }
    }
    if (sel.levels && sel.known) {
      yy += 2;
      const colW = (f.w - 36) / 2;
      sel.levels.forEach((l, i) => {
        const cx = f.x + 16 + (i % 2) * colW;
        const cy = yy + Math.floor(i / 2) * 16;
        if (cy < f.y + f.h - 16)
          drawText(g, a, `Nv ${i + 1}: ${l}`, cx, cy, {
            size: 12,
            color: '#c9d3ea',
            maxWidth: colW - 8,
          });
      });
    }
  }

  // ---------------- áudio e opções ----------------
  private sliderRect(which: 'music' | 'sound') {
    const pw = Math.min(W - 60, 420);
    const px = (W - pw) / 2;
    const y = which === 'music' ? 226 : 300;
    return { x: px + 36, y, w: pw - 72, h: 26 };
  }
  private sliderStart(x: number, y: number): void {
    if (!(this.screen === 'audio' || this.modal === 'audio')) return;
    for (const wch of ['music', 'sound'] as const) {
      const r = this.sliderRect(wch);
      if (x >= r.x - 12 && x <= r.x + r.w + 12 && y >= r.y - 14 && y <= r.y + r.h + 14) {
        this.slider = wch;
        this.sliderMove(x);
        return;
      }
    }
  }
  private sliderMove(x: number): void {
    if (!this.slider) return;
    const r = this.sliderRect(this.slider);
    const v = Math.max(0, Math.min(1, (x - r.x) / r.w));
    if (this.slider === 'music') {
      this.audio.musicVolume = v;
      this.save.music = v > 0;
      this.audio.musicOn = v > 0;
    } else {
      this.audio.soundVolume = v;
      this.save.sound = v > 0;
      this.audio.sound = v > 0;
    }
    this.audio.applyVolumes();
  }

  private drawAudioWindow(onClose: () => void): void {
    const g = this.g;
    const a = this.a;
    const pw = Math.min(W - 40, 440);
    const px = (W - pw) / 2;
    const pop = ease((this.screen === 'audio' ? this.screenT : this.modalT) / 0.25);
    this.windowFrame('OPÇÕES', px, 150, pw, 430, pop, onClose);
    for (const [wch, label] of [
      ['music', 'Música'],
      ['sound', 'Efeitos sonoros'],
    ] as const) {
      const r = this.sliderRect(wch);
      const v =
        wch === 'music'
          ? this.audio.musicOn
            ? this.audio.musicVolume
            : 0
          : this.audio.sound
            ? this.audio.soundVolume
            : 0;
      drawText(g, a, label, r.x, r.y - 34, { size: 22, color: '#ffffff' });
      nineSlice(g, a, 'UI/SliderBg', r.x, r.y + 6, r.w, 14, 3, 2);
      nineSlice(g, a, 'UI/Window/SliderFrame', r.x - 4, r.y, r.w + 8, 26, 6, 1.2);
      g.fillStyle = '#4aa0ff';
      g.fillRect(r.x + 3, r.y + 9, Math.max(0, (r.w - 6) * v), 8);
      drawFrame(g, a, 'UI/ButtonHandle', r.x + r.w * v, r.y + 13, { s: 1.6 });
    }
    const toggle = (label: string, y: number, val: boolean, fn: () => void) => {
      drawText(g, a, label, px + 40, y + 8, { size: 20, color: '#ffffff' });
      const id = `tg${y}`;
      this.hits.push({ x: px + pw - 100, y, w: 60, h: 40, fn, id });
      nineSlice(g, a, 'UI/Button', px + pw - 100, y, 60, 40, 5, 2.5);
      drawText(g, a, val ? 'SIM' : 'NÃO', px + pw - 70, y + 9, {
        size: 20,
        align: 'center',
        color: val ? '#6aff7a' : '#ff6a6a',
      });
    };
    toggle(
      'Flashes de dano',
      376,
      this.save.flashes,
      () => (this.save.flashes = !this.save.flashes),
    );
    toggle(
      'Números de dano',
      428,
      this.save.damageNumbers,
      () => (this.save.damageNumbers = !this.save.damageNumbers),
    );
    this.btn(
      'PRONTO',
      (W - 200) / 2,
      500,
      200,
      54,
      () => {
        writeSave(this.save);
        onClose();
      },
      'blue',
    );
  }

  // ---------------- partida ----------------
  private drawGame(): void {
    const g = this.g;
    const a = this.a;
    const w = this.world;
    if (!w) return;
    drawWorld(g, a, w, this.draw);
    // vinheta de dano / morte
    if (this.screenRed > 0 || this.draw.deadFor >= 0) {
      const dead = this.draw.deadFor >= 0 ? Math.min(1, this.draw.deadFor / 1.8) : 0;
      const gr = g.createRadialGradient(
        W / 2,
        this.fh / 2,
        150,
        W / 2,
        this.fh / 2,
        520 + Math.max(0, W - 510) / 2,
      );
      gr.addColorStop(0, 'rgba(160,10,20,0)');
      gr.addColorStop(1, `rgba(160,10,20,${Math.min(0.75, this.screenRed * 0.7 + dead * 0.55)})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, this.fh);
      if (dead > 0) {
        g.fillStyle = `rgba(8,10,16,${dead * 0.55})`;
        g.fillRect(0, 0, W, this.fh);
      }
    }
    this.drawHud(w);
    if (this.joy && !this.modal) {
      g.save();
      g.globalAlpha = 0.85;
      drawFrame(g, a, 'UI/VirtualJuystick/VirJoyOutter', this.joy.ox, this.joy.oy, { s: 2 });
      const dx = this.joy.x - this.joy.ox;
      const dy = this.joy.y - this.joy.oy;
      const l = Math.hypot(dx, dy) || 1;
      const kk = Math.min(l, 46) / l;
      drawFrame(
        g,
        a,
        'UI/VirtualJuystick/VirJoyInner',
        this.joy.ox + dx * kk,
        this.joy.oy + dy * kk,
        { s: 2.4 },
      );
      g.restore();
    }
    g.save();
    g.translate(0, this.my);
    if (this.modal === 'levelUp') this.drawLevelUp();
    if (this.modal === 'chest') this.drawChest();
    if (this.modal === 'pause' || this.modal === 'confirmQuit') this.drawPause();
    if (this.modal === 'audio') this.drawAudioWindow(() => this.openModalBack());
    g.restore();
    if (w.alive === false && this.draw.deadFor > 0.3) {
      const t = ease((this.draw.deadFor - 0.3) / 0.8);
      g.save();
      g.globalAlpha = t;
      drawText(g, a, 'VOCÊ CAIU', W / 2, 230 - (1 - t) * 24, {
        size: 84,
        align: 'center',
        color: '#ff4a4a',
      });
      g.restore();
    }
  }
  private openModalBack(): void {
    this.modal = 'pause';
    this.modalT = 0.3;
  }

  private drawHud(w: NhWorld): void {
    const g = this.g;
    const a = this.a;
    // barra de experiência (topo, largura toda)
    const req = w.requiredXp;
    const prog = req ? Math.min(1, w.xp / req) : 1;
    g.fillStyle = '#10131c';
    g.fillRect(0, 0, W, 26);
    g.fillStyle = '#1c2b46';
    g.fillRect(3, 3, W - 6, 20);
    const fillW = (W - 6) * prog;
    if (fillW > 0) {
      const f = a.frames['UI/ExpBarFill']!;
      g.imageSmoothingEnabled = false;
      for (let x = 3; x < 3 + fillW; x += 8)
        g.drawImage(a.img, f.x, f.y, f.w, f.h, x, 3, Math.min(8, 3 + fillW - x), 20);
      g.fillStyle = 'rgba(255,255,255,.2)';
      g.fillRect(3, 3, fillW, 6);
    }
    drawText(g, a, `NV ${w.level + 1}`, W - 12, 3, { size: 18, align: 'right' });
    // tempo no centro, ouro e pausa
    drawText(g, a, fmtTime(w.t), W / 2, 40, { size: 36, align: 'center' });
    drawFrame(g, a, 'UI/GoldIcon', 24, 58, { s: 2 });
    drawText(g, a, String(w.gold), 46, 46, { size: 24, color: '#ffd44a' });
    this.smallBtn('pause', W - 56, 36, 42, () => this.openModal('pause'));
    // armas na primeira fileira e passivos na segunda; evoluídas ganham moldura dourada
    const row = (ids: readonly UpgradeId[], y: number, slots: number) => {
      // slots vazios sempre à vista; os itens vão preenchendo da esquerda para a direita
      g.save();
      for (let s = 0; s < slots; s++) {
        g.fillStyle = 'rgba(8,12,24,.55)';
        g.fillRect(14 + s * 38, y, 34, 34);
        g.strokeStyle = 'rgba(120,150,210,.45)';
        g.lineWidth = 2;
        g.strokeRect(15 + s * 38, y + 1, 32, 32);
      }
      g.restore();
      let i = 0;
      for (const id of ids) {
        const lv = w.levels[id];
        if (!lv) continue;
        const x = 14 + i * 38;
        this.drawIconTile(UPGRADES[id].icon, x, y, 34);
        const evo = EVOLUTIONS.some(
          (e) => w.evolved.has(e.id) && (e.maxed.includes(id) || e.passive === id),
        );
        if (evo) {
          g.save();
          g.strokeStyle = '#ffd94a';
          g.lineWidth = 2;
          g.strokeRect(x - 1, y - 1, 36, 36);
          g.restore();
        }
        drawText(g, a, lv >= UPGRADE_MAX[id] ? 'M' : String(lv), x + 32, y + 20, {
          size: 13,
          align: 'right',
          color: lv >= UPGRADE_MAX[id] ? '#ffd94a' : '#ffffff',
        });
        i++;
      }
    };
    row(WEAPON_IDS, 84, MAX_WEAPON_SLOTS);
    row(PASSIVE_IDS, 124, MAX_PASSIVE_SLOTS);
  }

  private drawLevelUp(): void {
    const g = this.g;
    const a = this.a;
    const w = this.world;
    const pend = w?.pending;
    if (!w || !pend || pend.kind !== 'levelUp') return;
    g.fillStyle = `rgba(6,8,14,${0.7 * ease(this.modalT / 0.25)})`;
    g.fillRect(0, -this.my, W, this.fh);
    const t = this.modalT;
    const pop = ease(t / 0.3);
    const cards = pend.options;
    const n = cards.length;
    const cw = n >= 4 ? 118 : 150;
    const gap = n >= 4 ? 8 : 12;
    const total = n * cw + (n - 1) * gap;
    const x0 = (W - total) / 2;
    g.save();
    g.globalAlpha = pop;
    drawText(g, a, 'SUBIU DE NÍVEL!', W / 2, 70 - (1 - pop) * 20, {
      size: 54,
      align: 'center',
      color: '#ffd44a',
    });
    drawText(
      g,
      a,
      this.banishMode
        ? 'Toque no item que quer banir'
        : `Nível ${w.level + 1}. Escolha uma melhoria`,
      W / 2,
      128,
      { size: 20, align: 'center', color: this.banishMode ? '#ff8a8a' : '#e8ecff' },
    );
    g.restore();
    cards.forEach((id, i) => {
      const delay = 0.3 + i * 0.22; // as cartas entram uma por vez, como no Slash
      const p = back((t - delay) / 0.4);
      if (p <= 0) return;
      const info = choiceInfo(id);
      const lv = info.evo ? 0 : w.levels[id as UpgradeId];
      const x = x0 + i * (cw + gap);
      const y = 168 + (1 - Math.min(1, p)) * 60;
      const h = 360;
      const ready = t > delay + 0.3;
      const hov =
        ready &&
        this.mouse.x >= x &&
        this.mouse.x <= x + cw &&
        this.mouse.y >= y &&
        this.mouse.y <= y + h;
      if (ready)
        this.hits.push({
          x,
          y,
          w: cw,
          h,
          fn: () => {
            if (this.banishMode) {
              w.banish(id as UpgradeId);
              this.banishMode = false;
            } else this.pickUpgrade(id);
          },
          id: `lv${i}`,
        });
      g.save();
      g.globalAlpha = Math.min(1, p * 2);
      const lift = hov ? -8 : 0;
      nineSlice(g, a, 'UI/Window/WndBg', x, y + lift, cw, h, 7, 2);
      if (this.banishMode) {
        g.fillStyle = 'rgba(200,40,40,.18)';
        g.fillRect(x + 8, y + lift + 8, cw - 16, h - 16);
      }
      const bs = n >= 4 ? 72 : 88;
      this.drawIconTile(info.icon, x + (cw - bs) / 2, y + lift + 18, bs);
      const fs = n >= 4 ? 17 : 21;
      let yy = y + lift + bs + 36;
      for (const l of wrapText(a, info.name, cw - 12, { size: fs })) {
        drawText(g, a, l, x + cw / 2, yy, {
          size: fs,
          align: 'center',
          color: info.evo ? '#ffe27a' : '#ffd44a',
        });
        yy += fs + 2;
      }
      drawText(
        g,
        a,
        info.evo ? 'EVOLUÇÃO!' : lv === 0 ? 'NOVO!' : `Nível ${lv} > ${lv + 1}`,
        x + cw / 2,
        yy + 2,
        {
          size: 16,
          align: 'center',
          color: info.evo ? '#ffd94a' : lv === 0 ? '#6aff7a' : '#9ad0ff',
        },
      );
      yy += 26;
      const body = info.evo ? info.desc : UPGRADES[id as UpgradeId].level(lv + 1);
      for (const l of wrapText(a, body, cw - 22, { size: n >= 4 ? 13 : 15 })) {
        drawText(g, a, l, x + cw / 2, yy, {
          size: n >= 4 ? 13 : 15,
          align: 'center',
          color: '#ffffff',
        });
        yy += n >= 4 ? 15 : 17;
      }
      yy += 6;
      if (!info.evo)
        for (const l of wrapText(a, info.desc, cw - 22, { size: n >= 4 ? 12 : 13 })) {
          if (yy < y + lift + h - 30)
            drawText(g, a, l, x + cw / 2, yy, {
              size: n >= 4 ? 12 : 13,
              align: 'center',
              color: '#a9b4d0',
            });
          yy += n >= 4 ? 14 : 16;
        }
      drawText(g, a, `[${i + 1}]`, x + cw / 2, y + lift + h - 24, {
        size: 13,
        align: 'center',
        color: '#7f8aa8',
      });
      g.restore();
    });
    // reroll, pular e banir (estilo Vampire Survivors)
    if (t > 0.9) {
      const bw = 148;
      const bg = 12;
      const bx = (W - (bw * 3 + bg * 2)) / 2;
      const by = 548;
      this.btn(
        `REROLL ${w.rerolls}`,
        bx,
        by,
        bw,
        50,
        () => void w.reroll(),
        w.rerolls > 0 ? 'blue' : 'dis',
        'X/reroll',
      );
      this.btn(
        `PULAR ${w.skips}`,
        bx + bw + bg,
        by,
        bw,
        50,
        () => void w.skip(),
        w.skips > 0 ? 'blue' : 'dis',
        'X/skip',
      );
      this.btn(
        this.banishMode ? 'CANCELAR' : `BANIR ${w.banishes}`,
        bx + (bw + bg) * 2,
        by,
        bw,
        50,
        () => (this.banishMode = !this.banishMode),
        w.banishes > 0 || this.banishMode ? 'danger' : 'dis',
        'X/banish',
      );
      drawText(g, a, 'R reroll   X pular   B banir', W / 2, by + 62, {
        size: 13,
        align: 'center',
        color: '#7f8aa8',
      });
    }
  }

  private drawChest(): void {
    const g = this.g;
    const a = this.a;
    const t = this.chestT;
    g.fillStyle = `rgba(6,8,14,${0.75 * ease(t / 0.3)})`;
    g.fillRect(0, -this.my, W, this.fh);
    const cx = W / 2;
    g.save();
    g.globalAlpha = Math.min(1, t * 2) * 0.45;
    drawFrame(g, a, 'UI/sunrays', cx, 300, { s: 6.2, rot: this.time * 0.35 });
    g.restore();
    const shake = t < 0.9 ? Math.sin(t * 50) * (t * 4) : 0;
    const open = t > 0.9;
    const pop = back(t / 0.5);
    g.save();
    g.translate(cx + shake, 330);
    g.scale(2.4 * pop, 2.4 * pop);
    drawFrame(g, a, 'UI/Chest/ChestShadow', 0, 52, { s: 1 });
    drawFrame(g, a, 'UI/Chest/ChestBottom', 0, 24, { s: 1 });
    drawFrame(
      g,
      a,
      open ? 'UI/Chest/ChestCapOpened' : 'UI/Chest/ChestCapClosed',
      0,
      open ? -20 : -4,
      { s: 1 },
    );
    if (open) {
      g.globalAlpha = Math.min(1, (t - 0.9) * 2) * 0.9;
      drawFrame(g, a, 'UI/Chest/ChestGlowUp', 0, -50, { s: 1 });
    }
    g.restore();
    drawText(g, a, this.chestPick?.startsWith('evo') && t > 1.2 ? 'EVOLUÇÃO!' : 'BAÚ!', cx, 90, {
      size: this.chestPick?.startsWith('evo') && t > 1.2 ? 66 : 90,
      align: 'center',
      color: '#ffd44a',
    });
    if (t > 1.5 && this.chestPick) {
      const p = back((t - 1.5) / 0.4);
      const u = choiceInfo(this.chestPick);
      const evo = u.evo;
      const lv = evo ? 0 : (this.world?.levels[this.chestPick as UpgradeId] ?? 0);
      g.save();
      g.globalAlpha = Math.min(1, p * 2);
      g.translate(cx, 500);
      g.scale(p, p);
      nineSlice(g, a, 'UI/Window/WndBg', -190, -70, 380, 140, 7, 2);
      this.drawIconTile(u.icon, -172, -52, 104);
      drawText(g, a, u.name, -56, -54, { size: 24, color: '#ffd44a', maxWidth: 235 });
      drawText(g, a, evo ? 'EVOLUÇÃO!' : lv === 0 ? 'NOVO!' : `Nível ${lv} > ${lv + 1}`, -56, -26, {
        size: 17,
        color: evo ? '#ffd94a' : lv === 0 ? '#6aff7a' : '#9ad0ff',
      });
      let yy = 0;
      for (const l of wrapText(
        a,
        evo ? u.desc : UPGRADES[this.chestPick as UpgradeId].level(lv + 1),
        235,
        { size: 15 },
      )) {
        drawText(g, a, l, -56, yy, { size: 15 });
        yy += 18;
      }
      g.restore();
    }
    if (t > 1.8 && this.chestPick) {
      // o prêmio pode ser pego ou recusado
      this.btn('PEGAR', cx - 162, 590, 156, 56, () => this.pickUpgrade(this.chestPick!), 'main');
      this.btn('RECUSAR', cx + 6, 590, 156, 56, () => this.pickUpgrade(null), 'danger');
    }
  }

  private drawPause(): void {
    const g = this.g;
    g.fillStyle = `rgba(6,8,14,${0.7 * ease(this.modalT / 0.2)})`;
    g.fillRect(0, -this.my, W, this.fh);
    const pw = 340;
    const px = (W - pw) / 2;
    const pop = ease(this.modalT / 0.25);
    const confirm = this.modal === 'confirmQuit';
    const f = this.windowFrame(confirm ? 'DESISTIR?' : 'PAUSA', px, 190, pw, 330, pop);
    if (confirm) {
      drawText(g, this.a, 'A partida acaba e o ouro', W / 2, f.y + 14, {
        size: 20,
        align: 'center',
      });
      drawText(g, this.a, 'coletado é guardado.', W / 2, f.y + 40, { size: 20, align: 'center' });
      this.btn('SIM, SAIR', px + 40, f.y + 100, pw - 80, 60, () => this.quitRun(), 'danger');
      this.btn('VOLTAR', px + 40, f.y + 176, pw - 80, 60, () => (this.modal = 'pause'), 'blue');
      return;
    }
    const w = this.world;
    if (w)
      drawText(g, this.a, `Tempo ${fmtTime(w.t)}   Abates ${w.kills}`, W / 2, f.y + 6, {
        size: 18,
        align: 'center',
        color: '#c9d3ea',
      });
    this.btn('CONTINUAR', px + 40, f.y + 40, pw - 80, 62, () => this.closeModal(), 'main');
    this.btn('OPÇÕES', px + 40, f.y + 116, pw - 80, 54, () => this.openModal('audio'), 'blue');
    this.btn(
      'DESISTIR',
      px + 40,
      f.y + 184,
      pw - 80,
      54,
      () => (this.modal = 'confirmQuit'),
      'danger',
    );
  }

  private quitRun(): void {
    if (!this.world) return;
    this.world.alive = false;
    this.draw.deadFor = 3;
    this.modal = null;
    this.finishRun();
  }

  // ---------------- resultado ----------------
  private drawOver(): void {
    const g = this.g;
    const a = this.a;
    const res = this.result;
    this.drawMenuBg();
    if (!res) return;
    const pop = ease(this.screenT / 0.35);
    const px = 24;
    const pw = W - 48;
    const f = this.windowFrame('FIM DE JOGO', px, 70, pw, 520, pop);
    const t = this.screenT;
    drawText(g, a, res.record ? 'NOVO RECORDE!' : 'Você caiu na noite', W / 2, f.y + 4, {
      size: res.record ? 30 : 24,
      align: 'center',
      color: res.record ? '#ffd44a' : '#f2c8c8',
    });
    if (res.record) {
      g.save();
      g.globalAlpha = 0.3 + 0.3 * Math.sin(this.time * 6);
      drawText(g, a, 'NOVO RECORDE!', W / 2, f.y + 4, {
        size: 30,
        align: 'center',
        color: '#ffffff',
        shadow: false,
      });
      g.restore();
    }
    const rows: Array<[string, string, string]> = [
      ['Sobreviveu', fmtTime(res.r.score), '#ffffff'],
      ['Inimigos derrotados', String(res.r.kills), '#ffffff'],
      ['Nível alcançado', String(res.r.level + 1), '#ffffff'],
      ['Ouro ganho', `+${Math.floor(res.shown)}`, '#ffd44a'],
    ];
    rows.forEach((r, i) => {
      const p = ease((t - 0.3 - i * 0.18) / 0.3);
      g.save();
      g.globalAlpha = p;
      const y = f.y + 52 + i * 34 + (1 - p) * 14;
      drawText(g, a, r[0], f.x + 20, y, { size: 22 });
      drawText(g, a, r[1], f.x + f.w - 20, y, { size: 24, align: 'right', color: r[2] });
      g.restore();
    });
    drawFrame(
      g,
      a,
      'UI/GoldIcon',
      f.x + f.w - 28 - measureText(a, `+${Math.floor(res.shown)}`, { size: 24 }) - 14,
      f.y + 52 + 3 * 34 + 12,
      { s: 1.6 },
    );
    // itens da partida
    const iy = f.y + 52 + 4 * 34 + 14;
    g.fillStyle = 'rgba(255,255,255,.14)';
    g.fillRect(f.x + 14, iy - 8, f.w - 28, 2);
    drawText(g, a, 'Itens desta partida', f.x + 20, iy, { size: 20, color: '#ffd44a' });
    const entries: Array<{ icon: string; label: string; gold: boolean }> = [
      ...UPGRADE_IDS.filter((u) => (res.r.upgrades[u] ?? 0) > 0).map((id) => {
        const lv = res.r.upgrades[id] ?? 0;
        return {
          icon: UPGRADES[id].icon,
          label: lv >= UPGRADES[id].max ? 'MÁX' : `Nv ${lv}`,
          gold: lv >= UPGRADES[id].max,
        };
      }),
      ...res.r.evolutions.map((id) => ({ icon: `E/${id}`, label: 'EVO', gold: true })),
    ];
    const ts = entries.length > 10 ? 44 : entries.length > 5 ? 54 : 62;
    const cols = Math.floor((f.w - 36) / (ts + 12));
    entries.forEach((en, i) => {
      const p = back((t - 1.0 - i * 0.09) / 0.35);
      if (p <= 0) return;
      const x = f.x + 20 + (i % cols) * (ts + 12);
      const y = iy + 28 + Math.floor(i / cols) * (ts + 26);
      g.save();
      g.translate(x + ts / 2, y + ts / 2);
      g.scale(p, p);
      g.translate(-ts / 2, -ts / 2);
      this.drawIconTile(en.icon, 0, 0, ts);
      drawText(g, a, en.label, ts / 2, ts + 4, {
        size: 14,
        align: 'center',
        color: en.gold ? '#ffd44a' : '#ffffff',
      });
      g.restore();
    });
    if (!entries.length)
      drawText(g, a, 'Nenhum item coletado.', f.x + 20, iy + 36, { size: 18, color: '#9aa3b8' });
    const itemRows = Math.max(1, Math.ceil(entries.length / cols));
    // conquistas liberadas
    if (res.unlocked.length) {
      const ay = iy + 28 + itemRows * (ts + 26) + 4;
      drawText(g, a, `Conquistas liberadas: ${res.unlocked.length}`, f.x + 20, ay, {
        size: 18,
        color: '#6aff7a',
      });
      res.unlocked.slice(0, 3).forEach((u, i) =>
        drawText(g, a, `${u.name}  +${u.reward}`, f.x + 24, ay + 24 + i * 20, {
          size: 16,
          color: '#ffffff',
          maxWidth: f.w - 48,
        }),
      );
      if (res.unlocked.length > 3)
        drawText(g, a, `e mais ${res.unlocked.length - 3}...`, f.x + 24, ay + 24 + 3 * 20, {
          size: 14,
          color: '#9aa3b8',
        });
    }
    const by = 606;
    const ready = t > 0.9;
    if (ready) {
      this.btn('JOGAR DE NOVO', 24, by, 300, 58, () => this.startGame(), 'main');
      this.btn('MENU', 24 + 300 + 12, by, W - 48 - 312, 58, () => this.go('menu'), 'blue');
    }
  }

  private drawToasts(): void {
    const g = this.g;
    const a = this.a;
    this.toastQ.slice(0, 3).forEach((t, i) => {
      const p = t.t < 0.4 ? ease(t.t / 0.4) : t.t > 3 ? 1 - (t.t - 3) / 0.6 : 1;
      if (p <= 0) return;
      const y = 14 + i * 64 - (1 - p) * 60;
      g.save();
      g.globalAlpha = Math.min(1, p * 2);
      nineSlice(g, a, 'UI/Window/WndBg', W / 2 - 170, y, 340, 58, 7, 1.5);
      drawFrame(g, a, 'UI/GoldIcon', W / 2 - 146, y + 30, { s: 2 });
      drawText(g, a, t.text, W / 2 - 124, y + 8, { size: 20, color: '#ffd44a', maxWidth: 280 });
      drawText(g, a, t.sub, W / 2 - 124, y + 31, { size: 14, color: '#ffffff', maxWidth: 280 });
      g.restore();
    });
  }
}

const PICKUPS = [
  {
    id: 'xp',
    name: 'Cristal de XP',
    desc: 'Solto pelos inimigos. Cada cristal vale 1 de experiência e leva você ao próximo nível.',
    icon: 'Drops/XP00',
  },
  {
    id: 'gold',
    name: 'Moeda de ouro',
    desc: 'Dá 1 de ouro. O ouro fica guardado e compra melhorias permanentes.',
    icon: 'UI/GoldIcon',
  },
  {
    id: 'health',
    name: 'Poção de vida',
    desc: 'Cura 10 de vida na hora.',
    icon: 'Drops/HealingItem00',
  },
  {
    id: 'magnet',
    name: 'Ímã',
    desc: 'Por 6 segundos puxa todos os itens do chão que estiverem por perto.',
    icon: 'Drops/PickupRange00',
  },
  {
    id: 'chest',
    name: 'Baú',
    desc: 'Solto por chefes. Abre e dá uma melhoria garantida.',
    icon: 'Drops/Chest00',
  },
];

function fmtProg(v: number): string {
  return v >= 60 && v % 60 === 0 ? `${v / 60}min` : String(Math.floor(v));
}
