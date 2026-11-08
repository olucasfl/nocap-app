/**
 * Tática dos bots no modo Bomba (spec 059). Cada bot tem um nível (novato, médio, craque) que decide o quanto joga em equipe:
 * o time terrorista escolhe uma bomba, quem leva a C4 só planta quando está seguro, os outros escoltam e vigiam o plantio;
 * os contra-terroristas se espalham pelos postos de A e B, trocam de bomba quando alguém enxerga o inimigo do outro lado,
 * e desarmam só quando dá tempo e o caminho está limpo. Fora da luta, bons bots andam no Shift (sem barulho) e se agacham no posto.
 *
 * O módulo é puro: quem chama (servidor ou página offline) passa o estado do mundo a cada passo e aplica as ordens de
 * plantar/desarmar que ele devolve.
 */
import { FS_DUST_MARKS, FS_DUST_SOLIDS, fsDustCellX, fsDustCellZ, fsDustCol, fsDustNearestFree, fsDustRow, fsDustWalkable, fsSiteAt } from './dust';
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
const siteMark = (id: SiteId) => FS_DUST_MARKS.find((m) => m.kind === 'site' && m.id === id)!;

interface Hold {
  x: number;
  z: number;
}
const holdCache = new Map<string, Hold[]>();

/**
 * Postos de vigia em volta de um ponto: lugares livres que enxergam o ponto e têm paredes em volta (cobertura),
 * longe uns dos outros. É onde os bots esperam em vez de ficarem parados no meio da bomba.
 */
export function fsBotHolds(cx: number, cz: number, radius = 13, max = 7): Hold[] {
  const key = `${Math.round(cx)},${Math.round(cz)},${radius}`;
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
      if (!fsDustWalkable(fsDustCol(x), fsDustRow(z))) continue;
      const [fc, fr] = fsDustNearestFree(x, z);
      if (Math.hypot(fsDustCellX(fc) - x, fsDustCellZ(fr) - z) > 0.6) continue;
      // precisa enxergar o ponto (para defender ou vigiar)
      if (!fsClearLine(FS_DUST_SOLIDS, [x, 1.1, z], [cx, 1.0, cz])) continue;
      // cobertura: quantas direções batem numa parede logo perto
      let cover = 0;
      for (const [ux, uz] of dirs) if (!fsClearLine(FS_DUST_SOLIDS, [x, 1.1, z], [x + ux * 6, 1.1, z + uz * 6])) cover++;
      cands.push({ x, z, score: cover * 1.2 - d / 7 });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const out: Hold[] = [];
  for (const c of cands) {
    if (out.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= 3)) out.push({ x: c.x, z: c.z });
    if (out.length >= max) break;
  }
  if (out.length === 0) out.push({ x: cx, z: cz });
  holdCache.set(key, out);
  return out;
}

interface Role {
  kind: 'carrier' | 'escort' | 'follow' | 'lurk' | 'defend' | 'rotator';
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

  newRound(w: FsBotWorld) {
    this.roles.clear();
    this.arrivedAt.clear();
    this.planSwitched = false;
    this.liveStart = w.now;
    this.seen = { tr: { A: { t: -99, n: 0 }, B: { t: -99, n: 0 } }, ct: { A: { t: -99, n: 0 }, B: { t: -99, n: 0 } } };
    this.lastSeenAny = { tr: -99, ct: -99 };
    this.plan = w.rng() < 0.5 ? 'A' : 'B';
    this.assign(w);
  }

  private bots(w: FsBotWorld, side: FsSide) {
    return w.people.filter((p) => p.side === side && p.alive && p.brain);
  }

  private assign(w: FsBotWorld) {
    // terroristas: um carrega, o resto escolta; novatos só seguem o carregador; com 4+ um craque faz "lurk" na outra bomba
    const tr = this.bots(w, 'tr');
    const plan = this.plan;
    const used = new Map<SiteId, number>([['A', 0], ['B', 0]]);
    const take = (s: SiteId) => {
      const i = used.get(s)!;
      used.set(s, i + 1);
      return i;
    };
    let lurker = false;
    for (const p of tr) {
      const sk = p.brain!.skill;
      const sneak = w.rng() < sk.sneak;
      const crouch = w.rng() < 0.3 + sk.sense * 0.5;
      if (w.carrier === p.id) {
        this.roles.set(p.id, { kind: 'carrier', site: plan, hold: 0, sneak, crouch: false, rotated: false });
      } else if (sk.sense < 0.3) {
        this.roles.set(p.id, { kind: 'follow', site: plan, hold: take(plan), sneak: false, crouch, rotated: false });
      } else if (!lurker && tr.length >= 4 && sk.sense > 0.8 && w.rng() < 0.5) {
        lurker = true;
        this.roles.set(p.id, { kind: 'lurk', site: other(plan), hold: take(other(plan)), sneak: true, crouch, rotated: false });
      } else {
        this.roles.set(p.id, { kind: 'escort', site: plan, hold: take(plan), sneak, crouch, rotated: false });
      }
    }
    // contra-terroristas: metade em cada bomba; com 4+ um médio/craque fica de rotação no meio
    const ct = this.bots(w, 'ct');
    const cu = new Map<SiteId, number>([['A', 0], ['B', 0]]);
    let rotator = false;
    ct.forEach((p, i) => {
      const sk = p.brain!.skill;
      const site: SiteId = i % 2 === 0 ? 'A' : 'B';
      const sneak = w.rng() < sk.sneak;
      const crouch = w.rng() < 0.2 + sk.sense * 0.6;
      if (!rotator && ct.length >= 4 && sk.sense >= 0.5 && i >= 2) {
        rotator = true;
        this.roles.set(p.id, { kind: 'rotator', site, hold: 0, sneak, crouch: false, rotated: false });
        return;
      }
      const n = cu.get(site)!;
      cu.set(site, n + 1);
      this.roles.set(p.id, { kind: 'defend', site, hold: n, sneak, crouch, rotated: false });
    });
  }

  /** Marca um contato: `by` viu um inimigo perto de uma bomba. */
  private note(by: FsSide, x: number, z: number, now: number) {
    this.lastSeenAny[by] = now;
    let best: SiteId = 'A';
    let bd = 1e9;
    for (const s of ['A', 'B'] as const) {
      const m = siteMark(s);
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (bd < 32) {
      const e = this.seen[by][best];
      e.n = now - e.t < 6 ? e.n + 1 : 1;
      e.t = now;
    }
  }

  step(w: FsBotWorld): FsBotOrders {
    const orders: FsBotOrders = { plant: new Set(), defuse: new Set() };
    if (w.phase === 'end' || w.phase === 'over') {
      for (const p of w.people) if (p.brain) this.clear(p.brain);
      return orders;
    }
    if (w.phase === 'buy') return orders;
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
        if (f) this.note(p.side, f.x, f.z, w.now);
      }
    }

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
          this.holdsPlanted = fsBotHolds(bp.x, bp.z, 14, 8);
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
      const m = siteMark(r.site);
      const siteHolds = fsBotHolds(m.x, m.z);
      if (r.kind === 'carrier') {
        b.objective = [m.x, m.z];
        b.sneak = r.sneak && Math.hypot(p.x - m.x, p.z - m.z) < 28 && !fighting;
        const inSite = fsSiteAt(p.x, p.z);
        if (inSite) {
          const arrived = this.arrivedAt.get(p.id) ?? w.now;
          this.arrivedAt.set(p.id, arrived);
          const waited = w.now - arrived;
          const mates = trBots.filter((o) => o.id !== p.id && Math.hypot(o.x - p.x, o.z - p.z) < 11).length;
          const clear = !fighting && b.lostT > (sk.sense > 0.5 ? 1.5 : 0.6);
          // craque espera o time chegar (ou o tempo apertar); novato planta assim que chega
          const covered = sk.sense < 0.5 || mates > 0 || waited > 4 || trBots.length === 1;
          const late = timeLeft < 35;
          const nearEnemy = defenders.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 9 && fsClearLine(FS_DUST_SOLIDS, [p.x, 1.1, p.z], [o.x, 1.1, o.z]));
          if (clear && (covered || late) && (!nearEnemy || late)) orders.plant.add(p.id);
        } else this.arrivedAt.delete(p.id);
        continue;
      }
      if (r.kind === 'follow' && carrierP && carrierP.alive && Math.hypot(carrierP.x - p.x, carrierP.z - p.z) > 6) {
        b.objective = [carrierP.x, carrierP.z];
        b.sneak = false;
        continue;
      }
      const siteTarget = r.kind === 'lurk' ? fsBotHolds(siteMark(r.site).x, siteMark(r.site).z) : siteHolds;
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
    // rotação: CT que vê o inimigo numa bomba chama quem está na outra
    const hotSite = (['A', 'B'] as const).reduce<SiteId | null>((acc, s) => (w.now - this.seen.ct[s].t < 8 && (acc === null || this.seen.ct[s].t > this.seen.ct[acc].t) ? s : acc), null);
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
          this.holdsPlanted = fsBotHolds(bp.x, bp.z, 14, 8);
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
      // antes do plantio: rotação e postos
      if (sk.sense > 0.45 && hotSite && !r.rotated && r.site !== hotSite && (r.kind !== 'defend' || ctBots.filter((o) => this.roles.get(o.id)?.site === r.site).length > 1)) {
        r.site = hotSite;
        r.rotated = true;
        r.hold = (ctBots.length + p.id.length) % 6;
        r.kind = 'defend';
        r.sneak = false;
      }
      if (r.kind === 'rotator' && !hotSite) {
        // sem notícia: fica no meio, entre as duas bombas
        const a = siteMark('A');
        const c = siteMark('B');
        const [fc, fr] = fsDustNearestFree((a.x + c.x) / 2, (a.z + c.z) / 2 + 6);
        b.objective = [fsDustCellX(fc), fsDustCellZ(fr)];
        b.sneak = r.sneak && !fighting;
        b.lookAt = null;
        continue;
      }
      const site = r.kind === 'rotator' && hotSite ? hotSite : r.site;
      const m = siteMark(site);
      const holds = fsBotHolds(m.x, m.z);
      const h = holds[r.hold % holds.length]!;
      b.objective = [h.x, h.z];
      const dist = Math.hypot(p.x - h.x, p.z - h.z);
      b.sneak = r.sneak && !fighting && r.kind !== 'rotator' && !r.rotated && dist < 35;
      b.holdCrouch = r.crouch && dist < 2.5;
      b.lookAt = [m.x, m.z];
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
