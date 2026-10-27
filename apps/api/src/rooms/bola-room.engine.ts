import {
  BOL_MAX_PLAYERS,
  BOL_ROOM_MAX,
  BOL_TEAM_COLORS,
  BOL_TEAM_NAMES,
  BolaMatch,
  BolaMatchError,
  bolPlacements,
  bolSuggestFormat,
  type BolInfo,
  type BolWorld,
} from '@nocap/games';
import { ColorRoomEngine, RoomError, type EngineOptions, type FinalRow } from './color-room.engine';

/** Quanto tempo (ms) os aparelhos têm para conectar ao do líder antes de a partida cair no servidor. */
const P2P_WINDOW_MS = 7000;

export interface BolaFormatState {
  teams: number;
  perTeam: number;
  /** O formato acompanha a quantidade de pessoas até o líder escolher um. */
  auto: boolean;
  /** Duração da partida (min). */
  minutes: number;
}

/**
 * O Fut Fox em sala (spec 046, fase 2). Diferente do Desmorona!, aqui o SERVIDOR simula tudo (bola, raposas e
 * gols) a 60 passos por segundo e manda o estado a cada tick: cada aparelho só envia a entrada (direção e pulos) e
 * desenha o que recebe. Sem ranking nem histórico. A sala aceita até 15 pessoas; até 12 jogam (3x3x3x3) e o resto
 * assiste. Times vazios podem ser completados com bots, e quem sai no meio deixa um bot no lugar.
 */
export class BolaRoomEngine extends ColorRoomEngine {
  override readonly game = 'bola' as const;
  override readonly persistable = false;
  protected override readonly minPlayers = 1;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['classico'];

  private format: BolaFormatState = {
    teams: 2,
    perTeam: 1,
    auto: true,
    minutes: 3,
  };
  /** Time de cada pessoa; quem não está aqui é espectador. */
  private teamOf = new Map<string, number>();
  /** Quem escolheu ser espectador (não entra em time sozinho). */
  private chose = new Set<string>();
  /** Bots pedidos pelo líder por time (só vale no lobby). */
  private bots: number[] = [0, 0, 0, 0];
  /** A partida em andamento (o mundo, as entradas, os bots e o fluxo). Só existe de `play` até o fim. */
  private match: BolaMatch | null = null;
  private dirty = false;
  /**
   * Quem simula a partida (spec 048): `pending` = aparelhos tentando conectar ao do líder; `p2p` = o aparelho do líder
   * simula e o servidor só espera o resultado; `server` = o servidor simula (reserva, e o jeito antigo).
   */
  /** Liga a partida ponto a ponto (a sala de verdade liga; os testes do motor ficam no jeito do servidor). */
  p2pEnabled = false;
  private net: 'server' | 'pending' | 'p2p' = 'server';
  /** O aparelho que simula no modo ponto a ponto (o líder no começo da partida). */
  private p2pHost = '';
  /** Pedidos de troca de time para o líder aplicar na partida dele (esvaziado por `drainP2pOut`). */
  private switchOut: { id: string; name: string; team: number; bot: string | null }[] = [];
  /** Respostas de erro para quem pediu a troca. */
  private noticeOut: { to: string; message: string }[] = [];
  private p2pDeadline = 0;
  private p2pOk = new Set<string>();
  private p2pFinal: { scores: number[]; winner: number } | null = null;
  /** O que o aparelho do líder precisa para montar a mesma partida. */
  private p2pSetup: {
    teams: number;
    perTeam: number;
    durationSec: number;
    seed: string;
    humans: { id: string; name: string; team: number }[];
    bots: number[];
    away: string[];
  } | null = null;

  private get world(): BolWorld | null {
    return this.match?.world ?? null;
  }

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: BOL_ROOM_MAX });
    this.mode = 'classico';
    this.settings = { rounds: 1 };
  }

  protected override validSettings(_merged: Record<string, unknown>, mode: string): boolean {
    return mode === 'classico';
  }

  protected override maybeAdvanceFromPick() {}

  protected override toReveal() {
    this.finalize();
  }

  /** Vindo de outro jogo (sala do Fox Cap!, spec 049): leva as pessoas e já as distribui nos times. */
  override adoptFrom(other: ColorRoomEngine) {
    super.adoptFrom(other);
    this.refresh();
  }

  // ---- pessoas ----

  override join(id: string, username: string) {
    const existing = this.members.get(id);
    if (existing) {
      existing.connected = true;
      existing.username = username;
      this.match?.setAway(id, false);
      this.ensureHost();
      this.dirty = true;
      return;
    }
    // Entrar no meio da partida é permitido: a pessoa chega como espectador e pode pedir um lugar.
    if (this.members.size >= this.maxPlayers) throw new RoomError('A sala está cheia');
    this.members.set(id, { id, username, connected: true, ready: false, joinedAt: this.now() });
    this.ensureHost();
    if (this.phase === 'lobby') this.refresh();
    this.dirty = true;
  }

  override disconnect(id: string) {
    super.disconnect(id);
    this.hostGone(id);
    this.match?.setAway(id, true);
    if (this.phase === 'lobby') this.refresh();
    this.dirty = true;
  }

  override leave(id: string) {
    this.hostGone(id);
    this.match?.toBot(id);
    this.teamOf.delete(id);
    this.chose.delete(id);
    super.leave(id);
    if (this.phase === 'lobby') this.refresh();
    this.dirty = true;
  }

  /** Quem simula saiu: antes de começar vale o servidor; no meio da partida ela termina (o estado estava só com ele). */
  private hostGone(id: string) {
    if (id !== this.p2pHost) return;
    if (this.net === 'pending') this.toServerMode();
    else if (this.net === 'p2p' && this.phase === 'play') {
      this.p2pFinal = {
        scores: Array.from({ length: this.format.teams }, () => 0),
        winner: -1,
      };
      this.finalize();
    }
  }

  // ---- times e formato (lobby) ----

  private humansIn(team: number): number {
    let n = 0;
    for (const t of this.teamOf.values()) if (t === team) n++;
    return n;
  }

  private connectedHumans(): number {
    return [...this.members.values()].filter((m) => m.connected).length;
  }

  /** Ajusta times e bots ao formato: quem não cabe vira espectador (os últimos a entrar saem primeiro). */
  private fit() {
    const { teams, perTeam } = this.format;
    const order = [...this.members.values()].sort((a, b) => b.joinedAt - a.joinedAt);
    for (const m of order) {
      const t = this.teamOf.get(m.id);
      if (t !== undefined && t >= teams) this.teamOf.delete(m.id);
    }
    for (let t = 0; t < teams; t++) {
      let over = this.humansIn(t) - perTeam;
      for (const m of order) {
        if (over <= 0) break;
        if (this.teamOf.get(m.id) === t) {
          this.teamOf.delete(m.id);
          over--;
        }
      }
    }
    for (let t = 0; t < this.bots.length; t++) {
      this.bots[t] =
        t < teams ? Math.max(0, Math.min(this.bots[t] ?? 0, perTeam - this.humansIn(t))) : 0;
    }
  }

  /** Quem ainda não tem time (e não escolheu assistir) entra no time com mais vaga. */
  private autoPlace() {
    const { teams, perTeam } = this.format;
    const order = [...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    for (const m of order) {
      if (this.teamOf.has(m.id) || this.chose.has(m.id)) continue;
      let best = -1;
      for (let t = 0; t < teams; t++) {
        if (this.humansIn(t) >= perTeam) continue;
        if (best < 0 || this.humansIn(t) < this.humansIn(best)) best = t;
      }
      if (best >= 0) {
        this.teamOf.set(m.id, best);
        this.bots[best] = Math.max(
          0,
          Math.min(this.bots[best] ?? 0, perTeam - this.humansIn(best)),
        );
      }
    }
  }

  /** Recalcula o formato sugerido (se automático), os times e os bots. */
  private refresh() {
    if (this.format.auto) {
      const f = bolSuggestFormat(Math.min(this.connectedHumans(), BOL_MAX_PLAYERS));
      this.format.teams = f.teams;
      this.format.perTeam = f.perTeam;
    }
    this.fit();
    this.autoPlace();
  }

  get suggestedFormat() {
    return bolSuggestFormat(Math.min(this.connectedHumans(), BOL_MAX_PLAYERS));
  }

  /** O líder escolhe o formato (ou volta ao automático) e a duração. */
  setFormat(
    id: string,
    v: { teams?: unknown; perTeam?: unknown; auto?: unknown; minutes?: unknown },
  ) {
    this.requireHost(id);
    this.requirePhase('lobby');
    if (v.minutes !== undefined) {
      if (!Number.isInteger(v.minutes) || (v.minutes as number) < 1 || (v.minutes as number) > 30) {
        throw new RoomError('A duração vai de 1 a 30 minutos');
      }
      this.format.minutes = v.minutes as number;
    }
    if (v.auto === true) this.format.auto = true;
    if (v.teams !== undefined || v.perTeam !== undefined) {
      const teams = v.teams === undefined ? this.format.teams : v.teams;
      const perTeam = v.perTeam === undefined ? this.format.perTeam : v.perTeam;
      if (!Number.isInteger(teams) || (teams as number) < 2 || (teams as number) > 4)
        throw new RoomError('São de 2 a 4 times');
      if (!Number.isInteger(perTeam) || (perTeam as number) < 1 || (perTeam as number) > 3)
        throw new RoomError('São de 1 a 3 raposas por time');
      if ((teams as number) * (perTeam as number) > BOL_MAX_PLAYERS)
        throw new RoomError('Esse formato passa de 12 jogadores');
      this.format.teams = teams as number;
      this.format.perTeam = perTeam as number;
      this.format.auto = false;
    }
    // quem estava em time por causa do formato antigo é redistribuído; as escolhas de espectador ficam
    this.refresh();
    for (const m of this.members.values()) m.ready = false;
    this.dirty = true;
  }

  /** O líder completa um time com bots (ou tira). */
  setBots(id: string, team: unknown, delta: unknown) {
    this.requireHost(id);
    this.requirePhase('lobby');
    if (!Number.isInteger(team) || (team as number) < 0 || (team as number) >= this.format.teams) {
      throw new RoomError('Esse time não existe neste formato');
    }
    if (delta !== 1 && delta !== -1) throw new RoomError('Pedido inválido');
    const t = team as number;
    const next = (this.bots[t] ?? 0) + (delta as number);
    if (next < 0) return;
    if (next + this.humansIn(t) > this.format.perTeam)
      throw new RoomError(`O time ${BOL_TEAM_NAMES[t]} já está cheio`);
    this.bots[t] = next;
    this.dirty = true;
  }

  /** Entra num time (ou vira espectador com -1). No meio da partida assume o lugar de um bot ou ocupa uma vaga livre. */
  setTeam(id: string, team: unknown, botId?: unknown) {
    this.requirePhase('lobby', 'play');
    const m = this.members.get(id);
    if (!m) throw new RoomError('Você não está na sala');
    if (this.phase === 'play' && this.net === 'pending') {
      throw new RoomError('A partida está conectando: tente de novo em alguns segundos');
    }
    if (!Number.isInteger(team) || (team as number) < -1 || (team as number) >= this.format.teams) {
      throw new RoomError('Esse time não existe neste formato');
    }
    const to = team as number;
    const cur = this.teamOf.get(id) ?? -1;
    if (this.phase === 'play' && this.net === 'p2p') {
      // quem simula é o aparelho do líder: o pedido vai para ele, que decide (time cheio, bot que já saiu) e responde
      if (cur === to) return;
      this.switchOut.push({
        id,
        name: m.username,
        team: to,
        bot: typeof botId === 'string' ? botId : null,
      });
      return;
    }
    if (cur === to) {
      // quem já está de fora e pede para assistir não volta a ser colocado num time sozinho
      if (to < 0) this.chose.add(id);
      return;
    }
    if (this.world) {
      this.moveLive(id, to, typeof botId === 'string' ? botId : null);
    } else {
      if (to >= 0 && this.humansIn(to) >= this.format.perTeam) {
        throw new RoomError(`O time ${BOL_TEAM_NAMES[to]} está cheio`);
      }
      if (to >= 0) {
        this.teamOf.set(id, to);
        this.chose.delete(id);
        this.bots[to] = Math.max(
          0,
          Math.min(this.bots[to] ?? 0, this.format.perTeam - this.humansIn(to)),
        );
      } else {
        this.teamOf.delete(id);
        this.chose.add(id);
      }
      m.ready = false;
    }
    this.dirty = true;
  }

  // ---- começar ----

  override start(id: string) {
    this.requireHost(id);
    this.requirePhase('lobby');
    const { teams } = this.format;
    for (let t = 0; t < teams; t++) {
      const present =
        [...this.teamOf].filter(([uid, tt]) => tt === t && this.members.get(uid)?.connected)
          .length + (this.bots[t] ?? 0);
      if (present === 0) throw new RoomError(`Falta jogador no time ${BOL_TEAM_NAMES[t]}`);
    }
    const waiting = [...this.teamOf.keys()].filter((uid) => {
      const m = this.members.get(uid);
      return m?.connected && uid !== this.hostId && !m.ready && !this.committed.has(uid);
    });
    if (waiting.length > 0) throw new RoomError('Falta gente marcar "pronto"');
    this.committed.clear();
    this.rematchVotes.clear();
    this.seed = this.newSeed();
    this.rounds = [];
    this.roundIndex = -1;
    this.beginRound();
  }

  protected override beginRound() {
    const { teams, perTeam, minutes } = this.format;
    this.roundIndex = 0;
    this.rounds[0] = {};
    const humans: BolInfo[] = [];
    const away: string[] = [];
    const ordered = [...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    for (let t = 0; t < teams; t++) {
      for (const m of ordered) {
        if (this.teamOf.get(m.id) !== t) continue;
        humans.push({ id: m.id, name: m.username, color: BOL_TEAM_COLORS[t] as number, team: t });
        if (!m.connected) away.push(m.id);
      }
    }
    this.match = new BolaMatch({
      teams,
      perTeam,
      durationSec: minutes * 60,
      seed: this.seed,
      humans,
      bots: this.bots,
      away,
      now: () => this.now(),
    });
    this.phase = 'play';
    this.phaseEndsAt = null;
    this.dirty = true;
    this.beginNet(humans, away);
  }

  /** Decide quem simula: ponto a ponto no aparelho do líder, se todos conectarem a ele; senão o servidor. */
  private beginNet(humans: BolInfo[], away: string[]) {
    const { teams, perTeam, minutes } = this.format;
    this.p2pFinal = null;
    this.p2pOk.clear();
    this.p2pHost = this.hostId ?? '';
    this.p2pSetup = {
      teams,
      perTeam,
      durationSec: minutes * 60,
      seed: this.seed,
      humans: humans.map((h) => ({ id: h.id, name: h.name, team: h.team })),
      bots: this.bots.slice(0, teams),
      away,
    };
    const host = this.members.get(this.p2pHost);
    if (!this.p2pEnabled || !host?.connected) {
      this.net = 'server';
      return;
    }
    this.net = 'pending';
    this.p2pDeadline = this.now() + P2P_WINDOW_MS;
  }

  /** Quem precisa conectar ao aparelho do líder: todo mundo que está na sala agora, menos ele. */
  private p2pPeers(): string[] {
    return [...this.members.values()]
      .filter((m) => m.connected && m.id !== this.p2pHost)
      .map((m) => m.id);
  }

  /** Um aparelho avisa que conectou ao líder (`ok`) ou que não conseguiu. */
  p2pReport(id: string, ok: unknown) {
    if (this.net !== 'pending' || !this.members.has(id)) return;
    if (ok === true) this.p2pOk.add(id);
    else this.toServerMode();
    this.dirty = true;
  }

  /** O líder respondeu a um pedido de troca de time: vale (ou volta o erro para quem pediu). */
  p2pSwitched(hostId: string, v: { id?: unknown; team?: unknown; ok?: unknown; error?: unknown }) {
    if (this.net !== 'p2p' || hostId !== this.p2pHost || typeof v.id !== 'string') return;
    if (!this.members.has(v.id)) return;
    if (v.ok === true && Number.isInteger(v.team)) {
      const to = v.team as number;
      if (to < 0) {
        this.teamOf.delete(v.id);
        this.chose.add(v.id);
      } else if (to < this.format.teams) {
        this.teamOf.set(v.id, to);
        this.chose.delete(v.id);
      }
      this.dirty = true;
    } else if (typeof v.error === 'string') {
      this.noticeOut.push({ to: v.id, message: v.error.slice(0, 200) });
    }
  }

  /** Pedidos para o líder e avisos para quem pediu (a sala entrega e esvazia). */
  drainP2pOut() {
    const out = { host: this.p2pHost, switches: this.switchOut, notices: this.noticeOut };
    this.switchOut = [];
    this.noticeOut = [];
    return out;
  }

  /** O líder manda o resultado da partida que ele simulou. */
  p2pResult(id: string, v: { scores?: unknown; winner?: unknown }) {
    if (this.net !== 'p2p' || id !== this.p2pHost || this.phase !== 'play') return;
    const teams = this.format.teams;
    const scores = Array.isArray(v.scores) ? v.scores.slice(0, teams) : [];
    if (
      scores.length !== teams ||
      !scores.every((n) => Number.isInteger(n) && n > -1000 && n < 1000)
    ) {
      return;
    }
    const winner =
      Number.isInteger(v.winner) && (v.winner as number) < teams ? (v.winner as number) : -1;
    this.p2pFinal = { scores: scores as number[], winner };
    this.finalize();
  }

  /** Volta ao jeito antigo: o servidor simula (alguém não conseguiu conectar, ou o líder sumiu na conexão). */
  private toServerMode() {
    if (this.net === 'server') return;
    this.net = 'server';
    this.dirty = true;
  }

  /** Só diz que o servidor está simulando (o quadro `bs` sai da sala). */
  get serverSimulates(): boolean {
    return this.net === 'server';
  }

  // ---- durante a partida ----

  /** A entrada da própria raposa: [mx, mz, contador de pulos, número de sequência]. Inválido é ignorado. */
  input(id: string, v: unknown): void {
    this.match?.input(id, v);
  }

  /** Troca de time no meio da partida: o corpo antigo vira bot; no time novo, assume um bot ou ocupa uma vaga livre. */
  private moveLive(id: string, to: number, botId: string | null) {
    const m = this.members.get(id) as { username: string };
    try {
      (this.match as BolaMatch).switchTeam(id, m.username, to, botId);
    } catch (e) {
      if (e instanceof BolaMatchError) throw new RoomError(e.message);
      throw e;
    }
    if (to < 0) {
      this.teamOf.delete(id);
      this.chose.add(id);
      return;
    }
    this.teamOf.set(id, to);
    this.chose.delete(id);
  }

  /** O líder encerra a partida com o placar de agora. */
  endNow(id: string) {
    this.requireHost(id);
    this.requirePhase('play');
    this.match?.endNow();
    this.dirty = true;
  }

  override tick(): boolean {
    const m = this.match;
    if (this.phase === 'play' && this.net === 'pending') {
      const peers = this.p2pPeers();
      if (peers.every((id) => this.p2pOk.has(id))) {
        this.net = 'p2p';
        this.dirty = true;
      } else if (this.now() >= this.p2pDeadline) this.toServerMode();
    }
    if (this.phase === 'play' && m && this.net === 'server') {
      m.tick();
      if (m.over) this.finalize();
    }
    const changed = this.dirty || (m?.takeDirty() ?? false);
    this.dirty = false;
    return changed;
  }

  private finalize() {
    if (this.phase === 'final') return;
    this.phase = 'final';
    this.phaseEndsAt = null;
    this.match?.wantStats();
    this.dirty = true;
  }

  protected override reset() {
    super.reset();
    this.match = null;
    this.net = 'server';
    this.p2pSetup = null;
    this.p2pFinal = null;
    this.p2pOk.clear();
    this.switchOut = [];
    this.noticeOut = [];
    // os times ficam como estavam, mas quem saiu da sala já foi tirado em `leave`
    this.refresh();
  }

  // ---- o que vai para os aparelhos ----

  /** O quadro do fluxo (a cada tick): bola, corpos, placar, relógio e os eventos desde o último. */
  drainFrame(): Record<string, unknown> | null {
    if (this.net !== 'server') return null;
    return this.match?.drainFrame(this.phase === 'play') ?? null;
  }

  /** Colocação por time (empate divide a posição). Só vale em `final`. */
  override finalRows(): FinalRow[] {
    const f = this.p2pFinal;
    if (f && this.p2pSetup) {
      // partida simulada no aparelho do líder: o placar veio dele
      const place = bolPlacements(f.scores);
      return this.p2pSetup.humans.map((h) => ({
        userId: h.id,
        username: h.name,
        totalTenths: (f.scores[h.team] ?? 0) * 10,
        placement: place.get(h.team) ?? 1,
        answers: [],
      }));
    }
    const m = this.match;
    if (!m) return [];
    const w = m.world;
    const place = m.placements();
    return w.players
      .filter((p) => !p.bot)
      .map((p) => ({
        userId: p.id,
        username: p.name,
        totalTenths: (w.scores[p.team] ?? 0) * 10,
        placement: place.get(p.team) ?? 1,
        answers: [],
      }));
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    const w = this.world;
    const members = Object.fromEntries(this.teamOf);
    return {
      bola: {
        me: viewerId ?? null,
        format: { ...this.format },
        suggested: this.suggestedFormat,
        teamOf: members,
        bots: this.bots.slice(0, this.format.teams),
        roster: this.match ? this.match.roster() : [],
        scores: this.p2pFinal ? this.p2pFinal.scores : w ? w.scores : [],
        winner:
          this.phase !== 'final'
            ? null
            : this.p2pFinal
              ? this.p2pFinal.winner
              : w
                ? w.winner
                : null,
        durationSec: this.format.minutes * 60,
        /** Quem simula a partida: o servidor, o aparelho do líder, ou "pending" enquanto os aparelhos conectam. */
        net: this.phase === 'lobby' ? 'server' : this.net,
        p2pHost: this.net === 'server' ? null : this.p2pHost,
        setup: this.net === 'server' ? null : this.p2pSetup,
      },
    };
  }
}

export { RoomError };
