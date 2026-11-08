/**
 * Tática dos bots no modo Bomba (spec 059). Cada bot tem um nível (novato, médio, craque) que decide o quanto joga em equipe:
 * o time terrorista escolhe uma bomba, quem leva a C4 só planta quando está seguro, os outros escoltam e vigiam o plantio;
 * os contra-terroristas se espalham pelos postos de A e B, trocam de bomba quando alguém enxerga o inimigo do outro lado,
 * e desarmam só quando dá tempo e o caminho está limpo. Fora da luta, bons bots andam no Shift (sem barulho) e se agacham no posto.
 *
 * O módulo é puro: quem chama (servidor ou página offline) passa o estado do mundo a cada passo e aplica as ordens de
 * plantar/desarmar que ele devolve.
 */
import type { FsMapApi } from './maps';
import { fsClearLine } from './grenades';
import type { FsDmBrain } from './dm';
import type { FsSide } from './bomb';

export interface FsBotPerson {
  id: string;
  side: FsSide;
  x: number;
  z: number;
  alive: boolean;
  /** Cérebro do bot; null para uma pessoa de verdade (não recebe ordens, só conta como aliada ou inimiga). */
  brain: FsDmBrain | null;
}

export interface FsBotWorld {
  map: FsMapApi;
  now: number;
  dt: number;
  rng: () => number;
  phase: 'buy' | 'live' | 'planted' | 'end' | 'over';
  /** Segundos que faltam na fase atual. */
  time: number;
  roundSec: number;
  people: readonly FsBotPerson[];
  carrier: string | null;
  dropPos: { x: number; z: number } | null;
  plantPos: { x: number; z: number } | null;
  /** Quem está desarmando agora. */
  defusing: string | null;
  /** Tempo de desarme de cada um (com ou sem alicate). */
  defuseSec: (id: string) => number;
  hasKit: (id: string) => boolean;
}

export interface FsBotOrders {
  /** Bots que devem plantar neste passo. */
  plant: Set<string>;
  /** Bots que devem desarmar neste passo. */
  defuse: Set<string>;
}

type SiteId = 'A' | 'B';
const other = (s: SiteId): SiteId => (s === 'A' ? 'B' : 'A');
const siteMark = (map: FsMapApi, id: SiteId) => map.marks.find((m) => m.kind === 'site' && m.id === id)!;

interface Hold {
  x: number;
  z: number;
}
const holdCache = new Map<string, Hold[]>();

/** Uma rota do mapa como linha quebrada: de onde os terroristas saem até uma bomba (ou até a base CT, que passa pelo meio). */
export interface FsBotLane {
  pts: [number, number][];
  len: number;
}
const laneCache = new Map<string, { A: FsBotLane; B: FsBotLane; mid: FsBotLane } | null>();
const mkLane = (path: [number, number][], from: { x: number; z: number }): FsBotLane => {
  const pts: [number, number][] = [[from.x, from.z], ...path];
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return { pts, len };
};
/** As três rotas principais (até A, até B e até a base CT, que é o meio do mapa), tiradas do caminho de verdade e guardadas por mapa. */
export function fsBotLanes(map: FsMapApi): { A: FsBotLane; B: FsBotLane; mid: FsBotLane } | null {
  if (laneCache.has(map.id)) return laneCache.get(map.id)!;
  const t = map.marks.find((m) => m.kind === 'base' && m.id === 'T');
  const ct = map.marks.find((m) => m.kind === 'base' && m.id === 'CT');
  const a = map.marks.find((m) => m.kind === 'site' && m.id === 'A');
  const b = map.marks.find((m) => m.kind === 'site' && m.id === 'B');
  let out: { A: FsBotLane; B: FsBotLane; mid: FsBotLane } | null = null;
  if (t && ct && a && b) {
    const A = mkLane(map.path(t.x, t.z, a.x, a.z), t);
    const B = mkLane(map.path(t.x, t.z, b.x, b.z), t);
    const mid = mkLane(map.path(t.x, t.z, ct.x, ct.z), t);
    if (A.len > 10 && B.len > 10 && mid.len > 10) out = { A, B, mid };
  }
  laneCache.set(map.id, out);
  return out;
}
/** O ponto da rota a `s` metros do começo. */
export const fsLaneAt = (l: FsBotLane, s: number): [number, number] => {
  let left = Math.max(0, Math.min(l.len, s));
  for (let i = 1; i < l.pts.length; i++) {
    const a = l.pts[i - 1]!;
    const c = l.pts[i]!;
    const d = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (left <= d || i === l.pts.length - 1) {
      const k = d > 1e-6 ? Math.min(1, left / d) : 0;
      return [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k];
    }
    left -= d;
  }
  return l.pts[l.pts.length - 1]!;
};


/**
 * Postos de vigia em volta de um ponto: lugares livres que enxergam o ponto e têm paredes em volta (cobertura),
 * longe uns dos outros. É onde os bots esperam em vez de ficarem parados no meio da bomba.
 */
export function fsBotHolds(map: FsMapApi, cx: number, cz: number, radius = 13, max = 7): Hold[] {
  const key = `${map.id}:${Math.round(cx)},${Math.round(cz)},${radius}`;
  const hit = holdCache.get(key);
  if (hit) return hit;
  const cands: { x: number; z: number; score: number }[] = [];
  const dirs = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)] as const);
  for (let dx = -radius; dx <= radius; dx += 1.5) {
    for (let dz = -radius; dz <= radius; dz += 1.5) {
      const d = Math.hypot(dx, dz);
      if (d < 3.5 || d > radius) continue;
      const x = cx + dx;
      const z = cz + dz;
      if (!map.walkable(map.col(x), map.row(z))) continue;
      const [fc, fr] = map.nearestFree(x, z);
      if (Math.hypot(map.cellX(fc) - x, map.cellZ(fr) - z) > 0.6) continue;
      // precisa enxergar o ponto (para defender ou vigiar)
      if (!fsClearLine(map.solids, [x, 1.1, z], [cx, 1.0, cz])) continue;
      // cobertura: quantas direções batem numa parede logo perto
      let cover = 0;
      for (const [ux, uz] of dirs) if (!fsClearLine(map.solids, [x, 1.1, z], [x + ux * 6, 1.1, z + uz * 6])) cover++;
      cands.push({ x, z, score: cover * 1.2 - d / 7 });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const out: Hold[] = [];
  // o posto precisa ser alcançável (o bot que recebe um posto sem caminho ficava parado no meio do nada)
  const from = map.marks.find((m) => m.kind === 'base' && m.id === 'CT') ?? map.marks.find((m) => m.kind === 'base');
  for (const c of cands) {
    if (!out.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= 3)) continue;
    if (from) {
      const pth = map.path(from.x, from.z, c.x, c.z);
      const last = pth[pth.length - 1];
      if (!last || Math.hypot(last[0] - c.x, last[1] - c.z) > 2.5) continue;
    }
    out.push({ x: c.x, z: c.z });
    if (out.length >= max) break;
  }
  if (out.length === 0) out.push({ x: cx, z: cz });
  holdCache.set(key, out);
  return out;
}

interface Role {
  kind: 'carrier' | 'escort' | 'follow' | 'lurk' | 'defend' | 'rotator' | 'mid';
  /** Plano do ataque: quem é do grupo `mid` vai primeiro ao meio do mapa. */
  group?: 'mid';
  /** Contra-terrorista que avança: fica na posição adiantada até esse instante e depois recua para o posto. */
  pushUntil?: number;
  site: SiteId;
  hold: number;
  /** Anda no Shift até chegar? (decidido uma vez por round, pelo nível) */
  sneak: boolean;
  /** Agacha no posto? */
  crouch: boolean;
  rotated: boolean;
}

/** Cérebro de equipe dos dois lados. Chame `newRound` quando o round é liberado e `step` todo passo. */
export class FsBombTactics {
  private roles = new Map<string, Role>();
  private plan: SiteId = 'A';
  private planSwitched = false;
  /** Quando cada bomba teve contato com o inimigo pela última vez (por lado que viu: tr viu ct / ct viu tr). */
  private seen: Record<FsSide, Record<SiteId, { t: number; n: number }>> = { tr: { A: { t: -99, n: 0 }, B: { t: -99, n: 0 } }, ct: { A: { t: -99, n: 0 }, B: { t: -99, n: 0 } } };
  private lastSeenAny: Record<FsSide, number> = { tr: -99, ct: -99 };
  private arrivedAt = new Map<string, number>();
  private think = 0;
  private liveStart = 0;
  private holdsPlanted: Hold[] = [];
  private holdsPlantedKey = '';
  /** Plano do round de cada time: os bots mudam de estratégia de round em round e se adaptam ao que acontece. */
  private ctPlan: 'hold' | 'stackA' | 'stackB' | 'pushMid' | 'aggro' = 'hold';
  private trPlan: 'rush' | 'split' | 'mid' | 'slow' = 'rush';
  /** Os terroristas esperam em pontos de preparação e só entram juntos (com granadas) quando esta marca vira. */
  private trGo = false;
  private lastEnemy: Record<FsSide, Record<SiteId, { x: number; z: number } | null>> = { tr: { A: null, B: null }, ct: { A: null, B: null } };
  private lastPos = new Map<string, { x: number; z: number; alive: boolean }>();
  private ctUtilAt = 0;
  /** Bomba em apuros e quem foi mandado para lá: fica valendo por um tempo (sem isso os bots trocavam de ordem a cada passo e ficavam indo e voltando). */
  private hot: { site: SiteId; since: number } | null = null;
  private supporterId: string | null = null;
  private watcherId: string | null = null;

  /** Mapa sem bombas (modo PvP): os bots só caçam o outro time, indo de ponto em ponto pelo lado do inimigo. */
  private isPvp(w: FsBotWorld) {
    return !w.map.marks.some((m) => m.kind === 'site');
  }
  private pvpUntil = new Map<string, number>();
  private pvpStep(w: FsBotWorld) {
    for (const p of w.people) {
      const b = p.brain;
      if (!p.alive || !b) continue;
      b.lookAt = null;
      b.holdCrouch = false;
      b.sneak = false;
      const obj = b.objective;
      const until = this.pvpUntil.get(p.id) ?? 0;
      if (obj && Math.hypot(obj[0] - p.x, obj[1] - p.z) > 3 && w.now < until) continue;
      const foeBase = w.map.marks.find((m) => m.kind === 'base' && m.id === (p.side === 'tr' ? 'CT' : 'T'));
      const spots = [...w.map.hotspots];
      if (foeBase) spots.sort((a, c) => Math.hypot(a[0] - foeBase.x, a[1] - foeBase.z) - Math.hypot(c[0] - foeBase.x, c[1] - foeBase.z));
      const pool = spots.slice(0, Math.max(3, Math.ceil(spots.length * 0.6)));
      const g = pool[Math.floor(w.rng() * pool.length)];
      if (g) b.objective = [g[0], g[1]];
      this.pvpUntil.set(p.id, w.now + 7 + w.rng() * 10);
    }
  }

  newRound(w: FsBotWorld) {
    if (this.isPvp(w)) {
      this.pvpUntil.clear();
      for (const p of w.people) if (p.brain) this.clear(p.brain);
      return;
    }
    this.roles.clear();
    this.arrivedAt.clear();
    this.planSwitched = false;
    this.liveStart = w.now;
    this.seen = { tr: { A: { t: -99, n: 0 }, B: { t: -99, n: 0 } }, ct: { A: { t: -99, n: 0 }, B: { t: -99, n: 0 } } };
    this.lastSeenAny = { tr: -99, ct: -99 };
    this.lastEnemy = { tr: { A: null, B: null }, ct: { A: null, B: null } };
    this.lastPos.clear();
    this.ctUtilAt = 0;
    this.hot = null;
    this.supporterId = null;
    this.watcherId = null;
    this.trGo = false;
    this.plan = w.rng() < 0.5 ? 'A' : 'B';
    const r = w.rng();
    this.ctPlan = r < 0.34 ? 'hold' : r < 0.44 ? 'stackA' : r < 0.54 ? 'stackB' : r < 0.76 ? 'pushMid' : 'aggro';
    const q = w.rng();
    this.trPlan = q < 0.3 ? 'rush' : q < 0.55 ? 'split' : q < 0.78 ? 'mid' : 'slow';
    // granadas para a execução e para a defesa (os bots "compraram" uma ou duas)
    for (const p of w.people) {
      const b = p.brain;
      if (!b) continue;
      if (b.nades.flash + b.nades.frag === 0 && w.rng() < 0.7) b.nades.flash = 1;
      if (b.skill.sense > 0.45 && b.nades.frag === 0 && w.rng() < 0.5) b.nades.frag = 1;
    }
    this.assign(w);
  }

  private bots(w: FsBotWorld, side: FsSide) {
    return w.people.filter((p) => p.side === side && p.alive && p.brain);
  }

  private assign(w: FsBotWorld) {
    const map = w.map;
    // terroristas: um carrega, o resto escolta; novatos só seguem o carregador; com 4+ um craque faz "lurk" na outra bomba
    const tr = this.bots(w, 'tr');
    const plan = this.plan;
    const used = new Map<SiteId, number>([['A', 0], ['B', 0]]);
    const take = (s: SiteId) => {
      const i = used.get(s)!;
      used.set(s, i + 1);
      return i;
    };
    let lurkers = 0;
    let midGroup = 0;
    const lurkN = this.trPlan === 'split' ? Math.max(1, Math.floor(tr.length * 0.4)) : tr.length >= 4 ? 1 : 0;
    const midN = this.trPlan === 'mid' ? Math.max(1, Math.ceil(tr.length * 0.4)) : 0;
    for (const p of tr) {
      const sk = p.brain!.skill;
      const sneak = w.rng() < sk.sneak;
      const crouch = w.rng() < 0.3 + sk.sense * 0.5;
      if (w.carrier === p.id) {
        this.roles.set(p.id, { kind: 'carrier', site: plan, hold: 0, sneak, crouch: false, rotated: false });
      } else if (sk.sense < 0.3) {
        this.roles.set(p.id, { kind: 'follow', site: plan, hold: take(plan), sneak: false, crouch, rotated: false });
      } else if (lurkers < lurkN && (this.trPlan === 'split' || (sk.sense > 0.8 && w.rng() < 0.5))) {
        lurkers++;
        this.roles.set(p.id, { kind: 'lurk', site: other(plan), hold: take(other(plan)), sneak: true, crouch, rotated: false });
      } else if (midGroup < midN) {
        midGroup++;
        this.roles.set(p.id, { kind: 'escort', group: 'mid', site: plan, hold: take(plan), sneak: false, crouch, rotated: false });
      } else {
        this.roles.set(p.id, { kind: 'escort', site: plan, hold: take(plan), sneak, crouch, rotated: false });
      }
    }
    // contra-terroristas: formação (2 em A, 2 em B e 1 no meio olhando, com 5); o plano do round empilha uma bomba, avança pelo meio ou
    // manda dois adiantarem a posição antes de recuar
    const ct = this.bots(w, 'ct');
    const order = [...ct].sort((x, y) => y.brain!.skill.sense - x.brain!.skill.sense);
    const nMid = ct.length >= 3 ? (this.ctPlan === 'pushMid' && ct.length >= 4 ? 2 : 1) : 0;
    const mids = order.slice(0, nMid);
    const rest = ct.filter((p) => !mids.includes(p));
    let aN = Math.ceil(rest.length / 2);
    let bN = rest.length - aN;
    if (this.ctPlan === 'stackA' && bN > 1) {
      aN++;
      bN--;
    } else if (this.ctPlan === 'stackB' && aN > 1) {
      aN--;
      bN++;
    }
    const cu = new Map<SiteId, number>([['A', 0], ['B', 0]]);
    const pushedSites = new Set<SiteId>();
    rest.forEach((p, i) => {
      const sk = p.brain!.skill;
      const site: SiteId = i < aN ? 'A' : 'B';
      const sneak = w.rng() < sk.sneak;
      const crouch = w.rng() < 0.2 + sk.sense * 0.6;
      const n = cu.get(site)!;
      cu.set(site, n + 1);
      const role: Role = { kind: 'defend', site, hold: n, sneak, crouch, rotated: false };
      if (this.ctPlan === 'aggro' && !pushedSites.has(site) && sk.sense >= 0.3) {
        pushedSites.add(site);
        role.pushUntil = w.now + 11 + w.rng() * 6;
      }
      this.roles.set(p.id, role);
    });
    mids.forEach((p, i) => {
      const role: Role = { kind: 'mid', site: i % 2 === 0 ? 'A' : 'B', hold: i, sneak: w.rng() < p.brain!.skill.sneak, crouch: true, rotated: false };
      if (this.ctPlan === 'pushMid') role.pushUntil = w.now + 16 + w.rng() * 9;
      this.roles.set(p.id, role);
    });
  }

  /** Marca um contato: `by` viu um inimigo perto de uma bomba. */
  private note(map: FsMapApi, by: FsSide, x: number, z: number, now: number) {
    this.lastSeenAny[by] = now;
    let best: SiteId = 'A';
    let bd = 1e9;
    for (const s of ['A', 'B'] as const) {
      const m = siteMark(map, s);
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (bd < 32) {
      this.lastEnemy[by][best] = { x, z };
      const e = this.seen[by][best];
      e.n = now - e.t < 6 ? e.n + 1 : 1;
      e.t = now;
    }
  }

  step(w: FsBotWorld): FsBotOrders {
    const map = w.map;
    const orders: FsBotOrders = { plant: new Set(), defuse: new Set() };
    if (w.phase === 'end' || w.phase === 'over') {
      for (const p of w.people) if (p.brain) this.clear(p.brain);
      return orders;
    }
    if (w.phase === 'buy') return orders;
    if (this.isPvp(w)) {
      this.pvpStep(w);
      return orders;
    }
    this.think -= w.dt;
    const fast = this.think <= 0;
    if (fast) this.think = 0.25;
    const byId = new Map(w.people.map((p) => [p.id, p]));
    const timeLeft = w.time;

    // ---- contatos: quem tem alvo à vista conta para a inteligência do time
    if (fast) {
      for (const p of w.people) {
        const b = p.brain;
        if (!p.alive || !b || !b.target || b.lostT > 0.5) continue;
        const f = byId.get(b.target);
        if (f) this.note(map, p.side, f.x, f.z, w.now);
      }
    }

    // morte de um aliado também é notícia: o time sabe de que lado foi (para dar apoio)
    if (fast) {
      for (const p of w.people) {
        const prev = this.lastPos.get(p.id);
        if (prev?.alive && !p.alive) this.note(map, p.side, prev.x, prev.z, w.now);
        this.lastPos.set(p.id, { x: p.x, z: p.z, alive: p.alive });
      }
    }
    const lanes = fsBotLanes(map);

    // ---- terroristas
    const planted = w.phase === 'planted' && w.plantPos;
    const trBots = this.bots(w, 'tr');
    const carrierP = w.carrier ? byId.get(w.carrier) : undefined;
    // novo carregador (o anterior morreu e alguém pegou a C4)
    if (w.carrier && !this.roles.has(w.carrier) && carrierP?.brain) this.roles.set(w.carrier, { kind: 'carrier', site: this.plan, hold: 0, sneak: false, crouch: false, rotated: false });
    for (const p of trBots) {
      const r = this.roles.get(p.id);
      if (r && w.carrier === p.id && r.kind !== 'carrier') r.kind = 'carrier';
      if (r && w.carrier !== p.id && r.kind === 'carrier') r.kind = 'escort';
    }
    // trocar de bomba: o carregador (se for esperto) desiste de uma bomba cheia de CTs
    if (!planted && !this.planSwitched && carrierP?.brain && carrierP.brain.skill.sense > 0.5 && fast) {
      const s = this.seen.tr[this.plan];
      const left = timeLeft;
      if (w.now - s.t < 5 && s.n >= 3 && left > 45 && w.rng() < 0.25) {
        this.plan = other(this.plan);
        this.planSwitched = true;
        this.assign(w);
      }
    }
    // preparar e entrar juntos: cada um espera num ponto de preparação até a maioria chegar (ou o tempo/uma luta apertar) e então todos entram,
    // jogando as granadas que tiverem no pátio antes
    if (!planted && !this.trGo && fast) {
      const elapsed = w.now - this.liveStart;
      if (!lanes) this.trGo = true;
      else {
        const goAfter = { rush: 5, split: 9, mid: 14, slow: 17 }[this.trPlan];
        const stageOf = (r: Role): [number, number] => (r.group === 'mid' ? fsLaneAt(lanes.mid, lanes.mid.len * 0.42) : fsLaneAt(lanes[r.site], lanes[r.site].len - 27));
        let arrived = 0;
        for (const p of trBots) {
          const r = this.roles.get(p.id);
          if (!r) continue;
          const st = stageOf(r);
          if (Math.hypot(p.x - st[0], p.z - st[1]) < 7) arrived++;
        }
        const need = Math.max(1, Math.ceil(trBots.length * 0.6));
        const fightingAny = trBots.some((p) => !!p.brain!.target && p.brain!.lostT < 1);
        if ((elapsed > goAfter && arrived >= need) || elapsed > goAfter + 16 || (fightingAny && elapsed > 4) || timeLeft < w.roundSec * 0.5) {
          this.trGo = true;
          for (const p of trBots) {
            const r = this.roles.get(p.id);
            const b = p.brain!;
            if (!r || b.skill.sense < 0.2 || b.nades.flash + b.nades.frag === 0) continue;
            const sm = siteMark(map, this.plan);
            const holds = fsBotHolds(map, sm.x, sm.z);
            const h = holds[(r.hold + 1) % holds.length]!;
            const d = Math.hypot(p.x - h.x, p.z - h.z);
            if (d > 9 && d < 34) b.throwReq = { kind: 'any', x: h.x, z: h.z };
          }
        }
      }
    }
    const nearest = (id: string, list: readonly FsBotPerson[]) => {
      const me = byId.get(id)!;
      let best: FsBotPerson | null = null;
      let bd = 1e9;
      for (const o of list) {
        if (o.id === id) continue;
        const d = Math.hypot(o.x - me.x, o.z - me.z);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      return best ? { p: best, d: bd } : null;
    };
    // quem pega a C4 do chão: o terrorista vivo mais perto (os outros seguem o plano)
    let picker: string | null = null;
    if (!w.carrier && w.dropPos && !planted) {
      let bd = 1e9;
      for (const p of trBots) {
        const d = Math.hypot(p.x - w.dropPos.x, p.z - w.dropPos.z);
        if (d < bd) {
          bd = d;
          picker = p.id;
        }
      }
    }
    const defenders = this.bots(w, 'ct');
    for (const p of trBots) {
      const b = p.brain!;
      const r = this.roles.get(p.id) ?? { kind: 'escort' as const, site: this.plan, hold: 0, sneak: false, crouch: false, rotated: false };
      this.roles.set(p.id, r);
      const sk = b.skill;
      const fighting = !!b.target && b.lostT < 1.2;
      b.lookAt = null;
      b.holdCrouch = false;
      if (picker === p.id) {
        b.objective = [w.dropPos!.x, w.dropPos!.z];
        b.sneak = false;
        continue;
      }
      if (planted) {
        const bp = w.plantPos!;
        if (w.defusing) {
          // desarmando: todo mundo perto corre para impedir
          const d = Math.hypot(p.x - bp.x, p.z - bp.z);
          if (d < 40 || sk.sense < 0.5) {
            b.objective = [bp.x, bp.z];
            b.sneak = false;
            continue;
          }
        }
        // pós-plantio: cada um num posto com vista para a bomba, agachado, esperando o CT chegar
        const hk = `${Math.round(bp.x)},${Math.round(bp.z)}`;
        if (this.holdsPlantedKey !== hk) {
          this.holdsPlantedKey = hk;
          this.holdsPlanted = fsBotHolds(map, bp.x, bp.z, 14, 8);
        }
        const idx = trBots.indexOf(p);
        const h = this.holdsPlanted[idx % this.holdsPlanted.length]!;
        // novatos ficam em cima da bomba; os outros se escondem
        if (sk.sense < 0.3) b.objective = [bp.x + (idx % 3) - 1, bp.z + 1];
        else b.objective = [h.x, h.z];
        b.sneak = sk.sense > 0.5 && !fighting && Math.hypot(p.x - h.x, p.z - h.z) < 22;
        b.holdCrouch = sk.sense > 0.3 && r.crouch;
        b.lookAt = [bp.x, bp.z];
        continue;
      }
      const m = siteMark(map, r.site);
      const siteHolds = fsBotHolds(map, m.x, m.z);
      // antes da entrada: espera no ponto de preparação do plano (rota da bomba, ou o meio para o grupo do meio)
      if (!this.trGo && lanes) {
        const st = r.group === 'mid' ? fsLaneAt(lanes.mid, lanes.mid.len * 0.42) : fsLaneAt(lanes[r.site], lanes[r.site].len - 27);
        b.objective = [st[0], st[1]];
        b.sneak = false;
        b.holdCrouch = false;
        b.lookAt = null;
        continue;
      }
      if (r.kind === 'carrier') {
        b.objective = [m.x, m.z];
        b.sneak = r.sneak && Math.hypot(p.x - m.x, p.z - m.z) < 28 && !fighting;
        const inSite = map.siteAt(p.x, p.z);
        if (inSite) {
          const arrived = this.arrivedAt.get(p.id) ?? w.now;
          this.arrivedAt.set(p.id, arrived);
          const waited = w.now - arrived;
          const mates = trBots.filter((o) => o.id !== p.id && Math.hypot(o.x - p.x, o.z - p.z) < 11).length;
          const clear = !fighting && b.lostT > (sk.sense > 0.5 ? 1.5 : 0.6);
          // craque espera o time chegar (ou o tempo apertar); novato planta assim que chega
          const covered = sk.sense < 0.5 || mates > 0 || waited > 4 || trBots.length === 1;
          const late = timeLeft < 35;
          const nearEnemy = defenders.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 9 && fsClearLine(map.solids, [p.x, 1.1, p.z], [o.x, 1.1, o.z]));
          if (clear && (covered || late) && (!nearEnemy || late)) orders.plant.add(p.id);
        } else this.arrivedAt.delete(p.id);
        continue;
      }
      // novato acompanha o carregador o tempo todo (antes só passava de 6 m: ao cruzar essa distância o objetivo trocava a cada passo e o bot ficava parado)
      if (r.kind === 'follow' && carrierP && carrierP.alive) {
        b.objective = [carrierP.x, carrierP.z];
        b.sneak = false;
        continue;
      }
      const siteTarget = r.kind === 'lurk' ? fsBotHolds(map, siteMark(map, r.site).x, siteMark(map, r.site).z) : siteHolds;
      const h = siteTarget[r.hold % siteTarget.length]!;
      b.objective = [h.x, h.z];
      const dist = Math.hypot(p.x - h.x, p.z - h.z);
      b.sneak = r.sneak && dist < 30 && !fighting;
      b.holdCrouch = r.crouch && dist < 2.5;
      b.lookAt = [m.x, m.z];
      // espera no posto um tempo antes de avançar sozinho se o carregador está atrasado
      void nearest;
    }

    // ---- contra-terroristas
    const ctBots = this.bots(w, 'ct');
    const attackers = this.bots(w, 'tr');
    // apoio: contato (tiro visto ou aliado morto) numa bomba; o aliado mais perto de fora dela vai dar apoio e o seguinte fica de olho
    const recent = (['A', 'B'] as const).reduce<SiteId | null>((acc, s) => (w.now - this.seen.ct[s].t < 8 && (acc === null || this.seen.ct[s].t > this.seen.ct[acc].t) ? s : acc), null);
    if (!recent) {
      if (this.hot && w.now - this.hot.since > 10) this.hot = null;
    } else if (!this.hot || (recent !== this.hot.site && w.now - this.hot.since > 6)) {
      this.hot = { site: recent, since: w.now };
      this.supporterId = null;
      this.watcherId = null;
    } else if (recent === this.hot.site) this.hot.since = Math.max(this.hot.since, w.now - 5);
    const hotSite: SiteId | null = this.hot?.site ?? null;
    let supporter: string | null = null;
    let watcher: string | null = null;
    if (hotSite && !planted) {
      const hm = siteMark(map, hotSite);
      const aliveIds = new Set(ctBots.map((p) => p.id));
      if (!this.supporterId || !aliveIds.has(this.supporterId)) {
        const cands = ctBots
          .filter((p) => (this.roles.get(p.id)?.site !== hotSite || this.roles.get(p.id)?.kind === 'mid') && p.brain!.skill.sense > 0.3)
          .sort((a, c) => Math.hypot(a.x - hm.x, a.z - hm.z) - Math.hypot(c.x - hm.x, c.z - hm.z));
        this.supporterId = cands[0]?.id ?? null;
        this.watcherId = cands[1]?.id ?? null;
      }
      supporter = this.supporterId;
      watcher = this.watcherId && aliveIds.has(this.watcherId) ? this.watcherId : null;
      // defesa com granada: quem tem granada joga no último lugar onde o inimigo apareceu (a cada 6 s, um bot)
      const le = this.lastEnemy.ct[hotSite];
      if (fast && le && w.now >= this.ctUtilAt) {
        for (const p of ctBots) {
          const b = p.brain!;
          if (b.skill.sense < 0.3 || b.nades.flash + b.nades.frag === 0 || (!!b.target && b.lostT < 1.2)) continue;
          const d = Math.hypot(p.x - le.x, p.z - le.z);
          if (d > 9 && d < 30 && fsClearLine(map.solids, [p.x, 1.1, p.z], [p.x + (le.x - p.x) * 0.2, 1.1, p.z + (le.z - p.z) * 0.2])) {
            b.throwReq = { kind: 'any', x: le.x, z: le.z };
            this.ctUtilAt = w.now + 6;
            break;
          }
        }
      }
    }
    let defuser: string | null = null;
    if (planted) {
      // quem desarma: dono do alicate, senão o mais perto; só se der tempo
      const bp = w.plantPos!;
      const cands = ctBots
        .map((p) => ({ p, d: Math.hypot(p.x - bp.x, p.z - bp.z), kit: w.hasKit(p.id) }))
        .sort((a, b) => Number(b.kit) - Number(a.kit) || a.d - b.d);
      defuser = cands[0]?.p.id ?? null;
      // com pouco tempo só vale tentar se o desarme ainda cabe (novatos tentam mesmo assim)
      if (defuser) {
        const dp = byId.get(defuser)!;
        const need = w.defuseSec(defuser);
        const s = dp.brain!.skill;
        if (s.sense > 0.5 && timeLeft < need - 0.2) defuser = null;
      }
    }
    for (const p of ctBots) {
      const b = p.brain!;
      const sk = b.skill;
      const r = this.roles.get(p.id) ?? { kind: 'defend' as const, site: 'A' as SiteId, hold: 0, sneak: false, crouch: false, rotated: false };
      this.roles.set(p.id, r);
      const fighting = !!b.target && b.lostT < 1.2;
      b.lookAt = null;
      b.holdCrouch = false;
      if (planted) {
        const bp = w.plantPos!;
        const d = Math.hypot(p.x - bp.x, p.z - bp.z);
        const teamSawRecently = w.now - this.lastSeenAny.ct < 3;
        const mates = ctBots.filter((o) => o.id !== p.id && Math.hypot(o.x - bp.x, o.z - bp.z) < 14).length;
        const hk = `${Math.round(bp.x)},${Math.round(bp.z)}`;
        if (this.holdsPlantedKey !== hk) {
          this.holdsPlantedKey = hk;
          this.holdsPlanted = fsBotHolds(map, bp.x, bp.z, 14, 8);
        }
        if (p.id === defuser) {
          // craque só avança quando o time limpou (sem contato recente) e tem companhia; novato corre direto
          const go = sk.sense < 0.5 || (!teamSawRecently && (mates > 0 || ctBots.length === 1 || timeLeft < 22));
          if (go || d < 3) {
            b.objective = [bp.x, bp.z];
            b.sneak = sk.sense > 0.5 && !fighting && d < 25 && timeLeft > 25;
          } else {
            const h = this.holdsPlanted[ctBots.indexOf(p) % this.holdsPlanted.length]!;
            b.objective = [h.x, h.z];
            b.sneak = true;
            b.holdCrouch = d < 18;
            b.lookAt = [bp.x, bp.z];
          }
          if (d < 2.3 && !fighting && b.lostT > (sk.sense > 0.5 ? 1.0 : 0.3) && (sk.sense < 0.5 || !teamSawRecently || timeLeft < 14)) orders.defuse.add(p.id);
          continue;
        }
        // os outros dão cobertura de um posto com vista para a bomba
        const h = this.holdsPlanted[(ctBots.indexOf(p) + 1) % this.holdsPlanted.length]!;
        if (sk.sense < 0.3) b.objective = [bp.x + 2, bp.z - 1];
        else b.objective = [h.x, h.z];
        b.sneak = sk.sense > 0.5 && !fighting && Math.hypot(p.x - h.x, p.z - h.z) < 20;
        b.holdCrouch = r.crouch && Math.hypot(p.x - h.x, p.z - h.z) < 2.5;
        b.lookAt = [bp.x, bp.z];
        continue;
      }
      // antes do plantio: apoio, avanço/recuo e postos
      // recuar: quem estava avançado volta ao posto quando o tempo da posição acaba ou quando bateu de frente com mais gente do que o time
      if (r.pushUntil !== undefined && (w.now > r.pushUntil || (w.now - this.lastSeenAny.ct < 2 && ctBots.length < attackers.length))) r.pushUntil = undefined;
      const mid = lanes ? { hold: fsLaneAt(lanes.mid, lanes.mid.len * 0.72), watch: fsLaneAt(lanes.mid, lanes.mid.len * 0.45), push: fsLaneAt(lanes.mid, lanes.mid.len * 0.42), far: fsLaneAt(lanes.mid, lanes.mid.len * 0.25) } : null;
      if (supporter === p.id && hotSite) {
        // apoio: vai para um posto da bomba onde houve tiro ou morte
        const sm = siteMark(map, hotSite);
        const hs = fsBotHolds(map, sm.x, sm.z);
        const h = hs[(ctBots.indexOf(p) + 1) % hs.length]!;
        b.objective = [h.x, h.z];
        b.sneak = false;
        b.lookAt = [sm.x, sm.z];
        continue;
      }
      if (r.kind === 'mid') {
        if (mid) {
          if (r.pushUntil !== undefined) {
            b.objective = [mid.push[0], mid.push[1]];
            b.lookAt = [mid.far[0], mid.far[1]];
            b.sneak = r.sneak && !fighting;
          } else {
            b.objective = [mid.hold[0], mid.hold[1]];
            const dMid = Math.hypot(p.x - mid.hold[0], p.z - mid.hold[1]);
            b.holdCrouch = dMid < 2.5;
            // de olho: olha para o lado da bomba onde houve barulho, senão para a entrada do meio
            const hs2 = hotSite ? siteMark(map, hotSite) : null;
            b.lookAt = hs2 ? [hs2.x, hs2.z] : [mid.watch[0], mid.watch[1]];
            b.sneak = r.sneak && !fighting && dMid < 30;
          }
        } else {
          const a = siteMark(map, 'A');
          const c = siteMark(map, 'B');
          const [fc, fr] = map.nearestFree((a.x + c.x) / 2, (a.z + c.z) / 2);
          b.objective = [map.cellX(fc), map.cellZ(fr)];
        }
        continue;
      }
      if (r.pushUntil !== undefined && lanes) {
        // avança: posição adiantada na rota da bomba (a entrada), olhando para o lado de onde o inimigo vem
        const ln = lanes[r.site];
        const fwd = fsLaneAt(ln, ln.len - 20);
        const far = fsLaneAt(ln, ln.len - 40);
        b.objective = [fwd[0], fwd[1]];
        b.lookAt = [far[0], far[1]];
        b.sneak = r.sneak && !fighting;
        continue;
      }
      const m = siteMark(map, r.site);
      const holds = fsBotHolds(map, m.x, m.z);
      const h = holds[r.hold % holds.length]!;
      b.objective = [h.x, h.z];
      const dist = Math.hypot(p.x - h.x, p.z - h.z);
      b.sneak = r.sneak && !fighting && dist < 35;
      b.holdCrouch = r.crouch && dist < 2.5;
      // quem está de olho (segundo mais perto de onde houve contato) olha para lá sem sair do posto
      const watchSm = hotSite && watcher === p.id ? siteMark(map, hotSite) : null;
      b.lookAt = watchSm ? [watchSm.x, watchSm.z] : [m.x, m.z];
      void attackers;
    }
    return orders;
  }

  private clear(b: FsDmBrain) {
    b.sneak = false;
    b.holdCrouch = false;
    b.lookAt = null;
  }
}
