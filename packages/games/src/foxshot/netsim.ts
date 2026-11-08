/**
 * Simulação autoritativa do mata-mata online do Counter Fox (spec 057). A sala (servidor) roda isto e é quem manda: cada pessoa
 * só envia as entradas (teclas, mira, botões); o servidor anda o corpo com o mesmo movimento do jogo (`fsStepMover`), cuida das
 * armas (`FsLoadout`), acerta os tiros (com compensação de atraso: o alvo é olhado onde estava na tela de quem atirou), calcula o
 * dano, os pontos e o renascimento, e roda os bots (`fsDmStep`). Lógica pura: sem relógio nem rede (quem chama chama `step()` 60
 * vezes por segundo e manda `snapshot()` para todo mundo cerca de 20 vezes por segundo).
 */
import { fsAssister, type FsDamageEntry } from './assist';
import { fsFlinch, fsFlinchAt, fsIsBackstab } from './damage';
import type { FsSpawn } from './spawn';
import { fsMapById, type FsMapApi } from './maps';
import { FsBombMatch, fsBombBlastDamage, fsOtherSide, type FsBombConfig, type FsSide } from './bomb';
import { fsBotLevelAt, fsDmFlash, fsDmHear, fsDmHurt, fsDmNew, fsDmPickWeapon, fsDmStep, type FsBotLevel, type FsDmBrain, type FsDmFoe } from './dm';
import { FsBombTactics } from './bombbots';
import { fsClearLine, fsFlashEffect, fsFragDamage, fsGrenadeLaunch, fsGrenadeStep, FS_GRENADES, type FsGrenadeBody, type FsGrenadeId } from './grenades';
import { FsLoadout } from './gun';
import { FS_RESPAWN_S, fsMatchConfig, fsMatchResult, fsMatchScore, type FsMatchConfig, type FsMatchRow } from './match';
import { FS_MOVE, fsEyeHeight, fsNewMover, fsStepMover, type FsMover } from './movement';
import { FS_SHOP, fsBuy, fsShopItem, fsShopPrice } from './shop';
import { fsDir, fsTrace, type FsBody, type Vec3 } from './trace';
import { FS_WEAPONS, type FsWeaponId } from './weapons';
import type { FsBox } from './map';

/** Passos por segundo da simulação e passo em segundos. */
export const FS_NET_HZ = 60;
/** Fração do dano que o fogo amigo causa no modo Bomba. */
export const FS_FRIENDLY_FIRE = 0.25;
export const FS_NET_DT = 1 / FS_NET_HZ;
/** Quanto o servidor volta no tempo para acertar um tiro (compensação de atraso), no máximo, em passos (250 ms). */
export const FS_NET_REWIND_MAX = 30;
/** Fila de entradas por jogador: acima disso as mais velhas se perdem (a pessoa está muito atrasada). */
const QUEUE_MAX = 12;

/** Um comando que viaja junto da entrada (trocar de arma, comprar). */
export type FsNetCmd = { t: 'dropbomb' } | { t: 'bombslot' } | { t: 'slot'; i: number } | { t: 'nade'; k: FsGrenadeId | 'next' } | { t: 'cycle'; d: 1 | -1 } | { t: 'buy'; id: string } | { t: 'suicide' };

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
  /** Segurar E: planta e desarma a bomba (modo Bomba). */
  use?: boolean;
  /** Passo do servidor que o aparelho estava mostrando (para a compensação de atraso). */
  viewTick: number;
  /**
   * Para onde a mira apontava no instante do tiro, antes do recuo. Quando o quadro do tiro não teve passo de entrada (telas de 120/144 Hz), a entrada
   * seguinte já leva a mira levantada pelo recuo; sem isto o servidor atirava por cima do alvo (principalmente na sniper, 4 graus de coice).
   */
  shotYaw?: number;
  shotPitch?: number;
  cmds?: FsNetCmd[];
}

export type FsNetEvent =
  /** `o`: o que o tiro achou (0 corpo, 1 alvo protegido pelo nascimento, 2 parede ou chão, 3 nada): o atirador vê o motivo de não dar dano. */
  | { k: 'shot'; by: string; from: Vec3; to: Vec3; w: FsWeaponId; o?: number; c?: number; d?: number[] }
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
  /** Invencibilidade do nascimento (mata-mata): até este tick; acaba ao andar ou atirar. */
  shieldUntil: number;
  shieldX: number;
  shieldZ: number;
  /** Última vez que chegou entrada (para marcar quem saiu). */
  heardAt: number;
  /** Time (só a cor por enquanto, o mata-mata é de todos contra todos): 0 contra-terrorista (azul), 1 terrorista (laranja). */
  team: 0 | 1;
  /** Nível do bot (novato, médio ou craque). */
  level: FsBotLevel;
  /** Modo Bomba: a C4 está na mão (só assim dá para plantar). */
  bombHeld: boolean;
  /** Até que tick está cego (luz de granada): o abate sai com o ícone de cego no kill feed. */
  blindUntil: number;
}

export interface FsNetOptions {
  minutes: number;
  humans: { id: string; name: string; /** Time escolhido na sala (0 contra-terrorista, 1 terrorista). */ team?: 0 | 1 }[];
  bots: number;
  /** Modo Bomba (spec 059): rounds, bomba e economia no lugar do mata-mata. */
  bomb?: Partial<FsBombConfig>;
  /** Modo Bomba: quantos bots em cada time, [contra-terrorista, terrorista] (a sala só põe bot se o líder pedir). */
  botTeams?: [number, number];
  /** O mapa (`duna` ou `cidade`); sem isso, a Duna. */
  map?: string;
  rng?: () => number;
  boxes?: readonly FsBox[];
}

const WEAPON_IDS: readonly FsWeaponId[] = ['ak', 'pistol', 'sniper', 'knife', 'smg', 'shotgun', 'm4', 'usp'];
export const fsNetWeaponIndex = (id: FsWeaponId) => WEAPON_IDS.indexOf(id);
export const fsNetWeaponId = (i: number): FsWeaponId => WEAPON_IDS[i] ?? 'pistol';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r2 = (n: number) => Math.round(n * 100) / 100;
/** O corpo do próprio jogador vai com 0,1 mm: a previsão do cliente refaz as entradas a partir dele, e a rede em centímetros desviava em quinas de muro. */
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Confere e limpa uma entrada que veio da rede (nada de número absurdo). Devolve null se não presta. */
export function fsNetParseInput(raw: unknown): FsNetInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!finite(o.seq) || !finite(o.fwd) || !finite(o.strafe) || !finite(o.yaw) || !finite(o.pitch)) return null;
  const cmds: FsNetCmd[] = [];
  if (Array.isArray(o.cmds)) {
    for (const c of o.cmds.slice(0, 4)) {
      const q = c as Record<string, unknown>;
      if (q?.t === 'dropbomb') cmds.push({ t: 'dropbomb' });
      else if (q?.t === 'suicide') cmds.push({ t: 'suicide' });
      else if (q?.t === 'bombslot') cmds.push({ t: 'bombslot' });
      else if (q?.t === 'slot' && finite(q.i) && q.i >= 0 && q.i <= 2) cmds.push({ t: 'slot', i: Math.floor(q.i) });
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
    use: !!o.use,
    viewTick: finite(o.viewTick) ? Math.floor(o.viewTick) : 0,
    ...(finite(o.shotYaw) && finite(o.shotPitch) ? { shotYaw: ((o.shotYaw % 360) + 360) % 360, shotPitch: clamp(o.shotPitch, -88, 88) } : {}),
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
  /** Modo Bomba: o placar de rounds, o dinheiro e a bomba (null no mata-mata). */
  readonly bm: FsBombMatch | null;
  private bombPos: { x: number; y: number; z: number } | null = null;
  private plantPos: { x: number; y: number; z: number } | null = null;
  /** Onde a bomba está largada no chão (null = com alguém ou plantada) e quando já dá para pegar de novo (evita pegar na hora que largou). */
  private dropPos: { x: number; y: number; z: number } | null = null;
  private dropAllowedAt = 0;
  private planSite: 'A' | 'B' = 'A';
  /** O mapa da partida. */
  readonly map: FsMapApi;
  private botsMade = 0;
  private levelOffset = 0;
  private tactics = new FsBombTactics();
  private tacticsRound = -1;
  private roundEndAt = 0;
  private resetGear = true;
  /** Como terminou o último round: 0 nenhum, 1 TR venceu, 2 CT venceu; e o motivo (1 eliminação, 2 bomba, 3 desarmou, 4 tempo). */
  private lastWin = 0;
  private lastReason = 0;
  private lastGain: Record<string, number> = {};

  constructor(opts: FsNetOptions) {
    const base = fsMatchConfig(opts.minutes, 1);
    this.cfg = { minutes: base.minutes, bots: Math.max(0, Math.min(9, Math.round(Number.isFinite(opts.bots) ? opts.bots : 0))) };
    this.bm = opts.bomb ? new FsBombMatch(opts.bomb) : null;
    this.endTick = this.bm ? Number.MAX_SAFE_INTEGER : this.cfg.minutes * 60 * FS_NET_HZ;
    this.map = fsMapById(opts.map ?? (opts.bomb?.pvp ? 'pvp' : undefined));
    this.boxes = opts.boxes ?? this.map.solids;
    this.rng = opts.rng ?? Math.random;
    this.levelOffset = Math.floor(this.rng() * 10);
    // PvP: o empate no tempo vai para o time com mais vida somada
    if (this.bm?.cfg.pvp) {
      this.bm.tiebreak = () => {
        const hp: Record<FsSide, number> = { tr: 0, ct: 0 };
        for (const q of this.players.values()) if (q.alive) hp[this.sideOf(q)] += q.hp;
        return hp.tr > hp.ct ? 'tr' : 'ct';
      };
    }
    const humans = opts.humans.slice(0, 10);
    const botCount = Math.max(0, Math.min(this.cfg.bots, 10 - humans.length));
    const botTeams = opts.botTeams;
    const placed: { x: number; z: number }[] = [];
    for (const h of humans) this.addPlayer(h.id, h.name, false, placed, 0, this.bm ? h.team : undefined);
    // os bots seguem a mesma alternância depois das pessoas (no modo Bomba, completam o time que tem menos gente)
    const count: [number, number] = [0, 0];
    for (const p of this.players.values()) count[p.team]++;
    for (let i = 0; i < botCount; i++) {
      let team = ((humans.length + i) % 2) as 0 | 1;
      if (this.bm) {
        if (botTeams) team = i < botTeams[0] ? 0 : 1;
        else team = count[0] <= count[1] ? 0 : 1;
        count[team]++;
      }
      this.addPlayer(`b${i + 1}`, `Bot ${i + 1}`, true, placed, team);
    }
    if (this.bm) {
      for (const p of this.players.values()) this.bm.addPlayer(p.id, this.sideOf(p));
      this.bm.startRound();
      this.bm.drain();
      this.beginRound();
    }
  }

  /** Lado no modo Bomba: time 1 é terrorista (laranja), time 0 contra-terrorista (azul). */
  private sideOf(p: FsNetPlayer): FsSide {
    // depois da troca de lados do meio da partida, quem manda é o lado do motor, não o time de entrada
    const live = this.bm?.players.get(p.id)?.side;
    if (live) return live;
    return p.team === 1 ? 'tr' : 'ct';
  }

  private addPlayer(id: string, name: string, bot: boolean, placed: { x: number; z: number }[], botTeam: 0 | 1 = 0, humanTeam?: 0 | 1) {
    const sp = this.map.pickSpawn(placed, this.rng, this.boxes);
    placed.push({ x: sp.x, z: sp.z });
    const mover = fsNewMover(sp.x, sp.z);
    mover.y = sp.y;
    const p: FsNetPlayer = {
      id, name, bot, mover, yaw: sp.yaw, pitch: 0, hp: 100, armor: 0, helmet: false, alive: true, respawnAt: 0,
      loadout: new FsLoadout(null, 'pistol'), kills: 0, assists: 0, deaths: 0, hs: 0, damage: 0, queue: [], last: null, lastSeq: 0,
      level: bot ? fsBotLevelAt(this.botsMade++, this.levelOffset) : 'pro', bombHeld: false, hist: [], brain: null, dmgLog: [], flinch: { mul: 1, dur: 0 }, flinchAt: -1e9, firedAt: -1e9, shieldUntil: 0, shieldX: 0, shieldZ: 0, heardAt: 0, team: bot ? botTeam : humanTeam !== undefined ? humanTeam : ((this.humansIn++ % 2) as 0 | 1), blindUntil: 0,
    };
    if (bot) {
      p.brain = fsDmNew(id, sp.x, sp.z, sp.yaw, fsDmPickWeapon(this.rng), this.rng, sp.y, p.level, true);
      this.dressBot(p);
    }
    this.players.set(id, p);
    this.giveShield(p);
    this.roster.push({ id, name, bot });
    // modo Bomba: quem chega com o round rolando só joga no próximo
    if (this.bm && this.tick > 0) {
      this.bm.addPlayer(id, this.sideOf(p));
      const me = this.bm.players.get(id)!;
      me.alive = false;
      p.alive = false;
      p.respawnAt = Number.MAX_SAFE_INTEGER;
    }
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
    p.brain = fsDmNew(id, p.mover.x, p.mover.z, p.yaw, w, this.rng, p.mover.y, p.level, true);
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
      let team: 0 | 1 | undefined;
      if (this.bm) {
        const n: [number, number] = [0, 0];
        for (const q of this.players.values()) n[q.team]++;
        team = n[0] <= n[1] ? 0 : 1;
      }
      this.addPlayer(id, name, false, placed, 0, team);
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
    if (this.bm) {
      // modo Bomba: a pessoa assume o time, o dinheiro e o estado do bot
      const bp = this.bm.players.get(old.r.id);
      this.bm.players.delete(old.r.id);
      if (bp) {
        bp.id = id;
        this.bm.players.set(id, bp);
      }
      p.loadout = new FsLoadout(null, this.sideOf(p) === 'ct' ? 'usp' : 'pistol');
      this.players.set(id, p);
      this.roster[old.i] = { id, name, bot: false };
      return true;
    }
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
        if (!this.bm && this.tick >= p.respawnAt) this.respawn(p);
        continue;
      }
      if (p.bot) {
        if (!this.bombFrozen()) this.stepBot(p, foesForBots(p.id).filter((f) => !this.bm || this.sideOf(this.players.get(f.id)!) !== this.sideOf(p)));
      }
      else this.stepHuman(p);
      if (p.shieldUntil > this.tick && Math.hypot(p.mover.x - p.shieldX, p.mover.z - p.shieldZ) > 0.35) p.shieldUntil = 0;
      p.hist.push({ tick: this.tick, x: p.mover.x, y: p.mover.y, z: p.mover.z, crouch: p.mover.crouchK, yaw: p.yaw });
      if (p.hist.length > 40) p.hist.shift();
    }
    this.stepGrenades();
    if (this.bm) this.stepBomb();
    if (!this.over && this.tick >= this.endTick) {
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
    // modo Bomba: parado na base na compra e no fim do round
    if (this.bombFrozen()) return;
    const lo = p.loadout;
    const adsOn = inp.alt && !lo.reloading && !lo.weapon.melee && lo.drawT <= 0;
    const mul = lo.weapon.moveMul * (adsOn ? 0.65 : 1) * fsFlinchAt(p.flinch, (this.tick - p.flinchAt) / FS_NET_HZ);
    // o passo de 1/60 s se divide em dois de 1/120 s, igual ao aparelho
    for (let i = 0; i < 2; i++) {
      fsStepMover(p.mover, { fwd: inp.fwd, strafe: inp.strafe, jump: inp.jump && i === 0, yaw: inp.yaw, speedMul: mul, crouch: inp.crouch, walk: inp.walk }, 1 / 120, this.boxes, [], this.map.ladders);
    }
    const speed = Math.hypot(p.mover.vx, p.mover.vz);
    const evs = lo.update(FS_NET_DT, { trigger: inp.trigger, reload: inp.reload, alt: inp.alt, inspect: inp.inspect }, { moving: speed > 0.8, airborne: !p.mover.onGround, ads: adsOn, speed, crouch: p.mover.crouchK > 0.5 }, p.id);
    for (const e of evs) {
      if (e.type === 'fire') {
        const rays = e.shot.pellets ?? [{ devYaw: e.shot.devYaw, devPitch: e.shot.devPitch }];
        // a mira do instante do tiro (sem o recuo), se vier perto da da entrada (o coice é de poucos graus; mais que isso não vale)
        let ay = inp.yaw;
        let ap = inp.pitch;
        if (inp.shotYaw !== undefined && inp.shotPitch !== undefined) {
          const dy = ((inp.shotYaw - inp.yaw + 540) % 360) - 180;
          if (Math.abs(dy) <= 15 && Math.abs(inp.shotPitch - inp.pitch) <= 15) {
            ay = inp.yaw + dy;
            ap = inp.shotPitch;
          }
        }
        this.fire(p, e.weapon.id, rays.map((r) => fsDir(ay + r.devYaw, ap + r.devPitch)), inp.viewTick, undefined, adsOn && e.weapon.adsFov > 0, Math.hypot(rays[0]!.devYaw, rays[0]!.devPitch));
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
    if (c.t === 'bombslot') {
      // pegar a C4 na mão (ou guardar): só quem a leva, durante a compra ou o round
      if (this.bm && this.bm.carrier === p.id && (this.bm.phase === 'live' || this.bm.phase === 'buy')) p.bombHeld = !p.bombHeld;
      return;
    }
    p.bombHeld = false;
    if (c.t === 'suicide') {
      p.shieldUntil = 0;
      this.damage(p.id, p.id, 1000, 0, false, 'knife', false);
      return;
    }
    if (c.t === 'dropbomb') {
      if (this.bm?.dropBomb(p.id)) {
        this.dropPos = { x: p.mover.x, y: p.mover.y, z: p.mover.z };
        this.dropAllowedAt = this.tick + 90;
      }
      return;
    }
    if (c.t === 'slot') lo.switchTo(c.i);
    else if (c.t === 'nade') lo.selectGrenade(c.k);
    else if (c.t === 'cycle') lo.cycleAll(c.d);
    else if (c.t === 'buy') {
      const item = fsShopItem(c.id);
      if (this.bm) {
        // só na base, na fase de compra, com dinheiro
        const bp = this.bm.players.get(p.id);
        if (!item || !bp || !this.bm.buyOpen || !this.inBase(p) || fsShopPrice(item, p.armor, p.helmet) > bp.money) return;
      }
      if (c.id === 'kit') {
        // alicate: só contra-terrorista e uma vez; cobra só se deu
        if (this.bm && item && this.bm.giveKit(p.id)) this.bm.buy(p.id, item.price, true);
        return;
      }
      const cost = item ? fsShopPrice(item, p.armor, p.helmet) : 0;
      if (this.bm && item?.id === 'vesthelm' && cost === 0) return; // já tem tudo: nada de recarga grátis
      const r = fsBuy(lo, c.id);
      if (r.ok && this.bm && item) this.bm.buy(p.id, cost, true);
      if (r.ok && r.armor) {
        p.armor = r.armor.points;
        p.helmet = p.helmet || r.armor.helmet;
      }
    }
  }

  private stepBot(p: FsNetPlayer, foes: FsDmFoe[]) {
    const b = p.brain!;
    const acts = fsDmStep(b, { now: this.tick / FS_NET_HZ, dt: FS_NET_DT, rng: this.rng, boxes: this.boxes, foes, map: this.map });
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

  private fire(p: FsNetPlayer, wid: FsWeaponId, rays: Vec3[], viewTick: number, originOverride?: Vec3, scoped = true, dev?: number) {
    const w = FS_WEAPONS[wid];
    p.firedAt = this.tick;
    p.shieldUntil = 0;
    const eye: Vec3 = originOverride ?? [p.mover.x, p.mover.y + fsEyeHeight(p.mover), p.mover.z];
    const bodies = this.bodiesAt(p.id, viewTick);
    const pool = new Map<string, { hp: number; armorLoss: number; head: boolean; armorHit: boolean; wall: boolean }>();
    // abate de sniper sem a luneta é "sem mirar" (ícone no kill feed)
    const noscope = wid === 'sniper' && !scoped;
    for (const dir of rays) {
      const tr = fsTrace(w, eye, dir, this.boxes, bodies);
      // diagnóstico (só quando não acertou corpo): onde o corpo mais perto do raio estava, de lado / para cima (cm), a distância (m) e o atraso usado (passos)
      let diag: number[] | undefined;
      if (tr.kind !== 'player' && bodies.length) {
        let best: number[] | undefined;
        let bd = 1e9;
        const yr = Math.atan2(-dir[0], -dir[2]);
        for (const b of bodies) {
          const cx = b.pos[0] - eye[0], cy = b.pos[1] + 0.9 - eye[1], cz = b.pos[2] - eye[2];
          const t = cx * dir[0] + cy * dir[1] + cz * dir[2];
          if (t <= 0) continue;
          const px = cx - dir[0] * t, py = cy - dir[1] * t, pz = cz - dir[2] * t;
          const dist = Math.hypot(px, py, pz);
          if (dist < bd) {
            bd = dist;
            best = [Math.round((px * Math.cos(yr) - pz * Math.sin(yr)) * 100), Math.round(py * 100), Math.round(t), this.tick - Math.round(clamp(viewTick, this.tick - FS_NET_REWIND_MAX, this.tick))];
          }
        }
        diag = best;
      }
      const shielded = tr.kind === 'player' && !!tr.targetId && (this.players.get(tr.targetId)?.shieldUntil ?? 0) > this.tick;
      this.events.push({ k: 'shot', by: p.id, from: eye.map(r2) as Vec3, to: tr.point.map(r2) as Vec3, w: wid, o: shielded ? 1 : tr.kind === 'player' ? 0 : tr.kind === 'world' ? 2 : 3, ...(dev === undefined ? {} : { c: Math.round(dev * 10) }), ...(diag ? { d: diag } : {}) });
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
    if (v.shieldUntil > this.tick) return;
    // modo Bomba: sem dano na compra nem depois do fim do round
    if (this.bm && this.bm.phase !== 'live' && this.bm.phase !== 'planted') return;
    // fogo amigo existe, mas muito mais fraco: um quarto do dano e a cabeça não mata na hora (nem o sniper)
    const friendly = !!this.bm && !!a && a !== v && this.sideOf(a) === this.sideOf(v);
    if (friendly) {
      hp = Math.min(hp, 100) * FS_FRIENDLY_FIRE;
      armorLoss *= FS_FRIENDLY_FIRE;
      head = false;
    }
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
    v.respawnAt = this.bm ? Number.MAX_SAFE_INTEGER : this.tick + Math.round(FS_RESPAWN_S * FS_NET_HZ);
    const self = vic === by;
    const as = self ? null : fsAssister(v.dmgLog, by, this.tick / FS_NET_HZ);
    v.dmgLog = [];
    if (a && !self && !friendly) {
      a.kills++;
      if (head) a.hs++;
    }
    const asP = as ? this.players.get(as) : undefined;
    if (asP) asP.assists++;
    this.events.push({ k: 'kill', killer: by, victim: vic, w, head, assist: as, wall: !!mods?.wall, noscope: !!mods?.noscope, blind: !!a && a !== v && a.blindUntil > this.tick });
    // o que ele segurava some do mundo (as granadas no ar continuam)
    v.queue = [];
    const hadBomb = this.bm?.carrier === vic;
    this.bm?.kill(self || friendly ? null : by, vic, w as FsWeaponId); // matar o aliado não rende dinheiro
    if (hadBomb && this.bm?.dropped) {
      this.dropPos = { x: v.mover.x, y: v.mover.y, z: v.mover.z };
      this.dropAllowedAt = this.tick + 30;
    }
  }

  /** Tira a proteção de todo mundo (usado pelos testes e ao abrir a partida sem espera). */
  dropShields(): void {
    for (const p of this.players.values()) p.shieldUntil = 0;
  }

  /** Mata-mata: quem nasce fica invencível até andar (ou 8 s parado); atirar também tira. */
  private giveShield(p: FsNetPlayer) {
    if (this.bm) return;
    p.shieldUntil = this.tick + 8 * FS_NET_HZ;
    p.shieldX = p.mover.x;
    p.shieldZ = p.mover.z;
  }

  private respawn(p: FsNetPlayer) {
    const foes = [...this.players.values()].filter((q) => q.alive && q.id !== p.id).map((q) => ({ x: q.mover.x, z: q.mover.z }));
    const sp = this.map.pickSpawn(foes, this.rng, this.boxes);
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
    // renasce com os pentes cheios (granadas não voltam)
    if (!p.bot) p.loadout.refillAmmo();
    p.blindUntil = 0;
    if (p.bot) {
      p.brain = fsDmNew(p.id, sp.x, sp.z, sp.yaw, fsDmPickWeapon(this.rng), this.rng, sp.y, p.level, true);
      p.mover = p.brain.mover;
      this.dressBot(p);
    }
    this.giveShield(p);
    this.events.push({ k: 'spawn', id: p.id, x: r2(sp.x), z: r2(sp.z) });
  }


  // ---------------------------------------------------------------- modo Bomba (spec 059)

  private bombFrozen(): boolean {
    const b = this.bm;
    // no fim do round todos andam livremente (só a compra e o fim da partida travam)
    return !!b && (b.phase === 'buy' || b.phase === 'over');
  }

  private inBase(p: FsNetPlayer): boolean {
    const m = this.map.marks.find((k) => k.kind === 'base' && k.id === (this.sideOf(p) === 'tr' ? 'T' : 'CT'));
    return !!m && p.mover.x >= m.x0 - 1 && p.mover.x <= m.x1 + 1 && p.mover.z >= m.z0 - 1 && p.mover.z <= m.z1 + 1;
  }

  private roundSpawns(): Map<string, FsSpawn> {
    const pool: Record<FsSide, FsSpawn[]> = {
      tr: this.map.spawns.filter((q) => q.zone === 'TR').sort(() => this.rng() - 0.5),
      ct: this.map.spawns.filter((q) => q.zone === 'CT').sort(() => this.rng() - 0.5),
    };
    const out = new Map<string, FsSpawn>();
    for (const p of this.players.values()) {
      const l = pool[this.sideOf(p)];
      out.set(p.id, l.length ? l.pop()! : this.map.spawns[0]!);
    }
    return out;
  }

  private priceOf(w: FsWeaponId): number {
    return FS_SHOP.flatMap((c) => c.items).find((i) => i.weapon === w && !i.soon)?.price ?? 1e9;
  }

  /** Todo mundo nasce na base do seu time; quem sobreviveu mantém o equipamento, quem morreu volta à pistola. */
  private beginRound() {
    const bm = this.bm!;
    const sp = this.roundSpawns();
    const vestPrice = Math.min(...FS_SHOP.flatMap((c) => c.items).filter((i) => i.armor && !i.armor.helmet && !i.soon).map((i) => i.price));
    for (const p of this.players.values()) {
      const side = this.sideOf(p);
      const keep = bm.survivors.has(p.id) && !this.resetGear;
      const s = sp.get(p.id)!;
      p.hp = 100;
      p.alive = true;
      p.respawnAt = 0;
      p.mover = fsNewMover(s.x, s.z);
      p.mover.y = s.y;
      p.yaw = s.yaw;
      p.pitch = 0;
      p.flinchAt = -1e9;
      p.hist = [];
      p.last = null;
      p.queue = [];
      p.blindUntil = 0;
      if (!keep) {
        p.armor = 0;
        p.helmet = false;
        if (!p.bot) p.loadout.resetKit(side === 'ct' ? 'usp' : 'pistol');
      }
      if (!p.bot) p.loadout.refillAmmo();
      if (p.bot) {
        let weapon: Exclude<FsWeaponId, 'knife'> = keep && p.brain ? p.brain.weapon : side === 'ct' ? 'usp' : 'pistol';
        const money = bm.players.get(p.id)!;
        if ((weapon === 'pistol' || weapon === 'usp') && !keep) {
          for (const w of [side === 'tr' ? 'ak' : 'm4', 'smg', 'shotgun'] as const) {
            if (money.money >= this.priceOf(w) && bm.buy(p.id, this.priceOf(w), true)) {
              weapon = w;
              break;
            }
          }
        }
        if (!p.armor && money.money >= vestPrice && bm.buy(p.id, vestPrice, true)) p.armor = 100;
        p.brain = fsDmNew(p.id, s.x, s.z, s.yaw, weapon, this.rng, s.y, p.level, true);
        p.brain.nades = { frag: 0, flash: 0 };
        p.mover = p.brain.mover;
      } else if (!keep) {
        p.loadout.refillAmmo();
      }
      this.events.push({ k: 'spawn', id: p.id, x: r2(s.x), z: r2(s.z) });
    }
    this.resetGear = false;
    this.bombPos = null;
    this.plantPos = null;
    this.dropPos = null;
    this.planSite = this.rng() < 0.5 ? 'A' : 'B';
  }

  /** Em qual pátio está (A ou B): vale o retângulo marcado, com folga, ou até 7 m do centro (o círculo que se vê no mapa). */
  private siteAt(x: number, z: number): string | null {
    return this.map.siteAt(x, z);
  }

  private stepBomb() {
    // a C4 só fica na mão de quem a leva (largou, morreu ou outro pegou: guarda)
    for (const q of this.players.values()) if (q.bombHeld && (this.bm!.carrier !== q.id || !q.alive)) q.bombHeld = false;
    const bm = this.bm!;
    if (bm.phase === 'over') return;
    // bomba largada no chão: qualquer terrorista vivo pega andando por cima (ou apertando E perto)
    if (bm.dropped && this.dropPos && (bm.phase === 'live' || bm.phase === 'buy')) {
      for (const q of this.players.values()) {
        if (!q.alive || this.sideOf(q) !== 'tr') continue;
        const d = Math.hypot(q.mover.x - this.dropPos.x, q.mover.z - this.dropPos.z);
        const wants = d < 1.1 && this.tick >= this.dropAllowedAt;
        const presses = !q.bot && !!q.last?.use && d < 2.4;
        if ((wants || presses) && bm.pickBomb(q.id)) {
          this.dropPos = null;
          break;
        }
      }
    }
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const side = this.sideOf(p);
      if (!p.bot) {
        const still = Math.hypot(p.mover.vx, p.mover.vz) < 2.2;
        const use = !!p.last?.use && still;
        if (side === 'tr' && bm.carrier === p.id) {
          const site = this.siteAt(p.mover.x, p.mover.z);
          const go = use && p.bombHeld;
          if (go && site) this.plantPos = { x: p.mover.x, y: p.mover.y, z: p.mover.z };
          bm.plant(p.id, go, site, FS_NET_DT);
        } else if (side === 'ct' && bm.phase === 'planted' && this.bombPos) {
          const near = Math.hypot(p.mover.x - this.bombPos.x, p.mover.z - this.bombPos.z) < 2.4;
          bm.defuse(p.id, use && near, near, FS_NET_DT);
        }
        continue;
      }
    }
    // bots: a tática de equipe dá os objetivos; aqui só se obedece plantar e desarmar
    if (bm.phase === 'live' && this.tacticsRound !== bm.round) {
      this.tacticsRound = bm.round;
      this.tactics.newRound(this.botWorld());
    }
    const orders = this.tactics.step(this.botWorld());
    for (const p of this.players.values()) {
      if (!p.alive || !p.bot || !p.brain) continue;
      const side = this.sideOf(p);
      const b = p.brain;
      if (side === 'tr' && bm.carrier === p.id) {
        const site = this.siteAt(b.mover.x, b.mover.z);
        const go = orders.plant.has(p.id);
        if (go && site) this.plantPos = { x: b.mover.x, y: b.mover.y, z: b.mover.z };
        bm.plant(p.id, go && !!site, site, FS_NET_DT);
      } else if (side === 'ct' && bm.phase === 'planted' && this.bombPos && orders.defuse.has(p.id)) {
        bm.defuse(p.id, true, true, FS_NET_DT);
      }
    }
    bm.step(FS_NET_DT);
    this.reactBomb();
    if (bm.phase === 'end' && this.tick >= this.roundEndAt) {
      bm.nextRound();
      this.reactBomb();
      this.beginRound();
    }
  }

  /**
   * A C4 explodeu: quem está perto morre, quem está mais longe leva menos dano e quem está muito longe não leva nada. O round
   * já acabou (a bomba venceu), então o dano é aplicado direto e sem crédito de abate.
   */
  private explodeBomb() {
    const at = this.bombPos;
    if (!at) return;
    this.events.push({ k: 'boom', id: ++this.nadeSeq, kind: 'frag', x: r2(at.x), y: r2(at.y), z: r2(at.z) });
    for (const q of this.players.values()) {
      if (!q.alive) continue;
      const dmg = fsBombBlastDamage(Math.hypot(q.mover.x - at.x, q.mover.z - at.z));
      if (dmg <= 0) continue;
      q.hp -= dmg;
      this.events.push({ k: 'hurt', vic: q.id, by: q.id, x: r2(at.x), z: r2(at.z), dmg, head: false });
      if (q.hp > 0) continue;
      q.hp = 0;
      q.alive = false;
      q.deaths++;
      this.events.push({ k: 'kill', killer: q.id, victim: q.id, w: 'frag', head: false, assist: null, wall: false, noscope: false, blind: false });
    }
  }

  /** Retrato do mundo para a tática dos bots (todos os jogadores, humanos e bots). */
  private botWorld() {
    const bm = this.bm!;
    return {
      now: this.tick / FS_NET_HZ,
      dt: FS_NET_DT,
      rng: this.rng,
      map: this.map,
      phase: bm.phase,
      time: bm.time,
      roundSec: bm.cfg.roundSec,
      people: [...this.players.values()].map((q) => ({ id: q.id, side: this.sideOf(q), x: q.mover.x, z: q.mover.z, alive: q.alive, brain: q.bot ? q.brain : null })),
      carrier: bm.carrier,
      dropPos: this.dropPos ? { x: this.dropPos.x, z: this.dropPos.z } : null,
      plantPos: this.bombPos ? { x: this.bombPos.x, z: this.bombPos.z } : null,
      defusing: bm.defusing,
      defuseSec: (id: string) => (bm.players.get(id)?.kit ? bm.cfg.defuseKitSec : bm.cfg.defuseSec),
      hasKit: (id: string) => !!bm.players.get(id)?.kit,
    };
  }

  private reactBomb() {
    const bm = this.bm!;
    for (const e of bm.drain()) {
      if (e.k === 'planted') {
        const at = this.plantPos ?? { x: 0, y: 0, z: 0 };
        this.bombPos = { x: at.x, y: this.map.floorY(at.x, at.z), z: at.z };
      } else if (e.k === 'exploded') {
        this.explodeBomb();
      } else if (e.k === 'roundEnd') {
        this.roundEndAt = this.tick + 5 * FS_NET_HZ;
        this.lastWin = e.winner === 'tr' ? 1 : 2;
        this.lastReason = e.reason === 'elim' ? 1 : e.reason === 'bomb' ? 2 : e.reason === 'defuse' ? 3 : 4;
        this.lastGain = e.rewards;
      } else if (e.k === 'half') this.resetGear = true;
      else if (e.k === 'over') {
        this.over = true;
        this.events.push({ k: 'over' });
      }
    }
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
  /** Placar de rounds e o lado de cada um (modo Bomba); `null` no mata-mata. */
  bombResult(): { tr: number; ct: number; winner: FsSide | null; sides: Record<string, FsSide> } | null {
    const bm = this.bm;
    if (!bm) return null;
    const sides: Record<string, FsSide> = {};
    for (const [id, p] of bm.players) sides[id] = p.side;
    return { tr: bm.score.tr, ct: bm.score.ct, winner: bm.winner ?? null, sides };
  }

  results(): FsMatchRow[] {
    return fsMatchResult([...this.players.values()].map((p) => ({ id: p.id, name: p.name, kills: p.kills, assists: p.assists, deaths: p.deaths })));
  }

  /**
   * O quadro de todo mundo (vai a todos). Cada jogador é uma linha de números inteiros pequenos:
   * [índice, x·100, y·100, z·100, yaw·10, pitch·10, vida, colete, bandeiras, arma, agachado·100, último número de entrada, abates, assist., mortes]
   * Bandeiras: 1 vivo, 2 capacete, 4 bot, 8 atirou agora há pouco, 16 recarregando, 32 no chão, 64 andando, 128 terrorista (laranja; sem a bandeira é contra-terrorista, azul).
   */
  frame(): { k: number; left: number; p: number[][]; g: number[][]; b?: number[] } {
    const p: number[][] = [];
    this.roster.forEach((r, i) => {
      const q = this.players.get(r.id)!;
      const sp = Math.hypot(q.mover.vx, q.mover.vz);
      const flags = (q.alive ? 1 : 0) | (q.helmet ? 2 : 0) | (q.bot ? 4 : 0) | (this.tick - q.firedAt < 12 ? 8 : 0) | (!q.bot && q.loadout.reloading ? 16 : 0) | (q.mover.onGround ? 32 : 0) | (sp > 0.8 ? 64 : 0) | ((this.bm ? this.sideOf(q) === 'tr' : q.team === 1) ? 128 : 0) | (q.shieldUntil > this.tick ? 256 : 0);
      const wid = q.bot ? q.brain!.weapon : q.loadout.weapon.id;
      p.push([
        i, Math.round(q.mover.x * 100), Math.round(q.mover.y * 100), Math.round(q.mover.z * 100),
        Math.round((((q.yaw + 180) % 360) - 180) * 10), Math.round(q.pitch * 10), Math.max(0, Math.round(q.hp)), Math.round(q.armor), flags,
        fsNetWeaponIndex(wid), Math.round(q.mover.crouchK * 100), q.lastSeq, q.kills, q.assists, q.deaths, Math.round(q.damage), q.hs,
      ]);
    });
    const g = this.grenades.map((n) => [n.id, n.body.kind === 'frag' ? 0 : 1, Math.round(n.body.x * 100), Math.round(n.body.y * 100), Math.round(n.body.z * 100)]);
    const bm = this.bm;
    // modo Bomba: [0 fase (0 compra, 1 round, 2 bomba plantada, 3 fim do round, 4 fim), 1 tempo·10, 2 round, 3 TR, 4 CT, 5 bomba x·100, 6 bomba z·100,
    //   7 pátio (0 nenhum, 1 A, 2 B), 8 portador (índice, -1), 9 vencedor, 10 motivo, 11 largada no chão (0/1), 12 x·100, 13 z·100,
    //   14 quem planta/desarma (índice, -1), 15 progresso·100, 16 ação (0 nenhuma, 1 plantando, 2 desarmando)]
    const planting = bm?.planting ?? null;
    const defusing = bm?.defusing ?? null;
    const actor = planting ?? defusing;
    const showBomb = !!this.bombPos && bm?.phase === 'planted';
    const ghostPos = planting ? this.plantPos : null;
    const b = bm
      ? [
          ({ buy: 0, live: 1, planted: 2, end: 3, over: 4 } as const)[bm.phase],
          Math.round(Math.max(0, bm.phase === 'end' ? (this.roundEndAt - this.tick) / FS_NET_HZ : bm.time) * 10),
          bm.round, bm.score.tr, bm.score.ct,
          showBomb ? Math.round(this.bombPos!.x * 100) : ghostPos ? Math.round(ghostPos.x * 100) : 0,
          showBomb ? Math.round(this.bombPos!.z * 100) : ghostPos ? Math.round(ghostPos.z * 100) : 0,
          bm.site === 'A' ? 1 : bm.site === 'B' ? 2 : 0,
          bm.carrier ? this.roster.findIndex((r) => r.id === bm.carrier) : -1,
          this.lastWin, this.lastReason,
          bm.dropped && this.dropPos ? 1 : 0,
          this.dropPos ? Math.round(this.dropPos.x * 100) : 0,
          this.dropPos ? Math.round(this.dropPos.z * 100) : 0,
          actor ? this.roster.findIndex((r) => r.id === actor) : -1,
          Math.round(100 * (planting ? bm!.plantProgress / bm!.cfg.plantSec : defusing ? bm!.defuseProgress / (bm!.players.get(defusing)?.kit ? bm!.cfg.defuseKitSec : bm!.cfg.defuseSec) : 0)),
          planting ? 1 : defusing ? 2 : 0,
        ]
      : undefined;
    return { k: this.tick, left: Math.max(0, this.endTick - this.tick), p, g, b };
  }

  /** O que só a própria pessoa precisa (para a previsão e para a tela): corpo exato, armas e granadas. */
  selfState(id: string) {
    const q = this.players.get(id);
    if (!q) return null;
    const lo = q.loadout;
    return {
      x: r4(q.mover.x), y: r4(q.mover.y), z: r4(q.mover.z), vx: r4(q.mover.vx), vy: r4(q.mover.vy), vz: r4(q.mover.vz),
      og: q.mover.onGround, ck: r4(q.mover.crouchK), seq: q.lastSeq, yaw: r2(q.yaw), pitch: r2(q.pitch), hp: Math.max(0, Math.round(q.hp)), armor: Math.round(q.armor), helmet: q.helmet, alive: q.alive,
      shield: q.alive && q.shieldUntil > this.tick ? (q.shieldUntil - this.tick) / (8 * FS_NET_HZ) : 0,
      respawnIn: q.alive ? 0 : Math.max(0, (q.respawnAt - this.tick) / FS_NET_HZ),
      cur: lo.current, held: lo.held, ammo: lo.held ? lo.grenades[lo.held] : lo.slot.ammo, reloading: lo.reloading,
      slots: lo.slots.map((s) => (s ? fsNetWeaponIndex(s.id) : -1)),
      nades: { ...lo.grenades },
      flinch: q.flinch, flinchAt: q.flinchAt / FS_NET_HZ * 1, tickNow: this.tick,
      bomb: this.bm
        ? (() => {
            const bp = this.bm!.players.get(id);
            const defTime = bp?.kit ? this.bm!.cfg.defuseKitSec : this.bm!.cfg.defuseSec;
            return {
              money: bp?.money ?? 0,
              plant: this.bm!.carrier === id ? this.bm!.plantProgress / this.bm!.cfg.plantSec : 0,
              defuse: this.bm!.phase === 'planted' && this.bm!.defuseProgress > 0 && bp?.side === 'ct' ? this.bm!.defuseProgress / defTime : 0,
              gain: this.lastGain[id] ?? 0,
              side: bp?.side ?? 'ct',
              kit: !!bp?.kit,
              win: this.bm!.cfg.winRounds, buy: this.bm!.buyOpen, held: this.bm!.carrier === id && q.bombHeld,
              // dinheiro só dos aliados (por posição na tabela); o do time inimigo nunca sai do servidor
              mates: Object.fromEntries(this.roster.flatMap((r, i) => { const o = this.bm!.players.get(r.id); return o && bp && o.side === bp.side && r.id !== id ? [[i, o.money]] : []; })) as Record<number, number>,
            };
          })()
        : undefined,
    };
  }

  /** O líder encerra a partida com o placar de agora. */
  endNow(): void {
    if (this.over) return;
    this.over = true;
    this.events.push({ k: 'over' });
  }

  /** Pontos de uma pessoa (atalho para testes e tela). */
  points(id: string): number {
    const q = this.players.get(id);
    return q ? fsMatchScore(q) : 0;
  }
}

export { FS_MOVE };
