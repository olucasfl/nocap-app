/**
 * Counter Fox, modo Bomba (spec 059): rounds com tempo, TR contra CT, bomba, economia no desenho do CS.
 * Lógica pura (sem rede nem tela): quem usa informa onde cada jogador está (`inSite`, `nearBomb`, `inBase`) e o motor
 * cuida das fases, do tempo, da bomba, do dinheiro e do placar.
 */
import type { FsWeaponId } from './weapons';

/** Segundos a mais de compra (na base) depois de liberar o round. */
export const FS_BUY_GRACE = 15;
/** Estouro da C4: mata até 10 m, depois o dano cai em linha reta e some aos 30 m (além disso ninguém se machuca). */
export const FS_BLAST_LETHAL = 10;
export const FS_BLAST_MAX = 30;
export function fsBombBlastDamage(dist: number): number {
  if (dist <= FS_BLAST_LETHAL) return 999;
  if (dist >= FS_BLAST_MAX) return 0;
  return 100 * (1 - (dist - FS_BLAST_LETHAL) / (FS_BLAST_MAX - FS_BLAST_LETHAL));
}
export type FsSide = 'tr' | 'ct';
export const fsOtherSide = (s: FsSide): FsSide => (s === 'tr' ? 'ct' : 'tr');

export interface FsBombConfig {
  /** Rounds para vencer (primeiro a N). */
  winRounds: number;
  buySec: number;
  roundSec: number;
  bombSec: number;
  plantSec: number;
  defuseSec: number;
  defuseKitSec: number;
  startMoney: number;
  maxMoney: number;
  winMoney: number;
  /** Vitória por bomba (TR explodiu / CT desarmou). */
  winBombMoney: number;
  /** Bônus de derrota: 1ª, 2ª... (a última vale para as seguintes). */
  lossBonus: number[];
  /** Todo TR recebe isto se plantou e perdeu o round. */
  plantLossMoney: number;
  plantMoney: number;
  defuseMoney: number;
  /** Modo PvP: times que se enfrentam sem bomba, com dinheiro infinito; o round acaba quando um time inteiro cai. */
  pvp: boolean;
  /** Compra do 2º round em diante, no PvP (s): é a contagem que libera o tiro. */
  freezeSec: number;
}

/** Valores do CS competitivo (spec 059 §1); o Lucas escolheu "igual ao CS", primeiro a 8, round de 1:55. */
export const FS_BOMB_DEFAULTS: FsBombConfig = {
  winRounds: 8,
  buySec: 15,
  roundSec: 115,
  bombSec: 40,
  plantSec: 3.2,
  defuseSec: 10,
  defuseKitSec: 5,
  startMoney: 800,
  maxMoney: 16000,
  winMoney: 3250,
  winBombMoney: 3500,
  lossBonus: [1400, 1900, 2400, 2900, 3400],
  plantLossMoney: 800,
  plantMoney: 300,
  defuseMoney: 300,
  pvp: false,
  freezeSec: 3,
};

export const FS_BOMB_LIMITS = {
  winRounds: [2, 13],
  buySec: [5, 30],
  roundSec: [60, 180],
} as const;
/** No PvP o líder escolhe quantos pontos vencem e o tempo do round numa faixa mais larga. */
export const FS_PVP_LIMITS = {
  winRounds: [1, 30],
  buySec: [3, 30],
  roundSec: [30, 300],
} as const;
/** Dinheiro do PvP: ilimitado (o valor só aparece na loja). */
export const FS_PVP_MONEY = 99_999;
/** Compra do 1º round no PvP (s). */
export const FS_PVP_BUY_SEC = 5;

/** Limita as opções à faixa permitida (a sala e o menu usam isto). */
export function fsBombConfig(patch: Partial<FsBombConfig> = {}): FsBombConfig {
  // chaves com `undefined` não apagam o padrão (um menu que não mexeu em algo manda a chave vazia)
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && !(typeof v === 'number' && !Number.isFinite(v))));
  const c = { ...FS_BOMB_DEFAULTS, ...clean } as FsBombConfig;
  const clamp = (v: number, [a, b]: readonly [number, number]) => Math.max(a, Math.min(b, Math.round(v)));
  c.pvp = c.pvp === true;
  // PvP: a compra é rápida (5 s) se ninguém escolheu outro tempo
  if (c.pvp && clean.buySec === undefined) c.buySec = FS_PVP_BUY_SEC;
  const lim = c.pvp ? FS_PVP_LIMITS : FS_BOMB_LIMITS;
  c.winRounds = clamp(c.winRounds, lim.winRounds);
  c.buySec = clamp(c.buySec, lim.buySec);
  c.roundSec = clamp(c.roundSec, lim.roundSec);
  c.freezeSec = Math.max(1, Math.min(10, Math.round(c.freezeSec)));
  if (c.pvp) {
    c.startMoney = FS_PVP_MONEY;
    c.maxMoney = FS_PVP_MONEY;
  }
  return c;
}

/** Quanto o abate rende, por arma (CS). */
export const FS_KILL_MONEY: Partial<Record<FsWeaponId, number>> & { default: number } = {
  default: 300,
  smg: 600,
  shotgun: 900,
  sniper: 100,
  knife: 1500,
};

export type FsRoundPhase = 'buy' | 'live' | 'planted' | 'end' | 'over';
export type FsRoundReason = 'elim' | 'bomb' | 'defuse' | 'time';

export type FsBombEvent =
  | { k: 'roundStart'; round: number; carrier: string | null }
  | { k: 'live' }
  | { k: 'dropped' }
  | { k: 'picked'; by: string }
  | { k: 'plantStart'; by: string }
  | { k: 'planted'; by: string; site: string }
  | { k: 'defuseStart'; by: string }
  | { k: 'defused'; by: string }
  | { k: 'exploded' }
  | { k: 'roundEnd'; winner: FsSide; reason: FsRoundReason; rewards: Record<string, number> }
  | { k: 'half' }
  | { k: 'over'; winner: FsSide };

export interface FsBombPlayer {
  id: string;
  side: FsSide;
  alive: boolean;
  money: number;
  kit: boolean;
  /** Ganhou US$ neste round (para mostrar no fim do round). */
  gained: number;
}

export class FsBombMatch {
  readonly cfg: FsBombConfig;
  phase: FsRoundPhase = 'buy';
  /** Tempo restante da fase atual (compra, round ou bomba), em segundos. */
  time: number;
  round = 0;
  readonly score: Record<FsSide, number> = { tr: 0, ct: 0 };
  readonly lossStreak: Record<FsSide, number> = { tr: 0, ct: 0 };
  readonly players = new Map<string, FsBombPlayer>();
  carrier: string | null = null;
  /** A bomba está no chão, largada (por quem a levava, que morreu ou apertou largar): qualquer terrorista pega. */
  dropped = false;
  site: string | null = null;
  planter: string | null = null;
  plantProgress = 0;
  defuseProgress = 0;
  winner: FsSide | null = null;
  lastRound: { winner: FsSide; reason: FsRoundReason } | null = null;
  private plantBy: string | null = null;
  private defuseBy: string | null = null;
  /** Relógio do desarme (s) e quando o desarmador atual foi visto por último: quem está desarmando não perde o progresso para outro. */
  private defuseClock = 0;
  private defuseSeen = 0;
  /** Quem está plantando / desarmando agora (para mostrar a animação a todos). */
  get planting(): string | null {
    return this.phase === 'live' && this.plantProgress > 0 ? this.plantBy : null;
  }
  get defusing(): string | null {
    return this.phase === 'planted' && this.defuseProgress > 0 ? this.defuseBy : null;
  }
  private plantedAny = false;
  private halfDone = false;
  private events: FsBombEvent[] = [];
  /** Quem sobreviveu ao último round (mantém o equipamento). */
  survivors = new Set<string>();
  /** PvP: desempate quando o tempo acaba com o mesmo número de vivos (vence quem tem mais vida somada). */
  tiebreak: (() => FsSide) | null = null;

  constructor(cfg: Partial<FsBombConfig> = {}) {
    this.cfg = fsBombConfig(cfg);
    this.time = this.cfg.buySec;
  }

  drain(): FsBombEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  addPlayer(id: string, side: FsSide): FsBombPlayer {
    const p: FsBombPlayer = { id, side, alive: this.phase === 'buy', money: this.cfg.startMoney, kit: false, gained: 0 };
    this.players.set(id, p);
    return p;
  }

  /** Troca de time (no lobby ou entre rounds). Quem troca no meio do round fica de fora até o próximo. */
  setSide(id: string, side: FsSide) {
    const p = this.players.get(id);
    if (!p || p.side === side) return;
    p.side = side;
    if (this.phase !== 'buy') p.alive = false;
    if (this.carrier === id) this.carrier = null;
  }

  removePlayer(id: string) {
    this.players.delete(id);
    if (this.carrier === id) this.carrier = null;
  }

  alive(side: FsSide): FsBombPlayer[] {
    return [...this.players.values()].filter((p) => p.side === side && p.alive);
  }
  teamSize(side: FsSide) {
    return [...this.players.values()].filter((p) => p.side === side).length;
  }

  /** Começa o primeiro round (ou o próximo, depois de `end`). */
  startRound() {
    if (this.phase === 'over') return;
    this.round++;
    this.phase = 'buy';
    this.time = this.cfg.pvp && this.round > 1 ? this.cfg.freezeSec : this.cfg.buySec;
    this.plantedAny = false;
    this.site = null;
    this.planter = null;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.plantBy = null;
    this.defuseBy = null;
    for (const p of this.players.values()) {
      p.alive = true;
      p.gained = 0;
    }
    const trs = this.alive('tr');
    // a bomba continua com quem a tinha, senão é sorteada entre os TR vivos (determinístico: o primeiro)
    this.dropped = false;
    this.carrier = this.cfg.pvp ? null : this.carrier && trs.some((p) => p.id === this.carrier) ? this.carrier : (trs[0]?.id ?? null);
    this.events.push({ k: 'roundStart', round: this.round, carrier: this.carrier });
  }

  /** A loja continua aberta (só na base) por FS_BUY_GRACE s depois que o round é liberado para jogar. */
  get buyOpen(): boolean {
    if (this.cfg.pvp) return this.phase === 'buy';
    return this.phase === 'buy' || (this.phase === 'live' && this.cfg.roundSec - this.time <= FS_BUY_GRACE);
  }

  /** Compra só na base e só enquanto a loja está aberta. Devolve se deu. */
  buy(id: string, price: number, inBase: boolean): boolean {
    const p = this.players.get(id);
    if (!p || !p.alive || !this.buyOpen || !inBase || price < 0) return false;
    // PvP: dinheiro infinito, comprar não gasta nada
    if (this.cfg.pvp) return true;
    if (price > p.money) return false;
    p.money -= price;
    return true;
  }

  giveKit(id: string): boolean {
    const p = this.players.get(id);
    if (!p || p.side !== 'ct' || p.kit) return false;
    p.kit = true;
    return true;
  }

  /** Um abate: dá o dinheiro da arma, mata a vítima e confere o fim do round. */
  kill(killer: string | null, victim: string, weapon: FsWeaponId) {
    const v = this.players.get(victim);
    if (!v || !v.alive || (this.phase !== 'live' && this.phase !== 'planted')) return;
    v.alive = false;
    if (this.carrier === victim) {
      // a bomba cai onde ele morreu (quem passar e pegar vira o portador)
      this.carrier = null;
      this.dropped = true;
      this.events.push({ k: 'dropped' });
    }
    const k = killer ? this.players.get(killer) : undefined;
    if (k && k.side !== v.side && !this.cfg.pvp) this.pay(k, FS_KILL_MONEY[weapon] ?? FS_KILL_MONEY.default);
    this.checkElimination();
  }

  /** Um TR pegou a bomba do chão (andou até ela ou apertou E perto). */
  pickBomb(id: string): boolean {
    if (this.cfg.pvp) return false;
    const p = this.players.get(id);
    if (!p || !p.alive || p.side !== 'tr' || this.carrier || this.plantedAny || this.phase === 'end' || this.phase === 'over') return false;
    this.carrier = id;
    this.dropped = false;
    this.events.push({ k: 'picked', by: id });
    return true;
  }

  /** O portador larga a bomba aos pés (tecla de largar). Devolve se largou. */
  dropBomb(id: string): boolean {
    if (this.cfg.pvp) return false;
    if (id !== this.carrier || (this.phase !== 'live' && this.phase !== 'buy')) return false;
    this.carrier = null;
    this.dropped = true;
    this.plantProgress = 0;
    this.plantBy = null;
    this.events.push({ k: 'dropped' });
    return true;
  }

  /** Plantar: chamado todo passo; `on` = segurando a tecla; `inSite` = dentro de A ou B (`site` = nome). */
  plant(id: string, on: boolean, inSite: string | null, dt: number) {
    if (this.cfg.pvp) return;
    if (this.phase !== 'live' || id !== this.carrier) return;
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    if (!on || !inSite) {
      this.plantProgress = 0;
      this.plantBy = null;
      return;
    }
    if (this.plantBy !== id) this.events.push({ k: 'plantStart', by: id });
    this.plantBy = id;
    this.plantProgress += dt;
    if (this.plantProgress >= this.cfg.plantSec) {
      this.phase = 'planted';
      this.time = this.cfg.bombSec;
      this.site = inSite;
      this.planter = id;
      this.plantedAny = true;
      this.carrier = null;
      this.plantProgress = 0;
      this.pay(p, this.cfg.plantMoney);
      this.events.push({ k: 'planted', by: id, site: inSite });
    }
  }

  /** Desarmar: só CT vivo, com a bomba plantada, ao lado dela. */
  defuse(id: string, on: boolean, nearBomb: boolean, dt: number) {
    if (this.cfg.pvp) return;
    if (this.phase !== 'planted') return;
    const p = this.players.get(id);
    if (!p || !p.alive || p.side !== 'ct') return;
    if (!on || !nearBomb) {
      if (this.defuseBy === id) {
        this.defuseBy = null;
        this.defuseProgress = 0;
      }
      return;
    }
    // outro contra-terrorista vivo já está desarmando: o segundo não consegue (e não zera o tempo do primeiro)
    const cur = this.defuseBy;
    if (cur && cur !== id && this.defuseProgress > 0) {
      const o = this.players.get(cur);
      if (o && o.alive && this.defuseClock - this.defuseSeen < 0.3) return;
    }
    this.defuseSeen = this.defuseClock;
    if (this.defuseBy !== id) {
      this.defuseBy = id;
      this.defuseProgress = 0;
      this.events.push({ k: 'defuseStart', by: id });
    }
    this.defuseProgress += dt;
    if (this.defuseProgress >= (p.kit ? this.cfg.defuseKitSec : this.cfg.defuseSec)) {
      this.pay(p, this.cfg.defuseMoney);
      this.events.push({ k: 'defused', by: id });
      this.endRound('ct', 'defuse');
    }
  }

  /** Avança o relógio. Chame todo passo (ou quadro) com o tempo decorrido. */
  step(dt: number) {
    this.defuseClock += dt;
    if (this.phase === 'end' || this.phase === 'over') return;
    this.time -= dt;
    if (this.time > 0) return;
    if (this.phase === 'buy') {
      this.phase = 'live';
      this.time = this.cfg.roundSec;
      this.events.push({ k: 'live' });
    } else if (this.phase === 'live') {
      if (this.cfg.pvp) {
        // tempo esgotado: vence o time com mais vivos; empate, quem tem mais vida somada
        const t = this.alive('tr').length;
        const c = this.alive('ct').length;
        this.endRound(t > c ? 'tr' : c > t ? 'ct' : (this.tiebreak?.() ?? 'ct'), 'time');
      } else this.endRound('ct', 'time');
    } else if (this.phase === 'planted') {
      this.events.push({ k: 'exploded' });
      this.endRound('tr', 'bomb');
    }
  }

  private pay(p: FsBombPlayer, amount: number) {
    const add = Math.max(0, Math.min(amount, this.cfg.maxMoney - p.money));
    p.money += add;
    p.gained += add;
  }

  private checkElimination() {
    if (this.phase !== 'live' && this.phase !== 'planted') return;
    if (this.cfg.pvp) {
      if (this.alive('ct').length === 0 && this.teamSize('ct') > 0) this.endRound('tr', 'elim');
      else if (this.alive('tr').length === 0 && this.teamSize('tr') > 0) this.endRound('ct', 'elim');
      return;
    }
    if (this.alive('ct').length === 0 && this.teamSize('ct') > 0) this.endRound('tr', 'elim');
    // TR todos mortos: com a bomba plantada o round continua (o CT precisa desarmar), senão o CT vence
    else if (this.alive('tr').length === 0 && this.teamSize('tr') > 0 && this.phase === 'live') this.endRound('ct', 'elim');
  }

  private endRound(winner: FsSide, reason: FsRoundReason) {
    if (this.phase === 'end' || this.phase === 'over') return;
    const loser = fsOtherSide(winner);
    const rewards: Record<string, number> = {};
    const winPay = this.cfg.pvp ? 0 : reason === 'bomb' || reason === 'defuse' ? this.cfg.winBombMoney : this.cfg.winMoney;
    const streak = Math.min(this.lossStreak[loser], this.cfg.lossBonus.length - 1);
    const lossPay = this.cfg.pvp ? 0 : this.cfg.lossBonus[streak]!;
    for (const p of this.players.values()) {
      const before = p.gained;
      if (p.side === winner) this.pay(p, winPay);
      else {
        this.pay(p, lossPay);
        if (loser === 'tr' && this.plantedAny) this.pay(p, this.cfg.plantLossMoney);
      }
      rewards[p.id] = p.gained - before + 0;
    }
    this.lossStreak[loser]++;
    this.lossStreak[winner] = 0;
    this.score[winner]++;
    this.survivors = new Set([...this.players.values()].filter((p) => p.alive).map((p) => p.id));
    this.lastRound = { winner, reason };
    this.winner = null;
    this.events.push({ k: 'roundEnd', winner, reason, rewards });
    this.phase = 'end';
    this.time = 5;
    if (this.score[winner] >= this.cfg.winRounds) {
      this.winner = winner;
      this.phase = 'over';
      this.events.push({ k: 'over', winner });
    }
  }

  /** Depois da tela do fim do round: troca de lado na metade (dinheiro zerado) e começa o próximo. */
  nextRound() {
    if (this.phase !== 'end') return;
    const played = this.score.tr + this.score.ct;
    const half = this.cfg.winRounds - 1;
    if (!this.cfg.pvp && !this.halfDone && played >= half) {
      this.halfDone = true;
      for (const p of this.players.values()) {
        p.side = fsOtherSide(p.side);
        p.money = this.cfg.startMoney;
        p.kit = false;
      }
      const t = this.score.tr;
      this.score.tr = this.score.ct;
      this.score.ct = t;
      this.lossStreak.tr = 0;
      this.lossStreak.ct = 0;
      this.survivors.clear();
      this.carrier = null;
      this.events.push({ k: 'half' });
    }
    this.startRound();
  }
}
