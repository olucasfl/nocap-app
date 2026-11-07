import {
  FS_MATCH_BOTS,
  FS_MATCH_MINUTES,
  FS_NET_HZ,
  FsNetSim,
  fsNetParseInput,
  fsMatchConfig,
  type FsNetEvent,
} from '@nocap/games';
import { ColorRoomEngine, RoomError, type AnySettings, type EngineOptions, type FinalRow } from './color-room.engine';

/** Contagem antes de começar (ms). */
export const FOXSHOT_COUNTDOWN_MS = 5000;
/** Quantas pessoas cabem na sala (quem passa dos 10 jogadores só espectaram). */
export const FOXSHOT_ROOM_MAX = 15;
/** Jogadores humanos + bots numa partida. */
const PLAYERS_MAX = 10;
/** O pódio espera um pouco para o último abate ser visto (ms). */
const OVER_MS = 2500;
/** No máximo estes passos por chamada: se a sala atrasou, anda um pouco mais rápido sem travar tudo. */
const MAX_CATCHUP = 6;
const STEP_MS = 1000 / FS_NET_HZ;

export interface FoxShotSettings {
  rounds: 1;
  minutes: number;
  /** Bots que completam a partida (0 a 9; no máximo 10 jogadores no total). */
  bots: number;
  /** 'dm' mata-mata; 'bomb' modo Bomba (spec 059). */
  /** 'none' = o líder ainda não escolheu o modo (a sala só começa depois). */
  kind: 'none' | 'dm' | 'bomb';
  /** Modo Bomba: bots por time (só entram se o líder pedir). */
  botsCt: number;
  botsTr: number;
  winRounds: number;
  roundSec: number;
}

/**
 * A sala do Counter Fox (spec 057): o mata-mata do Duna online. A sala é quem manda: roda a `FsNetSim` (movimento, armas, tiros
 * com compensação de atraso, pontos, renascer, bots) e transmite o quadro cerca de 20 vezes por segundo. Quem sai no meio vira bot.
 * Sem ranking e sem histórico (regra 2 do RULES.md).
 */
export class FoxShotRoomEngine extends ColorRoomEngine {
  override readonly game = 'foxshot' as const;
  override readonly persistable = false;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['mata'];
  protected override readonly minPlayers = 1;

  sim: FsNetSim | null = null;
  private startAt = 0;
  private overAt = 0;
  private dirty = false;
  /** Time escolhido na sala no modo Bomba (0 contra-terrorista, 1 terrorista); sem escolha o jogo equilibra. */
  readonly teamPref = new Map<string, 0 | 1>();

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: FOXSHOT_ROOM_MAX });
    this.mode = 'mata';
    this.settings = { rounds: 1, minutes: 5, bots: 0, kind: 'none', botsCt: 0, botsTr: 0, winRounds: 8, roundSec: 115 } as unknown as AnySettings;
  }

  /** Bots da partida: no modo Bomba são os dois times somados; no mata-mata, o número escolhido. */
  private botTotal(): number {
    return this.cfg.kind === 'bomb' ? this.cfg.botsCt + this.cfg.botsTr : this.cfg.bots;
  }

  private get cfg(): FoxShotSettings {
    return this.settings as unknown as FoxShotSettings;
  }

  protected override validSettings(merged: Record<string, unknown>, mode: string): boolean {
    const m = merged as unknown as FoxShotSettings;
    return (
      mode === 'mata' &&
      (FS_MATCH_MINUTES as readonly number[]).includes(m.minutes) &&
      Number.isInteger(m.bots) &&
      m.bots >= 0 &&
      m.bots <= FS_MATCH_BOTS.max &&
      (m.kind === 'none' || m.kind === 'dm' || m.kind === 'bomb') &&
      Number.isInteger(m.botsCt) &&
      m.botsCt >= 0 &&
      m.botsCt <= 5 &&
      Number.isInteger(m.botsTr) &&
      m.botsTr >= 0 &&
      m.botsTr <= 5 &&
      Number.isInteger(m.winRounds) &&
      m.winRounds >= 2 &&
      m.winRounds <= 13 &&
      Number.isInteger(m.roundSec) &&
      m.roundSec >= 60 &&
      m.roundSec <= 180
    );
  }

  /** Dá para entrar (e ser convidado) com a partida rolando: a pessoa chega espectando e escolhe se joga. */
  override get joinableInPlay(): boolean {
    return true;
  }

  override join(id: string, username: string) {
    const existing = this.members.get(id);
    if (existing) {
      existing.connected = true;
      existing.username = username;
      this.ensureHost();
      this.dirty = true;
      return;
    }
    if (this.phase === 'lobby' && this.members.size >= PLAYERS_MAX) throw new RoomError('A sala está cheia');
    if (this.members.size >= FOXSHOT_ROOM_MAX) throw new RoomError('A sala está cheia');
    this.members.set(id, { id, username, connected: true, ready: false, joinedAt: this.now() });
    this.ensureHost();
    this.dirty = true;
  }

  /** Troca de time no lobby do modo Bomba: cada um troca o seu; o líder troca o de qualquer um. */
  setTeam(by: string, id: string, team: number): void {
    if (this.phase !== 'lobby') throw new RoomError('Só dá para trocar de time no lobby');
    if (by !== id) this.requireHost(by);
    if (!this.members.has(id)) return;
    if (team !== 0 && team !== 1) return;
    this.teamPref.set(id, team);
    this.dirty = true;
  }

  /** Quem está espectando pede para jogar (toma o lugar de um bot ou ganha uma raposa nova). */
  joinPlay(id: string): void {
    const m = this.members.get(id);
    if (!m || !this.sim || (this.phase !== 'play' && this.phase !== 'show')) return;
    if (!this.sim.joinAs(id, m.username)) throw new RoomError('A partida já tem 10 jogadores. Siga espectando.');
    this.dirty = true;
  }

  protected override pausable(): boolean {
    return false;
  }

  override start(id: string) {
    this.requireHost(id);
    this.requirePhase('lobby');
    const humans = [...this.members.values()].filter((m) => m.connected);
    if (humans.length < 1) throw new RoomError('Falta gente na sala');
    if (this.cfg.kind === 'none') throw new RoomError('Escolha o modo de jogo na aba Modo');
    if (humans.length + this.botTotal() < 2) throw new RoomError('Coloque ao menos 1 bot ou chame um amigo');
    if (humans.some((m) => m.id !== this.hostId && !m.ready && !this.committed.has(m.id))) throw new RoomError('Falta gente marcar "pronto"');
    this.committed.clear();
    this.rematchVotes.clear();
    this.seed = this.newSeed();
    this.rounds = [];
    this.roundIndex = -1;
    this.beginRound();
  }

  protected override beginRound() {
    this.roundIndex = 0;
    this.rounds[0] = {};
    const humans = [...this.members.values()].filter((m) => m.connected).sort((a, b) => a.joinedAt - b.joinedAt);
    const cfg = fsMatchConfig(this.cfg.minutes, 1);
    const bomb = this.cfg.kind === 'bomb';
    // sem escolha, equilibra: quem ainda não escolheu entra no time com menos gente
    const count: [number, number] = [0, 0];
    for (const m of humans) {
      const t = this.teamPref.get(m.id);
      if (t !== undefined) count[t]++;
    }
    const teamOf = (id: string): 0 | 1 => {
      const t = this.teamPref.get(id);
      if (t !== undefined) return t;
      const pick = count[0] <= count[1] ? 0 : 1;
      count[pick]++;
      return pick;
    };
    this.sim = new FsNetSim({
      minutes: cfg.minutes,
      humans: humans.map((m) => ({ id: m.id, name: m.username, team: bomb ? teamOf(m.id) : undefined })),
      bots: Math.min(this.botTotal(), 10 - humans.length),
      botTeams: bomb ? [this.cfg.botsCt, this.cfg.botsTr] : undefined,
      bomb: bomb ? { winRounds: this.cfg.winRounds, roundSec: this.cfg.roundSec } : undefined,
    });
    this.startAt = this.now() + FOXSHOT_COUNTDOWN_MS;
    this.overAt = 0;
    this.phase = 'show';
    this.phaseEndsAt = this.startAt;
  }

  protected override maybeAdvanceFromPick() {}

  protected override toReveal() {
    this.phase = 'final';
    this.phaseEndsAt = null;
  }

  protected override reset() {
    super.reset();
    this.sim = null;
  }

  override disconnect(id: string) {
    super.disconnect(id);
    if (this.phase === 'play') this.sim?.takeOver(id);
  }

  override leave(id: string) {
    if (this.phase === 'play' || this.phase === 'show') this.sim?.takeOver(id);
    super.leave(id);
  }

  /** Entradas de uma pessoa (um pacote traz as últimas). Só vale com a partida rolando. */
  receive(id: string, raw: unknown): void {
    if (this.phase !== 'play' || !this.sim) return;
    const list = Array.isArray(raw) ? raw.slice(0, 8) : [raw];
    for (const r of list) {
      const inp = fsNetParseInput(r);
      if (inp) this.sim.pushInput(id, inp);
    }
  }

  override tick(): boolean {
    const t = this.now();
    if (this.phase === 'show') {
      if (t < this.startAt) return false;
      this.phase = 'play';
      this.phaseEndsAt = null;
      this.startAt = t;
      return true;
    }
    if (this.phase !== 'play' || !this.sim) return false;
    const want = Math.floor((t - this.startAt) / STEP_MS);
    let n = 0;
    while (this.sim.tick < want && n++ < MAX_CATCHUP && !this.sim.over) this.sim.step();
    // se atrasou demais, descarta o atraso (não corre atrás do tempo perdido)
    if (this.sim.tick < want - 30) this.startAt = t - this.sim.tick * STEP_MS;
    if (this.sim.over) {
      if (this.overAt === 0) this.overAt = t;
      if (t - this.overAt >= OVER_MS) {
        this.phase = 'final';
        this.phaseEndsAt = null;
        return true;
      }
    }
    const d = this.dirty;
    this.dirty = false;
    return d;
  }

  /** Eventos acumulados e quadros (o `FoxShotRoom` transmite). */
  drainEvents(): FsNetEvent[] {
    return this.sim?.drainEvents() ?? [];
  }
  frameFor(id: string) {
    if (!this.sim) return null;
    return { f: this.sim.frame(), s: this.sim.selfState(id) };
  }

  override finalRows(): FinalRow[] {
    if (!this.sim) return [];
    return this.sim.results().map((r) => ({
      userId: r.id,
      username: r.name,
      totalTenths: r.points * 10,
      placement: r.place,
      answers: [],
    }));
  }

  protected override extraSnapshot(): Record<string, unknown> {
    const s = this.sim;
    return {
      foxshot: {
        minutes: this.cfg.minutes,
        bots: this.cfg.bots,
        botsCt: this.cfg.botsCt,
        botsTr: this.cfg.botsTr,
        kind: this.cfg.kind,
        winRounds: this.cfg.winRounds,
        roundSec: this.cfg.roundSec,
        teams: Object.fromEntries(this.teamPref),
        startAt: this.phase === 'lobby' ? null : this.startAt,
        roster: s ? s.roster : null,
        hz: FS_NET_HZ,
        over: s?.over ?? false,
        score: s ? s.results().map((r) => ({ id: r.id, name: r.name, points: r.points, kills: r.kills, assists: r.assists, deaths: r.deaths })) : null,
      },
    };
  }
}

export { RoomError };
