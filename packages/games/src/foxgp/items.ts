import { createRng } from '../core/rng';
import { GP_ARC_VMAX, GP_HALF_WIDTH } from './constants';
import type { GpCar, GpWorld } from './world';

/**
 * Arcade com poderes (spec 085): caixas na pista, um item por vez (ou três do mesmo tipo, "triplo"), efeitos e a
 * escolha do item pela posição. Tudo puro e determinístico (mesma seed, mesma corrida); em sala, só o servidor roda.
 * As ideias vêm de jogos de kart em geral; nomes, regras e números são nossos.
 */
export type GpItemKind = 'peel' | 'ball' | 'seeker' | 'bomb' | 'nitro' | 'star' | 'bolt';
export type GpItemId =
  | 'peel'
  | 'peel3'
  | 'ball'
  | 'ball3'
  | 'seeker'
  | 'seeker3'
  | 'bomb'
  | 'nitro'
  | 'nitro3'
  | 'star'
  | 'bolt';

export const gpItemKind = (id: GpItemId): GpItemKind => id.replace('3', '') as GpItemKind;
export const gpItemCount = (id: GpItemId) => (id.endsWith('3') ? 3 : 1);

// ---- números do jogo (ajustar jogando) ----
/** Espaço entre fileiras de caixas (m) e quantas por fileira. */
export const GP_BOX_ROW_GAP = 220;
export const GP_BOX_PER_ROW = 3;
/** Raio de pegar a caixa e tempo até ela voltar (s). */
export const GP_BOX_RADIUS = 3.2;
export const GP_BOX_RESPAWN = 3;
/** Raio de acerto dos itens (m). */
export const GP_ITEM_HIT_RADIUS = 2.6;
export const GP_BOMB_RADIUS = 14;
export const GP_BOMB_FUSE = 2.6;
export const GP_PEEL_TTL = 60;
export const GP_SHOT_TTL = 14;
export const GP_BOLT_TTL = 30;
/** Quanto dura o tropeço (s) e a imunidade logo depois (s). */
export const GP_HIT_STUN = 1.4;
/** Voltas completas que o kart dá ao ser acertado (inteiro, para voltar de frente). */
export const GP_HIT_TURNS = 2;
export const GP_HIT_SAFE = 1.6;
/** O que sobra da velocidade ao ser acertado. */
export const GP_HIT_KEEP = 0.25;
export const GP_STAR_SEC = 8;
export const GP_NITRO_SEC = 1.5;
/** Espera entre dois usos (s), para o triplo não sair de uma vez. */
export const GP_USE_GAP = 0.45;

export const GP_BALL_SPEED = GP_ARC_VMAX * 1.5;
export const GP_SEEKER_SPEED = GP_ARC_VMAX * 1.3;
export const GP_BOLT_SPEED = GP_ARC_VMAX * 2.8;
/** Quanto o cometa azul acelera por metro de distância até o líder (alcança de qualquer lugar da pista). */
const GP_BOLT_CATCHUP = 0.5;
const GP_BALL_BOUNCES = 6;
/** Raio de acerto dos tiros: um pouco maior que o do chão, para a bola e o cometa não passarem por dentro do kart. */
const GP_SHOT_HIT_RADIUS = 3;

// ---- item pela posição ----
/** Faixa do carro: 0 frente, 1 meio, 2 trás (com 1 carro só, frente). */
export function gpItemTier(rank: number, total: number): 0 | 1 | 2 {
  if (total <= 1) return 0;
  const f = (rank - 1) / (total - 1);
  return f < 0.25 ? 0 : f < 0.65 ? 1 : 2;
}

const WEIGHTS: Record<0 | 1 | 2, readonly (readonly [GpItemId, number])[]> = {
  0: [
    ['peel', 4],
    ['ball', 4],
    ['nitro', 2],
  ],
  1: [
    ['ball', 2],
    ['seeker', 4],
    ['bomb', 3],
    ['peel3', 2],
    ['nitro', 2],
    ['ball3', 1],
  ],
  2: [
    ['seeker3', 3],
    ['nitro3', 3],
    ['ball3', 2],
    ['star', 3],
    ['bolt', 1],
    ['bomb', 1],
  ],
};

/** Sorteia o item de quem pegou a caixa. O Cometa azul só sai de quem não lidera. */
export function gpRollItem(rank: number, total: number, rng: () => number): GpItemId {
  const tier = gpItemTier(rank, total);
  const list = WEIGHTS[tier].filter(([id]) => !(id === 'bolt' && rank <= 1));
  const sum = list.reduce((a, [, w]) => a + w, 0);
  let r = rng() * sum;
  for (const [id, w] of list) {
    r -= w;
    if (r < 0) return id;
  }
  return list[0]![0];
}

/** O que a cena e o HUD leem dos itens (o sistema do líder ou o espelho de quem corre online). */
export interface GpItemsReadable {
  boxes: GpItemBox[];
  cars: Map<string, GpCarItem>;
  shots: GpShot[];
  traps: GpTrap[];
  state(id: string): GpCarItem;
}

// ---- estado ----
export interface GpItemBox {
  x: number;
  z: number;
  /** Segundos até voltar (0 = ativa). */
  cd: number;
}

export interface GpCarItem {
  /** O item que tem agora e quantos ainda faltam (triplo). */
  id: GpItemId | null;
  left: number;
  /** Espera entre usos (s). */
  gap: number;
  /** Tropeçando (s), imune (s) e Superfox (s). */
  stun: number;
  safe: number;
  star: number;
}

export type GpShotKind = 'ball' | 'seeker' | 'bolt';
export interface GpShot {
  uid: number;
  kind: GpShotKind;
  owner: string;
  x: number;
  z: number;
  h: number;
  /** Seeker/bolt: avanço na pista (m), afastamento do centro e o carro perseguido. */
  prog: number;
  d: number;
  target: string | null;
  ttl: number;
  bounces: number;
  /** Bola: velocidade lateral (m/s, + para a direita da pista); ela anda colada ao traçado e quica nas bordas. */
  vd: number;
}
export interface GpTrap {
  uid: number;
  kind: 'peel' | 'bomb';
  owner: string;
  x: number;
  z: number;
  ttl: number;
  /** Bomba: segundos até explodir. */
  fuse: number;
  /** Quem o largou fica imune por um instante (s). */
  arm: number;
}

export type GpItemEvent =
  | { type: 'pickup'; id: string; item: GpItemId }
  | { type: 'use'; id: string; item: GpItemId }
  | { type: 'hit'; id: string; by: string; kind: GpItemKind }
  | { type: 'blocked'; id: string; kind: GpItemKind }
  | { type: 'boom'; x: number; z: number };

/** Fileiras de caixas ao longo da pista, longe da largada. */
export function gpItemBoxes(world: GpWorld): GpItemBox[] {
  const tr = world.track;
  const rows = Math.max(3, Math.floor(tr.length / GP_BOX_ROW_GAP));
  const out: GpItemBox[] = [];
  const span = GP_HALF_WIDTH * 1.2;
  for (let r = 0; r < rows; r++) {
    const s = ((r + 0.6) / rows) * tr.length;
    for (let k = 0; k < GP_BOX_PER_ROW; k++) {
      const d = (k - (GP_BOX_PER_ROW - 1) / 2) * (span / (GP_BOX_PER_ROW - 1));
      const p = tr.pointAt(s, d);
      out.push({ x: p.x, z: p.z, cd: 0 });
    }
  }
  return out;
}

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

/**
 * O sistema de itens de uma partida: roda junto do `GpWorld` (chame `step` depois do `world.step`), com o pedido de
 * "usar item" de cada carro. Os efeitos mexem no carro (velocidade, giro, turbo) e viram eventos para o som e o HUD.
 */
export class GpItemSystem implements GpItemsReadable {
  readonly boxes: GpItemBox[];
  readonly cars = new Map<string, GpCarItem>();
  shots: GpShot[] = [];
  traps: GpTrap[] = [];
  private events: GpItemEvent[] = [];
  private uid = 0;
  private rng: () => number;
  /** Sentido do giro e quanto do giro já foi aplicado (0 a 1), por kart acertado. */
  private spinDir = new Map<string, { dir: number; done: number }>();

  constructor(
    private world: GpWorld,
    seed = world.seed,
  ) {
    this.rng = createRng(`${seed}:items`);
    this.boxes = gpItemBoxes(world);
    for (const c of world.cars)
      this.cars.set(c.id, { id: null, left: 0, gap: 0, stun: 0, safe: 0, star: 0 });
  }

  state(id: string): GpCarItem {
    let s = this.cars.get(id);
    if (!s) {
      s = { id: null, left: 0, gap: 0, stun: 0, safe: 0, star: 0 };
      this.cars.set(id, s);
    }
    return s;
  }

  drainEvents(): GpItemEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Posição de cada carro ativo (1 = líder), pela distância percorrida. */
  rankOf(id: string): { rank: number; total: number } {
    const live = this.world.cars.filter((c) => !c.gone && !c.ghost);
    const sorted = [...live].sort((a, b) => b.prog - a.prog);
    const i = sorted.findIndex((c) => c.id === id);
    return { rank: i < 0 ? sorted.length : i + 1, total: sorted.length };
  }

  /** Dá um item direto (testes, sala e depuração). */
  give(id: string, item: GpItemId) {
    const s = this.state(id);
    s.id = item;
    s.left = gpItemCount(item);
  }

  private active(c: GpCar) {
    return !c.gone && !c.ghost && !c.finished;
  }

  step(dt: number, use: Readonly<Record<string, boolean>> = {}) {
    const w = this.world;
    if (w.phase !== 'race') return;
    for (const c of w.cars) {
      const s = this.state(c.id);
      s.gap = Math.max(0, s.gap - dt);
      s.stun = Math.max(0, s.stun - dt);
      s.safe = Math.max(0, s.safe - dt);
      s.star = Math.max(0, s.star - dt);
    }
    for (const b of this.boxes) b.cd = Math.max(0, b.cd - dt);

    // pegar caixa
    for (const c of w.cars) {
      if (!this.active(c)) continue;
      const s = this.state(c.id);
      if (s.id) continue;
      for (const b of this.boxes) {
        if (b.cd > 0 || dist(c.x, c.z, b.x, b.z) > GP_BOX_RADIUS) continue;
        b.cd = GP_BOX_RESPAWN;
        const { rank, total } = this.rankOf(c.id);
        const item = gpRollItem(rank, total, this.rng);
        this.give(c.id, item);
        this.events.push({ type: 'pickup', id: c.id, item });
        break;
      }
    }

    // usar item
    for (const c of w.cars) {
      if (!this.active(c) || !use[c.id]) continue;
      const s = this.state(c.id);
      if (!s.id || s.gap > 0 || s.stun > 0) continue;
      this.useItem(c, s);
    }

    this.stepTraps(dt);
    this.stepShots(dt);

    // tropeço: o kart gira em torno de si (GP_HIT_TURNS voltas, rápido no começo) e fica lento enquanto dura
    for (const c of w.cars) {
      const s = this.state(c.id);
      if (s.stun <= 0) {
        this.spinDir.delete(c.id);
        continue;
      }
      const sp = this.spinDir.get(c.id);
      if (sp) {
        const p = 1 - s.stun / GP_HIT_STUN;
        const k = 1 - (1 - Math.min(1, p)) ** 2;
        c.h += sp.dir * Math.PI * 2 * GP_HIT_TURNS * (k - sp.done);
        sp.done = k;
      }
      if (c.speed > GP_ARC_VMAX * 0.3) this.scaleSpeed(c, 0.94);
    }
  }

  private scaleSpeed(c: GpCar, k: number) {
    c.speed *= k;
    c.vx *= k;
    c.vz *= k;
  }

  private useItem(c: GpCar, s: GpCarItem) {
    const item = s.id!;
    const kind = gpItemKind(item);
    s.left -= 1;
    s.gap = GP_USE_GAP;
    if (s.left <= 0) s.id = null;
    this.events.push({ type: 'use', id: c.id, item });
    const fx = Math.sin(c.h);
    const fz = -Math.cos(c.h);
    switch (kind) {
      case 'peel':
        this.traps.push({
          uid: ++this.uid,
          kind: 'peel',
          owner: c.id,
          x: c.x - fx * 4,
          z: c.z - fz * 4,
          ttl: GP_PEEL_TTL,
          fuse: 0,
          arm: 0.7,
        });
        break;
      case 'bomb':
        this.traps.push({
          uid: ++this.uid,
          kind: 'bomb',
          owner: c.id,
          x: c.x + fx * 9,
          z: c.z + fz * 9,
          ttl: GP_BOMB_FUSE + 1,
          fuse: GP_BOMB_FUSE,
          arm: 0.7,
        });
        break;
      case 'ball': {
        // sai na direção do kart, mas anda pelo traçado da pista (não atravessa o chão nem as bordas nas curvas)
        const along = this.world.track.pointAt(c.prog, c.d).h;
        let ang = c.h - along;
        while (ang > Math.PI) ang -= Math.PI * 2;
        while (ang < -Math.PI) ang += Math.PI * 2;
        ang = Math.max(-0.6, Math.min(0.6, ang));
        this.shots.push({
          uid: ++this.uid,
          kind: 'ball',
          owner: c.id,
          x: c.x + fx * 4,
          z: c.z + fz * 4,
          h: c.h,
          prog: c.prog + 4,
          d: c.d,
          target: null,
          ttl: GP_SHOT_TTL,
          bounces: GP_BALL_BOUNCES,
          vd: Math.sin(ang) * GP_BALL_SPEED,
        });
        break;
      }
      case 'seeker':
      case 'bolt': {
        const target = kind === 'bolt' ? this.leaderOtherThan(c.id) : this.nextAhead(c);
        this.shots.push({
          uid: ++this.uid,
          kind,
          owner: c.id,
          x: c.x + fx * 4,
          z: c.z + fz * 4,
          h: c.h,
          prog: c.prog + 4,
          d: c.d,
          target,
          ttl: kind === 'bolt' ? GP_BOLT_TTL : GP_SHOT_TTL,
          bounces: 0,
          vd: 0,
        });
        break;
      }
      case 'nitro':
        c.boostLevel = Math.max(c.boostLevel, 2);
        c.boostT = Math.max(c.boostT, GP_NITRO_SEC);
        break;
      case 'star':
        this.state(c.id).star = GP_STAR_SEC;
        c.boostLevel = Math.max(c.boostLevel, 1);
        c.boostT = Math.max(c.boostT, GP_STAR_SEC);
        break;
    }
  }

  private nextAhead(me: GpCar): string | null {
    let best: GpCar | null = null;
    for (const c of this.world.cars) {
      if (c.id === me.id || !this.active(c) || c.prog <= me.prog) continue;
      if (!best || c.prog < best.prog) best = c;
    }
    return best?.id ?? null;
  }

  private leaderOtherThan(id: string): string | null {
    let best: GpCar | null = null;
    for (const c of this.world.cars) {
      if (c.id === id || !this.active(c)) continue;
      if (!best || c.prog > best.prog) best = c;
    }
    return best?.id ?? null;
  }

  /** Acerta um carro (some se estiver imune ou de Superfox). Devolve se pegou. */
  hit(c: GpCar, by: string, kind: GpItemKind): boolean {
    const s = this.state(c.id);
    if (s.star > 0 || s.safe > 0) {
      this.events.push({ type: 'blocked', id: c.id, kind });
      return false;
    }
    s.stun = GP_HIT_STUN;
    s.safe = GP_HIT_STUN + GP_HIT_SAFE;
    c.spin = 0;
    this.spinDir.set(c.id, { dir: this.rng() < 0.5 ? -1 : 1, done: 0 });
    this.scaleSpeed(c, GP_HIT_KEEP);
    c.boostT = 0;
    c.boostX = 0;
    this.events.push({ type: 'hit', id: c.id, by, kind });
    return true;
  }

  private stepTraps(dt: number) {
    const keep: GpTrap[] = [];
    for (const t of this.traps) {
      t.ttl -= dt;
      t.arm = Math.max(0, t.arm - dt);
      let gone = t.ttl <= 0;
      if (t.kind === 'bomb') {
        t.fuse -= dt;
        if (t.fuse <= 0) {
          this.events.push({ type: 'boom', x: t.x, z: t.z });
          for (const c of this.world.cars) {
            if (this.active(c) && dist(c.x, c.z, t.x, t.z) <= GP_BOMB_RADIUS)
              this.hit(c, t.owner, 'bomb');
          }
          gone = true;
        }
      } else {
        for (const c of this.world.cars) {
          if (!this.active(c) || (t.arm > 0 && c.id === t.owner)) continue;
          if (dist(c.x, c.z, t.x, t.z) <= GP_ITEM_HIT_RADIUS) {
            this.hit(c, t.owner, 'peel');
            gone = true;
            break;
          }
        }
      }
      if (!gone) keep.push(t);
    }
    this.traps = keep;
  }

  private stepShots(dt: number) {
    const tr = this.world.track;
    const keep: GpShot[] = [];
    for (const sh of this.shots) {
      sh.ttl -= dt;
      let dead = sh.ttl <= 0;
      if (sh.kind === 'ball') {
        const lim = GP_HALF_WIDTH - 1.2;
        const vf = Math.sqrt(Math.max(1, GP_BALL_SPEED * GP_BALL_SPEED - sh.vd * sh.vd));
        sh.prog += vf * dt;
        sh.d += sh.vd * dt;
        if (Math.abs(sh.d) > lim) {
          if (sh.bounces-- <= 0) dead = true;
          sh.d = Math.sign(sh.d) * lim;
          sh.vd = -sh.vd;
          // a quicada sempre devolve a bola para dentro da pista, mesmo saindo reta
          if (Math.abs(sh.vd) < GP_BALL_SPEED * 0.25)
            sh.vd = -Math.sign(sh.d) * GP_BALL_SPEED * 0.4;
        }
        const p = tr.pointAt(sh.prog, sh.d);
        sh.x = p.x;
        sh.z = p.z;
        sh.h = p.h + Math.atan2(sh.vd, vf);
      } else {
        // perseguidores seguem o traçado da pista e vão para o afastamento do alvo
        const target = sh.target ? this.world.car(sh.target) : undefined;
        const speed = sh.kind === 'bolt' ? GP_BOLT_SPEED : GP_SEEKER_SPEED;
        // o cometa azul acelera quanto mais longe estiver do líder, para sempre alcançá-lo
        const extra =
          sh.kind === 'bolt' && target ? Math.max(0, target.prog - sh.prog) * GP_BOLT_CATCHUP : 0;
        sh.prog += (speed + extra) * dt;
        if (target && this.active(target)) {
          const gap = target.prog - sh.prog;
          // bem à frente do alvo: não passa dele, espera atrás para acertar
          if (gap < 0) sh.prog = Math.max(sh.prog - speed * dt * 0.5, target.prog);
          sh.d += Math.max(-1, Math.min(1, target.d - sh.d)) * Math.min(1, 6 * dt) * 6;
        } else if (sh.kind === 'bolt') {
          sh.target = this.leaderOtherThan(sh.owner);
        }
        const p = tr.pointAt(sh.prog, sh.d);
        sh.x = p.x;
        sh.z = p.z;
        sh.h = p.h;
      }
      if (!dead) {
        for (const c of this.world.cars) {
          if (!this.active(c) || c.id === sh.owner) continue;
          if (sh.kind !== 'ball' && sh.target && c.id !== sh.target) continue;
          if (dist(c.x, c.z, sh.x, sh.z) <= GP_SHOT_HIT_RADIUS) {
            this.hit(c, sh.owner, sh.kind);
            dead = true;
            break;
          }
        }
      }
      if (!dead) keep.push(sh);
    }
    this.shots = keep;
  }
}

// ---- bots ----
/** Depois de quanto tempo com o item o bot usa de qualquer jeito (para não ficar guardando para sempre). */
export const GP_BOT_HOLD_MAX = 9;

/**
 * O bot usa o item agora? Cada item tem a sua hora: tiros quando há alguém na frente ao alcance, casca e bomba quando há
 * alguém atrás (ou na frente, para a bomba), turbo e Superfox numa reta, cometa azul na hora. `held` é há quanto tempo
 * ele tem o item (s): passou do limite, usa.
 */
export function gpBotUseItem(world: GpWorld, c: GpCar, item: GpItemId, held: number): boolean {
  if (held < 0.8) return false;
  if (held >= GP_BOT_HOLD_MAX) return true;
  const kind = gpItemKind(item);
  let ahead = Infinity;
  let aheadD = 0;
  let behind = Infinity;
  for (const o of world.cars) {
    if (o.id === c.id || o.gone || o.ghost || o.finished) continue;
    const gap = o.prog - c.prog;
    if (gap > 4 && gap < ahead) {
      ahead = gap;
      aheadD = o.d - c.d;
    } else if (gap < -4 && -gap < behind) behind = -gap;
  }
  switch (kind) {
    case 'bolt':
      return true;
    case 'ball':
      return ahead < 70 && Math.abs(aheadD) < 5;
    case 'seeker':
      return ahead < 130;
    case 'bomb':
      return ahead < 28 || behind < 22;
    case 'peel':
      return behind < 30;
    case 'nitro':
    case 'star':
      return Math.abs(c.steer) < 0.15 && c.speed > 12;
  }
}

// ---- rede (spec 085, etapa online) ----
const KIND_IDS: readonly GpItemKind[] = ['peel', 'ball', 'seeker', 'bomb', 'nitro', 'star', 'bolt'];
const ITEM_IDS: readonly GpItemId[] = [
  'peel',
  'peel3',
  'ball',
  'ball3',
  'seeker',
  'seeker3',
  'bomb',
  'nitro',
  'nitro3',
  'star',
  'bolt',
];
const EVENT_TYPES = ['pickup', 'use', 'hit', 'blocked', 'boom'] as const;

/** O que cada aparelho precisa para desenhar os itens (o líder manda isto junto do estado). */
export interface GpItemsSnap {
  /** Índices das caixas que estão em espera. */
  b: number[];
  /** Tiros: [uid, tipo, x, z, direção]. */
  s: [number, number, number, number, number][];
  /** Armadilhas: [uid, 0 casca / 1 bomba, x, z, pavio]. */
  t: [number, number, number, number, number][];
  /** Ccada carro: [vaga, item (-1 nenhum), quantos faltam, Superfox (0/1), tropeçando (0/1)]. */
  c: [number, number, number, number, number][];
  /** Eventos novos: [tipo, vaga de quem, tipo do item ou x, z]. Sem garantia de entrega (só som e aviso). */
  e: number[][];
}

const q = (v: number) => Math.round(v * 100) / 100;

/** Monta o estado dos itens para a rede (o `events` já vem em linhas, de `gpItemEventRows`). */
export function gpItemsSnap(sys: GpItemSystem, world: GpWorld, events: number[][]): GpItemsSnap {
  return {
    b: sys.boxes.flatMap((b, i) => (b.cd > 0 ? [i] : [])),
    s: sys.shots.map((x) => [x.uid, KIND_IDS.indexOf(x.kind), q(x.x), q(x.z), q(x.h)]),
    t: sys.traps.map((x) => [x.uid, x.kind === 'bomb' ? 1 : 0, q(x.x), q(x.z), q(x.fuse)]),
    c: world.cars
      .filter((c) => !c.gone)
      .map((c) => {
        const st = sys.state(c.id);
        return [
          c.slot,
          st.id ? ITEM_IDS.indexOf(st.id) : -1,
          st.left,
          st.star > 0 ? 1 : 0,
          st.stun > 0 ? 1 : 0,
        ];
      }),
    e: events,
  };
}

/** Um evento do sistema em linha para a rede. */
export function gpItemEventRow(e: GpItemEvent, world: GpWorld): number[] | null {
  const t = EVENT_TYPES.indexOf(e.type);
  if (e.type === 'boom') return [t, 0, q(e.x), q(e.z)];
  const car = world.car(e.id);
  if (!car) return null;
  const what =
    e.type === 'pickup' || e.type === 'use' ? ITEM_IDS.indexOf(e.item) : KIND_IDS.indexOf(e.kind);
  return [t, car.slot, what, 0];
}

/**
 * O espelho dos itens num aparelho que não é o líder: só guarda o que o líder mandou, no mesmo formato que a cena e o
 * HUD leem do `GpItemSystem` (caixas, tiros, armadilhas e o item de cada carro).
 */
export class GpItemView implements GpItemsReadable {
  readonly boxes: GpItemBox[];
  readonly cars = new Map<string, GpCarItem>();
  shots: GpShot[] = [];
  traps: GpTrap[] = [];
  private events: GpItemEvent[] = [];

  constructor(private world: GpWorld) {
    this.boxes = gpItemBoxes(world);
  }

  state(id: string): GpCarItem {
    let s = this.cars.get(id);
    if (!s) {
      s = { id: null, left: 0, gap: 0, stun: 0, safe: 0, star: 0 };
      this.cars.set(id, s);
    }
    return s;
  }

  drainEvents(): GpItemEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  apply(n: GpItemsSnap) {
    if (
      !n ||
      !Array.isArray(n.b) ||
      !Array.isArray(n.s) ||
      !Array.isArray(n.t) ||
      !Array.isArray(n.c)
    )
      return;
    const wait = new Set(n.b);
    this.boxes.forEach((b, i) => (b.cd = wait.has(i) ? GP_BOX_RESPAWN : 0));
    this.shots = n.s.flatMap(([uid, k, x, z, h]) => {
      const kind = KIND_IDS[k!];
      if (kind !== 'ball' && kind !== 'seeker' && kind !== 'bolt') return [];
      return [
        {
          uid: uid!,
          kind,
          owner: '',
          x: x!,
          z: z!,
          h: h!,
          prog: 0,
          d: 0,
          target: null,
          ttl: 1,
          bounces: 0,
          vd: 0,
        },
      ];
    });
    this.traps = n.t.map(([uid, k, x, z, fuse]) => ({
      uid: uid!,
      kind: k === 1 ? ('bomb' as const) : ('peel' as const),
      owner: '',
      x: x!,
      z: z!,
      ttl: 1,
      fuse: fuse!,
      arm: 0,
    }));
    for (const [slot, item, left, star, stun] of n.c) {
      const car = this.world.cars.find((c) => c.slot === slot);
      if (!car) continue;
      const st = this.state(car.id);
      st.id = item! >= 0 ? (ITEM_IDS[item!] ?? null) : null;
      st.left = left!;
      st.star = star! ? 1 : 0;
      st.stun = stun! ? 1 : 0;
    }
    for (const row of n.e ?? []) {
      const [t, slot, what, z] = row;
      const type = EVENT_TYPES[t!];
      if (!type) continue;
      if (type === 'boom') {
        this.events.push({ type: 'boom', x: what!, z: z! });
        continue;
      }
      const car = this.world.cars.find((c) => c.slot === slot);
      if (!car) continue;
      if (type === 'pickup' || type === 'use') {
        const item = ITEM_IDS[what!];
        if (item) this.events.push({ type, id: car.id, item });
      } else {
        const kind = KIND_IDS[what!];
        if (kind) this.events.push({ type, id: car.id, by: '', kind });
      }
    }
  }
}
