/**
 * Simulação autoritativa do mata-mata online do Counter Fox (spec 057). A sala (servidor) roda isto e é quem manda: cada pessoa
 * só envia as entradas (teclas, mira, botões); o servidor anda o corpo com o mesmo movimento do jogo (`fsStepMover`), cuida das
 * armas (`FsLoadout`), acerta os tiros (com compensação de atraso: o alvo é olhado onde estava na tela de quem atirou), calcula o
 * dano, os pontos e o renascimento, e roda os bots (`fsDmStep`). Lógica pura: sem relógio nem rede (quem chama chama `step()` 60
 * vezes por segundo e manda `snapshot()` para todo mundo cerca de 20 vezes por segundo).
 */
import { fsAssister, type FsDamageEntry } from './assist';
import { fsFlinch, fsFlinchAt, fsIsBackstab } from './damage';
import { FS_DUST_BOXES, fsPickSpawn } from './dust';
import { fsDmFlash, fsDmHear, fsDmHurt, fsDmNew, fsDmPickWeapon, fsDmStep, type FsDmBrain, type FsDmFoe } from './dm';
import { fsClearLine, fsFlashEffect, fsFragDamage, fsGrenadeLaunch, fsGrenadeStep, FS_GRENADES, type FsGrenadeBody, type FsGrenadeId } from './grenades';
import { FsLoadout } from './gun';
import { FS_RESPAWN_S, fsMatchConfig, fsMatchResult, fsMatchScore, type FsMatchConfig, type FsMatchRow } from './match';
import { FS_MOVE, fsEyeHeight, fsNewMover, fsStepMover, type FsMover } from './movement';
import { fsBuy } from './shop';
import { fsDir, fsTrace, type FsBody, type Vec3 } from './trace';
import { FS_WEAPONS, type FsWeaponId } from './weapons';
import type { FsBox } from './map';

/** Passos por segundo da simulação e passo em segundos. */
export const FS_NET_HZ = 60;
export const FS_NET_DT = 1 / FS_NET_HZ;
/** Quanto o servidor volta no tempo para acertar um tiro (compensação de atraso), no máximo, em passos (250 ms). */
export const FS_NET_REWIND_MAX = 15;
/** Fila de entradas por jogador: acima disso as mais velhas se perdem (a pessoa está muito atrasada). */
const QUEUE_MAX = 12;

/** Um comando que viaja junto da entrada (trocar de arma, comprar). */
export type FsNetCmd = { t: 'slot'; i: number } | { t: 'nade'; k: FsGrenadeId | 'next' } | { t: 'cycle'; d: 1 | -1 } | { t: 'buy'; id: string };

/** A entrada de um passo de 1/60 s, como o aparelho a leu. */
export interface FsNetInput {
  seq: number;
  fwd: number;
  strafe: number;
  jump: boolean;
  crouch: boolean;
  walk: boolean;
  /** Para onde olha (graus; já com o recuo): vem do aparelho. */
  yaw: number;
  pitch: number;
  trigger: boolean;
  alt: boolean;
  reload: boolean;
  inspect: boolean;
  /** Passo do servidor que o aparelho estava mostrando (para a compensação de atraso). */
  viewTick: number;
  cmds?: FsNetCmd[];
}

export type FsNetEvent =
  | { k: 'shot'; by: string; from: Vec3; to: Vec3; w: FsWeaponId }
  | { k: 'hit'; by: string; vic: string; dmg: number; head: boolean; armor: boolean; kill: boolean }
  | { k: 'hurt'; vic: string; by: string; x: number; z: number; dmg: number; head: boolean }
  | { k: 'kill'; killer: string; victim: string; w: FsWeaponId | FsGrenadeId; head: boolean; assist: string | null; wall: boolean; noscope: boolean; blind: boolean }
  | { k: 'spawn'; id: string; x: number; z: number }
  | { k: 'nade'; id: number; by: string; kind: FsGrenadeId }
  | { k: 'boom'; id: number; kind: FsGrenadeId; x: number; y: number; z: number }
  | { k: 'flash'; vic: string; blind: number; deaf: number }
  | { k: 'melee'; by: string; kind: 'slash' | 'stab' | 'backstab' }
  | { k: 'over' };

interface Hist {
  tick: number;
  x: number;
  y: number;
  z: number;
  crouch: number;
  yaw: number;
}

export interface FsNetPlayer {
  id: string;
  name: string;
  bot: boolean;
  mover: FsMover;
  yaw: number;
  pitch: number;
  hp: number;
  armor: number;
  helmet: boolean;
  alive: boolean;
  respawnAt: number;
  loadout: FsLoadout;
  kills: number;
  assists: number;
  deaths: number;
  hs: number;
  damage: number;
  queue: FsNetInput[];
  last: FsNetInput | null;
  lastSeq: number;
  hist: Hist[];
  brain: FsDmBrain | null;
  dmgLog: FsDamageEntry[];
  flinch: { mul: number; dur: number };
  flinchAt: number;
  /** Atirou há pouco (animação do corpo dos outros). */
  firedAt: number;
  /** Última vez que chegou entrada (para marcar quem saiu). */
  heardAt: number;
  /** Time (só a cor por enquanto, o mata-mata é de todos contra todos): 0 contra-terrorista (azul), 1 terrorista (laranja). */
  team: 0 | 1;
  /** Até que tick está cego (luz de granada): o abate sai com o ícone de cego no kill feed. */
  blindUntil: number;
}

export interface FsNetOptions {
  minutes: number;
  humans: { id: string; name: string }[];
  bots: number;
  rng?: () => number;
  boxes?: readonly FsBox[];
}

const WEAPON_IDS: readonly FsWeaponId[] = ['ak', 'pistol', 'sniper', 'knife', 'smg', 'shotgun', 'm4', 'usp'];
export const fsNetWeaponIndex = (id: FsWeaponId) => WEAPON_IDS.indexOf(id);
export const fsNetWeaponId = (i: number): FsWeaponId => WEAPON_IDS[i] ?? 'pistol';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Confere e limpa uma entrada que veio da rede (nada de número absurdo). Devolve null se não presta. */
export function fsNetParseInput(raw: unknown): FsNetInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!finite(o.seq) || !finite(o.fwd) || !finite(o.strafe) || !finite(o.yaw) || !finite(o.pitch)) return null;
  const cmds: FsNetCmd[] = [];
  if (Array.isArray(o.cmds)) {
    for (const c of o.cmds.slice(0, 4)) {
      const q = c as Record<string, unknown>;
      if (q?.t === 'slot' && finite(q.i) && q.i >= 0 && q.i <= 2) cmds.push({ t: 'slot', i: Math.floor(q.i) });
      else if (q?.t === 'nade' && (q.k === 'frag' || q.k === 'flash' || q.k === 'next')) cmds.push({ t: 'nade', k: q.k });
      else if (q?.t === 'cycle' && (q.d === 1 || q.d === -1)) cmds.push({ t: 'cycle', d: q.d });
      else if (q?.t === 'buy' && typeof q.id === 'string' && q.id.length < 24) cmds.push({ t: 'buy', id: q.id });
    }
  }
  return {
    seq: Math.floor(o.seq),
    fwd: clamp(o.fwd, -1, 1),
    strafe: clamp(o.strafe, -1, 1),
    jump: !!o.jump,
    crouch: !!o.crouch,
    walk: !!o.walk,
    yaw: ((o.yaw % 360) + 360) % 360,
    pitch: clamp(o.pitch, -88, 88),
    trigger: !!o.trigger,
    alt: !!o.alt,
    reload: !!o.reload,
    inspect: !!o.inspect,
    viewTick: finite(o.viewTick) ? Math.floor(o.viewTick) : 0,
    cmds,
  };
}

export class FsNetSim {
  tick = 0;
  readonly cfg: FsMatchConfig;
  readonly endTick: number;
  readonly boxes: readonly FsBox[];
  readonly players = new Map<string, FsNetPlayer>();
  /** Ordem fixa dos jogadores (o índice vai nos pacotes). */
  readonly roster: { id: string; name: string; bot: boolean }[] = [];
  readonly grenades: { id: number; owner: string; body: FsGrenadeBody }[] = [];
  private events: FsNetEvent[] = [];
  private nadeSeq = 0;
  /** Quantas pessoas já entraram: a 1ª é contra-terrorista (azul), a 2ª terrorista (laranja), a 3ª azul... */
  private humansIn = 0;
  private rng: () => number;
  over = false;

  constructor(opts: FsNetOptions) {
    const base = fsMatchConfig(opts.minutes, 1);
    this.cfg = { minutes: base.minutes, bots: Math.max(0, Math.min(9, Math.round(Number.isFinite(opts.bots) ? opts.bots : 0))) };
    this.endTick = this.cfg.minutes * 60 * FS_NET_HZ;
    this.boxes = opts.boxes ?? FS_DUST_BOXES;
    this.rng = opts.rng ?? Math.random;
    const humans = opts.humans.slice(0, 10);
    const botCount = Math.max(0, Math.min(this.cfg.bots, 10 - humans.length));
    const placed: { x: number; z: number }[] = [];
    for (const h of humans) this.addPlayer(h.id, h.name, false, placed);
    // os bots seguem a mesma alternância depois das pessoas
    for (let i = 0; i < botCount; i++) this.addPlayer(`b${i + 1}`, `Bot ${i + 1}`, true, placed, ((humans.length + i) % 2) as 0 | 1);
  }

  private addPlayer(id: string, name: string, bot: boolean, placed: { x: number; z: number }[], botTeam: 0 | 1 = 0) {
    const sp = fsPickSpawn(placed, this.rng, this.boxes);
    placed.push({ x: sp.x, z: sp.z });
    const mover = fsNewMover(sp.x, sp.z);
    mover.y = sp.y;
    const p: FsNetPlayer = {
      id, name, bot, mover, yaw: sp.yaw, pitch: 0, hp: 100, armor: 0, helmet: false, alive: true, respawnAt: 0,
      loadout: new FsLoadout(null, 'pistol'), kills: 0, assists: 0, deaths: 0, hs: 0, damage: 0, queue: [], last: null, lastSeq: 0,
      hist: [], brain: null, dmgLog: [], flinch: { mul: 1, dur: 0 }, flinchAt: -1e9, firedAt: -1e9, heardAt: 0, team: bot ? botTeam : ((this.humansIn++ % 2) as 0 | 1), blindUntil: 0,
    };
    if (bot) {
      p.brain = fsDmNew(id, sp.x, sp.z, sp.yaw, fsDmPickWeapon(this.rng), this.rng, sp.y);
      this.dressBot(p);
    }
    this.players.set(id, p);
    this.roster.push({ id, name, bot });
  }

  private dressBot(p: FsNetPlayer) {
    const vest = this.rng() < 0.55;
    p.armor = vest ? 100 : 0;
    p.helmet = vest && this.rng() < 0.5;
  }

  /** Quem saiu no meio da partida vira bot (o corpo não fica parado esperando tiro). */
  takeOver(id: string): void {
    const p = this.players.get(id);
    if (!p || p.bot) return;
    p.bot = true;
    p.queue = [];
    const w = p.loadout.weapon.melee ? 'pistol' : (p.loadout.weapon.id as Exclude<FsWeaponId, 'knife'>);
    p.brain = fsDmNew(id, p.mover.x, p.mover.z, p.yaw, w, this.rng, p.mover.y);
    p.brain.mover = p.mover;
    const r = this.roster.find((q) => q.id === id);
    if (r) r.bot = true;
  }

  /**
   * Quem chega no meio da partida pede para jogar: volta ao corpo que virou bot (se saiu daqui), toma o lugar de um bot
   * ou, se ainda houver vaga (máx. 10 no total), ganha uma raposa nova. Sem vaga, devolve false (fica espectando).
   */
  joinAs(id: string, name: string): boolean {
    const mine = this.players.get(id);
    if (mine) {
      if (!mine.bot) return true;
      mine.bot = false;
      mine.brain = null;
      mine.queue = [];
      mine.last = null;
      mine.heardAt = this.tick;
      const r = this.roster.find((q) => q.id === id);
      if (r) r.bot = false;
      return true;
    }
    const slot = this.roster.findIndex((r) => r.bot);
    if (slot < 0) {
      if (this.roster.length >= 10) return false;
      const placed = [...this.players.values()].filter((q) => q.alive).map((q) => ({ x: q.mover.x, z: q.mover.z }));
      this.addPlayer(id, name, false, placed);
      return true;
    }
    // toma o lugar do bot de menos pontos (o índice no pacote continua o mesmo)
    const old = this.roster
      .map((r, i) => ({ r, i, q: this.players.get(r.id)! }))
      .filter((x) => x.r.bot)
      .sort((a, b) => fsMatchScore(a.q) - fsMatchScore(b.q))[0]!;
    const p = old.q;
    this.players.delete(old.r.id);
    p.id = id;
    p.name = name;
    p.bot = false;
    p.brain = null;
    p.kills = p.assists = p.deaths = p.hs = p.damage = 0;
    p.lastSeq = 0;
    p.loadout = new FsLoadout(null, 'pistol');
    p.dmgLog = [];
    p.heardAt = this.tick;
    p.team = (this.humansIn++ % 2) as 0 | 1;
    this.players.set(id, p);
    this.roster[old.i] = { id, name, bot: false };
    this.respawn(p);
    return true;
  }

  // ---------------------------------------------------------------- entrada

  /** Entrada de uma pessoa (confira com `fsNetParseInput` antes). Ignora a que já passou (número menor que o último). */
  pushInput(id: string, inp: FsNetInput): void {
    const p = this.players.get(id);
    if (!p || p.bot) return;
    p.heardAt = this.tick;
    if (inp.seq <= p.lastSeq && !p.queue.some((q) => q.seq === inp.seq)) {
      // já usada (pacote repetido)
      return;
    }
    if (p.queue.some((q) => q.seq === inp.seq)) return;
    p.queue.push(inp);
    p.queue.sort((a, b) => a.seq - b.seq);
    while (p.queue.length > QUEUE_MAX) p.queue.shift();
  }

  // ---------------------------------------------------------------- o passo

  /** Anda a partida um passo (1/60 s). */
  step(): void {
    if (this.over) return;
    this.tick++;
    const foesForBots = (self: string): FsDmFoe[] => {
      const out: FsDmFoe[] = [];
      for (const q of this.players.values()) {
        if (q.id === self || !q.alive) continue;
        const sp = Math.hypot(q.mover.vx, q.mover.vz);
        out.push({ id: q.id, x: q.mover.x, y: q.mover.y, z: q.mover.z, crouch: q.mover.crouchK, noisy: sp > 3.4 && q.mover.crouchK < 0.5 && q.mover.onGround });
      }
      return out;
    };
    for (const p of this.players.values()) {
      if (!p.alive) {
        if (this.tick >= p.respawnAt) this.respawn(p);
        continue;
      }
      if (p.bot) this.stepBot(p, foesForBots(p.id));
      else this.stepHuman(p);
      p.hist.push({ tick: this.tick, x: p.mover.x, y: p.mover.y, z: p.mover.z, crouch: p.mover.crouchK, yaw: p.yaw });
      if (p.hist.length > 40) p.hist.shift();
    }
    this.stepGrenades();
    if (this.tick >= this.endTick) {
      this.over = true;
      this.events.push({ k: 'over' });
    }
  }

  private stepHuman(p: FsNetPlayer) {
    let inp = p.queue.shift() ?? null;
    if (inp) {
      p.lastSeq = inp.seq;
      p.last = inp;
    } else if (p.last) {
      // sem entrada nova: repete a última (andar continua, mas ações pontuais não se repetem)
      inp = { ...p.last, jump: false, cmds: [] };
    } else return;
    for (const c of inp.cmds ?? []) this.runCmd(p, c);
    p.yaw = inp.yaw;
    p.pitch = inp.pitch;
    const lo = p.loadout;
    const adsOn = inp.alt && !lo.reloading && !lo.weapon.melee;
    const mul = lo.weapon.moveMul * (adsOn ? 0.65 : 1) * fsFlinchAt(p.flinch, (this.tick - p.flinchAt) / FS_NET_HZ);
    // o passo de 1/60 s se divide em dois de 1/120 s, igual ao aparelho
    for (let i = 0; i < 2; i++) {
      fsStepMover(p.mover, { fwd: inp.fwd, strafe: inp.strafe, jump: inp.jump && i === 0, yaw: inp.yaw, speedMul: mul, crouch: inp.crouch, walk: inp.walk }, 1 / 120, this.boxes);
    }
    const speed = Math.hypot(p.mover.vx, p.mover.vz);
    const evs = lo.update(FS_NET_DT, { trigger: inp.trigger, reload: inp.reload, alt: inp.alt, inspect: inp.inspect }, { moving: speed > 0.8, airborne: !p.mover.onGround, ads: adsOn, speed, crouch: p.mover.crouchK > 0.5 }, p.id);
    for (const e of evs) {
      if (e.type === 'fire') {
        const rays = e.shot.pellets ?? [{ devYaw: e.shot.devYaw, devPitch: e.shot.devPitch }];
        this.fire(p, e.weapon.id, rays.map((r) => fsDir(inp!.yaw + r.devYaw, inp!.pitch + r.devPitch)), inp.viewTick, undefined, adsOn && e.weapon.adsFov > 0);
      } else if (e.type === 'melee') this.melee(p, e.kind, inp.viewTick);
      else if (e.type === 'throw') {
        const dir = fsDir(inp.yaw, inp.pitch);
        const eye: Vec3 = [p.mover.x, p.mover.y + fsEyeHeight(p.mover), p.mover.z];
        const origin: Vec3 = [eye[0] + dir[0] * 0.4, eye[1] - 0.15 + dir[1] * 0.4 - (e.style === 'near' ? 0.35 : 0), eye[2] + dir[2] * 0.4];
        this.throwNade(p, e.grenade, origin, dir, e.power);
      }
    }
  }

  private runCmd(p: FsNetPlayer, c: FsNetCmd) {
    const lo = p.loadout;
    if (c.t === 'slot') lo.switchTo(c.i);
    else if (c.t === 'nade') lo.selectGrenade(c.k);
    else if (c.t === 'cycle') lo.cycleAll(c.d);
    else if (c.t === 'buy') {
      const r = fsBuy(lo, c.id);
      if (r.ok && r.armor) {
        p.armor = r.armor.points;
        p.helmet = p.helmet || r.armor.helmet;
      }
    }
  }

  private stepBot(p: FsNetPlayer, foes: FsDmFoe[]) {
    const b = p.brain!;
    const acts = fsDmStep(b, { now: this.tick / FS_NET_HZ, dt: FS_NET_DT, rng: this.rng, boxes: this.boxes, foes });
    p.mover = b.mover;
    p.yaw = b.yaw;
    p.pitch = b.pitch;
    for (const a of acts) {
      if (a.type === 'fire') {
        p.firedAt = this.tick;
        this.fire(p, a.weapon, a.rays, this.tick, a.origin);
      } else if (a.type === 'throw') this.throwNade(p, a.kind, a.origin, a.dir, a.power, true);
    }
  }

  // ---------------------------------------------------------------- tiro

  /** Os corpos dos outros como estavam em `viewTick` (compensação de atraso), limitado a 250 ms. */
  private bodiesAt(self: string, viewTick: number): FsBody[] {
    const t = clamp(viewTick, this.tick - FS_NET_REWIND_MAX, this.tick);
    const out: FsBody[] = [];
    for (const q of this.players.values()) {
      if (q.id === self) continue;
      let h: Hist | undefined;
      for (let i = q.hist.length - 1; i >= 0; i--) {
        if (q.hist[i]!.tick <= t) {
          h = q.hist[i];
          break;
        }
      }
      const x = h?.x ?? q.mover.x;
      const y = h?.y ?? q.mover.y;
      const z = h?.z ?? q.mover.z;
      const yaw = h?.yaw ?? q.yaw;
      const yr = (yaw * Math.PI) / 180;
      out.push({ id: q.id, pos: [x, y, z], alive: q.alive, armor: q.armor, helmet: q.helmet, crouch: h?.crouch ?? q.mover.crouchK, facing: [-Math.sin(yr), -Math.cos(yr)] });
    }
    return out;
  }

  private fire(p: FsNetPlayer, wid: FsWeaponId, rays: Vec3[], viewTick: number, originOverride?: Vec3, scoped = true) {
    const w = FS_WEAPONS[wid];
    p.firedAt = this.tick;
    const eye: Vec3 = originOverride ?? [p.mover.x, p.mover.y + fsEyeHeight(p.mover), p.mover.z];
    const bodies = this.bodiesAt(p.id, viewTick);
    const pool = new Map<string, { hp: number; armorLoss: number; head: boolean; armorHit: boolean; wall: boolean }>();
    // abate de sniper sem a luneta é "sem mirar" (ícone no kill feed)
    const noscope = wid === 'sniper' && !scoped;
    for (const dir of rays) {
      const tr = fsTrace(w, eye, dir, this.boxes, bodies);
      this.events.push({ k: 'shot', by: p.id, from: eye.map(r2) as Vec3, to: tr.point.map(r2) as Vec3, w: wid });
      if (tr.kind === 'player' && tr.targetId && tr.damage) {
        const c = pool.get(tr.targetId) ?? { hp: 0, armorLoss: 0, head: false, armorHit: false, wall: false };
        c.hp += tr.damage.hp;
        c.armorLoss += tr.damage.armorLoss;
        c.head = c.head || tr.zone === 'head';
        c.armorHit = c.armorHit || tr.damage.protectedByArmor;
        c.wall = c.wall || tr.wall < 1;
        pool.set(tr.targetId, c);
      }
    }
    for (const [vid, d] of pool) this.damage(vid, p.id, d.hp, d.armorLoss, d.head, wid, d.armorHit, undefined, { wall: d.wall, noscope });
    // quem está por perto ouve
    for (const q of this.players.values()) if (q.brain && q.id !== p.id) fsDmHear(q.brain, wid, p.mover.x, p.mover.z);
  }

  private melee(p: FsNetPlayer, kind: 'slash' | 'stab', viewTick: number) {
    const kw = FS_WEAPONS.knife;
    const eye: Vec3 = [p.mover.x, p.mover.y + fsEyeHeight(p.mover), p.mover.z];
    const dir = fsDir(p.yaw, p.pitch);
    const bodies = this.bodiesAt(p.id, viewTick);
    const w = kind === 'stab' ? { ...kw, damage: kw.melee!.stab } : kw;
    let tr = fsTrace(w, eye, dir, this.boxes, bodies, kw.melee!.range);
    let back = false;
    if (kind === 'stab' && tr.kind === 'player' && tr.targetId) {
      const body = bodies.find((b) => b.id === tr.targetId);
      if (body?.facing && fsIsBackstab(body.facing, [body.pos[0], body.pos[2]], [p.mover.x, p.mover.z])) {
        back = true;
        tr = fsTrace({ ...kw, damage: kw.melee!.backstab }, eye, dir, this.boxes, bodies, kw.melee!.range);
      }
    }
    this.events.push({ k: 'melee', by: p.id, kind: back ? 'backstab' : kind });
    if (tr.kind === 'player' && tr.targetId && tr.damage) this.damage(tr.targetId, p.id, tr.damage.hp, 0, false, 'knife', false);
  }

  // ---------------------------------------------------------------- dano, pontos e renascer

  /** Tira vida de `vic` por causa de `by`. Cuida de colete, abate, assistência, pontos e do renascimento. */
  damage(vic: string, by: string, hp: number, armorLoss: number, head: boolean, w: FsWeaponId | FsGrenadeId, armorHit: boolean, at?: { x: number; z: number }, mods?: { wall?: boolean; noscope?: boolean }): void {
    const v = this.players.get(vic);
    const a = this.players.get(by);
    if (!v || !v.alive || this.over) return;
    v.dmgLog.push({ attacker: by, time: this.tick / FS_NET_HZ });
    if (v.dmgLog.length > 24) v.dmgLog.shift();
    const dealt = Math.min(v.hp, hp);
    v.hp -= hp;
    v.armor = Math.max(0, v.armor - armorLoss);
    if (a && a !== v) a.damage += dealt;
    if (hp > 0) {
      v.flinch = fsFlinch(hp);
      v.flinchAt = this.tick;
    }
    const src = at ?? (a ? { x: a.mover.x, z: a.mover.z } : { x: v.mover.x, z: v.mover.z });
    this.events.push({ k: 'hurt', vic, by, x: r2(src.x), z: r2(src.z), dmg: hp, head });
    if (v.brain && a && a !== v) fsDmHurt(v.brain, src.x, src.z);
    const kill = v.hp <= 0;
    this.events.push({ k: 'hit', by, vic, dmg: hp, head, armor: armorHit, kill });
    if (!kill) return;
    v.hp = 0;
    v.alive = false;
    v.deaths++;
    v.respawnAt = this.tick + Math.round(FS_RESPAWN_S * FS_NET_HZ);
    const self = vic === by;
    const as = self ? null : fsAssister(v.dmgLog, by, this.tick / FS_NET_HZ);
    v.dmgLog = [];
    if (a && !self) {
      a.kills++;
      if (head) a.hs++;
    }
    const asP = as ? this.players.get(as) : undefined;
    if (asP) asP.assists++;
    this.events.push({ k: 'kill', killer: by, victim: vic, w, head, assist: as, wall: !!mods?.wall, noscope: !!mods?.noscope, blind: !!a && a !== v && a.blindUntil > this.tick });
    // o que ele segurava some do mundo (as granadas no ar continuam)
    v.queue = [];
  }

  private respawn(p: FsNetPlayer) {
    const foes = [...this.players.values()].filter((q) => q.alive && q.id !== p.id).map((q) => ({ x: q.mover.x, z: q.mover.z }));
    const sp = fsPickSpawn(foes, this.rng, this.boxes);
    p.hp = 100;
    p.armor = 0;
    p.helmet = false;
    p.alive = true;
    p.mover = fsNewMover(sp.x, sp.z);
    p.mover.y = sp.y;
    p.yaw = sp.yaw;
    p.pitch = 0;
    p.flinchAt = -1e9;
    p.hist = [];
    p.last = null;
    p.queue = [];
    if (p.bot) {
      p.brain = fsDmNew(p.id, sp.x, sp.z, sp.yaw, fsDmPickWeapon(this.rng), this.rng, sp.y);
      p.mover = p.brain.mover;
      this.dressBot(p);
    }
    this.events.push({ k: 'spawn', id: p.id, x: r2(sp.x), z: r2(sp.z) });
  }

  // ---------------------------------------------------------------- granadas

  private throwNade(p: FsNetPlayer, kind: FsGrenadeId, origin: Vec3, dir: Vec3, power: number, bot = false) {
    const body = fsGrenadeLaunch(kind, origin, dir, power, [p.mover.vx, p.mover.vz]);
    const id = ++this.nadeSeq;
    this.grenades.push({ id, owner: p.id, body });
    this.events.push({ k: 'nade', id, by: p.id, kind });
    void bot;
  }

  private stepGrenades() {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i]!;
      let boom = false;
      for (let k = 0; k < 2 && !boom; k++) boom = fsGrenadeStep(g.body, FS_NET_DT / 2, this.boxes);
      if (!boom) continue;
      this.grenades.splice(i, 1);
      this.explode(g);
    }
  }

  private explode(g: { id: number; owner: string; body: FsGrenadeBody }) {
    const b = g.body;
    const blast: Vec3 = [b.x, b.y + 0.25, b.z];
    this.events.push({ k: 'boom', id: g.id, kind: b.kind, x: r2(b.x), y: r2(b.y), z: r2(b.z) });
    for (const q of [...this.players.values()]) {
      if (!q.alive) continue;
      if (b.kind === 'frag') {
        const c: Vec3 = [q.mover.x, q.mover.y + 0.6, q.mover.z];
        const dmg = fsFragDamage(Math.hypot(c[0] - blast[0], c[1] - blast[1], c[2] - blast[2]));
        if (dmg > 0 && fsClearLine(this.boxes, blast, c)) this.damage(q.id, g.owner, dmg, 0, false, 'frag', false, { x: b.x, z: b.z });
      } else {
        const eye: Vec3 = [q.mover.x, q.mover.y + fsEyeHeight(q.mover), q.mover.z];
        const r = fsFlashEffect(eye, fsDir(q.yaw, q.pitch), blast, fsClearLine(this.boxes, eye, blast), FS_GRENADES.flash.radius);
        if (r.blind > 0 || r.deaf > 0) this.events.push({ k: 'flash', vic: q.id, blind: r.blind, deaf: r.deaf });
        if (r.blind > 0) q.blindUntil = Math.max(q.blindUntil, this.tick + Math.round(r.blind * FS_NET_HZ));
        if (q.brain && r.blind > 0) fsDmFlash(q.brain, this.tick / FS_NET_HZ + r.blind);
      }
    }
  }

  // ---------------------------------------------------------------- o que sai para a rede

  /** Os eventos desde a última chamada (esvazia a lista). */
  drainEvents(): FsNetEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Pontos e abates de todo mundo, ordenados (placar e tela final). */
  results(): FsMatchRow[] {
    return fsMatchResult([...this.players.values()].map((p) => ({ id: p.id, name: p.name, kills: p.kills, assists: p.assists, deaths: p.deaths })));
  }

  /**
   * O quadro de todo mundo (vai a todos). Cada jogador é uma linha de números inteiros pequenos:
   * [índice, x·100, y·100, z·100, yaw·10, pitch·10, vida, colete, bandeiras, arma, agachado·100, último número de entrada, abates, assist., mortes]
   * Bandeiras: 1 vivo, 2 capacete, 4 bot, 8 atirou agora há pouco, 16 recarregando, 32 no chão, 64 andando, 128 terrorista (laranja; sem a bandeira é contra-terrorista, azul).
   */
  frame(): { k: number; left: number; p: number[][]; g: number[][] } {
    const p: number[][] = [];
    this.roster.forEach((r, i) => {
      const q = this.players.get(r.id)!;
      const sp = Math.hypot(q.mover.vx, q.mover.vz);
      const flags = (q.alive ? 1 : 0) | (q.helmet ? 2 : 0) | (q.bot ? 4 : 0) | (this.tick - q.firedAt < 12 ? 8 : 0) | (!q.bot && q.loadout.reloading ? 16 : 0) | (q.mover.onGround ? 32 : 0) | (sp > 0.8 ? 64 : 0) | (q.team === 1 ? 128 : 0);
      const wid = q.bot ? q.brain!.weapon : q.loadout.weapon.id;
      p.push([
        i, Math.round(q.mover.x * 100), Math.round(q.mover.y * 100), Math.round(q.mover.z * 100),
        Math.round((((q.yaw + 180) % 360) - 180) * 10), Math.round(q.pitch * 10), Math.max(0, Math.round(q.hp)), Math.round(q.armor), flags,
        fsNetWeaponIndex(wid), Math.round(q.mover.crouchK * 100), q.lastSeq, q.kills, q.assists, q.deaths,
      ]);
    });
    const g = this.grenades.map((n) => [n.id, n.body.kind === 'frag' ? 0 : 1, Math.round(n.body.x * 100), Math.round(n.body.y * 100), Math.round(n.body.z * 100)]);
    return { k: this.tick, left: Math.max(0, this.endTick - this.tick), p, g };
  }

  /** O que só a própria pessoa precisa (para a previsão e para a tela): corpo exato, armas e granadas. */
  selfState(id: string) {
    const q = this.players.get(id);
    if (!q) return null;
    const lo = q.loadout;
    return {
      x: r2(q.mover.x), y: r2(q.mover.y), z: r2(q.mover.z), vx: r2(q.mover.vx), vy: r2(q.mover.vy), vz: r2(q.mover.vz),
      og: q.mover.onGround, ck: r2(q.mover.crouchK), seq: q.lastSeq, yaw: r2(q.yaw), pitch: r2(q.pitch), hp: Math.max(0, Math.round(q.hp)), armor: Math.round(q.armor), helmet: q.helmet, alive: q.alive,
      respawnIn: q.alive ? 0 : Math.max(0, (q.respawnAt - this.tick) / FS_NET_HZ),
      cur: lo.current, held: lo.held, ammo: lo.held ? lo.grenades[lo.held] : lo.slot.ammo, reloading: lo.reloading,
      slots: lo.slots.map((s) => (s ? fsNetWeaponIndex(s.id) : -1)),
      nades: { ...lo.grenades },
      flinch: q.flinch, flinchAt: q.flinchAt / FS_NET_HZ * 1, tickNow: this.tick,
    };
  }

  /** Pontos de uma pessoa (atalho para testes e tela). */
  points(id: string): number {
    const q = this.players.get(id);
    return q ? fsMatchScore(q) : 0;
  }
}

export { FS_MOVE };
